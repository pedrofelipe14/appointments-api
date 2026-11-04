import { useState } from 'react'
import type { Provider } from '../api'
import { useApp } from '../context'
import { browserZone } from '../time'

const ZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return []
  }
})()

export function ProviderSetup({ onCreated }: { onCreated: (p: Provider) => void }) {
  const { api, user, t, fail, changed } = useApp()
  const [name, setName] = useState(user.name)
  const [about, setAbout] = useState('')
  const [timezone, setTimezone] = useState(browserZone)
  const [hours, setHours] = useState(24)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      onCreated(await api.createProvider({ name: name.trim(), about: about.trim() || undefined, timezone, confirmWithinHours: hours }))
      changed()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card setup" onSubmit={submit}>
      <h2>{t.provider.setupTitle}</h2>
      <p className="muted">{t.provider.setupIntro}</p>
      <label>
        {t.provider.name}
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder={t.provider.namePlaceholder} />
      </label>
      <label>
        {t.provider.about}
        <textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={1000} rows={3} />
      </label>
      <div className="row">
        <label>
          {t.provider.timezone}
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} list="zones" required spellCheck={false} />
          <datalist id="zones">
            {ZONES.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </label>
        <label>
          {t.provider.confirmWithin}
          <input type="number" min={1} max={168} value={hours} onChange={(e) => setHours(Number(e.target.value))} required />
        </label>
      </div>
      <p className="hint">{t.provider.confirmWithinHint}</p>
      <button className="btn primary" disabled={busy}>
        {t.provider.create}
      </button>
    </form>
  )
}
