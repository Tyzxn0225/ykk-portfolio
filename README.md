# 王云康 · 建筑设计作品集网站

React 19 + Vite 7 实现的个人作品集站点。明亮系、克制、带技术图纸质感的视觉方向，PC 端优先，版心 **1700px**，同时对手机端做了适配。

> 性能审查与优化记录见 [PERFORMANCE.md](./PERFORMANCE.md)（首屏传输量 5.11 MB → 0.34 MB）。

---

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 启动开发预览（监听所有网卡，手机也能开）
pnpm dev

# 3. 构建 + 本地预览
pnpm build                                        # 根路径产物（Vercel / Netlify）
node node_modules/vite/bin/vite.js preview --port 5274 --strictPort

# 只想本机访问（不暴露到局域网）时：
pnpm dev:local
```

---

## 部署

同一个代码库同时支持三种托管方式。**关键差别只有一处：资源基路径（base）。**
base 不对时的表现很坑 —— **本地预览完全正常，线上白屏**。

| 方式 | 构建命令 | base | 说明 |
| --- | --- | --- | --- |
| **Vercel / Netlify（拖拽）** | `pnpm build` | `/` | 站点在根域名下 |
| **GitHub Pages** | `pnpm build:pages` | `/wyk-portfolio/` | project 站点在子路径下 |
| 本地开发 | `pnpm dev` | `/` | |

仓库名只在 `scripts/site-config.mjs` 里定义一次。

### 方式一：Vercel / Netlify 拖拽部署（最快）

```bash
pnpm build
```

然后把 **`dist` 文件夹整个**拖进去：

- **Vercel** → https://vercel.com/new
- **Netlify** → https://app.netlify.com/drop

> **拖的是 `dist` 目录本身，不是它里面的文件，也不是项目根目录。**
> 拖项目根目录会失败：那两个平台会把它当"需要构建的源码工程"处理，
> 而本项目没有为它们配置构建命令。
>
> 产物约 50 MB（42 MB 图片 + 8.6 MB 视频），首次上传会慢一点；
> 之后由 Vercel/Netlify 的 CDN 接管。
>
> 拖拽部署不读 `vercel.json` / `netlify.toml`，所以本项目也不需要这两个文件。
> 单页站点没有客户端路由，因此不需要 SPA rewrite 规则。

### 方式二：GitHub Pages（自动）

```bash
git remote add origin https://github.com/<你的用户名>/wyk-portfolio.git
git push -u origin main
```

推送后到仓库 **Settings → Pages → Source 选 "GitHub Actions"**。
`.github/workflows/deploy-pages.yml` 会自动跑 `pnpm build:pages` 并发布。

线上地址：`https://<你的用户名>.github.io/wyk-portfolio/`

### 部署后自测

```bash
node scripts/diagnose.mjs   --url http://127.0.0.1:5274/ --width 1920 --height 1080
node scripts/verify-video.mjs --url http://127.0.0.1:5274/ --out shots
```

---

## 离线查看

**站点完全自包含**：不用 Google Fonts、不用任何 CDN、不发任何外部请求。
用 `scripts/audit-offline.mjs` 把除 `127.0.0.1` 之外的所有请求拦掉，
页面依旧 34 张图 0 破图、视频 `readyState=4` 正常播放、被拦截的外部请求 **0 个**。
所以断网、内网、无外网的环境都能完整打开。

```bash
pnpm build:open      # 产出 dist-open/（引用改成相对路径）
```

然后**双击 `离线查看.cmd`**，它会用自带的 Python 起一个本地静态服务并自动开浏览器。
不想敲命令、也不想依赖 Node 装没装 —— 这个脚本走 Python，只在找不到 Python 时才退回 `vite preview`。

### ⚠️ 不能直接双击 `index.html`

用 `file://` 打开 `dist/index.html` 或 `dist-open/index.html` 都会**白屏**。原因不是路径写错，而是
**Chrome / Edge / Firefox 出于安全策略，禁止从 `file://` 加载 ES module 脚本**（跨源限制）。
构建产物用的是 `<script type="module">`，必然被拦。

这不是本项目能绕过的：要么起个本地服务（`离线查看.cmd` 就是干这个，
它**不需要联网**），要么把 React 打包成非 module 的传统脚本并放弃 code splitting。

> 浏览器缓存：用 `离线查看.cmd` 打开过一次后，即使之后不起服务、直接断网，
> 浏览器通常也能从缓存加载。但这是缓存行为，不如起服务可靠。

---

## 用手机打开（局域网）

开发服务器与预览服务器默认监听 `0.0.0.0`，所以同一 Wi-Fi 下的手机可以直接访问：

```
http://<本机局域网 IP>:5273/    开发
http://<本机局域网 IP>:5274/    生产预览
```

本机 IP 用 `ipconfig` 查（本项目机器上是 `172.18.115.161`）。

> **原来打不开的原因**：`vite.config.js` 里写死了 `host: '127.0.0.1'`，
> 只绑回环地址，手机连不上。现已改为 `0.0.0.0`（可用 `pnpm dev:local` 或
> `HOST=127.0.0.1` 恢复只绑本机）。
>
> 如果手机仍连不上，检查 Windows 防火墙是否拦了 Node ——
> 首次启动时系统会弹窗询问「是否允许 Node.js 访问网络」，选**专用网络**即可。
> 这一步需要你自己点确认，命令行无法代为批准。

---

## 目录结构

```
portfolio-site/
├─ index.html                  单页入口（字体、SEO meta）
├─ vite.config.js              端口 5273/5274，监听 0.0.0.0；含开发用组件试验台插件
├─ PERFORMANCE.md              性能审查与优化记录
├─ public/
│  ├─ assets/                  构建产物：按目录分组的 WebP + JPEG 多尺寸图
│  └─ video/                   首页视频背景（README.md 有规格说明）
├─ scripts/                    见文末「脚本清单」
└─ src/
   ├─ main.jsx                 入口，挂载样式
   ├─ App.jsx                  页面骨架 + 右侧进度指示 + 光标光斑
   ├─ data/content.js          ★ 所有文案、项目、联系方式都在这里
   ├─ components/
   │  ├─ Primitives.jsx        Pic（响应式图）/ Reveal / Counter / SectionHead
   │  ├─ Nav.jsx               固定导航 + 滚动进度 + 磨砂玻璃
   │  ├─ Hero.jsx              全屏首屏（视频背景 + 大标题 + CTA）
   │  ├─ About.jsx             个人经历（形象照 / 介绍 / 联系方式 / 数据）
   │  ├─ Works.jsx             精选项目大卡片 + 其他项目网格 + 灯箱
   │  ├─ Strengths.jsx         个人优势卡片 + 工作方式
   │  ├─ Contact.jsx           整屏收尾页
   │  ├─ FoldText/             React Bits 的 FoldText（第三方）
   │  └─ BorderGlow/           React Bits 的 BorderGlow + useEdgeGlow（第三方）
   └─ styles/
      ├─ base.css              设计变量、重置、排版、按钮
      ├─ layout.css            版心、导航、竖向指示、段落标题
      └─ sections.css          各段落的专属样式 + 响应式断点
```

---

## ⚠️ 改文件时的注意事项

**不要用 PowerShell 的 `Set-Content -Encoding utf8` / `Out-File -Encoding utf8` 写含中文的文件。**

Windows PowerShell 5.1 下它会写 BOM，并在处理非 ASCII 时可能先按 GBK 解码再编码，
把中文全部变成乱码。本项目已因此损失过两次文件——`src/data/content.js`（靠生产构建产物才恢复）
和 `README.md`（未能恢复，重写）。批量替换请用编辑器或 `edit` 工具，
或走 `python scripts/write-text.py <目标> <来源>`。

---

## 响应式断点

| 断点 | 针对 | 主要调整 |
| --- | --- | --- |
| ≤1560px | 小笔记本 | 版心收窄、卡片间距 |
| ≤1320px | 平板横屏 | 精选卡片改单列 |
| ≤1100px | 平板 | 个人经历三栏改两栏 |
| ≤820px | 手机 / 竖屏平板 | 各网格全部单列；缩略图条变矮；能力卡单列 |
| ≤430px | 主流手机（360/390/414/430） | 精选缩略图缩到 68×50，条带内缩 |
| ≤350px | 小屏手机（320/iPhon SE） | 条带只留 2 张缩略图，页脚导航收紧 |
| `pointer: coarse` 或 ≤820px | 触屏 | 点击热区补到约 44px |

### 手机端已修的问题

1. **`feat__thumbs` 顶出容器**：3 张 96px 缩略图 + 间距在 320px 屏上会超出栏宽 22px。
   已按断点收窄并在 ≤350px 时只留 2 张。
2. **页脚导航被压成竖排单字**：5 个导航链接在 390px 下被挤成「首/页」「个/人/经/历」。
   已加 `white-space: nowrap` + `flex-wrap: wrap`，现在整齐折成两行。
3. **电话 / 邮箱点不中**：收尾页联系卡里的这两个 `<a>` 只有约 15px 高
   （垂直 padding 挂在外层容器上），手指容易点空。已用「真实 padding + 等量负 margin」
   把热区撑到 41–44px，视觉排版一格未动。

### 移动端复测

```bash
node scripts/audit-mobile.mjs --url http://127.0.0.1:5274/ --out shots/mobile
node scripts/audit-taps.mjs   --url http://127.0.0.1:5274/ --widths 390
node scripts/shot-at.mjs      --url http://127.0.0.1:5274/ --sel ".contact" --out shots/mobile/contact.png
python scripts/slice-shots.py shots/mobile/390.jpg 1900
```

> **看图时注意**：整页长截图（`captureBeyondViewport`）会绕过滚动，
> 依赖 IntersectionObserver 的 `Reveal` 段落与 `sticky` 元素在那种截图里
> 会呈现为空白或错位，**不代表真实渲染有问题**。
> 要判断某一段到底长什么样，用 `shot-at.mjs` 真的滚过去再截。

---

## 五个模块对应关系

| 需求 | 实现位置 | 说明 |
| --- | --- | --- |
| ① 全屏 Hero：视频背景 + 大标题 + 导航 + 联系按钮 | `components/Hero.jsx` + `Nav.jsx` | `<video>` 播放 `public/video/hero.mp4`，失败时回退到高清渲染图 |
| ② 个人经历：人物图 + 介绍 + 联系方式 + 项目数据 | `components/About.jsx` | 三栏布局；右侧技能条；底部 4 项数字指标带缓动计数 |
| ③ 精选项目：大卡片展示作品图 | `components/Works.jsx` | 3 个图文交替大卡片，**每张图都能点开灯箱**；另 6 个项目网格化 |
| ④ 个人优势：卡片展示能力 | `components/Strengths.jsx` | 6 张能力卡 + 工作方式（纯文字）+ 署名 |
| ⑤ 底部联系方式：整屏收尾 | `components/Contact.jsx` | 深色收尾页 + 联系卡 + 页脚，背景为夜景渲染图 |

### 灯箱（看图）行为

- 大卡片的**主图 / 左下缩略图 / 图注条带**都是按钮，点哪张就打开哪一张。
- 缩略图与条带取 `images[1]` 起，所以第 i 张对应图集第 `i + 1` 张；
  映射集中在 `Works.jsx` 的 `FEAT_PREVIEW_START`。
- 条带最多显示 `FEAT_STRIP_MAX`（当前 5）张，更多可在灯箱翻到。
- 键盘：`←` `→` 翻页，`Esc` 关闭，焦点自动移到关闭按钮。
- 竖版长图在灯箱里完整缩放显示，不会被裁。

---

## 第三方组件

### React Bits · FoldText

首屏主标题按行折起再翻开。位置 `src/components/FoldText/`。

相对上游源码的改动：

| 改动 | 原因 |
| --- | --- |
| 新增 `delay` prop | 首屏用它编排：等视频稳住 0.7s 再翻开文字 |
| 新增 `lineHeight` / `letterSpacing` | 上游默认 `line-height: 0.95`、`letter-spacing: -0.04em` 是给拉丁标题的，中文会挤 |
| 改用 `gsap/gsap-core.js`，去掉 ScrollTrigger | 上游从 `gsap` 入口引入会把 ScrollTrigger/Draggable/Flip 全打进包；而本项目用 `trigger="mount"`，ScrollTrigger 是死代码。`trigger="scroll"` 改由 IntersectionObserver 实现（省 63 KB / gzip 25 KB） |

### React Bits · BorderGlow

指针靠近元素边缘时，对应那一侧亮起一圈辉光。位置 `src/components/BorderGlow/`。

**为什么不直接给每个按钮套 BorderGlow**：它是 `<div>` 卡片容器，自带圆角、背景与边框。
套在圆角胶囊按钮上会改掉形状，也会把 `<a>` 塞进 `<div>` 影响键盘语义。所以分两条路，
但视觉语言一致（同一套 `--glow-color-*` 色阶 + 同一个 conic 锥形遮罩）：

| 用在哪 | 怎么实现 |
| --- | --- |
| 大尺寸卡片（3 精选 + 6 其他） | 直接用 `<BorderGlow>` 包裹 |
| 胶囊按钮（导航 / 首屏 CTA / 收尾页） | `useButtonGlow()` 把同样变量写到按钮上，样式在 `base.css` 的 `.btn--glow` |

亮色页面上上游默认参数几乎看不见，本站调高了饱和度与强度（见 `Works.jsx` 的 `GLOW_COLORS`）。

---

## 图片资源流程

原始素材在 `D:\01个人文件\个人简历及作品集\`。改图或换图：

1. 编辑 `scripts/process-images.py` 里的 `PLAN`，把 `输出名` 映射到新源文件并给出宽度档位。
2. 运行 `pnpm assets`（全部）或 `pnpm assets 项目名`（单项）。
3. 校验 `node scripts/check-assets.mjs`。

### 宽度档位（重要）

`<Pic widths={[...]}>` 里写的每个宽度，磁盘上都必须有对应的 `-{宽度}.webp` 与 `-{宽度}.jpg`，
否则浏览器会 404 并显示破图。当前两套档位：

| 档位组 | 宽度 | 用在哪 |
| --- | --- | --- |
| `PROJ` | 800 / 1600 / 2000 | 精选大卡片、灯箱里放大看的图 |
| `AUX` | 400 / 800 / 1200 | 小卡片封面（卡片里只显示到约 547 CSS px） |

某张图同时用于两种角色时（如人工岛总平），在数据里显式写 `coverWidths`。

源文件查找顺序：`图片` → `案例临摹` → `形象照`（`resolve_source()`）。

---

## 首页视频背景

视频放在 `public/video/hero.mp4`，自动播放（静音、循环）。换视频只要覆盖这个文件。

当前素材要点：

- 1270×720 / 53.77 秒 / H.264 / 8.61 MB
- 源片 52s 之后是平台个人主页收尾卡，已在 `Hero.jsx` 设 `LOOP_END = 51.5` 提前循环
- **源片四角带平台水印（烧进画面）**，靠上下过渡带压制，底部两块在部分画面仍可见；
  细节与可选方案见 `public/video/README.md`
- 没有视频或加载失败时回退到 `assets/hero/poster-*`，不会破图或黑屏
- `<video>` 设了 `fetchpriority="low"`，不与首屏字体/图片抢带宽；不挂 `poster`
  （`.hero__still` 已压着同一张图，poster 只会多请求一次）

```bash
node scripts/verify-video.mjs --url http://127.0.0.1:5274/ --out shots
python scripts/probe-video.py public/video/hero.mp4
```

---

## 各项目当前使用的图

| 项目 | 图集顺序 |
| --- | --- |
| 剧场设计 | 黄昏鸟瞰 → 总平面图 → 线稿立面 → 报告厅室内 → 雨夜城市界面 → 功能爆炸分析 |
| 运动健康社区改造 | 社区中心 → 整片屋面鸟瞰 → 屋顶花园 → 街道视角（红色廊架）→ 主入口（红色拱架）→ 社区市集广场 → 市集广场鸟瞰 → 垂直交通分析 |
| 商业建筑改造 | 1-1 立面图 → 2-2 立面图 → 总平面与流线 → 垂直交通体系分析（1F–5F） |
| 客运站设计 | 整体鸟瞰 → 剖面（折叠屋面） |
| 人工岛服务站设计 | 总平面图 → 设计展板 |
| 案例临摹与研究 | 形体研究小样 → 谷物之屋 · 总平面 → 谷物之屋 · 立面 |
| 南瓜王国 / 修行客栈 / 游戏设计开发 | 见 `src/data/content.js` |

**辨图要点（避免再次分错）**

- **红色元素全部属于「运动健康社区改造」**：连续红色步行道串起屋面运动场、屋顶花园与
  社区市集广场（蓝色遮阳伞 + 圆形水院），另有两处红色界面——街道视角的**红色廊架**
  与主入口的**红色拱架 + 花格墙**。
- **商业建筑改造**是 **6 层体量**：木格栅 + 玻璃幕墙 + 曲线中庭。它的图是立面图、
  总平与 1F–5F 动线分析，**没有街区效果图**。
- **客运站**是低矮的**折叠屋面**体量（鸟瞰 + 剖面）。
- **剧场设计的线稿立面**画的是曲面屋面 + 玻璃幕墙 + 顶部折板 + 棕榈，是剧场的外立面。

> 已修正的分错（早期从作品集 PDF 分图时按文件名猜归属造成的）：
>
> | 资源 | 原来错挂在 | 实际属于 |
> | --- | --- | --- |
> | `屋顶总平.jpg` | 运动健康社区改造 | 南瓜王国（乡村场地） |
> | `鸟1市集.png` / `市集.png` | 商业建筑改造 | 运动健康社区改造（社区市集广场） |
> | `街道2.png` / `panyan.png` | 商业建筑改造 | 运动健康社区改造（红色廊架 / 红色拱架） |
> | `垂直交通分析.jpg` | 运动健康社区改造 | 商业建筑改造（1F–5F 商业区动线） |
> | `1-1立面图.jpg` / `2-2立面图.jpg` | 客运站设计 | 商业建筑改造（6 层立面） |
> | `线稿风格立面.jpg` | 案例临摹与研究 | 剧场设计（外立面） |
>
> 改归后的资源已重命名：`commercial-street` → `sport-street`、
> `commercial-front` → `sport-entrance`、`commercial-market` → `sport-plaza`、
> `commercial-bird` → `sport-plaza2`、`linework` → `theater-elevation`。
>
> **仍缺一张图**：运动健康社区改造的「垂直交通分析」目前借用商业改造那张。
>
> 剧场设计原来的「剖透视 · 观演空间与公共动线」按需求换成了总平面图，
> 资源 `theater-section-*` 仍保留，改回只需动 `content.js` 一行。

---

## 脚本清单

核心：

| 脚本 | 用途 |
| --- | --- |
| `process-images.py` | 从原始素材生成网页用多尺寸资源 |
| `check-assets.mjs` | 校验代码引用的图片档位是否都已生成 |
| `write-text.py` | 安全写 UTF-8 文本（避免 PowerShell 编码坑） |
| `slice-shots.py` | 把超长整页截图切成可查看的段 |

自检与测量：

| 脚本 | 用途 |
| --- | --- |
| `audit-firstload.mjs` | 首屏传输量 / 字体数 / FCP / 长任务 |
| `audit-mobile.mjs` | 多个手机宽度下的横向溢出、破图、整页截图 |
| `audit-taps.mjs` | 点击目标是否小于 40px（含所在位置） |
| `shot-at.mjs` | 滚到指定元素后截视口（判断真实渲染） |
| `diagnose.mjs` | 破图、横向溢出、控制台报错、失败请求 |
| `screenshot.mjs` | 整页长图 + 逐段截图 |
| `check-nav.mjs` | 导航栏固定与磨砂在各滚动位置的表现 |
| `check-all-images.mjs` | 逐个点击所有小图，核对灯箱打开的是第几张 |
| `check-feat-strip.mjs` | 单独校验精选卡片条带的序号映射 |
| `capture-hover.mjs` | 派发真实 pointermove 后截图（验证悬停类特效） |
| `capture-fold-frames.mjs` | 抓 FoldText 折叠动画的连续帧 |
| `verify-foldtext.mjs` | 采样 rotateX/opacity，确认动画真的在跑 |
| `verify-video.mjs` | 确认首页视频真的在播放而非回退静态图 |
| `probe-video.py` | 不依赖 ffmpeg 读取视频参数 |
| `check-watermark.py` | 检查画面帧里是否还有平台水印的红色 Logo |

---

## 设计变量速查

改整体观感只需动 `src/styles/base.css` 顶部的 `:root`：

| 变量 | 当前值 | 作用 |
| --- | --- | --- |
| `--bg` | `#f7f7f5` | 页面底色（暖白） |
| `--ink` | `#14151a` | 主文字 |
| `--accent` | `#2f5cff` | 唯一强调色 |
| `--wrap` | `1700px` | 版心宽度 |
| `--sec-y` | `clamp(88px, 9vw, 160px)` | 段落上下留白 |
| `--mono` | Bahnschrift | 编号 / 尺寸标注用的等宽字体 |

字体不引外链，走本机已装的 Noto Sans SC / Noto Serif SC / Bahnschrift（原因见 `index.html` 注释）。

---

## 内容待补充 / 可优化项

- [ ] 运动健康社区改造的**垂直交通分析图**（现借用商业改造那张）
- [ ] 商业建筑改造的**效果图**（现只有立面图与总平，卡片封面偏空）
- [ ] 首页视频换成**无水印源片**，换后删掉 `.hero__edgeMask`
- [ ] 案例临摹的形体研究小样分辨率偏低（644×953），有高清版可替换
- [ ] 各项目的 `year` / `location` 按作品集页码推断，请核对成真实信息
- [ ] 移动端已适配到 320px，但交互（灯箱手势滑动切换）尚未做
