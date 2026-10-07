/**
 * GitHub Pages 专用构建：base 设为 /<仓库名>/。
 *
 * 为什么单独一个脚本：Windows PowerShell 写不了 `VITE_BASE=x vite build`
 * 这种内联环境变量赋值，用 JS 设 process.env 才是跨平台的。
 *
 *   node scripts/build-pages.mjs
 */
import { build } from 'vite'
import { resolve } from 'node:path'
import { PAGES_BASE, REPO_NAME } from './site-config.mjs'

const ROOT = resolve(import.meta.dirname, '..')

async function main() {
  process.env.VITE_BASE = PAGES_BASE

  console.log(`构建 GitHub Pages 版本（base = "${PAGES_BASE}"）`)
  console.log(`仓库名取自 scripts/site-config.mjs → REPO_NAME = "${REPO_NAME}"\n`)

  await build({ root: ROOT, logLevel: 'info' })

  console.log('\n' + '='.repeat(56))
  console.log(`  线上地址：https://<你的用户名>.github.io/${REPO_NAME}/`)
  console.log('  注意：base 带子路径，这份 dist/ 直接开本地文件是打不开的，')
  console.log('        用 pnpm preview 验证。')
  console.log('='.repeat(56))
}

main().catch((e) => {
  console.error('构建失败:', e.message)
  process.exit(1)
})
