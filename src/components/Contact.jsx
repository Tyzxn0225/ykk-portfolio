import { Pic, Reveal, Meta, Crosshair, CopyValue } from './Primitives.jsx'
import { useButtonGlow } from './BorderGlow/useEdgeGlow.js'
import { profile, sections } from '../data/content.js'

/** 整屏收尾页：联系方式 */
export default function Contact() {
  const year = new Date().getFullYear()
  const mailGlow = useButtonGlow({ glowColor: '225 96 66', glowIntensity: 1.7 })
  const telGlow = useButtonGlow({ glowColor: '225 96 70', glowIntensity: 1.7 })

  return (
    <section className="contact" id="contact">
      <div className="contact__bg" aria-hidden="true">
        <Pic
          src="hero/theater-dusk"
          widths={[960, 1600, 1920]}
          sizes="100vw"
          alt=""
          className="contact__bgImg"
        />
        <span className="contact__scrim" />
        <span className="contact__grid" />
      </div>

      <div className="wrap contact__inner">
        <Reveal className="contact__top">
          <Meta>04 / CONTACT</Meta>
          <span className="contact__rule" aria-hidden="true" />
          <Meta>AVAILABLE FOR OPPORTUNITY</Meta>
        </Reveal>

        <div className="contact__main">
          <Reveal delay={80}>
            <h2 className="contact__title">
              <span className="contact__titleLine">期待与你</span>
              <span className="contact__titleLine contact__titleLine--em">一起把想法建起来。</span>
            </h2>
          </Reveal>

          <Reveal delay={160}>
            <p className="contact__sub">
              寻求建筑实习 / 设计助理岗位。作品集与完整图纸可随时提供，欢迎联系我聊聊。
            </p>
          </Reveal>

          <Reveal delay={220}>
            <div className="contact__cta">
              <a
                className="btn btn--light btn--lg btn--glow"
                href="mailto:884597845@qq.com"
                ref={mailGlow.ref}
                style={mailGlow.style}
              >
                <span>发邮件给我</span>
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
                  <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </a>
              <a
                className="btn btn--outline btn--lg btn--glow"
                href="tel:16635613420"
                ref={telGlow.ref}
                style={telGlow.style}
              >
                <span>166 3561 3420</span>
              </a>
            </div>
          </Reveal>
        </div>

        <div className="contact__cards">
          {profile.contacts.map((item, i) => (
            <Reveal className="ccard" key={item.label} delay={i * 60}>
              <Crosshair className="ccard__cross" />
              <Meta className="ccard__label">{item.label}</Meta>
              {item.copyable ? (
                <CopyValue value={item.value} />
              ) : item.href ? (
                <a className="ccard__value is-mono" href={item.href}>
                  {item.value}
                </a>
              ) : (
                <span className="ccard__value">{item.value}</span>
              )}
            </Reveal>
          ))}
        </div>

        <footer className="contact__footer">
          <div className="contact__footLeft">
            <span className="contact__mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                <rect x="0.5" y="0.5" width="23" height="23" stroke="currentColor" strokeOpacity="0.3" />
                <path d="M6.5 17.5 L12 6.5 L17.5 17.5" stroke="currentColor" strokeWidth="1" />
              </svg>
            </span>
            <p>
              <b>
                {profile.name} · {profile.nameLatin}
              </b>
              <span>
                {profile.school} 建筑学 · {profile.grade}
              </span>
            </p>
          </div>

          <nav className="contact__footNav" aria-label="页脚导航">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.nav}
              </a>
            ))}
          </nav>

          <div className="contact__footRight">
            <Meta>© {year} {profile.nameLatin}</Meta>
            <Meta>DESIGNED &amp; BUILT BY SELF</Meta>
          </div>
        </footer>
      </div>
    </section>
  )
}
