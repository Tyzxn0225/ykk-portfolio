import { useEffect, useRef, useState } from 'react'

/**
 * 资源基路径：支持部署在子目录（Vite base）。
 * 图片文件名规则：`${base}-${width}.webp|jpg`
 */
const BASE = import.meta.env.BASE_URL || '/'

/**
 * 拼出资源 URL。
 * - 默认落在 public/assets/ 下（所有经过 process-images.py 处理的图片）
 * - `{ raw: true }` 表示相对 public 根目录，例如 public/video/hero.mp4
 */
export const asset = (path, { raw = false } = {}) =>
  `${BASE}${raw ? '' : 'assets/'}${path}`.replace(/([^:])\/\//g, '$1/')

/** public 根目录下的文件（视频等） */
export const publicUrl = (path) => asset(path, { raw: true })

/**
 * 响应式图片：自动生成 srcset，优先 WebP。
 */
export function Pic({
  src,
  widths = [800, 1600, 2000],
  alt = '',
  className = '',
  sizes = '100vw',
  loading = 'lazy',
  fetchPriority,
  decoding = 'async',
  style,
}) {
  // srcset 必须按宽度升序排列：部分浏览器只会取第一个候选，
  // 若把最小宽度写在最前面，小尺寸容器会误选大文件或算出错误密度。
  const usable = [...new Set(widths.filter((w) => w > 0))].sort((a, b) => a - b)
  const webpSet = usable.map((w) => `${asset(`${src}-${w}.webp`)} ${w}w`).join(', ')
  const jpgSet = usable.map((w) => `${asset(`${src}-${w}.jpg`)} ${w}w`).join(', ')
  const fallback = asset(`${src}-${usable[usable.length - 1]}.jpg`)

  return (
    <picture>
      <source type="image/webp" srcSet={webpSet} sizes={sizes} />
      <source type="image/jpeg" srcSet={jpgSet} sizes={sizes} />
      <img
        src={fallback}
        alt={alt}
        className={className}
        style={style}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        draggable="false"
      />
    </picture>
  )
}

/** 滚动进入视口时触发揭示动画 */
export function Reveal({ children, as: Tag = 'div', delay = 0, className = '', once = true }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true)
            if (once) io.unobserve(entry.target)
          } else if (!once) {
            setShown(false)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once])

  return (
    <Tag
      ref={ref}
      className={`reveal ${shown ? 'is-in' : ''} ${className}`.trim()}
      style={{ '--reveal-delay': `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}

/** 小标签：等宽字体 + 编号，用于制造「技术图纸」的秩序感 */
export function Meta({ children, className = '' }) {
  return <span className={`meta ${className}`.trim()}>{children}</span>
}

/** 段落标题：编号 / 中文标题 / 英文标题 + 细线 */
export function SectionHead({ num, title, en, note, align = 'left' }) {
  return (
    <Reveal className={`sec-head sec-head--${align}`}>
      <div className="sec-head__row">
        <Meta className="sec-head__num">{num}</Meta>
        <span className="sec-head__rule" aria-hidden="true" />
        <Meta className="sec-head__en">{en}</Meta>
      </div>
      <h2 className="sec-head__title">
        {title}
        {note ? <em className="sec-head__note">{note}</em> : null}
      </h2>
    </Reveal>
  )
}

/** 图片角落的十字定位标记 —— 图纸感 */
export function Crosshair({ className = '' }) {
  return (
    <span className={`crosshair ${className}`.trim()} aria-hidden="true">
      <i />
      <i />
    </span>
  )
}

/** 缓动数字：进入视口后从 0 计数到目标值 */
export function Counter({ value, duration = 1200 }) {
  const ref = useRef(null)
  const [display, setDisplay] = useState(0)
  const numeric = Number(value)
  const isNumber = Number.isFinite(numeric)

  useEffect(() => {
    if (!isNumber) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setDisplay(numeric)
      return
    }
    let raf = 0
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          io.unobserve(entry.target)
          const start = performance.now()
          const tick = (now) => {
            const p = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - p, 3)
            setDisplay(Math.round(numeric * eased))
            if (p < 1) raf = requestAnimationFrame(tick)
          }
          raf = requestAnimationFrame(tick)
        })
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [numeric, isNumber, duration])

  return <span ref={ref}>{isNumber ? display : value}</span>
}

/** 复制到剪贴板的小交互 */
export function CopyValue({ value }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button type="button" className="copy" onClick={copy} aria-label={`复制 ${value}`}>
      <span className="copy__text">{value}</span>
      <span className={`copy__hint ${copied ? 'is-copied' : ''}`}>{copied ? '已复制' : '复制'}</span>
    </button>
  )
}
