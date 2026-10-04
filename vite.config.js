import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

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
 * GitHub Pages 的 project 站点部署在 /<仓库名>/ 子路径下，
 * 这时所有资源都必须带这个前缀，否则线上白屏（本地却完全正常，很难查）。
 *
 * 本地开发与预览用 '/'，只有生产构建才切到子路径：
 * 这样 `pnpm dev` 仍是最简单的 http://127.0.0.1:5273/，
 * 而 `pnpm build` 产出的 dist/ 可以直接交给 GitHub Pages。
 * `vite preview` 也按生产 base 提供文件，所以本地就能验证子路径下的表现。
 *
 * 换仓库名 → 只改这一行。
 */
const REPO_NAME = 'wyk-portfolio'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? `/${REPO_NAME}/` : '/',
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
