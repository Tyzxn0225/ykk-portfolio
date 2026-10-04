# 性能审查与优化记录

审查范围：视频与图片体积、动态背景、滚动监听、GSAP 动画、首屏加载。
结论与改动如下，全部为实测数据（Chrome DevTools Protocol，1920×1080）。

---

## 总体结果（生产构建，首屏不滚动）

| 指标 | 优化前 | 优化后 |
| --- | --- | --- |
| 首屏请求数 | 70 | **5** |
| 首屏传输量 | 5.11 MB | **0.34 MB** |
| 字体文件 | 36 个 / 2.24 MB | **0** |
| JS（打包） | 387.9 KB（gzip 134.2） | **324.7 KB（gzip 108.8）** |
| 首次内容绘制 FCP | 608 ms | **388 ms** |
| 长任务（>50ms） | 0 | **0** |
| 资源总量 | 46.8 MB | 41.7 MB |

---

## 1. 视频与图片体积

**视频：8.61 MB，1270×720，53.8 秒。**
首屏用 `preload="auto"` + 自动播放，但加了 `fetchpriority="low"`，
让它排在首屏字体/图片之后下载，不再抢带宽。
另外删掉了 `<video poster>`：`.hero__still` 里本来就压着同一张高清渲染图
（z-index 更高），poster 只是重复请求一张 312 KB 的 JPEG。

> 视频本身没有重编码。8.61 MB 对 53 秒的 720p 属正常范围，
> 真要再降只能重编码，而本机没有 ffmpeg。换无水印源片时可以顺便压一版。

**图片：原先给所有项目图都生成 800/1600/2000 三档，
但「其他课程设计」的小卡片里图片实际只显示到约 547 CSS px，
按 2x 也就 1100 px 上下 —— 2000 档完全用不上，单张能到 960 KB。**

现在按用途分两套档位（`scripts/process-images.py`）：

| 档位组 | 宽度 | 用在哪 |
| --- | --- | --- |
| `PROJ` | 800 / 1600 / 2000 | 精选项目大卡片、灯箱里放大看的图 |
| `AUX` | 400 / 800 / 1200 | 小卡片封面 |

对应前端：`Works.jsx` 的 `MORE_COVER_WIDTHS = [400, 800, 1200]`。
某张图同时用于两种角色时（例如人工岛总平），在数据里显式写 `coverWidths`。

---

## 2. WebGL 动态背景

**没有 WebGL，也没有 canvas。** 全站搜 `webgl|canvas|getContext|three|ogl` 为零命中。

首屏的「科技感」全部来自 CSS：
- Hero 的网格、光晕、噪点是 `repeating-linear-gradient` + SVG turbulence data-URI
- 鼠标跟随光斑 `.spotlight` 是一个 640×640 的径向渐变 div，用 transform 平移
- BorderGlow 的辉光是 `conic-gradient` 遮罩 + 多层 box-shadow

**结论：这一项没有性能问题，不需要改。** 也就没有 GPU 上下文丢失、显存占用这些风险。
（`.spotlight` 的 `mousemove` 已用 rAF 节流，并对 `hover: none` 与 reduced-motion 直接关闭。）

---

## 3. 滚动监听

原本有 3 处 `window scroll`，都是 passive，但 **Nav 的处理函数每帧都 `setState`**：

```js
setScrolled(window.scrollY > 40)                        // 每帧都调用
setProgress(Math.min(1, y / max))                       // 每帧都换新值
```

进度条是连续量，等于**每帧触发一次 React 重渲染**，而 Nav 里还挂着 BorderGlow 的 ref 与若干节点。

已改（`Nav.jsx`）：

- `scrolled` 只在布尔值真正翻转时才 `setState`（滚动全程最多 2 次）
- 进度条幅值直接写 DOM：`progressRef.current.style.transform = scaleX(p)`，
  不进 React state
- 整个处理函数用 `requestAnimationFrame` 合并，并补了 `resize` 监听

同时去掉 CSS 里 `.nav__progress span { transition: transform .12s }` ——
数值已经逐帧写入，再加过渡等于每帧起一次动画，白烧合成时间。

Hero 的视差与 App 的 Rail 本来就是 rAF 合并的，保持不变。

---

## 4. GSAP 动画

组件 `FoldText` 用了 GSAP。原本：

```js
import { gsap } from 'gsap'                    // index.js 会把全部插件再导出
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)             // 模块加载时无条件注册
```

问题有两层：

1. **`gsap` 入口会把 ScrollTrigger / Draggable / Flip 一并打进包里**
   （源码体积：gsap-core 168 KB + ScrollTrigger 110 KB + Draggable 99 KB + Flip 48 KB）。
2. **ScrollTrigger 在本项目里其实是死代码** —— 首屏用的是 `trigger="mount"`，
   从不走 `trigger="scroll"` 分支。

已改（`FoldText.jsx`）：

- 改成 `import { gsap } from 'gsap/gsap-core.js'`，只取 tween 核心
- 移除 `ScrollTrigger` 依赖，`trigger="scroll"` 改用 **IntersectionObserver** 实现
  （`rootMargin: '0px 0px -18% 0px'` + `threshold: 0.01`，触发一次后 disconnect，
  与原来 `ScrollTrigger.create({ start: 'top 82%', once: true })` 语义等价）

**效果：打包 JS 387.9 → 324.7 KB（gzip 134.2 → 108.8 KB），省 63 KB / 25 KB gzip。**

实际动画开销本身很小：DOM 里只有 2 个 `.fold-text-piece`（按行折，不是按字），
只补间 `opacity / rotateX / --fold-crease`。折叠过程与结束后都无长任务。

---

## 5. 首屏加载

**最大的问题不是 JS，而是外链字体。** 原先 `index.html` 从 Google Fonts 拉
Inter + Noto Sans SC + Noto Serif SC 共 11 个字重：

- 那份 CSS 本身 **213 KB**
- 实际下载 **36 个字体文件 / 2.24 MB**（中文字体按 unicode-range 切片，一次就是几十个）
- 首屏最大值的一半以上都在这里

而这三套字在目标机器上**本来就装好了**，`base.css` 的字体栈也一直把它们排在前面，
外链字体其实只是兜底。已移除 `fonts.googleapis.com` 与两个 `preconnect`：

```css
--sans:  'Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei UI', …
--serif: 'Noto Serif SC', 'Songti SC', 'SimSun', Georgia, serif
--mono:  'Bahnschrift', 'Cascadia Mono', …
```

零请求，中文渲染更稳，也顺带消除了 FOUT/布局抖动。
实测字体请求 36 → **0**，首屏总量 5.11 → 0.34 MB。

其余：`hero/poster` 用 `loading="eager"` + `fetchpriority="high"` 是对的（它就是 LCP），
其余图片全部 `loading="lazy"`。

---

## 怎么复现这些数字

```bash
pnpm build
node node_modules/vite/bin/vite.js preview --port 5274 --strictPort

# 首屏传输量 / 字体数 / FCP / 长任务
node scripts/audit-firstload.mjs --url http://127.0.0.1:5274/ --wait 14000

# 资源引用完整性（档位是否与 PLAN 对得上）
node scripts/check-assets.mjs
```

`audit-firstload.mjs` 是这次新加的：它不滚动、不等懒加载，
只统计「首屏真正要付的代价」，避免把懒加载的图算进去。
