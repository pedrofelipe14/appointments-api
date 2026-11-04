import { useEffect, useMemo, useState } from 'react'
import { Code, CodeTabs } from './components/CodeTabs'
import { Endpoint } from './components/Endpoint'
import { Playground } from './components/Playground'
import { initialLang, type Lang, saveLang, STRINGS } from './i18n'
import { byTag, type OpenApiSpec, operations } from './openapi'
import type { Call } from './snippets'

const REPO = 'https://github.com/pedrofelipe14/appointments-api'
const SERVICE = '3f8a2c1e-5b7d-4e9f-a1c2-7d6e5f4a3b2c'
const APPOINTMENT = '9b1d4e7a-2c3f-4a5b-8d6e-1f2a3b4c5d6e'

// The first three quickstart requests (texts come from i18n, in the same order).
const QUICKSTART: Call[] = [
  { method: 'POST', path: '/auth/login', body: { email: 'lio@example.com', password: 'a-long-password' } },
  { method: 'POST', path: '/appointments', auth: true, body: { serviceId: SERVICE, from: '2026-11-16', to: '2026-11-22', timeOfDay: 'afternoon' } },
  { method: 'POST', path: `/appointments/${APPOINTMENT}/confirm`, auth: true },
]

const CONSTRAINT_SQL = `-- 1. Requests for one provider take turns (appointments.service.ts)
select 1 from providers where id = $1 for no key update;
-- ...then find the first free time and insert it.

-- 2. And the database refuses overlaps anyway (migrations/001_init.sql)
constraint appointments_no_overlap exclude using gist (
  provider_id with =,                             -- same provider...
  tstzrange(starts_at, ends_at, '[)') with &&     -- ...and overlapping times
) where (status in ('pending', 'confirmed'))`

const TIMEZONE_JS = `// Times come back in UTC: show them in the provider's time zone.
const label = new Intl.DateTimeFormat('es-AR', {
  timeZone: provider.timezone,       // "America/Argentina/Buenos_Aires"
  weekday: 'long', hour: '2-digit', minute: '2-digit',
})
label.format(new Date(appointment.startsAt))   // "jueves, 16:00"`

const CONFLICT_JS = `const res = await fetch(\`\${API}/appointments\`, { method: 'POST', headers, body })
if (res.status === 409) {
  const { message } = await res.json()   // "No free time between 2026-11-16 and 2026-11-22"
  showToast('No hay lugar esa semana. ¿Probamos la próxima?')
}`

const loadBase = () => {
  try {
    return localStorage.getItem('cba-base') ?? 'http://localhost:3000'
  } catch {
    return 'http://localhost:3000'
  }
}

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [spec, setSpec] = useState<OpenApiSpec | null>(null)
  const [base, setBase] = useState(loadBase)
  const t = STRINGS[lang]

  useEffect(() => {
    document.documentElement.lang = lang
    saveLang(lang)
  }, [lang])

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}openapi.json`).then((r) => r.json()).then(setSpec)
  }, [])

  const changeBase = (url: string) => {
    setBase(url)
    try {
      localStorage.setItem('cba-base', url)
    } catch {
      // not remembered, still works
    }
  }

  const groups = useMemo(() => (spec ? byTag(operations(spec)) : []), [spec])
  const sections = ['overview', 'quickstart', 'guide', 'errors', 'reference', 'playground'] as const

  return (
    <>
      <header className="top">
        <a href="#" className="brand"><span className="ball" aria-hidden="true" />Appointments API</a>
        <nav>
          {sections.map((s) => <a key={s} href={`#${s}`}>{t.nav[s]}</a>)}
        </nav>
        <div className="top-actions">
          <div className="lang" role="radiogroup" aria-label="Language">
            {(['es', 'en'] as const).map((l) => (
              <button key={l} role="radio" aria-checked={lang === l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <a className="gh" href={REPO}>GitHub</a>
        </div>
      </header>

      <main>
        <section className="hero">
          <p className="kicker">{t.hero.kicker}</p>
          <h1>{t.hero.title}</h1>
          <p className="lead">{t.hero.subtitle}</p>
          <div className="ctas">
            <a className="btn primary" href="#playground">{t.hero.tryIt}</a>
            <a className="btn" href="#reference">{t.hero.reference}</a>
          </div>
          <div className="stats">
            {t.hero.stats.map(([n, label]) => (
              <div key={label}><strong>{n}</strong><span>{label}</span></div>
            ))}
          </div>
        </section>

        <section id="overview">
          <h2>{t.overview.title}</h2>
          <div className="features">
            {t.overview.features.map(([title, text]) => (
              <article key={title}><h3>{title}</h3><p>{text}</p></article>
            ))}
          </div>

          <div className="split">
            <div>
              <h3>{t.overview.problemTitle}</h3>
              <p>{t.overview.problem}</p>
            </div>
            <Code>{CONSTRAINT_SQL}</Code>
          </div>

          <h3>{t.overview.lifecycleTitle}</h3>
          <ol className="lifecycle">
            {t.overview.states.map(([state, text]) => (
              <li key={state}><code className={`state ${state}`}>{state}</code><span>{text}</span></li>
            ))}
          </ol>
        </section>

        <section id="quickstart">
          <h2>{t.quickstart.title}</h2>
          <p className="muted">{t.quickstart.intro}</p>
          <ol className="steps">
            {t.quickstart.steps.map(([title, text], i) => (
              <li key={title}>
                <div className="step-text"><span className="step-n">{i + 1}</span><h3>{title}</h3><p>{text}</p></div>
                {i < 3
                  ? <CodeTabs call={QUICKSTART[i]} base={base} copyLabel={t.quickstart.copy} copiedLabel={t.quickstart.copied} />
                  : <Code>{CONFLICT_JS}</Code>}
              </li>
            ))}
          </ol>
        </section>

        <section id="guide">
          <h2>{t.guide.title}</h2>
          <p className="muted">{t.guide.intro}</p>
          <div className="guide">
            {t.guide.sections.map(([title, text]) => (
              <article key={title}><h3>{title}</h3><p>{text}</p></article>
            ))}
          </div>
          <h3>{t.guide.tzTitle}</h3>
          <Code>{TIMEZONE_JS}</Code>
        </section>

        <section id="errors">
          <h2>{t.errors.title}</h2>
          <p className="muted">{t.errors.intro}</p>
          <div className="table-wrap">
            <table className="errors">
              <thead><tr>{t.errors.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {t.errors.rows.map(([code, when, what]) => (
                  <tr key={code}><td><span className={`status s${code[0]}`}>{code}</span></td><td>{when}</td><td>{what}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="reference">
          <h2>{t.reference.title}</h2>
          <p className="muted">{t.reference.intro}</p>
          {spec && groups.map(([tag, ops]) => (
            <div key={tag} className="tag-group">
              <h3 className="tag">{tag}</h3>
              {ops.map((op) => <Endpoint key={op.id} spec={spec} op={op} t={t.reference} />)}
            </div>
          ))}
        </section>

        <section id="playground">
          <h2>{t.playground.title}</h2>
          <p className="muted">{t.playground.intro}</p>
          <Playground base={base} onBaseChange={changeBase} t={t.playground} />
        </section>
      </main>

      <footer><a href={REPO}>{t.footer}</a></footer>
    </>
  )
}
