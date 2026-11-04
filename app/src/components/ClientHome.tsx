import { useMemo, useState } from 'react'
import type { Appointment, Provider } from '../api'
import { useApp, usePoll } from '../context'
import { browserZone } from '../time'
import { AppointmentCard } from './AppointmentCard'
import { BookFlow } from './BookFlow'

export function ClientHome() {
  const { api, t, fail, revision, changed } = useApp()
  const [tab, setTab] = useState<'book' | 'mine'>('book')
  const [providers, setProviders] = useState<Provider[] | null>(null)
  const [mine, setMine] = useState<Appointment[] | null>(null)

  usePoll(() => api.providers().then(setProviders).catch(fail), 60_000, [api, revision])
  usePoll(() => api.mine().then(setMine).catch(fail), 15_000, [api, revision])

  const zones = useMemo(() => new Map(providers?.map((p) => [p.id, p.timezone])), [providers])
  const now = Date.now()
  const upcoming = (mine ?? []).filter((a) => new Date(a.endsAt).getTime() > now && (a.status === 'pending' || a.status === 'confirmed'))
  const past = (mine ?? []).filter((a) => !upcoming.includes(a))
  upcoming.sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const cancel = async (a: Appointment) => {
    if (!confirm(t.client.cancelConfirm)) return
    try {
      await api.cancel(a.id)
      changed()
    } catch (e) {
      fail(e)
    }
  }

  const card = (a: Appointment, actions: boolean) => (
    <AppointmentCard key={a.id} appointment={a} zone={zones.get(a.providerId) ?? browserZone()} who={a.providerName}>
      {actions && (
        <button className="btn danger small" onClick={() => cancel(a)}>
          {t.client.cancel}
        </button>
      )}
    </AppointmentCard>
  )

  return (
    <>
      <nav className="tabs page-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'book'} className={tab === 'book' ? 'on' : ''} onClick={() => setTab('book')}>
          {t.client.book}
        </button>
        <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
          {t.client.mine}
          {upcoming.length > 0 && <span className="count">{upcoming.length}</span>}
        </button>
      </nav>

      {tab === 'book' ? (
        providers === null ? (
          <p className="muted">{t.loading}</p>
        ) : (
          <BookFlow providers={providers} onSeeMine={() => setTab('mine')} />
        )
      ) : mine === null ? (
        <p className="muted">{t.loading}</p>
      ) : mine.length === 0 ? (
        <p className="empty">{t.client.empty}</p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="list">
              <h2>{t.client.upcoming}</h2>
              {upcoming.map((a) => card(a, true))}
            </section>
          )}
          {past.length > 0 && (
            <section className="list">
              <h2>{t.client.past}</h2>
              {past.map((a) => card(a, false))}
            </section>
          )}
        </>
      )}
    </>
  )
}
