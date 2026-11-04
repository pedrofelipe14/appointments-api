import { useState } from 'react'
import { type Call, type Lang as CodeLang, SNIPPETS } from '../snippets'

const LABELS: Record<CodeLang, string> = { curl: 'curl', js: 'JavaScript', python: 'Python' }

interface Props {
  call: Call
  base: string
  copyLabel: string
  copiedLabel: string
}

/** The same request as curl, JavaScript and Python, with a copy button. */
export function CodeTabs({ call, base, copyLabel, copiedLabel }: Props) {
  const [lang, setLang] = useState<CodeLang>('curl')
  const [copied, setCopied] = useState(false)
  const code = SNIPPETS[lang](call, base)

  return (
    <div className="code">
      <div className="code-bar">
        <div role="tablist">
          {(Object.keys(LABELS) as CodeLang[]).map((l) => (
            <button key={l} role="tab" aria-selected={l === lang} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>
              {LABELS[l]}
            </button>
          ))}
        </div>
        <button
          className="copy"
          onClick={() => {
            navigator.clipboard?.writeText(code).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }}
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  )
}

/** A plain code block (no tabs), for SQL and other snippets. */
export function Code({ children }: { children: string }) {
  return (
    <div className="code">
      <pre><code>{children}</code></pre>
    </div>
  )
}
