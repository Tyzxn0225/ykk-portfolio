/**
 * 把页面滚到指定元素，然后截当前视口。
 *
 * 为什么需要它：整页长截图（captureBeyondViewport）会绕过滚动，
 * 于是 position: sticky / 视口相关的布局不会按真实滚动状态渲染，
 * 容易得出错误结论。要看某一段到底长什么样，必须真的滚过去再截。
 *
 *   node scripts/shot-at.mjs --url http://127.0.0.1:5274/ --sel ".contact" --out shots/mobile/contact.png
 */
import { spawn } from 'node:child_process'
import { rm, mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const URL_ = arg('url', 'http://127.0.0.1:5274/')
const SEL = arg('sel', '.contact')
const OUT = arg('out', 'shots/at.png')
const W = Number(arg('width', 390))
const H = Number(arg('height', 844))
const PORT = Number(arg('port', 9400))

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const dir = await mkdtemp(join(tmpdir(), 'at-'))
  const child = spawn(
    CHROME,
    ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`,
     '--hide-scrollbars', '--disable-gpu', 'about:blank'],
    { stdio: 'ignore' },
  )
  let ws
  let id = 0
  const pending = new Map()
  try {
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break } catch { /* retry */ }
      await sleep(250)
    }
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(t.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', rej, { once: true })
    })
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id)
        pending.delete(m.id)
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result)
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
      width: W, height: H, deviceScaleFactor: 2, mobile: true,
    })
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    await send('Page.navigate', { url: URL_ })
    await sleep(2500)

    // 先整页滚一遍触发 reveal，再滚回目标元素
    await send('Runtime.evaluate', {
      expression: `(async()=>{const s=Math.round(innerHeight*0.8);const e=document.documentElement.scrollHeight;for(let y=0;y<e;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,110))}})()`,
      awaitPromise: true,
    })
    await sleep(400)

    const info = await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(SEL)});
        if (!el) return { error: 'not found' };
        const b = el.getBoundingClientRect();
        const top = Math.round(b.top + scrollY);
        scrollTo(0, top);
        return { top, h: Math.round(b.height), absTop: top };
      })()`,
      returnByValue: true,
    })
    await sleep(900)

    const shot = await send('Page.captureScreenshot', { format: 'png' })
    await mkdir(dirname(OUT), { recursive: true })
    await writeFile(OUT, Buffer.from(shot.data, 'base64'))
    console.log(JSON.stringify(info.result.value), '->', OUT)
  } finally {
    try { ws?.close() } catch { /* noop */ }
    child.kill()
    await sleep(300)
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
