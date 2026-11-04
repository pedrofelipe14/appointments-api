import { useEffect, useRef, useState } from 'react'
import type { Strings } from '../i18n'
import { ApiClient, type Cell, type LogEntry, runRace, runTour } from '../playground'

interface Props {
  base: string
  onBaseChange: (url: string) => void
  t: Strings['playground']
}

type Health = 'checking' | 'online' | 'offline'

/** Runs real scenarios against the API from the browser and shows every request. */
export function Playground({ base, onBaseChange, t }: Props) {
  const [health, setHealth] = useState<Health>('checking')
  const [log, setLog] = useState<LogEntry[]>([])
  const [cells, setCells] = useState<Cell[]>([])
  const [result, setResult] = useState<{ distinct: number; late: number } | null>(null)
  const [running, setRunning] = useState(false)
  const logEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setHealth('checking')
    const timer = setTimeout(() => {
      fetch(`${base}/health`)
        .then((r) => !cancelled && setHealth(r.ok ? 'online' : 'offline'))
        .catch(() => !cancelled && setHealth('offline'))
    }, 300) // wait for typing to settle
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [base])

  // Braces matter: scrollIntoView returns a promise in current browsers, and an effect
  // must not return anything but a cleanup function.
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [log])

  // Updates an entry in place when its response arrives.
  const record = (entry: LogEntry) =>
    setLog((prev) => {
      const i = prev.findIndex((e) => e.id === entry.id)
      return i < 0 ? [...prev, entry] : prev.map((e, j) => (j === i ? entry : e))
    })

  const run = async (scenario: 'tour' | 'race') => {
    setRunning(true)
    setLog([])
    setCells([])
    setResult(null)
    const api = new ApiClient(base, record)
    try {
      if (scenario === 'tour') await runTour(api)
      else setResult(await runRace(api, (i, s) => setCells((prev) => { const next = [...prev]; next[i] = s; return next })))
    } catch {
      setHealth('offline')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="playground">
      <div className="pg-config">
        <label>
          <span>{t.baseUrl}</span>
          <input value={base} onChange={(e) => onBaseChange(e.target.value.replace(/\/$/, ''))} spellCheck={false} />
        </label>
        <span className={`health ${health}`}>{health === 'online' ? t.online : health === 'offline' ? t.offline : '…'}</span>
      </div>
      {health === 'offline' && <p className="muted small">{t.offlineHelp}</p>}

      <div className="pg-scenarios">
        <button disabled={running || health !== 'online'} onClick={() => run('tour')}>
          <strong>{t.tour}</strong>
          <span>{t.tourHelp}</span>
        </button>
        <button disabled={running || health !== 'online'} onClick={() => run('race')}>
          <strong>{t.race}</strong>
          <span>{t.raceHelp}</span>
        </button>
      </div>

      {cells.length > 0 && (
        <div className="race">
          <div className="race-grid">
            {/* Sorted by the time each request got, so the day fills up like a calendar. */}
            {[...cells].sort((a, b) => (a.time ?? '~').localeCompare(b.time ?? '~')).map((c, i) => (
              <span key={i} className={`cell ${c.status === 201 ? 'won' : c.status === 'pending' ? 'pending' : 'lost'}`} title={String(c.status)}>
                {c.status === 'pending' ? '' : c.time ?? c.status}
              </span>
            ))}
          </div>
          {result && <p className="race-result">{t.raceResult(result.distinct, result.late)}</p>}
        </div>
      )}

      <div className="log" aria-live="polite">
        {log.length === 0 && <p className="muted">{running ? t.running : t.empty}</p>}
        {log.map((e) => (
          <details key={e.id} className="log-entry">
            <summary>
              <span className={`method ${e.method.toLowerCase()}`}>{e.method}</span>
              <code>{e.path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '…')}</code>
              {e.note && <span className="note">{e.note}</span>}
              <span className={`status ${e.status ? `s${String(e.status)[0]}` : 'wait'}`}>{e.status ?? '…'}</span>
              {e.ms !== undefined && <span className="muted small">{e.ms} ms</span>}
            </summary>
            {e.body !== undefined && <pre className="json"><code>{JSON.stringify(e.body, null, 2)}</code></pre>}
            {e.response !== undefined && <pre className="json"><code>{JSON.stringify(e.response, null, 2)}</code></pre>}
          </details>
        ))}
        <div ref={logEnd} />
      </div>
    </div>
  )
}
