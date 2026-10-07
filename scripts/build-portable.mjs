/**
 * 构建「直接双击就能看」的离线版本。
 *
 * 背景：Vite 默认产出的是绝对路径引用（`/assets/...`）。
 * 这种产物用 `file://` 打开（也就是双击 index.html）会全部 404 —— 白屏，
 * 因为 `file://` 下 `/` 指向磁盘根目录。
 *
 * 做法：先按根路径正常构建，再把产物里的引用改成相对路径
 * （`./assets/...`、`./video/...`），这样既能在本地双击打开，
 * 也能放到任意子目录的静态托管上。
 *
 * 为什么用「构建后改写」而不是 vite 的 `base: './'`：
 * 运行时的图片 URL 走 import.meta.env.BASE_URL，依赖固定 base；
 * 改成 './' 会让 srcset 在 http 场景下不太稳。改产物则互不影响。
 *
 *   node scripts/build-portable.mjs
 */
import { build } from 'vite'
import { cp, readFile, writeFile, readdir, stat, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const OUT = join(ROOT, 'dist-open')

/** 只处理这三类文件；二进制资源原样拷贝 */
const TEXT_EXT = new Set(['.html', '.js', '.css'])

/** 只改写我们自己的根路径引用，避免误伤字符串里的 / 或网址 */
const REWRITES = [
  [/(["'(])\/assets\//g, '$1./assets/'],
  [/(["'(])\/video\//g, '$1./video/'],
]

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else out.push(p)
  }
  return out
}

async function main() {
  delete process.env.VITE_BASE

  console.log('第 1 步：正常构建（base = "/"）\n')
  await build({ root: ROOT, logLevel: 'warn' })

  console.log('\n第 2 步：拷贝到 dist-open/ 并改写为相对路径')
  if (existsSync(OUT)) await rm(OUT, { recursive: true, force: true })
  await cp(DIST, OUT, { recursive: true })

  let changed = 0
  let bytes = 0
  const files = await walk(OUT)
  for (const f of files) {
    bytes += (await stat(f)).size
    if (!TEXT_EXT.has(extname(f).toLowerCase())) continue
    const src = await readFile(f, 'utf8')
    let next = src
    for (const [re, to] of REWRITES) next = next.replace(re, to)
    if (next !== src) {
      await writeFile(f, next, 'utf8')
      changed += 1
    }
  }

  const leftovers = []
  for (const f of files) {
    if (!TEXT_EXT.has(extname(f).toLowerCase())) continue
    const s = await readFile(f, 'utf8')
    if (/(["'(])\/(assets|video)\//.test(s)) leftovers.push(f.replace(ROOT + '\\', ''))
  }

  console.log(`  改写文件: ${changed} 个`)
  console.log(`  文件总数: ${files.length} 个，${(bytes / 1024 / 1024).toFixed(1)} MB`)
  if (leftovers.length) {
    console.log(`  ⚠ 仍有绝对路径残留: ${leftovers.length} 个文件`)
    leftovers.slice(0, 5).forEach((f) => console.log('    ' + f))
  } else {
    console.log('  ✓ 已无 /assets/ 或 /video/ 绝对引用')
  }

  console.log('\n' + '='.repeat(56))
  console.log('  离线版就绪')
  console.log('='.repeat(56))
  console.log(`  双击打开 : ${join(OUT, 'index.html')}`)
  console.log('             不需要联网，也不需要起服务')
  console.log('')
  console.log(`  在线部署 : 拖 dist\\ 那个目录（保持绝对路径，更适合 CDN）`)
  console.log('='.repeat(56))
}

main().catch((e) => {
  console.error('构建失败:', e.message)
  process.exit(1)
})
