/**
 * 用 Chrome DevTools Protocol 给站点截图（不依赖 puppeteer / playwright）。
 *
 *   node scripts/screenshot.mjs --url http://127.0.0.1:5273/ --out shots --width 1920 --height 1080
 *
 * 会输出：
 *   <out>/full.png           整页长图
 *   <out>/hero.png           首屏
 *   <out>/view-<n>-<id>.png  逐段截图（滚动触发入场动画后再拍）
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1]])
    return acc
  }, []),
)

const URL_ = args.url || 'http://127.0.0.1:5273/'
const OUT = path.resolve(args.out || 'shots')
const WIDTH = Number(args.width || 1920)
const HEIGHT = Number(args.height || 1080)
const SECTIONS = (args.sections || 'home,about,works,strengths,contact').split(',').filter(Boolean)
const PORT = Number(args.port || 9333)

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chromePath) {
  console.error('找不到 Chrome / Edge')
  process.exit(1)
}

const userDataDir = path.join(os.tmpdir(), `dsh-chrome-shot-${Date.now()}`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForDevtools(port, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) return await res.json()
    } catch {
      /* retry */
    }
    await sleep(250)
  }
  throw new Error('DevTools 未就绪')
}

async function main() {
  await mkdir(OUT, { recursive: true })

  const child = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-features=Translate,MediaRouter',
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  )

  const cleanup = async () => {
    try {
      child.kill()
    } catch {
      /* noop */
    }
    await sleep(200)
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }

  let ws
  let id = 0
  const pending = new Map()

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id
      pending.set(msgId, { resolve, reject })
      ws.send(JSON.stringify({ id: msgId, method, params }))
    })

  try {
    const version = await waitForDevtools(PORT)
    const targetRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const target = await targetRes.json()

    ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', reject, { once: true })
    })

    ws.addEventListener('message', (event) => {
      let msg
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error)})`))
        else resolve(msg.result)
      }
    })

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    })

    await send('Page.navigate', { url: URL_ })
    await sleep(2600)

    const shot = async (file, opts = {}) => {
      const res = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: opts.full || false,
        ...(opts.clip ? { clip: opts.clip } : {}),
        optimizeForSpeed: false,
      })
      await writeFile(path.join(OUT, file), Buffer.from(res.data, 'base64'))
      console.log('saved', file)
    }

    const evaluate = async (expression) => {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      return res.result?.value
    }

    // 首屏
    await shot('hero.png')

    // 逐段滚动，先触发所有 reveal 动画
    for (const sid of SECTIONS) {
      const ok = await evaluate(`(() => {
        const el = document.getElementById(${JSON.stringify(sid)});
        if (!el) return false;
        window.scrollTo({ top: el.offsetTop - 2, behavior: 'instant' });
        return true;
      })()`)
      if (!ok) {
        console.log('skip missing section', sid)
        continue
      }
      await sleep(1500)
      await shot(`view-${sid}.png`)
    }

    // 回到顶部，等动画完成后拍整页长图
    await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
    // 先把整页都滚一遍，确保懒加载图片与动画都触发
    const totalHeight = await evaluate(`document.documentElement.scrollHeight`)
    for (let y = 0; y < totalHeight; y += HEIGHT) {
      await evaluate(`window.scrollTo({ top: ${y}, behavior: 'instant' })`)
      await sleep(260)
    }
    await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
    await sleep(1400)

    const dims = await evaluate(
      `({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })`,
    )
    const fullHeight = Math.min(dims.h, 26000)
    console.log('page size', dims.w, 'x', dims.h)

    await shot('full.png', { full: true, clip: { x: 0, y: 0, width: WIDTH, height: fullHeight, scale: 1 } })

    // 控制台报错检查
    const errs = await evaluate(`window.__dshErrors ? window.__dshErrors : []`)
    if (errs && errs.length) console.log('page errors:', errs)
  } finally {
    try {
      ws?.close()
    } catch {
      /* noop */
    }
    await cleanup()
  }
}

main().catch(async (err) => {
  console.error('FAILED:', err.message)
  process.exit(1)
})
