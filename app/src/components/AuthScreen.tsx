import { useEffect, useState } from 'react'
import { Api, ApiError } from '../api'
import type { Strings } from '../i18n'
import type { Session } from '../session'

interface Props {
  base: string
  onBaseChange: (base: string) => void
  t: Strings
  onSession: (session: Session) => void
}

type Health = 'checking' | 'online' | 'offline'

export function AuthScreen({ base, onBaseChange, t, onSession }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<'client' | 'provider'>('client')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [health, setHealth] = useState<Health>('checking')

  // Is the API there? Checked whenever the URL changes (debounced while typing).
  useEffect(() => {
    setHealth('checking')
    let live = true
    const timer = setTimeout(() => {
      new Api(base)
        .providers()
        .then(() => live && setHealth('online'))
        .catch(() => live && setHealth('offline'))
    }, 400)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [base])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const api = new Api(base)
    try {
      if (mode === 'register') await api.register({ email, name, password, role })
      const { accessToken, expiresIn } = await api.login({ email, password })
      const user = await new Api(base, accessToken).me()
      onSession({ token: accessToken, expiresAt: Date.now() + expiresIn * 1000, user })
    } catch (err) {
      setError(err instanceof ApiError && err.status === 0 ? t.errors.offline : (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <section className="pitch">
        <h1>{t.auth.pitch}</h1>
        <ul>
          {t.auth.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <form className="card auth-card" onSubmit={submit}>
        <div className="tabs" role="tablist">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {m === 'login' ? t.auth.login : t.auth.register}
            </button>
          ))}
        </div>

        {mode === 'register' && (
          <>
            <div className="roles">
              {(['client', 'provider'] as const).map((r) => (
                <button key={r} type="button" className={`choice${role === r ? ' on' : ''}`} aria-pressed={role === r} onClick={() => setRole(r)}>
                  <strong>{r === 'client' ? t.auth.asClient : t.auth.asProvider}</strong>
                  <span>{r === 'client' ? t.auth.asClientHint : t.auth.asProviderHint}</span>
                </button>
              ))}
            </div>
            <label>
              {t.auth.name}
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />
            </label>
          </>
        )}
        <label>
          {t.auth.email}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          {t.auth.password}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
          {mode === 'register' && <span className="hint">{t.auth.passwordHint}</span>}
        </label>

        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy || health === 'offline'}>
          {mode === 'login' ? t.auth.submitLogin : t.auth.submitRegister}
        </button>

        <details className="server" open={health === 'offline'}>
          <summary>
            {t.server.label} <span className={`health ${health}`}>{t.server[health]}</span>
          </summary>
          <input value={base} onChange={(e) => onBaseChange(e.target.value.trim())} spellCheck={false} aria-label={t.server.label} />
          {health === 'offline' && <p className="hint">{t.server.help}</p>}
        </details>
      </form>
    </div>
  )
}
