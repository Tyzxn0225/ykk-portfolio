/**
 * 验证精选大卡片的图注条带：点第 N 张是否打开图集里的第 N+1 张。
 *
 *   node scripts/check-feat-strip.mjs --url http://127.0.0.1:5273/ --card 0 --strip 1 --out shots/x.png
 *
 * 精选卡片的 images[0] 是主图，缩略图与条带取的是 images[1] 起，
 * 所以条带第 i 项 → 图集第 i+1 张。
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
const CARD = Number(arg('card', '0'))
const STRIP = Number(arg('strip', '1'))
const OUT = arg('out', '')
const PORT = Number(arg('port', 9349))

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  if (OUT) await mkdir(path.dirname(path.resolve(OUT)), { recursive: true })
  const userDataDir = path.join(os.tmpdir(), `dsh-strip-${Date.now()}`)
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
  const errors = []

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
      if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails?.exception?.description || 'exception')
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

    const info2 = await evaluate(`(() => {
      const card = document.querySelectorAll('.feat__card')[${CARD}];
      if (!card) return { missing: true, cards: document.querySelectorAll('.feat__card').length };
      const strips = [...card.querySelectorAll('.feat__stripItem')];
      return {
        title: card.querySelector('.feat__title')?.firstChild?.textContent?.trim(),
        stripCount: strips.length,
        stripLabels: strips.map(s => s.getAttribute('aria-label')),
      };
    })()`)
    console.log('卡片信息:', JSON.stringify(info2, null, 2))
    if (info2.missing) throw new Error('没找到卡片')

    const clicked = await evaluate(`(() => {
      const card = document.querySelectorAll('.feat__card')[${CARD}];
      const el = card.querySelectorAll('.feat__stripItem')[${STRIP}];
      if (!el) return false;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      el.click();
      return true;
    })()`)
    if (!clicked) throw new Error(`条带第 ${STRIP} 项不存在`)

    await sleep(1200)

    const state = await evaluate(`(() => {
      const lb = document.querySelector('.lb');
      if (!lb) return { open: false };
      const img = lb.querySelector('.lb__img');
      const dots = [...lb.querySelectorAll('.lb__dots button')];
      return {
        open: true,
        index: dots.findIndex(d => d.classList.contains('is-active')),
        total: dots.length,
        counter: lb.querySelector('.lb__foot .meta')?.textContent,
        caption: lb.querySelector('.lb__cap')?.textContent,
        src: img?.currentSrc?.split('/').pop(),
        natural: img ? img.naturalWidth + 'x' + img.naturalHeight : null,
        rendered: img ? Math.round(img.getBoundingClientRect().width) + 'x' + Math.round(img.getBoundingClientRect().height) : null,
      };
    })()`)
    console.log('\n灯箱状态:', JSON.stringify(state, null, 2))
    // 精选卡片：images[0] 是主图，条带取 images[1] 起，
    // 所以条带第 i 项（0 基）对应图集第 i+1 张（0 基 index = i + 1）。
    const expected = STRIP + 1
    console.log(`\n期望: 条带第 ${STRIP} 项 → 图集第 ${expected + 1} 张（index ${expected}）`)
    console.log(`实际: 第 ${state.index + 1} 张（index ${state.index}）  ${state.src}`)
    console.log(`>>> ${state.open && state.index === expected ? '正确' : '不对'}`)
    console.log(`控制台异常: ${errors.length ? errors.join(' | ') : '无'}`)

    if (OUT) {
      const res = await send('Page.captureScreenshot', { format: 'png' })
      await writeFile(path.resolve(OUT), Buffer.from(res.data, 'base64'))
      console.log('截图已保存:', OUT)
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
