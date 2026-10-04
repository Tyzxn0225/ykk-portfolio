/**
 * 检查导航栏在滚动过程中的固定与磨砂表现。
 *
 *   node scripts/check-nav.mjs --url http://127.0.0.1:5273/ --out shots
 *
 * 会在 0 / 300 / 1200 / 5000 四个位置各截一张图，
 * 并打印导航栏的 class、backdrop-filter、背景与位置，确认它真的固定住了。
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}

const URL_ = arg('url', 'http://127.0.0.1:5273/')
const OUT = path.resolve(arg('out', 'shots'))
const PORT = Number(arg('port', 9342))
const POSITIONS = arg('at', '0,300,1200,3200,5000,6600,8100,9200').split(',').map(Number)

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  await mkdir(OUT, { recursive: true })
  const userDataDir = path.join(os.tmpdir(), `dsh-nav-${Date.now()}`)
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1920,1080',
      '--hide-scrollbars',
      '--disable-gpu',
      '--autoplay-policy=no-user-gesture-required',
      '--no-first-run',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let ws
  let id = 0
  const pending = new Map()

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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await send('Page.navigate', { url: URL_ })
    await sleep(3500)

    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description }
      return r.result?.value
    }

    for (const y of POSITIONS) {
      await evaluate(`window.scrollTo({ top: ${y}, behavior: 'instant' })`)
      await sleep(900)

      const info = await evaluate(`(() => {
        const el = document.querySelector('.nav');
        if (!el) return { missing: true };
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          scrollY: Math.round(window.scrollY),
          classes: el.className,
          position: cs.position,
          top: +r.top.toFixed(1),
          height: +r.height.toFixed(1),
          background: cs.backgroundColor,
          backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
          borderBottom: cs.borderBottomColor,
          zIndex: cs.zIndex,
        };
      })()`)
      console.log(`\n--- scrollY = ${y} ---`)
      console.log(JSON.stringify(info, null, 2))

      // captureScreenshot 的 clip 是相对「页面」而不是视口，
      // 所以这里要加上当前的滚动距离，才能真正截到固定导航栏。
      const scrollY = info.scrollY ?? y
      const res = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: scrollY, width: 1920, height: 260, scale: 1 },
      })

      // 顺带看一下导航栏背后到底是什么内容，以及它有几分「透」
      const behind = await evaluate(`(() => {
        const el = document.elementFromPoint(window.innerWidth * 0.5, 130);
        const box = el ? el.getBoundingClientRect() : null;
        return {
          tag: el ? el.tagName : null,
          cls: el ? String(el.className).slice(0, 60) : null,
          rect: box ? { y: +box.y.toFixed(0), h: +box.height.toFixed(0) } : null,
        };
      })()`)
      if (behind) console.log('  nav 下方内容:', JSON.stringify(behind))
      const name = `nav-y${y}.png`
      await writeFile(path.join(OUT, name), Buffer.from(res.data, 'base64'))
      console.log('saved', name)
    }
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
