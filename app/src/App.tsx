import { useCallback, useEffect, useMemo, useState } from 'react'
import { Api, ApiError } from './api'
import { AuthScreen } from './components/AuthScreen'
import { ClientHome } from './components/ClientHome'
import { Notifications } from './components/Notifications'
import { ProviderHome } from './components/ProviderHome'
import { Ctx, type AppContext } from './context'
import { STRINGS, initialLang, saveLang, type Lang } from './i18n'
import { loadBase, loadSession, saveBase, saveSession, type Session } from './session'

const PORTAL = 'https://pedrofelipe14.github.io/appointments-api/'

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [base, setBase] = useState(loadBase)
  const [session, setSession] = useState<Session | null>(() => loadSession())
  const [toast, setToast] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const t = STRINGS[lang]

  useEffect(() => {
    document.documentElement.lang = lang
    saveLang(lang)
  }, [lang])
  useEffect(() => saveSession(session), [session])
  useEffect(() => saveBase(base), [base])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  // Log out when the token runs out, even if the tab sits idle.
  useEffect(() => {
    if (!session) return
    const timer = setTimeout(() => {
      setSession(null)
      setToast(t.errors.session)
    }, session.expiresAt - Date.now())
    return () => clearTimeout(timer)
  }, [session, t])

  const fail = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        setSession(null)
        setToast(t.errors.session)
      } else if (error instanceof ApiError && error.status === 0) setToast(t.errors.offline)
      else setToast(error instanceof Error ? error.message : String(error))
    },
    [t],
  )

  const ctx = useMemo<AppContext | null>(
    () =>
      session && {
        api: new Api(base, session.token),
        user: session.user,
        lang,
        t,
        fail,
        revision,
        changed: () => setRevision((r) => r + 1),
      },
    [base, session, lang, t, fail, revision],
  )

  return (
    <>
      <header className="top">
        <a className="brand" href="./">
          <span className="mark" aria-hidden="true" />
          <span>
            {t.brand}
            <small>{t.tagline}</small>
          </span>
        </a>
        <div className="top-actions">
          {ctx && (
            <Ctx.Provider value={ctx}>
              <Notifications />
            </Ctx.Provider>
          )}
          <div className="lang" role="radiogroup" aria-label="Language">
            {(['es', 'en'] as const).map((l) => (
              <button key={l} role="radio" aria-checked={lang === l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <a className="ghost small-hide" href={PORTAL}>
            {t.portal}
          </a>
          {session && (
            <button className="ghost" onClick={() => setSession(null)}>
              {t.logout}
            </button>
          )}
        </div>
      </header>

      <main>
        {ctx ? (
          <Ctx.Provider value={ctx}>
            <p className="hello">
              {t.hello(ctx.user.name)} <span className="role">{t.roles[ctx.user.role]}</span>
            </p>
            {ctx.user.role === 'provider' ? <ProviderHome /> : <ClientHome />}
          </Ctx.Provider>
        ) : (
          <AuthScreen base={base} onBaseChange={setBase} t={t} onSession={setSession} />
        )}
      </main>

      {toast && (
        <div className="toast" role="alert" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </>
  )
}
