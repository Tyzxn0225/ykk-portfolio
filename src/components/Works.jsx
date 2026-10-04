import { useEffect, useRef, useState } from 'react'
import { Pic, Reveal, SectionHead, Meta, Crosshair } from './Primitives.jsx'
import BorderGlow from './BorderGlow/BorderGlow.jsx'
import { featuredProjects, moreProjects } from '../data/content.js'

/** 全站统一的边框辉光配色：以站点的强调蓝为主，掺一点暖色避免死板 */
const GLOW_COLORS = ['#2f5cff', '#7aa2ff', '#c8a878']

/* ------------------------------------------------------------------ */
/* 精选项目：大卡片（图文左右交替）                                     */
/* ------------------------------------------------------------------ */

/** `.feat__thumbs` 与 `.feat__strip` 都从 images[1] 开始，所以缩略图编号要 +1 */
const FEAT_PREVIEW_START = 1
/** 条带最多放几张（缩略图只取前 3 张） */
const FEAT_STRIP_MAX = 5
/** 「其他课程设计」封面默认档位。
 *  卡片里的图实际只显示到约 547 CSS px，按 2x 也就 1100 px 上下，
 *  所以用 400/800/1200 三档，比 800/1600/2000 省很多流量。
 *  单张图源分辨率不够时用 coverWidths 覆盖。 */
const MORE_COVER_WIDTHS = [400, 800, 1200]

function FeaturedCard({ project, flipped, onOpen }) {
  const previews = project.images.slice(FEAT_PREVIEW_START, FEAT_PREVIEW_START + FEAT_STRIP_MAX)

  return (
    <Reveal className={`feat ${flipped ? 'is-flipped' : ''}`}>
      <BorderGlow
        className="feat__glow"
        backgroundColor="#ffffff"
        borderRadius={4}
        edgeSensitivity={12}
        glowColor="225 96 56"
        glowRadius={30}
        glowIntensity={1.5}
        coneSpread={38}
        fillOpacity={0.85}
        colors={GLOW_COLORS}
      >
        <article className="feat__card">
        <div className="feat__media">
          <Crosshair className="feat__cross feat__cross--tl" />
          <button
            type="button"
            className="feat__imgWrap"
            onClick={() => onOpen(0)}
            aria-label={`放大查看：${project.images[0]?.caption || project.title}`}
          >
            <Pic
              src={project.cover}
              widths={[800, 1600, 2000]}
              sizes="(max-width: 1200px) 92vw, 60vw"
              alt={`${project.title} 效果图`}
              className="feat__img"
            />
            <div className="feat__mediaVeil" aria-hidden="true" />
            <span className="feat__zoom" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.4" />
                <path d="M13.5 13.5 L17.5 17.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M9 6.4v5.2M6.4 9h5.2" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </span>
          </button>

          <span className="feat__index" aria-hidden="true">
            {project.index}
          </span>

          <div className="feat__thumbs">
            {previews.slice(0, 3).map((im, i) => (
              <button
                type="button"
                className="feat__thumb"
                key={im.src}
                onClick={() => onOpen(i + FEAT_PREVIEW_START)}
                aria-label={`放大查看：${im.caption || project.title}`}
              >
                <Pic src={im.src} widths={[800]} sizes="100px" alt={im.caption} className="feat__thumbImg" />
              </button>
            ))}
          </div>
        </div>

        <div className="feat__body">
          <div className="feat__metaRow">
            <Meta>{project.category}</Meta>
            <span className="feat__dot" aria-hidden="true" />
            <Meta>{project.year}</Meta>
          </div>

          <h3 className="feat__title">
            {project.title}
            <span className="feat__titleEn">{project.titleLatin}</span>
          </h3>

          <p className="feat__brief">{project.brief}</p>

          <ul className="feat__tags">
            {project.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>

          <dl className="feat__facts">
            <div>
              <dt>
                <Meta>LOCATION</Meta>
              </dt>
              <dd>{project.location}</dd>
            </div>
            <div>
              <dt>
                <Meta>ROLE</Meta>
              </dt>
              <dd>{project.role}</dd>
            </div>
          </dl>

          <div className="feat__strip">
            {previews.map((im, i) => (
              <button
                type="button"
                className="feat__stripItem"
                key={im.src}
                style={{ '--i': i }}
                onClick={() => onOpen(i + FEAT_PREVIEW_START)}
                aria-label={`放大查看：${im.caption || project.title}`}
              >
                <Pic src={im.src} widths={[800]} sizes="240px" alt={im.caption} className="feat__stripImg" />
                <span className="feat__stripCap">{im.caption}</span>
              </button>
            ))}
          </div>

          <p className="feat__hint">
            <Meta>点击任意图片可放大查看全部 {project.images.length} 张图纸</Meta>
          </p>
        </div>
        </article>
      </BorderGlow>
    </Reveal>
  )
}

/* ------------------------------------------------------------------ */
/* 其余项目：网格 + 点击查看大图                                        */
/* ------------------------------------------------------------------ */

function Lightbox({ project, initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(() => {
    const total = project.images.length
    if (!total) return 0
    return Math.min(Math.max(initialIndex, 0), total - 1)
  })
  const closeRef = useRef(null)

  const images = project.images.map((im) =>
    typeof im === 'string' ? { src: im, caption: project.title } : im,
  )
  const total = images.length

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % total)
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + total) % total)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose, total])

  const current = images[index]

  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label={`${project.title} 图片查看`}>
      <button type="button" className="lb__backdrop" aria-label="关闭" onClick={onClose} />
      <div className="lb__panel">
        <div className="lb__head">
          <div>
            <Meta>{project.category}</Meta>
            <h4>
              {project.title}
              <span>{project.titleLatin}</span>
            </h4>
          </div>
          <button ref={closeRef} type="button" className="lb__close" onClick={onClose} aria-label="关闭">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </div>

        <div className="lb__stage">
          <Pic
            key={current.src}
            src={current.src}
            widths={current.widths || [800, 1600, 2000]}
            sizes="86vw"
            alt={current.caption || project.title}
            className="lb__img"
            loading="eager"
          />
          {total > 1 ? (
            <>
              <button
                type="button"
                className="lb__nav lb__nav--prev"
                onClick={() => setIndex((i) => (i - 1 + total) % total)}
                aria-label="上一张"
              >
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
                  <path d="M12.5 4.5 L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </button>
              <button
                type="button"
                className="lb__nav lb__nav--next"
                onClick={() => setIndex((i) => (i + 1) % total)}
                aria-label="下一张"
              >
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
                  <path d="M7.5 4.5 L13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </button>
            </>
          ) : null}
        </div>

        <div className="lb__foot">
          <p className="lb__cap">{current.caption}</p>
          <div className="lb__dots">
            {images.map((im, i) => (
              <button
                key={im.src}
                type="button"
                className={i === index ? 'is-active' : ''}
                onClick={() => setIndex(i)}
                aria-label={`查看第 ${i + 1} 张`}
              />
            ))}
          </div>
          <Meta>
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </Meta>
        </div>
      </div>
    </div>
  )
}

function MoreCard({ project, onOpen, delay }) {
  return (
    <Reveal className="more" delay={delay}>
      <BorderGlow
        className="more__glow"
        backgroundColor="#ffffff"
        borderRadius={4}
        edgeSensitivity={12}
        glowColor="225 96 56"
        glowRadius={26}
        glowIntensity={1.5}
        coneSpread={38}
        fillOpacity={0.85}
        colors={GLOW_COLORS}
      >
        <button type="button" className="more__card" onClick={onOpen}>
        <span className="more__media">
          <Pic
            src={project.cover}
            widths={project.coverWidths || MORE_COVER_WIDTHS}
            sizes="(max-width: 1200px) 92vw, 30vw"
            alt={`${project.title} 效果图`}
            className="more__img"
            style={{ objectPosition: project.coverPos }}
          />          <span className="more__veil" aria-hidden="true" />
          <span className="more__open">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
              <path d="M7 13 L13 7M8.5 7H13v4.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            查看图纸
          </span>
        </span>
        <span className="more__body">
          <span className="more__meta">
            <Meta>{project.category}</Meta>
            <span aria-hidden="true">·</span>
            <Meta>{project.year}</Meta>
          </span>
          <span className="more__title">{project.title}</span>
          <span className="more__en">{project.titleLatin}</span>
          <span className="more__blurb">{project.blurb}</span>
        </span>
        </button>
      </BorderGlow>
    </Reveal>
  )
}

/* ------------------------------------------------------------------ */

export default function Works() {
  // 记录「打开了哪个项目、从第几张开始看」
  const [viewer, setViewer] = useState(null)

  const open = (project, index = 0) => setViewer({ project, index })
  const close = () => setViewer(null)

  return (
    <section className="works" id="works">
      <div className="wrap">
        <SectionHead num="02" title="精选项目" en="SELECTED WORKS" note="2022 — 2025" />

        <Reveal className="works__lede" delay={80}>
          <p>
            从公共建筑到城市更新，从乡村产业到交互设计。以下三个项目完整呈现了从概念推敲到图纸表达的思考过程，
            其余课程设计可在下方展开查看。
          </p>
          <div className="works__count">
            <b>{String(featuredProjects.length).padStart(2, '0')}</b>
            <Meta>FEATURED</Meta>
            <span aria-hidden="true">/</span>
            <b>{String(moreProjects.length).padStart(2, '0')}</b>
            <Meta>MORE</Meta>
          </div>
        </Reveal>

        <div className="works__featured">
          {featuredProjects.map((p, i) => (
            <FeaturedCard
              key={p.id}
              project={p}
              flipped={i % 2 === 1}
              onOpen={(index) => open(p, index)}
            />
          ))}
        </div>

        <div className="works__more">
          <div className="works__moreHead">
            <Meta>其他课程设计 / MORE PROJECTS</Meta>
            <span className="works__rule" aria-hidden="true" />
          </div>
          <div className="works__moreGrid">
            {moreProjects.map((p, i) => (
              <MoreCard key={p.title} project={p} delay={i * 60} onOpen={() => open(p, 0)} />
            ))}
          </div>
        </div>
      </div>

      {viewer ? (
        <Lightbox project={viewer.project} initialIndex={viewer.index} onClose={close} />
      ) : null}
    </section>
  )
}
