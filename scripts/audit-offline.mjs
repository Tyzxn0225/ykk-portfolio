/**
 * 离线体检：把除本地回环外的所有网络请求拦掉，再看页面能否正常渲染。
 *
 * 用途：确认站点不依赖任何外部 CDN / 字体 / 接口，
 * 断网或内网环境下也能完整打开。
 *
 *   node scripts/audit-offline.mjs --url http://127.0.0.1:5274/
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
const PORT = Number(arg('port', 9410))
const W = Number(arg('width', 1920))
const H = Number(arg('height', 1080))

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const dir = await mkdtemp(join(tmpdir(), 'offline-'))
  const child = spawn(
    CHROME,
    ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`,
     '--hide-scrollbars', '--disable-gpu', 'about:blank'],
    { stdio: 'ignore' },
  )
  let ws
  let id = 0
  const pending = new Map()
  const blocked = []
  const failed = []

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
    ws.addEventListener('message', async (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id)
        pending.delete(m.id)
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result)
        return
      }
      // 拦截所有非本机的请求 —— 模拟断网
      if (m.method === 'Fetch.requestPaused') {
        const url = m.params.request.url
        const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/)/.test(url) || url.startsWith('data:')
        const mid = ++id
        ws.send(JSON.stringify({
          id: mid,
          method: isLocal ? 'Fetch.continueRequest' : 'Fetch.failRequest',
          params: isLocal ? { requestId: m.params.requestId } : { requestId: m.params.requestId, errorReason: 'InternetDisconnected' },
        }))
        if (!isLocal) blocked.push(url)
      }
      if (m.method === 'Network.loadingFailed') failed.push(m.params.errorText)
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
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })

    await send('Page.navigate', { url: URL_ })
    await sleep(5000)

    const probe = await send('Runtime.evaluate', {
      expression: `(() => {
        const imgs = [...document.images];
        const v = document.querySelector('.hero__video');
        return {
          title: document.title,
          h1: (document.querySelector('h1') || {}).textContent || '',
          sections: document.querySelectorAll('section').length,
          images: imgs.length,
          brokenImages: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
          videoPresent: !!v,
          videoReadyState: v ? v.readyState : -1,
          videoError: v && v.error ? v.error.code : null,
          fonts: [...document.fonts].length,
          fontStatus: document.fonts.status,
          docHeight: document.documentElement.scrollHeight,
        };
      })()`,
      returnByValue: true,
    })

    console.log('=== 断网（仅允许 127.0.0.1）下的渲染结果 ===')
    console.log(JSON.stringify(probe.result.value, null, 2))
    console.log(`\n被拦截的外部请求: ${blocked.length} 个`)
    blocked.slice(0, 10).forEach((u) => console.log('  ' + u))
    if (!blocked.length) console.log('  （没有发起任何外部请求）')
  } finally {
    try { ws?.close() } catch { /* noop */ }
    child.kill()
    await sleep(300)
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
