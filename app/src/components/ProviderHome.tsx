import { useState } from 'react'
import type { Appointment, Provider } from '../api'
import { useApp, usePoll } from '../context'
import { relative } from '../time'
import { AppointmentCard } from './AppointmentCard'
import { HoursEditor } from './HoursEditor'
import { ProviderSetup } from './ProviderSetup'
import { ServicesEditor } from './ServicesEditor'

type Tab = 'requests' | 'agenda' | 'hours' | 'services'

export function ProviderHome() {
  const { api, user, t, lang, fail, revision, changed } = useApp()
  const [profile, setProfile] = useState<Provider | null | undefined>(undefined) // undefined: loading, null: none yet
  const [inbox, setInbox] = useState<Appointment[] | null>(null)
  const [tab, setTab] = useState<Tab>('requests')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  usePoll(
    () =>
      api
        .providers()
        .then((all) => setProfile(all.find((p) => p.userId === user.id) ?? null))
        .catch(fail),
    60_000,
    [api, revision],
  )
  usePoll(() => profile && api.inbox().then(setInbox).catch(fail), 10_000, [api, revision, !!profile])

  if (profile === undefined) return <p className="muted">{t.loading}</p>
  if (profile === null) return <ProviderSetup onCreated={(p) => (setProfile(p), setTab('hours'))} />

  const zone = profile.timezone
  const now = Date.now()
  const all = inbox ?? []
  const pending = all.filter((a) => a.status === 'pending').sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const agenda = all.filter((a) => a.status === 'confirmed' && new Date(a.endsAt).getTime() > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const history = all.filter((a) => !pending.includes(a) && !agenda.includes(a))

  const act = async (id: string, call: () => Promise<unknown>) => {
    setBusy(id)
    try {
      await call()
      setRejecting(null)
      setReason('')
      changed()
    } catch (e) {
      fail(e)
      changed() // it may have expired or been cancelled meanwhile
    } finally {
      setBusy(null)
    }
  }

  const missing = [!profile.workingHours.length && t.provider.missingHours, !profile.services.length && t.provider.missingServices].filter(Boolean)
  const tabs: [Tab, string, number][] = [
    ['requests', t.provider.requests, pending.length],
    ['agenda', t.provider.agenda, agenda.length],
    ['hours', t.provider.hours, 0],
    ['services', t.provider.services, 0],
  ]

  return (
    <>
      <div className="profile-head">
        <h1>{profile.name}</h1>
        <span className="muted small">{zone.replace(/_/g, ' ')}</span>
      </div>
      {missing.length > 0 && (
        <p className="warn">
          {t.provider.missing} {missing.join(' · ')}
        </p>
      )}

      <nav className="tabs page-tabs" role="tablist">
        {tabs.map(([id, label, count]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
            {count > 0 && <span className="count">{count}</span>}
          </button>
        ))}
      </nav>

      {tab === 'requests' &&
        (inbox === null ? (
          <p className="muted">{t.loading}</p>
        ) : pending.length === 0 ? (
          <p className="empty">{t.provider.noRequests}</p>
        ) : (
          <section className="list">
            {pending.map((a) => (
              <AppointmentCard key={a.id} appointment={a} zone={zone} who={a.clientName}>
                {rejecting === a.id ? (
                  <form
                    className="reject"
                    onSubmit={(e) => {
                      e.preventDefault()
                      act(a.id, () => api.reject(a.id, reason.trim()))
                    }}
                  >
                    <label>
                      {t.provider.rejectReason}
                      <input value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={300} placeholder={t.provider.rejectPlaceholder} autoFocus />
                    </label>
                    <div className="actions">
                      <button className="btn danger small" disabled={busy === a.id || !reason.trim()}>
                        {t.provider.sendReject}
                      </button>
                      <button type="button" className="btn small" onClick={() => setRejecting(null)}>
                        {t.provider.back}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <button className="btn primary small" disabled={busy === a.id} onClick={() => act(a.id, () => api.confirm(a.id))}>
                      {t.provider.confirm}
                    </button>
                    <button className="btn small" onClick={() => (setRejecting(a.id), setReason(''))}>
                      {t.provider.reject}
                    </button>
                    <span className="deadline">{t.provider.respondIn(relative(a.respondBy, lang))}</span>
                  </>
                )}
              </AppointmentCard>
            ))}
          </section>
        ))}

      {tab === 'agenda' && (
        <>
          <section className="list">
            {agenda.length === 0 && <p className="empty">{t.provider.noAgenda}</p>}
            {agenda.map((a) => (
              <AppointmentCard key={a.id} appointment={a} zone={zone} who={a.clientName}>
                <button className="btn danger small" disabled={busy === a.id} onClick={() => confirm(t.provider.cancelConfirm) && act(a.id, () => api.cancel(a.id))}>
                  {t.provider.cancel}
                </button>
              </AppointmentCard>
            ))}
          </section>
          {history.length > 0 && (
            <section className="list">
              <h2>{t.provider.history}</h2>
              {history.map((a) => (
                <AppointmentCard key={a.id} appointment={a} zone={zone} who={a.clientName} />
              ))}
            </section>
          )}
        </>
      )}

      {tab === 'hours' && <HoursEditor provider={profile} onSaved={setProfile} />}
      {tab === 'services' && <ServicesEditor provider={profile} onAdded={(s) => setProfile({ ...profile, services: [...profile.services, s] })} />}
    </>
  )
}
