import { useEffect, useRef, useState } from 'react'
import type { Notification } from '../api'
import { useApp, usePoll } from '../context'
import { formatDay, formatTime, relative } from '../time'

/** Bell with the unread count; opening the list marks everything as read. */
export function Notifications() {
  const { api, t, lang, fail, revision, changed } = useApp()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const seen = useRef(-1)

  usePoll(
    () =>
      api
        .notifications()
        .then((n) => {
          setItems(n.items)
          setUnread(n.unread)
          // Something new arrived (a request, an answer): reload the lists too.
          if (seen.current >= 0 && n.unread > seen.current) changed()
          seen.current = n.unread
        })
        .catch(fail),
    10_000,
    [api, revision],
  )

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const toggle = () => {
    setOpen((o) => !o)
    if (!open && unread) {
      setUnread(0)
      seen.current = 0
      api.readNotifications().catch(fail)
    }
  }

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return (
    <div className="bell-box" ref={box}>
      <button className="ghost bell" onClick={toggle} aria-expanded={open} aria-label={t.notifications.title}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Zm4 4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <h3>{t.notifications.title}</h3>
          {items.length === 0 && <p className="muted">{t.notifications.empty}</p>}
          <ul>
            {items.map((n) => (
              <li key={n.id} className={n.read ? '' : 'new'}>
                <span className={`dot ${n.kind}`} />
                <div>
                  <strong>{t.notifications.kinds[n.kind]}</strong>
                  <span>
                    {n.serviceName} · {formatDay(n.startsAt, zone, lang)} {formatTime(n.startsAt, zone)}
                  </span>
                  <small>{relative(n.createdAt, lang)}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
