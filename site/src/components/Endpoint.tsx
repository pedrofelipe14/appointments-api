import { example, type OpenApiSpec, type Operation, resolve, schemaName } from '../openapi'
import type { Strings } from '../i18n'

interface Props {
  spec: OpenApiSpec
  op: Operation
  t: Strings['reference']
}

/** One endpoint of the reference, built from the OpenAPI spec. Click to expand. */
export function Endpoint({ spec, op, t }: Props) {
  const body = resolve(spec, op.body)
  return (
    <details className="endpoint" id={op.id}>
      <summary>
        <span className={`method ${op.method.toLowerCase()}`}>{op.method}</span>
        <code className="path">{op.path}</code>
        <span className="summary">{op.summary}</span>
        <span className={`lock ${op.auth ? 'on' : ''}`}>{op.auth ? `🔒 ${t.auth}` : t.public}</span>
      </summary>
      <div className="endpoint-body">
        {op.description && <p>{op.description}</p>}

        {op.parameters.length > 0 && (
          <>
            <h4>{t.params}</h4>
            <table className="fields">
              <tbody>
                {op.parameters.map((p) => (
                  <tr key={`${p.in}-${p.name}`}>
                    <td><code>{p.name}</code> <span className="muted">{p.in}</span></td>
                    <td>{p.schema?.type}{p.required && <span className="req"> · {t.required}</span>}</td>
                    <td className="muted">{p.description ?? (p.schema?.example as string) ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {body && (
          <>
            <h4>{t.body} <span className="muted">{schemaName(op.body)}</span></h4>
            <table className="fields">
              <tbody>
                {Object.entries(body.properties ?? {}).map(([name, s]) => (
                  <tr key={name}>
                    <td><code>{name}</code></td>
                    <td>
                      {s.enum ? s.enum.join(' | ') : s.format ?? s.type}
                      {body.required?.includes(name) && <span className="req"> · {t.required}</span>}
                    </td>
                    <td className="muted">{s.description ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h4>{t.example}</h4>
            <pre className="json"><code>{JSON.stringify(example(spec, op.body), null, 2)}</code></pre>
          </>
        )}

        <h4>{t.responses}</h4>
        <ul className="responses">
          {op.responses.map((r) => (
            <li key={r.status}>
              <span className={`status s${r.status[0]}`}>{r.status}</span>
              <span>{r.description || schemaName(r.schema)}</span>
              {r.schema && <span className="muted">{schemaName(r.schema)}</span>}
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
