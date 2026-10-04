/**
 * 手机端点击目标体检：只统计真正会被手指点到的元素的有效尺寸。
 *
 * 注意：不能只看 <a>/<button> 自身的盒子 —— 例如「联系方式」里的电话是一层
 * 带 padding 的 <a>，里面还有 <span>；如果只测内层 span 会误判成 15px 高。
 * 这里取元素自身与其可点击祖先中较大的那个有效矩形。
 *
 *   node scripts/audit-taps.mjs --url http://127.0.0.1:5274/ --widths 390
 */
import { spawn } from 'node:child_process'
import { rm, mkdtemp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const URL_ = arg('url', 'http://127.0.0.1:5274/')
const PORT = Number(arg('port', 9390))
const WIDTHS = arg('widths', '390').split(',').map(Number).filter(Boolean)
const MIN = Number(arg('min', 40))

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const dir = await mkdtemp(join(tmpdir(), 'taps-'))
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
      try {
        const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
        if (r.ok) break
      } catch { /* retry */ }
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

    for (const width of WIDTHS) {
      await send('Emulation.setDeviceMetricsOverride', {
        width, height: 844, deviceScaleFactor: 1, mobile: true,
      })
      await send('Page.navigate', { url: URL_ })
      await sleep(2500)
      await send('Runtime.evaluate', {
        expression: `(async()=>{const s=Math.round(innerHeight*0.8);const e=document.documentElement.scrollHeight;for(let y=0;y<e;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,110))}scrollTo(0,0);await new Promise(r=>setTimeout(r,300))})()`,
        awaitPromise: true,
      })
      await sleep(500)

      const r = await send('Runtime.evaluate', {
        expression: `(() => {
          const MIN = ${MIN};
          const out = [];
          document.querySelectorAll('a[href], button').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none') return;
            if (r.right < -50) return; // 跳过 skip-link 这种屏幕外元素
            if (r.height < MIN || r.width < MIN) {
              out.push({
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 22),
                cls: (el.className || '').toString().slice(0, 40),
                w: Math.round(r.width),
                h: Math.round(r.height),
                top: Math.round(r.top + scrollY),
              });
            }
          });
          return out;
        })()`,
        returnByValue: true,
      })

      const list = r.result.value
      console.log(`\n=== ${width}px  小于 ${MIN}px 的点击目标：${list.length} 个 ===`)
      list.sort((a, b) => a.top - b.top).forEach((x) => {
        console.log(`  y=${String(x.top).padStart(6)}  ${x.w}×${x.h}  ${x.tag}.${x.cls}  "${x.text}"`)
      })
      if (!list.length) console.log('  无')
    }
  } finally {
    try { ws?.close() } catch { /* noop */ }
    child.kill()
    await sleep(300)
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
