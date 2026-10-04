import { Reveal, SectionHead, Meta, Crosshair } from './Primitives.jsx'
import { strengths, profile } from '../data/content.js'

function StrengthCard({ item, index }) {
  return (
    <Reveal className="st" delay={index * 60}>
      <article className="st__card">
        <Crosshair className="st__cross" />
        <header className="st__head">
          <Meta className="st__tag">{item.tag}</Meta>
          <span className="st__index" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
        </header>

        <h3 className="st__title">{item.title}</h3>
        <p className="st__sub">{item.subtitle}</p>
        <p className="st__body">{item.body}</p>

        <ul className="st__points">
          {item.points.map((p) => (
            <li key={p}>
              <span className="st__pointMark" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>

        <span className="st__hair" aria-hidden="true" />
      </article>
    </Reveal>
  )
}

export default function Strengths() {
  return (
    <section className="strengths" id="strengths">
      <div className="wrap">
        <SectionHead num="03" title="个人优势" en="CAPABILITIES" note="我能带来的" />

        <Reveal className="strengths__lede" delay={80}>
          <p>
            从场地调研到最终出图，我把一名建筑学学生能承担的工作拆成六项可交付的能力。
            每一项都对应作品集里可以翻到的具体图纸。
          </p>
        </Reveal>

        <div className="strengths__grid">
          {strengths.map((s, i) => (
            <StrengthCard key={s.tag} item={s} index={i} />
          ))}
        </div>

        <Reveal className="strengths__band" delay={120}>
          <div className="band">
            <div className="band__text">
              <Meta>工作方式 / HOW I WORK</Meta>
              <p>
                先读懂场地与任务书，再动手画第一根线。习惯把每个决策都落到图纸上，
                也习惯在交出方案前先自己挑一遍毛病。
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal className="strengths__sign" delay={160}>
          <span className="strengths__signLine" aria-hidden="true" />
          <p>
            <b>{profile.name}</b>
            <span>
              {profile.school} · {profile.degree} · {profile.period}
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
