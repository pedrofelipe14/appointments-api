// Turns one API call into ready-to-paste code in curl, JavaScript and Python.

export interface Call {
  method: string
  path: string
  body?: unknown
  /** Sends the bearer token (shown as $TOKEN / token). */
  auth?: boolean
  query?: Record<string, string>
}

export type Lang = 'curl' | 'js' | 'python'

const withQuery = (path: string, query?: Record<string, string>) =>
  query && Object.keys(query).length ? `${path}?${new URLSearchParams(query)}` : path

const json = (value: unknown, indent: number) => JSON.stringify(value, null, 2).replace(/\n/g, `\n${' '.repeat(indent)}`)

export function curl(call: Call, base: string): string {
  const lines = [`curl -X ${call.method} "${base}${withQuery(call.path, call.query)}"`]
  if (call.auth) lines.push(`  -H "Authorization: Bearer $TOKEN"`)
  if (call.body !== undefined) {
    lines.push(`  -H "Content-Type: application/json"`)
    lines.push(`  -d '${JSON.stringify(call.body)}'`)
  }
  return lines.join(' \\\n')
}

export function javascript(call: Call, base: string): string {
  const headers: string[] = []
  if (call.auth) headers.push('Authorization: `Bearer ${token}`')
  if (call.body !== undefined) headers.push("'Content-Type': 'application/json'")
  const options = [`method: '${call.method}'`]
  if (headers.length) options.push(`headers: { ${headers.join(', ')} }`)
  if (call.body !== undefined) options.push(`body: JSON.stringify(${json(call.body, 2)})`)
  return [
    `const res = await fetch('${base}${withQuery(call.path, call.query)}', {`,
    ...options.map((o) => `  ${o},`),
    '})',
    'const data = await res.json()',
  ].join('\n')
}

export function python(call: Call, base: string): string {
  const args = [`"${base}${call.path}"`]
  if (call.query && Object.keys(call.query).length) args.push(`params=${JSON.stringify(call.query)}`)
  if (call.auth) args.push('headers={"Authorization": f"Bearer {token}"}')
  if (call.body !== undefined) args.push(`json=${json(call.body, 4).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')}`)
  return ['import requests', '', `res = requests.${call.method.toLowerCase()}(`, ...args.map((a) => `    ${a},`), ')', 'data = res.json()'].join('\n')
}

export const SNIPPETS: Record<Lang, (call: Call, base: string) => string> = { curl, js: javascript, python }
