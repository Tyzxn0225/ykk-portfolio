/**
 * 逐个点击精选项目卡片里的每一张小图，确认都能打开灯箱、且打开的就是被点的那张。
 *
 *   node scripts/check-all-images.mjs --url http://127.0.0.1:5273/ --out shots
 *
 * 对每张精选卡片检查：
 *   - 主图（.feat__imgWrap）
 *   - 左下缩略图（.feat__thumb × N）
 *   - 图注条带（.feat__stripItem × N）
 * 每点一次就读取灯箱里的 currentSrc 和序号，跟预期对比。
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
const PORT = Number(arg('port', 9346))

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  await mkdir(OUT, { recursive: true })
  const userDataDir = path.join(os.tmpdir(), `dsh-allimg-${Date.now()}`)
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
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
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

    // 找到每张精选卡片上有多少个可点区域
    const plan = await evaluate(`(() => {
      const cards = [...document.querySelectorAll('.feat__card')];
      return cards.map((card, ci) => {
        const title = card.querySelector('.feat__title')?.firstChild?.textContent?.trim();
        return {
          cardIndex: ci,
          title,
          main: card.querySelectorAll('.feat__imgWrap').length,
          thumbs: card.querySelectorAll('.feat__thumb').length,
          strips: card.querySelectorAll('.feat__stripItem').length,
        };
      });
    })()`)
    console.log('卡片可点区域统计:')
    console.log(JSON.stringify(plan, null, 2))

    // 每张卡片逐个点击。
    // 注意预期序号：缩略图与图注条带都从 images[1] 开始（images[0] 是主图），
    // 所以第 i 个缩略图对应图集里的第 i+1 张。
    const clickCases = [
      { sel: '.feat__imgWrap', label: '主图', offset: 0 },
      { sel: '.feat__thumb', label: '缩略图', offset: 1 },
      { sel: '.feat__stripItem', label: '图注条带', offset: 1 },
    ]

    let pass = 0
    let fail = 0
    const failures = []

    for (const card of plan) {
      for (const c of clickCases) {
        const count = await evaluate(
          `document.querySelectorAll('.feat__card')[${card.cardIndex}].querySelectorAll('${c.sel}').length`,
        )
        for (let i = 0; i < count; i += 1) {
          const opened = await evaluate(`(() => {
            const card = document.querySelectorAll('.feat__card')[${card.cardIndex}];
            const el = card.querySelectorAll('${c.sel}')[${i}];
            el.scrollIntoView({ block: 'center' });
            el.click();
            return true;
          })()`)
          if (!opened) continue
          await sleep(700)

          const state = await evaluate(`(() => {
            const lb = document.querySelector('.lb');
            if (!lb) return { open: false };
            const img = lb.querySelector('.lb__img');
            const dots = [...lb.querySelectorAll('.lb__dots button')];
            const activeDot = dots.findIndex(d => d.classList.contains('is-active'));
            return {
              open: true,
              index: activeDot,
              total: dots.length,
              counter: lb.querySelector('.lb__foot .meta')?.textContent,
              src: img?.currentSrc?.split('/').pop(),
              caption: lb.querySelector('.lb__cap')?.textContent,
            };
          })()`)

          const label = `${card.title} / ${c.label}#${i}`
          const expected = i + c.offset
          const ok = state.open && state.index === expected
          if (ok) pass += 1
          else fail += 1
          if (!ok) failures.push({ label, expected, state })
          console.log(
            `${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(28)} 期望第 ${expected + 1} 张 · 实际第 ${state.index + 1}/${state.total} 张  ${state.src}`,
          )

          // 关掉灯箱
          await evaluate(`document.querySelector('.lb__backdrop')?.click()`)
          await sleep(320)
        }
      }
    }

    console.log(`\n=== 结果 ===`)
    console.log(`通过 ${pass} / 失败 ${fail}`)
    if (failures.length) {
      console.log('失败明细:')
      failures.forEach((f) => console.log('  ' + JSON.stringify(f)))
    }
    console.log(`控制台报错: ${errors.length ? [...new Set(errors)].join(' | ') : '无'}`)
    console.log(`\n>>> ${fail === 0 && errors.length === 0 ? '所有小图都能打开且对应正确' : '存在问题'}`)

    const shot = await send('Page.captureScreenshot', { format: 'png' })
    await writeFile(path.join(OUT, 'all-images-final.png'), Buffer.from(shot.data, 'base64'))
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
