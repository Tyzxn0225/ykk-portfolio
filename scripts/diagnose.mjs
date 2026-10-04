/**
 * 页面自检：读取所有 <img> 的加载状态、控制台错误、布局越界。
 *   node scripts/diagnose.mjs --url http://127.0.0.1:5273/ --width 1920 --height 1080
 */
import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const argv = process.argv.slice(2)
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def
}

const URL_ = arg('url', 'http://127.0.0.1:5273/')
const WIDTH = Number(arg('width', 1920))
const HEIGHT = Number(arg('height', 1080))
const PORT = Number(arg('port', 9334))

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const userDataDir = path.join(os.tmpdir(), `dsh-diag-${Date.now()}`)
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-first-run',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let id = 0
  const pending = new Map()
  const consoleErrors = []
  const failedRequests = []
  let ws

  try {
    let info
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
        if (r.ok) {
          info = await r.json()
          break
        }
      } catch {
        /* retry */
      }
      await sleep(250)
    }
    if (!info) throw new Error('DevTools 未就绪')

    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(t.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', rej, { once: true })
    })

    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)
        pending.delete(msg.id)
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
        return
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push('EXCEPTION: ' + (msg.params.exceptionDetails?.exception?.description || ''))
      }
      if (msg.method === 'Network.loadingFailed') {
        failedRequests.push(`${msg.params.type} ${msg.params.errorText} blocked=${msg.params.blockedReason || '-'}`)
      }
      if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
        failedRequests.push(`HTTP ${msg.params.response.status} ${msg.params.response.url}`)
      }
    })

    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const mid = ++id
        pending.set(mid, { resolve, reject })
        ws.send(JSON.stringify({ id: mid, method, params }))
      })

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await send('Page.navigate', { url: URL_ })
    await sleep(3000)

    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description }
      return r.result?.value
    }

    // 滚动全部，触发懒加载
    const h = await evaluate('document.documentElement.scrollHeight')
    for (let y = 0; y < h; y += HEIGHT) {
      await evaluate(`window.scrollTo(0, ${y})`)
      await sleep(400)
    }
    await evaluate('window.scrollTo(0, 0)')
    await sleep(2500)

    const report = await evaluate(`(() => {
      const imgs = [...document.images].map(img => ({
        src: img.currentSrc || img.src,
        alt: img.alt,
        natural: img.naturalWidth + 'x' + img.naturalHeight,
        complete: img.complete,
        w: Math.round(img.getBoundingClientRect().width),
        h: Math.round(img.getBoundingClientRect().height),
        cls: img.className,
        parent: img.parentElement?.parentElement?.className || img.parentElement?.className || '',
        html: img.outerHTML.slice(0, 260),
      }));
      const overflow = [...document.querySelectorAll('*')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > window.innerWidth + 2 || r.left < -2);
      }).slice(0, 12).map(el => el.className || el.tagName);
      const pics = [...document.querySelectorAll('picture')].slice(0,2).map(p => ({
        sources: [...p.querySelectorAll('source')].map(s => s.srcset),
        imgSrc: p.querySelector('img')?.getAttribute('src'),
        currentSrc: p.querySelector('img')?.currentSrc,
      }));
      return { imgs, overflow, pics, docH: document.documentElement.scrollHeight, winW: window.innerWidth };
    })()`)

    console.log('=== PAGE ===')
    console.log('doc height', report.docH, '| viewport width', report.winW)
    console.log('\n=== PICTURE SAMPLE ===')
    console.log(JSON.stringify(report.pics, null, 2))

    console.log('\n=== IMAGES ===', report.imgs.length)
    const broken = report.imgs.filter((i) => !i.complete || i.natural.startsWith('0x'))
    report.imgs.forEach((i) => {
      const flag = !i.complete || i.natural.startsWith('0x') ? 'BROKEN' : 'ok    '
      console.log(`${flag} ${String(i.natural).padEnd(11)} box ${i.w}x${i.h}  ${i.src}`)
    })

    if (broken.length) {
      console.log('\n=== BROKEN DETAIL ===')
      broken.forEach((b) => {
        console.log(`\ncls: ${b.cls}\nparent: ${b.parent}\nalt: ${b.alt}\nhtml: ${b.html}`)
      })
    }

    console.log('\n=== BROKEN COUNT ===', broken.length)

    console.log('\n=== HORIZONTAL OVERFLOW CANDIDATES ===')
    console.log(report.overflow.length ? report.overflow.join('\n') : '(none)')

    console.log('\n=== CONSOLE ERRORS ===')
    console.log(consoleErrors.length ? [...new Set(consoleErrors)].join('\n') : '(none)')

    console.log('\n=== FAILED REQUESTS ===')
    console.log(failedRequests.length ? [...new Set(failedRequests)].join('\n') : '(none)')
  } finally {
    try {
      ws?.close()
    } catch {
      /* noop */
    }
    child.kill()
    await sleep(300)
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
