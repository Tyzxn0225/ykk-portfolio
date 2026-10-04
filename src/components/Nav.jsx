import { useEffect, useRef, useState } from 'react'
import { sections, profile } from '../data/content.js'
import { useButtonGlow } from './BorderGlow/useEdgeGlow.js'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState('home')
  const [open, setOpen] = useState(false)
  const progressRef = useRef(null)
  const ctaGlow = useButtonGlow({ glowColor: '225 96 60', glowIntensity: 1.5 })

  // 滚动处理：
  // - scrolled 只在布尔值真正翻转时才 setState（原来每帧都 set，导致整棵 Nav 每帧重渲染）
  // - 进度条幅值直接写 DOM（transform 是合成层属性，不触发重排/重绘）
  useEffect(() => {
    let raf = 0
    let lastScrolled = null

    const measure = () => {
      raf = 0
      const y = window.scrollY
      const next = y > 40
      if (next !== lastScrolled) {
        lastScrolled = next
        setScrolled(next)
      }
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(1, y / max) : 0
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${p.toFixed(4)})`
      }
    }

    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const ids = sections.map((s) => s.id)
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (!els.length || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActive(visible.target.id)
      },
      { threshold: [0.2, 0.5], rootMargin: '-20% 0px -30% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const go = (event, id) => {
    event.preventDefault()
    setOpen(false)
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <header className={`nav ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`}>
      <div className="nav__inner">
        <a className="nav__brand" href="#home" onClick={(e) => go(e, 'home')}>
          <span className="nav__mark" aria-hidden="true">
            <svg viewBox="0 0 28 28" width="26" height="26" fill="none">
              <rect x="0.5" y="0.5" width="27" height="27" stroke="currentColor" strokeOpacity="0.28" />
              <path d="M7.5 20.5 L14 7.5 L20.5 20.5" stroke="currentColor" strokeWidth="1.1" />
              <path d="M10.6 16.4 H17.4" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          </span>
          <span className="nav__name">
            <b>{profile.name}</b>
            <em>{profile.nameLatin}</em>
          </span>
        </a>

        <nav className="nav__links" aria-label="主导航">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`nav__link ${active === s.id ? 'is-active' : ''}`}
              onClick={(e) => go(e, s.id)}
            >
              <span className="nav__linkNum">{s.num}</span>
              <span className="nav__linkCn">{s.nav}</span>
              <span className="nav__linkEn">{s.en}</span>
            </a>
          ))}
        </nav>

        <div className="nav__actions">
          <a
            className="btn btn--dark nav__cta btn--glow"
            href="#contact"
            ref={ctaGlow.ref}
            style={ctaGlow.style}
            onClick={(e) => go(e, 'contact')}
          >
            <span>联系我</span>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
              <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </a>
          <button
            type="button"
            className="nav__toggle"
            aria-label="切换导航菜单"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <i />
            <i />
          </button>
        </div>
      </div>

      <div className="nav__progress" aria-hidden="true">
        <span ref={progressRef} />
      </div>

      <div className="nav__drawer" hidden={!open}>
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} onClick={(e) => go(e, s.id)}>
            <span className="meta">{s.num}</span>
            <span>{s.nav}</span>
            <span className="meta">{s.en}</span>
          </a>
        ))}
      </div>
    </header>
  )
}
