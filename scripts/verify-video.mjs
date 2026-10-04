/**
 * 验证首页视频背景是否真的在播放（而不是悄悄回退到了静态图）。
 *
 *   node scripts/verify-video.mjs --url http://127.0.0.1:5273/ --out shots
 *
 * 检查项：
 *   1. <video> 是否用到了 hero.mp4
 *   2. readyState / videoWidth / duration 是否正常
 *   3. currentTime 是否在推进（真的在播）
 *   4. 是否触发了 media error
 *   5. 静态回退层是否已经淡出（说明视频接管了背景）
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
const WIDTH = Number(arg('width', 1920))
const HEIGHT = Number(arg('height', 1080))
const PORT = Number(arg('port', 9336))

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  await mkdir(OUT, { recursive: true })
  const userDataDir = path.join(os.tmpdir(), `dsh-vid-${Date.now()}`)
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${WIDTH},${HEIGHT}`,
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
  const mediaRequests = []

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
      if (msg.method === 'Network.responseReceived') {
        const r = msg.params.response
        if (/\.(mp4|webm)/i.test(r.url)) {
          mediaRequests.push({ status: r.status, url: r.url, mime: r.mimeType, fromCache: r.fromDiskCache })
        }
      }
      if (msg.method === 'Network.loadingFailed' && /\.(mp4|webm)/i.test(msg.params.errorText || '')) {
        mediaRequests.push({ status: 'FAILED', url: msg.params.errorText })
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

    // 记录页面侧的 media 事件
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__mediaLog = [];
        document.addEventListener('DOMContentLoaded', () => {
          const v = document.querySelector('video.hero__video');
          if (!v) { window.__mediaLog.push('NO_VIDEO_ELEMENT'); return; }
          ['loadstart','loadedmetadata','loadeddata','canplay','playing','stalled','suspend','waiting','error','emptied']
            .forEach(ev => v.addEventListener(ev, () => {
              window.__mediaLog.push(ev + '@' + Date.now() + (v.error ? ' err=' + v.error.code + ':' + v.error.message : ''));
            }));
        });
      `,
    })

    await send('Page.navigate', { url: URL_ })
    await sleep(3500)

    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description }
      return r.result?.value
    }

    const snap = async (label) => {
      const v = await evaluate(`(() => {
        const el = document.querySelector('video.hero__video');
        if (!el) return { missing: true };
        const still = document.querySelector('.hero__still');
        const cs = still ? getComputedStyle(still) : null;
        return {
          currentSrc: el.currentSrc,
          src: el.getAttribute('src') || [...el.querySelectorAll('source')].map(s => s.getAttribute('src')),
          readyState: el.readyState,
          networkState: el.networkState,
          videoWidth: el.videoWidth,
          videoHeight: el.videoHeight,
          duration: el.duration,
          currentTime: el.currentTime,
          paused: el.paused,
          muted: el.muted,
          loop: el.loop,
          autoplay: el.autoplay,
          error: el.error ? { code: el.error.code, message: el.error.message } : null,
          hasReadyClass: el.classList.contains('is-ready'),
          stillOpacity: cs ? cs.opacity : null,
          stillHidden: still ? still.classList.contains('is-hidden') : null,
          log: window.__mediaLog || [],
        };
      })()`)
      console.log(`\n--- ${label} ---`)
      console.log(JSON.stringify(v, null, 2))
      return v
    }

    const first = await snap('3.5s 后')
    await sleep(2500)
    const second = await snap('6s 后')

    // 截图看实际画面
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    await writeFile(path.join(OUT, 'hero-video.png'), Buffer.from(shot.data, 'base64'))
    console.log('\n截图已保存: shots/hero-video.png')

    console.log('\n=== 网络请求 ===')
    console.log(mediaRequests.length ? JSON.stringify(mediaRequests, null, 2) : '(页面没有发起视频请求)')

    console.log('\n=== 结论 ===')
    const playing = second && !second.missing && second.currentTime > first.currentTime
    const ok = playing && second.videoWidth > 0 && !second.error
    console.log(`视频元素存在      : ${!second.missing}`)
    console.log(`解码出画面尺寸    : ${second.videoWidth}x${second.videoHeight}`)
    console.log(`时间在推进        : ${playing} (${first.currentTime?.toFixed(2)} → ${second.currentTime?.toFixed(2)})`)
    console.log(`有 media 错误     : ${Boolean(second.error)}`)
    console.log(`静态回退层已隐藏  : ${second.stillHidden}`)
    console.log(`\n>>> ${ok ? '✅ 视频背景正常工作' : '❌ 视频没有正常播放，仍在用静态图'}`)
    if (!ok) process.exitCode = 1
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
