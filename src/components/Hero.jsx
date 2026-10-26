import { useEffect, useRef, useState } from 'react'
import { publicUrl, Pic, Reveal, Meta } from './Primitives.jsx'
import FoldText from './FoldText/FoldText.jsx'
import { useButtonGlow } from './BorderGlow/useEdgeGlow.js'
import { profile, focusAreas } from '../data/content.js'

/**
 * 全屏首页
 * - 背景播放 public/video/hero.mp4（把视频丢进去即可自动生效）
 * - 没有视频 / 加载失败时自动回退到高清渲染图，不会出现破图或黑屏
 * - 视频之上叠加浅色过渡带与网格，保证「明亮系 + 科技感」
 *
 * 源片已换成无水印的原始渲染（剧院设计，1920×1088），循环自然播放。
 */

export default function Hero() {
  const [videoOk, setVideoOk] = useState(false)
  const [offset, setOffset] = useState(0)
  const videoRef = useRef(null)
  const heroRef = useRef(null)
  const mediaRef = useRef(null)

  // 两个 CTA 按钮的边框辉光
  const primaryGlow = useButtonGlow()
  const ghostGlow = useButtonGlow({ glowColor: '225 90 60', glowIntensity: 1.2 })

  // 首屏视差
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setOffset(Math.min(window.scrollY, window.innerHeight))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  // 只在真的能取到视频时才启用 <video>，避免出现破图
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const onReady = () => setVideoOk(true)
    const onError = () => setVideoOk(false)
    el.addEventListener('loadeddata', onReady)
    el.addEventListener('error', onError)
    // 触发一次探测
    try {
      el.load()
    } catch {
      /* noop */
    }
    return () => {
      el.removeEventListener('loadeddata', onReady)
      el.removeEventListener('error', onError)
    }
  }, [])

  const go = (event, id) => {
    event.preventDefault()
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="hero" id="home" ref={heroRef}>
      <div className="hero__bg" style={{ transform: `translate3d(0, ${offset * 0.16}px, 0)` }}>
        <div className="hero__media" ref={mediaRef}>
          <video
            ref={videoRef}
            className={`hero__video ${videoOk ? 'is-ready' : ''}`}
            muted
            loop
            playsInline
            autoPlay
            /* 首帧由 .hero__still 里的高清渲染图兜住（它压在视频之上），
               所以这里不必再挂 poster，能省掉一张 312 KB 的重复 JPEG。 */
            preload="auto"
            /* 视频体积不小，不该跟首屏的字体/图片抢带宽 */
            fetchpriority="low"
            aria-hidden="true"
            tabIndex={-1}
          >
            <source src={publicUrl('video/hero.mp4')} type="video/mp4" />
            <source src={publicUrl('video/hero.webm')} type="video/webm" />
          </video>

          <div className={`hero__still ${videoOk ? 'is-hidden' : ''}`} aria-hidden={videoOk}>
            <Pic
              src="hero/poster"
              widths={[1920, 2560]}
              sizes="100vw"
              alt="剧场设计 —— 曲面屋面与城市界面夜景渲染"
              loading="eager"
              fetchPriority="high"
              className="hero__img"
            />
          </div>
        </div>

        <div className="hero__scrim" aria-hidden="true" />
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__grid" aria-hidden="true" />
        <div className="hero__noise" aria-hidden="true" />
      </div>

      <div className="wrap hero__inner">
        <div className="hero__top">
          <Reveal className="hero__eyebrow" delay={80}>
            <Meta>PORTFOLIO 2026</Meta>
            <span className="hero__eyebrowDot" aria-hidden="true" />
            <Meta>{profile.grade}</Meta>
            <span className="hero__eyebrowDot" aria-hidden="true" />
            <Meta>{profile.schoolLatin}</Meta>
          </Reveal>
        </div>

        <div className="hero__center">
          <Reveal delay={140}>
            <p className="hero__role">{profile.role}</p>
          </Reveal>

          <h1 className="hero__heading">
            <FoldText
              className="hero__title"
              text={profile.tagline.join('\n')}
              splitBy="line"
              hinge="top"
              trigger="mount"
              delay={0.7}
              duration={0.9}
              stagger={0.16}
              ease="power3.out"
              perspective={900}
              creaseShading={0.5}
              fontSize="clamp(46px, 6.6vw, 128px)"
              fontWeight={500}
              color="var(--ink)"
              lineHeight="1.14"
              letterSpacing="0.01em"
            />
          </h1>

          <Reveal delay={320}>
            <p className="hero__sub">{profile.taglineSub}</p>
          </Reveal>

          <Reveal delay={400}>
            <div className="hero__cta">
              <a
                className="btn btn--dark btn--glow"
                href="#works"
                ref={primaryGlow.ref}
                style={primaryGlow.style}
                onClick={(e) => go(e, 'works')}
              >
                <span>查看精选项目</span>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                  <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </a>
              <a
                className="btn btn--ghost btn--glow"
                href="#contact"
                ref={ghostGlow.ref}
                style={ghostGlow.style}
                onClick={(e) => go(e, 'contact')}
              >
                <span>联系方式</span>
              </a>
            </div>
          </Reveal>
        </div>

        <div className="hero__bottom">
          <Reveal className="hero__focus" delay={480}>
            {focusAreas.map((f) => (
              <span className="hero__chip" key={f}>
                {f}
              </span>
            ))}
          </Reveal>

          <Reveal className="hero__scroll" delay={560}>
            <a href="#about" onClick={(e) => go(e, 'about')}>
              <span className="meta">SCROLL</span>
              <span className="hero__scrollLine" aria-hidden="true">
                <i />
              </span>
            </a>
          </Reveal>
        </div>
      </div>

      <div className="hero__rule" aria-hidden="true" />
    </section>
  )
}
