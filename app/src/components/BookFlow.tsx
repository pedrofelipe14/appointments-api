import { useEffect, useRef, useState } from 'react'
import type { Appointment, Provider, Service, Slot, TimeOfDay } from '../api'
import { useApp } from '../context'
import { summarize } from '../hours'
import { formatDate, formatDay, formatDuration, formatPrice, formatTime, localDate, nextDates, relative, weekdayName } from '../time'

const TIMES: TimeOfDay[] = ['any', 'morning', 'afternoon', 'evening']

/** ISO weekday (1 = Monday) of a YYYY-MM-DD date. */
const isoWeekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() || 7

interface Props {
  providers: Provider[]
  onSeeMine: () => void
}

/** Pick a provider and a service, then either "the first free time between these days" or an exact free time. */
export function BookFlow({ providers, onSeeMine }: Props) {
  const { api, t, lang, fail, changed } = useApp()
  const bookable = providers.filter((p) => p.services.length && p.workingHours.length)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [service, setService] = useState<Service | null>(null)
  const [mode, setMode] = useState<'auto' | 'exact'>('auto')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('any')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [slot, setSlot] = useState<Slot | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Appointment | null>(null)
  const [reload, setReload] = useState(0)
  const autoPick = useRef(true) // the day was picked for the client, not by them

  const zone = provider?.timezone ?? 'UTC'
  const days = provider ? nextDates(zone, 14) : []
  const open = new Set(provider?.workingHours.map((h) => h.weekday))

  const choose = (p: Provider) => {
    setProvider(p)
    setService(p.services.length === 1 ? p.services[0] : null)
    setFrom(localDate(p.timezone))
    setTo(localDate(p.timezone, 6))
    setDate(nextDates(p.timezone, 14).find((d) => p.workingHours.some((h) => h.weekday === isoWeekday(d))) ?? localDate(p.timezone))
    setSlot(null)
    autoPick.current = true
  }

  // Free times for the chosen day.
  useEffect(() => {
    if (!provider || !service || mode !== 'exact' || !date) return
    let live = true
    setSlots(null)
    setSlot(null)
    api
      .availability(provider.id, service.id, date)
      .then((s) => {
        if (!live) return
        // Nothing left on the day picked for them (say, today is over): move on to the next working day.
        const next = nextDates(provider.timezone, 14).find((d) => d > date && provider.workingHours.some((h) => h.weekday === isoWeekday(d)))
        if (!s.length && autoPick.current && next) setDate(next)
        else setSlots(s)
      })
      .catch((e) => live && fail(e))
    return () => {
      live = false
    }
  }, [api, provider, service, mode, date, reload, fail])

  const submit = async () => {
    if (!service) return
    setBusy(true)
    try {
      const body = mode === 'exact' ? { serviceId: service.id, startsAt: slot!.startsAt } : { serviceId: service.id, from, to, timeOfDay }
      setDone(await api.request({ ...body, ...(note.trim() ? { note: note.trim() } : {}) }))
      changed()
    } catch (e) {
      fail(e)
      if (mode === 'exact') setReload((r) => r + 1) // the time may have just been taken: show what is left
    } finally {
      setBusy(false)
    }
  }

  const restart = () => {
    setDone(null)
    setProvider(null)
    setService(null)
    setNote('')
  }

  if (done)
    return (
      <div className="card done">
        <span className="check" aria-hidden="true" />
        <h2>{t.client.requested}</h2>
        <p className="big-time">
          {formatDay(done.startsAt, zone, lang)} · {formatTime(done.startsAt, zone)}
        </p>
        <p>
          {done.serviceName} {t.with} {done.providerName}
        </p>
        <p className="muted">{t.client.requestedBody(done.providerName, relative(done.respondBy, lang))}</p>
        <div className="actions">
          <button className="btn primary" onClick={onSeeMine}>
            {t.client.seeMine}
          </button>
          <button className="btn" onClick={restart}>
            {t.client.another}
          </button>
        </div>
      </div>
    )

  if (!provider)
    return (
      <section>
        <h2>{t.client.pickProvider}</h2>
        {bookable.length === 0 && <p className="empty">{t.client.noProviders}</p>}
        <div className="providers">
          {bookable.map((p) => (
            <button key={p.id} className="card provider" onClick={() => choose(p)}>
              <strong>{p.name}</strong>
              {p.about && <span className="about">{p.about}</span>}
              <span className="muted small">{t.client.services(p.services.length)}</span>
              <span className="hours small">
                {summarize(p.workingHours).map((g) => (
                  <span key={g.days.join()}>
                    {g.days.length > 2
                      ? `${weekdayName(g.days[0], lang, 'short')}–${weekdayName(g.days[g.days.length - 1], lang, 'short')}`
                      : g.days.map((d) => weekdayName(d, lang, 'short')).join(', ')}{' '}
                    {g.ranges}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      </section>
    )

  const ready = service && (mode === 'auto' ? from && to && from <= to : slot)
  return (
    <section className="book">
      <div className="chosen">
        <div>
          <strong>{provider.name}</strong>
          <span className="muted small">{provider.timezone.replace(/_/g, ' ')}</span>
        </div>
        <button className="ghost" onClick={() => setProvider(null)}>
          {t.client.change}
        </button>
      </div>

      <h3>{t.client.pickService}</h3>
      <div className="services">
        {provider.services.map((s) => (
          <button key={s.id} className={`choice${service?.id === s.id ? ' on' : ''}`} aria-pressed={service?.id === s.id} onClick={() => setService(s)}>
            <strong>{s.name}</strong>
            <span>
              {formatDuration(s.durationMinutes)} · {formatPrice(s.priceCents, lang)}
            </span>
            {s.description && <span className="muted">{s.description}</span>}
          </button>
        ))}
      </div>

      {service && (
        <>
          <h3>{t.client.how}</h3>
          <div className="modes">
            {(['auto', 'exact'] as const).map((m) => (
              <button key={m} className={`choice${mode === m ? ' on' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
                <strong>{m === 'auto' ? t.client.auto : t.client.exact}</strong>
                <span>{m === 'auto' ? t.client.autoHint : t.client.exactHint}</span>
              </button>
            ))}
          </div>

          {mode === 'auto' ? (
            <div className="window">
              <label>
                {t.client.from}
                <input type="date" value={from} min={localDate(zone)} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                {t.client.to}
                <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </label>
              <div className="field">
                <span>{t.client.partOfDay}</span>
                <div className="segmented">
                  {TIMES.map((x) => (
                    <button key={x} className={timeOfDay === x ? 'on' : ''} aria-pressed={timeOfDay === x} onClick={() => setTimeOfDay(x)}>
                      {t.timeOfDay[x]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="days" role="listbox">
                {days.map((d) => (
                  <button key={d} role="option" aria-selected={date === d} className={`day${date === d ? ' on' : ''}${open.has(isoWeekday(d)) ? '' : ' closed'}`} onClick={() => ((autoPick.current = false), setDate(d))}>
                    {formatDate(d, lang)}
                  </button>
                ))}
              </div>
              {slots === null ? (
                <p className="muted">{t.loading}</p>
              ) : slots.length === 0 ? (
                <p className="empty">{t.client.noSlots}</p>
              ) : (
                <div className="slots">
                  {slots.map((s) => (
                    <button key={s.startsAt} className={slot?.startsAt === s.startsAt ? 'on' : ''} aria-pressed={slot?.startsAt === s.startsAt} onClick={() => setSlot(s)}>
                      {formatTime(s.startsAt, zone)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <label className="note-field">
            {t.client.note}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder={t.client.notePlaceholder} />
          </label>

          <button className="btn primary wide" disabled={!ready || busy} onClick={submit}>
            {mode === 'auto' ? t.client.submitAuto : t.client.submitExact(slot ? formatTime(slot.startsAt, zone) : '…')}
          </button>
        </>
      )}
    </section>
  )
}
