/**
 * 首屏加载体检：统计首屏实际请求了多少字节、哪些资源最大、LCP 与长任务。
 *
 *   node scripts/audit-firstload.mjs --url http://127.0.0.1:5273/
 *
 * 只看「首屏」：不滚动、不等懒加载，度量真实的首屏代价。
 */
import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}

const URL_ = arg('url', 'http://127.0.0.1:5273/')
const PORT = Number(arg('port', 9350))
const WAIT = Number(arg('wait', '6000'))

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const userDataDir = path.join(os.tmpdir(), `dsh-audit-${Date.now()}`)
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
  const requests = new Map()
  const longTasks = []

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
        return
      }
      if (msg.method === 'Network.responseReceived') {
        const { requestId, response, type } = msg.params
        if (response.fromDiskCache || response.fromServiceWorker) return
        requests.set(requestId, {
          url: response.url,
          type,
          mime: response.mimeType,
          status: response.status,
          size: 0,
        })
      }
      if (msg.method === 'Network.loadingFinished') {
        const r = requests.get(msg.params.requestId)
        if (r) r.size = msg.params.encodedDataLength
      }
      if (msg.method === 'Performance.entryAdded') {
        const e2 = msg.params.entry
        if (e2.entryType === 'longtask') longTasks.push(Math.round(e2.duration))
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
    await send('Performance.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    })

    await send('Page.navigate', { url: URL_ })
    await sleep(WAIT)

    const metrics = await send('Performance.getMetrics')
    const m = Object.fromEntries(metrics.metrics.map((x) => [x.name, x.value]))

    const list = [...requests.values()].filter((r) => r.size > 0)
    const total = list.reduce((a, b) => a + b.size, 0)

    const byType = {}
    for (const r of list) {
      byType[r.type] = byType[r.type] || { n: 0, size: 0 }
      byType[r.type].n += 1
      byType[r.type].size += r.size
    }

    console.log('=== 首屏请求汇总（不滚动） ===')
    console.log(`请求数 ${list.length}   总计 ${(total / 1024 / 1024).toFixed(2)} MB\n`)
    console.log('按类型:')
    Object.entries(byType)
      .sort((a, b) => b[1].size - a[1].size)
      .forEach(([k, v]) => {
        console.log(`  ${k.padEnd(12)} ${String(v.n).padStart(3)} 个  ${(v.size / 1024).toFixed(0).padStart(6)} KB`)
      })

    console.log('\n最大的 15 个请求:')
    list
      .sort((a, b) => b.size - a.size)
      .slice(0, 15)
      .forEach((r) => {
        console.log(`  ${(r.size / 1024).toFixed(0).padStart(6)} KB  ${r.type.padEnd(10)} ${r.url.replace(URL_.replace(/\/$/, ''), '')}`)
      })

    console.log('\n=== 运行时指标 ===')
    const nav = await send('Runtime.evaluate', {
      expression: `(() => {
        const n = performance.getEntriesByType('navigation')[0] || {};
        const paints = {};
        performance.getEntriesByType('paint').forEach(p => { paints[p.name] = Math.round(p.startTime); });
        const lcp = performance.getEntriesByType('largest-contentful-paint');
        const lcpLast = lcp.length ? Math.round(lcp[lcp.length-1].startTime) : null;
        const resources = performance.getEntriesByType('resource');
        const video = resources.filter(r => /\\.(mp4|webm)/.test(r.name));
        const img = resources.filter(r => r.initiatorType === 'img' || /\\.(webp|jpg|png)/.test(r.name));
        return {
          domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0),
          loadEvent: Math.round(n.loadEventEnd || 0),
          firstPaint: paints['first-paint'] ?? null,
          firstContentfulPaint: paints['first-contentful-paint'] ?? null,
          lcp: lcpLast,
          videoBytes: video.reduce((a,b)=>a+(b.transferSize||b.encodedBodySize||0),0),
          videoCount: video.length,
          imageBytes: img.reduce((a,b)=>a+(b.transferSize||b.encodedBodySize||0),0),
          imageCount: img.length,
        };
      })()`,
      returnByValue: true,
    })
    console.log(JSON.stringify(nav.result.value, null, 2))

    console.log('\n长任务(>50ms):', longTasks.length ? longTasks.join(', ') + ' ms' : '无')
    console.log(`JS 堆大小: ${(m.JSHeapUsedSize / 1024 / 1024).toFixed(1)} MB`)
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
