import { useState } from 'react'
import type { Provider, Service } from '../api'
import { useApp } from '../context'
import { formatDuration, formatPrice } from '../time'

const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 180, 240]

export function ServicesEditor({ provider, onAdded }: { provider: Provider; onAdded: (s: Service) => void }) {
  const { api, t, lang, fail, changed } = useApp()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(60)
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      onAdded(
        await api.addService(provider.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          durationMinutes: duration,
          priceCents: Math.round(Number(price.replace(',', '.')) * 100),
        }),
      )
      setName('')
      setDescription('')
      setPrice('')
      changed()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="list">
        {provider.services.length === 0 && <p className="empty">{t.provider.noServices}</p>}
        {provider.services.map((s) => (
          <article key={s.id} className="service-row">
            <div>
              <strong>{s.name}</strong>
              {s.description && <span className="muted">{s.description}</span>}
            </div>
            <span>{formatDuration(s.durationMinutes)}</span>
            <strong>{formatPrice(s.priceCents, lang)}</strong>
          </article>
        ))}
      </section>

      <form className="card service-form" onSubmit={submit}>
        <h3>{t.provider.addService}</h3>
        <label>
          {t.provider.serviceName}
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder={t.provider.serviceNamePlaceholder} />
        </label>
        <label>
          {t.provider.serviceDescription}
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </label>
        <div className="row">
          <label>
            {t.provider.duration}
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {formatDuration(d)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.provider.price}
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required pattern="\d+([.,]\d{1,2})?" placeholder="15000" />
          </label>
        </div>
        <button className="btn primary" disabled={busy}>
          {t.provider.addService}
        </button>
      </form>
    </>
  )
}
