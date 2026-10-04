/**
 * 抓取 FoldText 折叠动画的连续帧，用来确认折叠中间态的观感。
 *
 *   node scripts/capture-fold-frames.mjs --url http://127.0.0.1:5273/ --out shots/fold
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
const OUT = path.resolve(arg('out', 'shots/fold'))
const PORT = Number(arg('port', 9345))
const SHOTS = (arg('times', '700,850,1000,1150')).split(',').map(Number)

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  await mkdir(OUT, { recursive: true })
  const userDataDir = path.join(os.tmpdir(), `dsh-foldf-${Date.now()}`)
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

    // 用一个可暂停的 GSAP 时间轴来定格动画：注入后手动 seek，保证每次抓到的角度可控
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__foldPause = false;
        const origRAF = window.requestAnimationFrame;
      `,
    })

    await send('Page.navigate', { url: URL_ })

    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description }
      return r.result?.value
    }

    for (const at of SHOTS) {
      // 重新加载并等到目标时刻截图
      await send('Page.navigate', { url: URL_ })
      await sleep(at)
      const state = await evaluate(`(() => {
        const pieces = [...document.querySelectorAll('.hero__title .fold-text-piece')];
        return pieces.map(p => {
          const m = new DOMMatrixReadOnly(getComputedStyle(p).transform);
          const rotX = Math.atan2(-m.m23, m.m33) * (180 / Math.PI);
          return { rotX: +rotX.toFixed(1), opacity: +Number(getComputedStyle(p).opacity).toFixed(2) };
        });
      })()`)
      const res = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 60, y: 280, width: 1360, height: 420, scale: 1 },
      })
      const name = `fold-${String(at).padStart(4, '0')}ms.png`
      await writeFile(path.join(OUT, name), Buffer.from(res.data, 'base64'))
      console.log(name, JSON.stringify(state))
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
