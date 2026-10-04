/**
 * 把鼠标移到页面上某个元素的指定相对位置（触发 hover 态），截取整视口图。
 * 用于验证 BorderGlow 这类只在悬停时出现的特效。
 *
 *   node scripts/capture-hover.mjs --url http://127.0.0.1:5273/ \
 *        --selector ".feat__glow" --index 0 --out shots/glow.png --px 0.97 --py 0.5
 *
 * 说明：
 * - Input.dispatchMouseEvent 用的是**视口**坐标；先 scrollIntoView 再取
 *   getBoundingClientRect 才是视口坐标。
 * - 截图直接给整视口并打印元素 rect，由调用方裁切，避免 clip 算偏。
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
const OUT = arg('out', 'shots/hover.png')
const SEL = arg('selector', '.btn--glow')
const INDEX = Number(arg('index', '0'))
const PX = Number(arg('px', '0.97'))
const PY = Number(arg('py', '0.5'))
const PORT = Number(arg('port', 9347))

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  await mkdir(path.dirname(path.resolve(OUT)), { recursive: true })
  const userDataDir = path.join(os.tmpdir(), `dsh-hover-${Date.now()}`)
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
    await sleep(3800)

    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description }
      return r.result?.value
    }

    const found = await evaluate(`(() => {
      const els = document.querySelectorAll(${JSON.stringify(SEL)});
      if (!els[${INDEX}]) return { missing: true, count: els.length };
      els[${INDEX}].scrollIntoView({ block: 'center', behavior: 'instant' });
      return { ok: true, count: els.length };
    })()`)
    console.log('定位元素:', JSON.stringify(found))
    if (found.missing) throw new Error(`没找到元素（共 ${found.count} 个）`)

    await sleep(600)

    const rect = await evaluate(`(() => {
      const el = document.querySelectorAll(${JSON.stringify(SEL)})[${INDEX}];
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.left + r.width * ${PX}),
        y: Math.round(r.top + r.height * ${PY}),
        left: Math.round(r.left), top: Math.round(r.top),
        w: Math.round(r.width), h: Math.round(r.height),
      };
    })()`)
    console.log('指针（视口坐标）与元素 rect:', JSON.stringify(rect))

    for (const [dx, dy] of [[0, 0], [-1, -1], [-2, 0]]) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: rect.x + dx,
        y: rect.y + dy,
        pointerType: 'mouse',
        buttons: 0,
      })
      await sleep(140)
    }
    await sleep(700)

    const state = await evaluate(`(() => {
      const el = document.querySelectorAll(${JSON.stringify(SEL)})[${INDEX}];
      const before = getComputedStyle(el, '::before');
      return {
        edgeProximity: el.style.getPropertyValue('--edge-proximity'),
        cursorAngle: el.style.getPropertyValue('--cursor-angle'),
        beforeOpacity: before.opacity,
        className: el.className,
      };
    })()`)
    console.log('悬停状态:', JSON.stringify(state, null, 2))

    const res = await send('Page.captureScreenshot', { format: 'png' })
    await writeFile(path.resolve(OUT), Buffer.from(res.data, 'base64'))
    console.log(`截图已保存（整视口）: ${OUT}`)
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
