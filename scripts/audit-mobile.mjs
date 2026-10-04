/**
 * 手机端（窄屏）体检：按真实手机视口逐个宽度排查横向溢出、破图、控制台报错，
 * 并把每个宽度的整页截图存下来。
 *
 *   node scripts/audit-mobile.mjs --url http://127.0.0.1:5274/ --out shots/mobile
 *
 * 相比 diagnose.mjs，这个脚本的重点是：
 *   1. 一次跑多个手机宽度（默认 320/360/390/414/430）
 *   2. 明确列出「哪个元素」超出了视口，以及它的宽度，便于直接定位
 *   3. 检查 tap 目标是否过小（< 40px）
 */
import { spawn } from 'node:child_process'
import { rm, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}

const URL_ = arg('url', 'http://127.0.0.1:5274/')
const OUT = arg('out', 'shots/mobile')
const PORT = Number(arg('port', 9360))
const WIDTHS = arg('widths', '320,360,390,414,430')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean)

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  await mkdir(OUT, { recursive: true })
  const userDataDir = path.join(os.tmpdir(), `dsh-mobile-${Date.now()}`)
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-first-run',
      'about:blank',
    ],
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

    const errors = []
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)
        pending.delete(msg.id)
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
        return
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        errors.push('EXCEPTION: ' + (msg.params.exceptionDetails?.text || ''))
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

    const summary = []

    for (const width of WIDTHS) {
      const height = width <= 360 ? 640 : width <= 390 ? 844 : 896
      errors.length = 0

      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 3,
        mobile: true,
      })
      await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

      await send('Page.navigate', { url: URL_ })
      await sleep(2500)

      // 先把整页滚一遍：
      //   1. 触发所有 Reveal 的 IntersectionObserver（否则没进过视口的段落
      //      还是 opacity:0，整页截图会到处是空白，量出来的是假象）
      //   2. 触发图片懒加载
      // 然后再回到顶部截图，这样看到的才是用户真实滑过一遍后的样子。
      await send('Runtime.evaluate', {
        expression: `(async () => {
          const step = Math.round(window.innerHeight * 0.8);
          const end = document.documentElement.scrollHeight;
          for (let y = 0; y < end; y += step) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 120));
          }
          window.scrollTo(0, end);
          await new Promise(r => setTimeout(r, 400));
          window.scrollTo(0, 0);
          await new Promise(r => setTimeout(r, 400));
        })()`,
        awaitPromise: true,
      })
      await sleep(600)

      const probe = await send('Runtime.evaluate', {
        expression: `(() => {
          const vw = window.innerWidth;
          const docW = document.documentElement.scrollWidth;

          // 找出所有右边界超出视口的元素
          const offenders = [];
          document.querySelectorAll('*').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            const cs = getComputedStyle(el);
            if (cs.position === 'fixed') return;
            if (r.right > vw + 1 || r.left < -1) {
              offenders.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className && el.className.toString().slice(0, 60)) || '',
                left: Math.round(r.left),
                right: Math.round(r.right),
                width: Math.round(r.width),
              });
            }
          });

          // 去重后按超出量排序
          const seen = new Set();
          const uniq = offenders.filter(o => {
            const k = o.tag + '|' + o.cls;
            if (seen.has(k)) return false;
            seen.add(k); return true;
          }).sort((a,b) => (b.right - vw) - (a.right - vw)).slice(0, 12);

          // 过小的点击目标
          const smallTaps = [];
          document.querySelectorAll('a, button').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            if (r.height < 40 || r.width < 40) {
              smallTaps.push({
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || '').trim().slice(0, 18),
                w: Math.round(r.width), h: Math.round(r.height),
              });
            }
          });

          const imgs = [...document.images];
          return {
            vw,
            docW,
            overflow: docW - vw,
            offenders: uniq,
            smallTapCount: smallTaps.length,
            smallTaps: smallTaps.slice(0, 8),
            images: imgs.length,
            brokenImages: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
            videoVisible: (() => {
              const v = document.querySelector('.hero__video');
              if (!v) return 'none';
              const cs = getComputedStyle(v);
              return cs.display !== 'none' && cs.visibility !== 'hidden' ? 'yes' : 'hidden';
            })(),
            heroHeight: (() => {
              const h = document.querySelector('.hero');
              return h ? Math.round(h.getBoundingClientRect().height) : null;
            })(),
          };
        })()`,
        returnByValue: true,
      })

      const r = probe.result.value

      // 整页截图。
      // 注意 cssContentSize 是 CSS 像素，而截图 clip 期望的是「设备像素」——
      // 之前直接把 CSS 高度丢进去，在 deviceScaleFactor=3 下得到 3 倍高的图
      // （390px 的页面被截成 45099px），看起来像页面出了大问题。
      const dsf = 3
      const metrics = await send('Page.getLayoutMetrics')
      const fullH = Math.min(Math.round(metrics.cssContentSize.height), 20000)
      const shot = await send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 72,
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height: fullH, scale: 1 / dsf },
      })
      await writeFile(path.join(OUT, `${width}.jpg`), Buffer.from(shot.data, 'base64'))

      summary.push({ width, height, ...r, errors: [...errors] })

      console.log(`\n=== ${width} × ${height} ===`)
      console.log(`  文档宽度 ${r.docW} / 视口 ${r.vw}  →  横向溢出 ${r.overflow > 0 ? '★ ' + r.overflow + 'px' : '无'}`)
      console.log(`  图片 ${r.images} 张，破图 ${r.brokenImages} 张`)
      console.log(`  首屏高度 ${r.heroHeight}px，视频 ${r.videoVisible}`)
      if (r.offenders.length) {
        console.log('  超出视口的元素:')
        r.offenders.forEach((o) => {
          console.log(`    ${o.tag}.${o.cls}  left=${o.left} right=${o.right} w=${o.width}`)
        })
      }
      if (r.smallTapCount) {
        console.log(`  偏小的点击目标 ${r.smallTapCount} 个（前几个）:`)
        r.smallTaps.forEach((s) => console.log(`    ${s.tag} "${s.text}" ${s.w}×${s.h}`))
      }
      if (errors.length) {
        console.log('  控制台报错:')
        errors.slice(0, 5).forEach((e) => console.log('    ' + e))
      }
    }

    await writeFile(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')
    console.log(`\n截图与汇总已写入 ${OUT}/`)
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
