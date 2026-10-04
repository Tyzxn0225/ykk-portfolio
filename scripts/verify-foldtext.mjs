/**
 * 验证 FoldText 的折叠动画是否真的在跑。
 *
 *   node scripts/verify-foldtext.mjs --url http://127.0.0.1:5273/ --out shots
 *
 * 做法：
 *   1. 页面加载后极短间隔内多次采样 .fold-text-piece 的 rotateX / opacity，判断是否处于「折起」状态；
 *   2. 等动画结束后再采样一次，确认已经翻开（rotateX→0、opacity→1）；
 *   3. 顺带检查无障碍结构（sr-only 文本 + aria-hidden 视觉层）。
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
const PORT = Number(arg('port', 9344))

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const PROBE = `(() => {
  const pieces = [...document.querySelectorAll('.hero__title .fold-text-piece')];
  const lines = [...document.querySelectorAll('.hero__title .fold-text-line')];
  const root = document.querySelector('.hero__title');
  const sr = document.querySelector('.hero__title .fold-text-sr-only');
  const visual = document.querySelector('.hero__title .fold-text-visual');
  const read = (el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    // 从矩阵反推 rotateX 的近似角度
    const rotX = Math.atan2(-m.m23, m.m33) * (180 / Math.PI);
    return {
      rotX: +rotX.toFixed(1),
      opacity: +Number(getComputedStyle(el).opacity).toFixed(2),
      crease: getComputedStyle(el).getPropertyValue('--fold-crease').trim(),
    };
  };
  return {
    pieceCount: pieces.length,
    lineCount: lines.length,
    tag: root ? root.tagName : null,
    lineBox: lines.map(l => {
      const b = l.getBoundingClientRect();
      return Math.round(b.width) + 'x' + Math.round(b.height);
    }),
    lineHeights: lines.map(l => getComputedStyle(l).lineHeight),
    rootLineHeight: root ? getComputedStyle(root).lineHeight : null,
    srText: sr ? sr.textContent : null,
    visualHidden: visual ? visual.getAttribute('aria-hidden') : null,
    pieces: pieces.map(read),
  };
})()`

async function main() {
  await mkdir(OUT, { recursive: true })
  const userDataDir = path.join(os.tmpdir(), `dsh-fold-${Date.now()}`)
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
  const consoleErrors = []

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
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push('EXCEPTION: ' + (msg.params.exceptionDetails?.exception?.description || ''))
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

    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description }
      return r.result?.value
    }

    // 尽早开始采样：导航之后立刻连续取几次
    await send('Page.navigate', { url: URL_ })
    const samples = []
    for (let i = 0; i < 14; i += 1) {
      const s = await evaluate(PROBE)
      if (s && !s.__error) samples.push({ t: i * 150, s })
      await sleep(150)
    }

    console.log('=== 采样（每 150ms 一次）===')
    for (const { t, s } of samples) {
      const px = s.pieces.map((p) => `${p.rotX}°/${p.opacity}`).join('  ')
      console.log(`t≈${String(t).padStart(4)}ms  pieces=${s.pieceCount}  ${px}`)
    }

    const first = samples[0]?.s
    const last = samples[samples.length - 1]?.s
    const foldedSeen = samples.some(({ s }) => s.pieces.some((p) => Math.abs(p.rotX) > 20 || p.opacity < 0.9))
    const unfoldedAtEnd = last && last.pieces.every((p) => Math.abs(p.rotX) < 1 && p.opacity > 0.99)

    console.log('\n=== 结构 ===')
    console.log(
      JSON.stringify(
        {
          tag: last?.tag,
          lineCount: last?.lineCount,
          pieceCount: last?.pieceCount,
          lineBox: last?.lineBox,
          rootLineHeight: last?.rootLineHeight,
          lineHeights: last?.lineHeights,
          srText: last?.srText,
          visualHidden: last?.visualHidden,
        },
        null,
        2,
      ),
    )

    console.log('\n=== 结论 ===')
    console.log(`捕捉到折叠中间态 : ${foldedSeen ? '是' : '否'}`)
    console.log(`结束时已完全翻开 : ${unfoldedAtEnd ? '是' : '否'}`)
    console.log(`无障碍文本       : ${last?.srText ? '有' : '缺失'}`)
    console.log(`视觉层 aria-hidden: ${last?.visualHidden}`)
    console.log(`控制台报错       : ${consoleErrors.length ? [...new Set(consoleErrors)].join(' | ') : '无'}`)

    const ok = last?.pieceCount > 0 && unfoldedAtEnd && !!last?.srText
    console.log(`\n>>> ${ok ? 'FoldText 正常工作' : 'FoldText 有问题，需要检查'}`)

    const res = await send('Page.captureScreenshot', { format: 'png' })
    await writeFile(path.join(OUT, 'foldtext-final.png'), Buffer.from(res.data, 'base64'))
    console.log('截图已保存: shots/foldtext-final.png')
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
