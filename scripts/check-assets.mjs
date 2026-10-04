/**
 * 资源自检：检查 public/assets 下，代码里引用到的图片尺寸是否都存在。
 *
 *   node scripts/check-assets.mjs
 *
 * 覆盖两部分：
 *   1. src/ 里字面量写的 <Pic src="..." widths={[...]} />
 *   2. src/data/content.js 里由变量引用的图片（项目的 cover / images）
 *
 * 约定：不带 widths 的图片按 DEFAULT_WIDTHS 校验；
 * 需要别的档位时，在该条数据里显式加 `widths: [900, 1800]`。
 * 退出码非 0 表示有缺失，适合放进构建流程。
 */
import { readFile, readdir, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const ASSETS = path.join(ROOT, 'public', 'assets')
const CONTENT = path.join(SRC, 'data', 'content.js')

/** 普通项目图的默认档位，与 scripts/process-images.py 里的 PROJ 对应 */
const DEFAULT_WIDTHS = [800, 1600, 2000]
/** 「其他课程设计」小卡片封面的档位，与 process-images.py 里的 AUX 对应 */
const AUX_WIDTHS = [400, 800, 1200]
const EXTS = ['webp', 'jpg']

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) out.push(full)
  }
  return out
}

const exists = async (p) => {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

/** 从 `widths={[...]}` / `widths: [...]` 里取档位。
 *  用 (?<![A-Za-z]) 防止误匹配到 coverWidths —— 否则封面会按错误的档位校验。 */
function parseWidths(text) {
  if (!text) return null
  const m = text.match(/(?<![A-Za-z])widths\s*[:=]\s*\{?\s*\[([^\]]*)\]/)
  if (!m) return null
  const list = m[1]
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
  return list.length ? list : null
}

async function main() {
  const missing = []
  const seen = new Set()
  let checked = 0

  const record = async (src, widths, origin) => {
    for (const w of widths) {
      for (const ext of EXTS) {
        const key = `${src}-${w}.${ext}`
        if (seen.has(key)) continue
        seen.add(key)
        checked += 1
        const p = path.join(ASSETS, key)
        if (!(await exists(p))) missing.push({ file: path.relative(ROOT, p), origin })
      }
    }
  }

  // ---- 1. src 里字面量写法的 <Pic src="..." widths={[...]} /> ----
  for (const file of await walk(SRC)) {
    const code = await readFile(file, 'utf8')
    const tagRe = /<Pic\b[\s\S]*?\/>/g
    let m
    while ((m = tagRe.exec(code))) {
      const tag = m[0]
      const srcM = tag.match(/src=(?:"([^"]+)"|\{([^}]+)\})/)
      if (!srcM) continue
      const raw = (srcM[1] || srcM[2] || '').trim()
      // 变量形式的引用交给下面 data/content.js 的扫描处理
      if (!/^['"][^'"]+['"]$/.test(raw) && !/^[a-z0-9/_-]+$/i.test(raw)) continue
      const src = raw.replace(/^['"]|['"]$/g, '')
      const widths = parseWidths(tag) || DEFAULT_WIDTHS
      await record(src, widths, path.relative(ROOT, file))
    }
  }

  // 组件里以 `project.cover` 形式引用的兜底档位（data 里没写 coverWidths 时生效）
  const worksCode = await readFile(path.join(SRC, 'components', 'Works.jsx'), 'utf8')
  const fallbackM = worksCode.match(/MORE_COVER_WIDTHS\s*=\s*\[([^\]]*)\]/)
  const MORE_FALLBACK = fallbackM
    ? fallbackM[1]
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    : [800, 1600]

  // ---- 2. data/content.js 里以变量引用的封面与图集 ----
  // 关键：要区分「精选项目」与「其他课程设计」两段 —— 前者的封面是灯箱里的大图（PROJ 档位），
  // 后者是小卡片封面（AUX 档位）。混在一起校验会大量误报。
  const dataCode = await readFile(CONTENT, 'utf8')
  const moreAt = dataCode.indexOf('export const moreProjects')
  const featuredPart = moreAt >= 0 ? dataCode.slice(0, moreAt) : dataCode
  const morePart = moreAt >= 0 ? dataCode.slice(moreAt) : ''

  const collect = (text) => {
    const out = new Set()
    let d
    const srcRe = /(?:cover|src)\s*:\s*'([^']+)'/g
    const refRe = /'((?:hero|projects|misc|portrait)\/[a-z0-9-]+)'/g
    while ((d = srcRe.exec(text))) out.add(d[1])
    while ((d = refRe.exec(text))) out.add(d[1])
    return out
  }

  /** 单张图的自定义档位（`{ src: '...', widths: [...] }`）；只保留真正声明了 widths 的项 */
  const widthsIn = (text) => {
    const map = new Map()
    const re = /\{[^{}]*src:\s*'([^']+)'[^{}]*\}/g
    let m
    while ((m = re.exec(text))) {
      const w = parseWidths(m[0])
      if (w) map.set(m[1], w)
    }
    return map
  }

  /** 封面的自定义档位（`coverWidths: [...]`） */
  const coverWidthsIn = (text) => {
    const map = new Map()
    const re = /cover:\s*'([^']+)'[\s\S]{0,160}?coverWidths:\s*\[([^\]]*)\]/g
    let m
    while ((m = re.exec(text))) {
      const list = m[2]
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
      if (list.length) map.set(m[1], list)
    }
    return map
  }

  const featuredRefs = collect(featuredPart)
  const moreRefs = collect(morePart)
  const featuredCustom = widthsIn(featuredPart)
  const moreCover = coverWidthsIn(morePart)
  const moreCustom = widthsIn(morePart)

  // 「其他课程设计」里，一个 src 可能同时是某些项目的封面、又是另一些项目的图集项，
  // 两种角色的档位不同（封面走 MORE_COVER_WIDTHS / coverWidths，图集走各自 widths），
  // 所以两种都要校验，不能只按其中一种。
  const moreCoverRefs = new Set()
  const moreImageRefs = new Set()
  {
    let m
    const coverRe = /cover:\s*'([^']+)'/g
    const srcRe = /src:\s*'([^']+)'/g
    while ((m = coverRe.exec(morePart))) moreCoverRefs.add(m[1])
    while ((m = srcRe.exec(morePart))) moreImageRefs.add(m[1])
    // 数组字面量写法 images: ['a', 'b'] 也当成图集项
    const arrRe = /images:\s*\[([^\]]*)\]/g
    while ((m = arrRe.exec(morePart))) {
      for (const s of m[1].matchAll(/'((?:hero|projects|misc|portrait)\/[a-z0-9-]+)'/g)) {
        moreImageRefs.add(s[1])
      }
    }
  }

  // 精选项目：封面与图集都在灯箱里放大看，统一按 PROJ 档位；写了自己的 widths 就用它
  for (const src of featuredRefs) {
    await record(src, featuredCustom.get(src) || DEFAULT_WIDTHS, 'src/data/content.js (featuredProjects)')
  }

  for (const src of moreCoverRefs) {
    if (featuredRefs.has(src)) continue
    // 封面：组件用 project.coverWidths（即该项的 coverWidths 或 widths），否则用 MORE_COVER_WIDTHS
    const coverSet = moreCover.get(src) || moreCustom.get(src) || MORE_FALLBACK
    await record(src, coverSet, 'src/data/content.js (moreProjects cover)')
  }

  for (const src of moreImageRefs) {
    if (!moreCustom.has(src)) continue
    await record(src, moreCustom.get(src), 'src/data/content.js (moreProjects images)')
  }

  console.log(`检查了 ${checked} 个资源文件引用（去重后）`)
  if (missing.length) {
    console.log(`\n缺失 ${missing.length} 个文件：`)
    missing.forEach((m) => console.log(`  ${m.file}   ← 引用自 ${m.origin}`))
    console.log('\n修复：在 scripts/process-images.py 的 PLAN 里补上对应宽度，再运行 `pnpm assets`。')
    process.exit(1)
  }
  console.log('全部存在 ✓')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
