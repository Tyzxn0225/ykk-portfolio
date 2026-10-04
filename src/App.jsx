import { useEffect, useState } from 'react'
import Nav from './components/Nav.jsx'
import Hero from './components/Hero.jsx'
import About from './components/About.jsx'
import Works from './components/Works.jsx'
import Strengths from './components/Strengths.jsx'
import Contact from './components/Contact.jsx'
import { sections } from './data/content.js'

/** 右侧竖向进度指示（PC 端细节） */
function Rail() {
  const [active, setActive] = useState('home')

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean)
    if (!els.length || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActive(visible.target.id)
      },
      { threshold: [0.2, 0.6], rootMargin: '-25% 0px -25% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const go = (event, id) => {
    event.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside className="rail" aria-hidden="true">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={active === s.id ? 'is-active' : ''}
          onClick={(e) => go(e, s.id)}
          tabIndex={-1}
        >
          <span className="rail__num">{s.num}</span>
          <span className="rail__label">{s.nav}</span>
          <span className="rail__dot" />
        </a>
      ))}
    </aside>
  )
}

/** 跟随光标的柔和光斑，营造「科技感」但不抢戏 */
function Spotlight() {
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || window.matchMedia?.('(hover: none)').matches) return
    const el = document.getElementById('spotlight')
    if (!el) return
    let raf = 0
    const onMove = (e) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${e.clientX - 320}px, ${e.clientY - 320}px, 0)`
        el.style.opacity = '1'
      })
    }
    const onLeave = () => {
      el.style.opacity = '0'
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseout', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseout', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [])

  return <div className="spotlight" id="spotlight" aria-hidden="true" />
}

export default function App() {
  return (
    <div className="app">
      <a className="skip" href="#works">
        跳到精选项目
      </a>

      <Nav />
      <Spotlight />
      <Rail />

      <main>
        <Hero />
        <About />
        <Works />
        <Strengths />
        <Contact />
      </main>
    </div>
  )
}
