import type { ReactNode } from 'react'
import type { Appointment } from '../api'
import { useApp } from '../context'
import { formatDay, formatPrice, formatTime } from '../time'

interface Props {
  appointment: Appointment
  zone: string
  /** The other party: the provider for a client, the client for a provider. */
  who: string
  children?: ReactNode
}

export function AppointmentCard({ appointment: a, zone, who, children }: Props) {
  const { t, lang } = useApp()
  return (
    <article className={`appt ${a.status}`}>
      <div className="when">
        <span>{formatDay(a.startsAt, zone, lang)}</span>
        <strong>{formatTime(a.startsAt, zone)}</strong>
        <small>{formatTime(a.endsAt, zone)}</small>
      </div>
      <div className="what">
        <div className="what-top">
          <strong>{a.serviceName}</strong>
          <span className={`state ${a.status}`}>{t.status[a.status]}</span>
        </div>
        <span className="muted">
          {who} · {formatPrice(a.priceCents, lang)}
        </span>
        {a.note && <p className="note">“{a.note}”</p>}
        {a.rejectionReason && (
          <p className="reason">
            {t.client.reason}: {a.rejectionReason}
          </p>
        )}
        {children && <div className="actions">{children}</div>}
      </div>
    </article>
  )
}
