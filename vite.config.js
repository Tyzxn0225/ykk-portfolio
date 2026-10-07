import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { PAGES_BASE } from './scripts/site-config.mjs'

// 某些编辑器（含 DSH 的文件写入实现）会在源码目录里生成
// `.<name>.<pid>.<uuid>.tmpdir/` 临时目录。Windows 上这些文件随时可能被
// 独占锁定，chokidar 一旦去 watch 就会抛 EBUSY 并**直接搞崩整个 dev server**。
// 所以这里显式把这类临时产物排除在文件监听之外。
const TMP_ARTIFACTS = [
  '**/.*.tmpdir/**',
  '**/*.tmpdir/**',
  '**/.*.tmp',
  '**/*.tmp',
  '**/*~',
  '**/.DS_Store',
  '**/Thumbs.db',
]

/**
 * 开发期的组件试验台：访问 /__probe/<name>.html 会把 public/_probe/<name>.html
 * 原样返回，页面里可以 import 单个组件单独验证，不受整站样式干扰。
 * 只在 dev server 生效（apply: 'serve'），生产构建不会带上。
 */
function probePages() {
  const dir = fileURLToPath(new URL('./public/_probe/', import.meta.url))

  return {
    name: 'probe-pages',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url && req.url.match(/^\/__probe\/([\w-]+)\.html(\?.*)?$/)
        if (!m) return next()
        try {
          const html = readFileSync(join(dir, `${m[1]}.html`), 'utf8')
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        } catch {
          res.statusCode = 404
          res.end('probe not found')
        }
      })
    },
  }
}

/**
 * 资源基路径（base）—— 这是部署时最容易踩的坑：
 * 路径前缀不对时**本地完全正常、线上白屏**，很难查。
 *
 * 本项目要同时支持两种托管方式，而它们要求的 base 不同：
 *
 *   Vercel / Netlify（根域名，拖拽部署）
 *     → base 必须是 '/'，资源引用为 /assets/...
 *
 *   GitHub Pages（project 站点在 /<仓库名>/ 子路径）
 *     → base 必须是 '/<仓库名>/'，否则 404
 *
 * 所以这里按构建方式切换，默认走根路径（Vercel / Netlify 拖拽即用的场景）：
 *
 *   pnpm build         → base '/'
 *   pnpm build:pages   → base PAGES_BASE（GitHub Pages）
 *   pnpm dev           → base '/'
 *
 * 换 GitHub 仓库名 → 只改 scripts/site-config.mjs 里的 REPO_NAME。
 */
export default defineConfig(({ mode }) => ({
  // 默认 '/'（Vercel / Netlify 直接拖拽 dist 即可）。
  // GitHub Pages 走 `pnpm build:pages`，那个脚本会设 VITE_BASE。
  // 也允许直接 `VITE_BASE=/xxx/ pnpm build` 手动覆盖。
  base: process.env.VITE_BASE || '/',
  plugins: [react(), probePages()],
  server: {
    port: 5273,
    strictPort: true,
    // 默认监听所有网卡，手机才能通过局域网 IP 打开。
    // 原来写死 '127.0.0.1'，只有本机能访问 —— 这正是手机打不开的原因。
    // 只在本机开发时若不想暴露到局域网，用 HOST=127.0.0.1 pnpm dev。
    host: process.env.HOST || '0.0.0.0',
    watch: {
      ignored: TMP_ARTIFACTS,
    },
  },
  preview: {
    port: 5274,
    strictPort: true,
    // 同上：preview 默认也只绑 localhost
    host: process.env.HOST || '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 2048,
  },
}))
