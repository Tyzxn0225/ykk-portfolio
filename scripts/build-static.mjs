/**
 * 构建「可直接拖拽部署」的静态站点。
 *
 * 用途：给 Vercel / Netlify 的拖拽上传准备一份产物。
 * 这两个平台把站点放在根域名下，所以 base 必须是 '/'，
 * 否则资源会 404（本地预览正常、线上白屏）。
 *
 * 产物写到 dist/，与 `pnpm build` 一致，
 * 但会额外打印文件数、体积和要拖拽的目录，避免拖错层级。
 *
 *   node scripts/build-static.mjs
 */
import { build } from 'vite'
import { readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

async function walk(dir) {
  let files = 0
  let bytes = 0
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      const sub = await walk(p)
      files += sub.files
      bytes += sub.bytes
    } else {
      files += 1
      bytes += (await stat(p)).size
    }
  }
  return { files, bytes }
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`

async function main() {
  // 确保走根路径
  delete process.env.VITE_BASE

  console.log('构建静态站点（base = "/"，适用于 Vercel / Netlify 拖拽部署）\n')
  await build({ root: ROOT, logLevel: 'info' })

  const dist = join(ROOT, 'dist')
  const { files, bytes } = await walk(dist)

  console.log('\n' + '='.repeat(56))
  console.log('  可以拖拽部署了')
  console.log('='.repeat(56))
  console.log(`  目录   : ${dist}`)
  console.log(`  文件   : ${files} 个`)
  console.log(`  体积   : ${mb(bytes)}`)
  console.log('')
  console.log('  Vercel  → 打开 vercel.com/new，把上面这个 dist 文件夹整')
  console.log('            个拖进去（拖「文件夹」，不是里面的文件）')
  console.log('  Netlify → 打开 app.netlify.com/drop，同样拖 dist 文件夹')
  console.log('')
  console.log('  ⚠ 不要拖项目根目录：那是源码，这两个平台会当作')
  console.log('    需要构建的工程处理，而本项目没有给它们配构建命令。')
  console.log('')
  console.log('  部署后建议自测：首屏视频能否播放、点开一张项目图看灯箱。')
  console.log('='.repeat(56))
}

main().catch((e) => {
  console.error('构建失败:', e.message)
  process.exit(1)
})
