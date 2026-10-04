import { Pic, Reveal, SectionHead, Meta, Counter, CopyValue, Crosshair } from './Primitives.jsx'
import { profile, metrics, skills, campus } from '../data/content.js'

function ContactRow({ item }) {
  const inner = (
    <>
      <Meta className="about__contactLabel">{item.label}</Meta>
      <span className={`about__contactValue ${item.mono ? 'is-mono' : ''}`}>{item.value}</span>
      {item.href ? (
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true" className="about__contactArrow">
          <path d="M4 12 L12 4M6 4h6v6" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      ) : null}
    </>
  )

  if (item.copyable) {
    return (
      <li className="about__contactItem is-copyable">
        <Meta className="about__contactLabel">{item.label}</Meta>
        <CopyValue value={item.value} />
      </li>
    )
  }
  if (item.href) {
    return (
      <li className="about__contactItem">
        <a href={item.href}>{inner}</a>
      </li>
    )
  }
  return <li className="about__contactItem is-static">{inner}</li>
}

export default function About() {
  return (
    <section className="about" id="about">
      <div className="wrap">
        <SectionHead num="01" title="个人经历" en="PROFILE / EXPERIENCE" note="关于我" />

        <div className="about__grid">
          {/* 人物图 */}
          <Reveal className="about__figure" delay={60}>
            <figure className="figure">
              <Crosshair className="figure__cross figure__cross--tl" />
              <Crosshair className="figure__cross figure__cross--br" />
              <Pic
                src="portrait/portrait"
                widths={[600, 1200]}
                sizes="(max-width: 1100px) 60vw, 480px"
                alt="王云康个人形象照"
                className="figure__img"
              />
              <figcaption className="figure__cap">
                <Meta>{profile.nameLatin}</Meta>
                <span>{profile.school} · {profile.degree}</span>
              </figcaption>
            </figure>

            <div className="about__badges">
              <div className="badge">
                <Meta>在读</Meta>
                <b>{profile.grade}</b>
              </div>
              <div className="badge">
                <Meta>学制</Meta>
                <b>五年制本科</b>
              </div>
            </div>
          </Reveal>

          {/* 文字 */}
          <div className="about__body">
            <Reveal delay={120}>
              <h3 className="about__name">
                <span className="about__nameCn">{profile.name}</span>
                <span className="about__nameEn">{profile.nameLatin}</span>
              </h3>
              <p className="about__role">
                {profile.role} · {profile.degree} · {profile.period}
              </p>
            </Reveal>

            <Reveal delay={180}>
              <div className="about__intro">
                {profile.intro.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </Reveal>

            <Reveal delay={240}>
              <blockquote className="about__quote">
                <span className="about__quoteMark" aria-hidden="true">
                  “
                </span>
                <p>{profile.selfEval}</p>
              </blockquote>
            </Reveal>

            <Reveal delay={300}>
              <div className="about__campus">
                <Meta className="about__blockTitle">校园经历 / CAMPUS</Meta>
                <ul>
                  {campus.map((c) => (
                    <li key={c.role}>
                      <b>{c.role}</b>
                      <span>{c.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={340}>
              <div className="about__hobbies">
                <Meta className="about__blockTitle">兴趣爱好 / INTERESTS</Meta>
                <div className="about__chips">
                  {profile.hobbies.map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          {/* 联系方式 */}
          <Reveal className="about__aside" delay={180}>
            <div className="panel">
              <div className="panel__head">
                <Meta>CONTACT</Meta>
                <span className="panel__dot" aria-hidden="true" />
                <Meta>可随时联系</Meta>
              </div>
              <ul className="about__contact">
                {profile.contacts.map((item) => (
                  <ContactRow key={item.label} item={item} />
                ))}
              </ul>

              <div className="panel__divider" aria-hidden="true" />

              <Meta className="about__blockTitle">技能 / SKILLS</Meta>
              <ul className="skills">
                {skills.map((s, i) => (
                  <li key={s.name} style={{ '--i': i }}>
                    <div className="skills__row">
                      <span className="skills__name">{s.name}</span>
                      <span className="skills__group">{s.group}</span>
                    </div>
                    <span className="skills__bar" aria-hidden="true">
                      <i style={{ '--level': `${s.level}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        {/* 项目数据 */}
        <div className="metrics">
          <Meta className="metrics__title">项目数据 / BY THE NUMBERS</Meta>
          <div className="metrics__grid">
            {metrics.map((m, i) => (
              <Reveal className="metric" key={m.label} delay={i * 70}>
                <div className="metric__value">
                  <Counter value={m.value} />
                  <em>{m.unit}</em>
                </div>
                <div className="metric__label">{m.label}</div>
                <div className="metric__note">{m.note}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
