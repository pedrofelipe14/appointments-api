import { useState } from 'react'
import type { Provider } from '../api'
import { useApp } from '../context'
import { DEFAULT_WEEK, WEEKDAYS, fromWeek, invalidDays, nextRange, toWeek, type Week } from '../hours'
import { weekdayName } from '../time'

export function HoursEditor({ provider, onSaved }: { provider: Provider; onSaved: (p: Provider) => void }) {
  const { api, t, lang, fail, changed } = useApp()
  const [week, setWeek] = useState<Week>(() => (provider.workingHours.length ? toWeek(provider.workingHours) : DEFAULT_WEEK))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const bad = invalidDays(week)
  const edit = (next: Week) => {
    setWeek(next)
    setSaved(false)
  }
  const setRange = (day: number, i: number, key: 'startsAt' | 'endsAt', value: string) =>
    edit({ ...week, [day]: week[day].map((r, j) => (j === i ? { ...r, [key]: value } : r)) })
  const addRange = (day: number) => edit({ ...week, [day]: [...week[day], nextRange(week[day])] })
  const removeRange = (day: number, i: number) => edit({ ...week, [day]: week[day].filter((_, j) => j !== i) })

  const save = async () => {
    setBusy(true)
    try {
      onSaved(await api.setHours(provider.id, fromWeek(week)))
      setSaved(true)
      changed()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card hours-editor">
      <p className="muted">{t.provider.hoursIntro}</p>
      <div className="week">
        {WEEKDAYS.map((d) => (
          <div key={d} className={`weekday${bad.includes(d) ? ' bad' : ''}`}>
            <span className="day-name">{weekdayName(d, lang)}</span>
            <div className="ranges">
              {week[d].length === 0 && <span className="muted">{t.provider.closed}</span>}
              {week[d].map((r, i) => (
                <span key={i} className="range">
                  <input type="time" step={900} value={r.startsAt} onChange={(e) => setRange(d, i, 'startsAt', e.target.value)} aria-label={`${weekdayName(d, lang)} ${i + 1} start`} />
                  <span>–</span>
                  <input type="time" step={900} value={r.endsAt} onChange={(e) => setRange(d, i, 'endsAt', e.target.value)} aria-label={`${weekdayName(d, lang)} ${i + 1} end`} />
                  <button className="x" onClick={() => removeRange(d, i)} aria-label={t.provider.remove} title={t.provider.remove}>
                    ×
                  </button>
                </span>
              ))}
              <button className="ghost small" onClick={() => addRange(d)}>
                {t.provider.addRange}
              </button>
            </div>
          </div>
        ))}
      </div>
      {bad.length > 0 && <p className="error">{t.provider.badRanges}</p>}
      <div className="actions">
        <button className="btn primary" disabled={busy || bad.length > 0} onClick={save}>
          {saved ? `✓ ${t.provider.saved}` : t.provider.save}
        </button>
        <button className="btn" onClick={() => edit(DEFAULT_WEEK)}>
          {t.provider.useDefault}
        </button>
      </div>
    </section>
  )
}
