// Reads the API's OpenAPI document (public/openapi.json, generated from the NestJS code by
// `npm run openapi`), so the reference on this site always matches the real API.

export interface Schema {
  $ref?: string
  type?: string
  format?: string
  enum?: unknown[]
  items?: Schema
  properties?: Record<string, Schema>
  required?: string[]
  example?: unknown
  description?: string
  default?: unknown
  nullable?: boolean
  minimum?: number
  maximum?: number
  minLength?: number
}

export interface Parameter {
  name: string
  in: 'path' | 'query' | 'header'
  required?: boolean
  description?: string
  schema?: Schema
}

interface RawOperation {
  summary?: string
  description?: string
  tags?: string[]
  parameters?: Parameter[]
  requestBody?: { content: Record<string, { schema: Schema }> }
  responses: Record<string, { description?: string; content?: Record<string, { schema: Schema }> }>
  security?: unknown[]
}

export interface OpenApiSpec {
  info: { title: string; version: string; description?: string }
  paths: Record<string, Record<string, RawOperation>>
  components?: { schemas?: Record<string, Schema> }
}

export interface Operation {
  id: string
  method: string
  path: string
  tag: string
  summary: string
  description: string
  auth: boolean
  parameters: Parameter[]
  body?: Schema
  responses: { status: string; description: string; schema?: Schema }[]
}

const METHOD_ORDER = ['get', 'post', 'put', 'patch', 'delete']

/** Every operation, in a stable order: grouped by tag as they appear in the spec. */
export function operations(spec: OpenApiSpec): Operation[] {
  const out: Operation[] = []
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const method of METHOD_ORDER) {
      const op = methods[method]
      if (!op) continue
      out.push({
        id: `${method}-${path}`.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, ''),
        method: method.toUpperCase(),
        path,
        tag: op.tags?.[0] ?? 'other',
        summary: op.summary ?? '',
        description: op.description ?? '',
        auth: (op.security?.length ?? 0) > 0,
        parameters: op.parameters ?? [],
        body: op.requestBody?.content['application/json']?.schema,
        responses: Object.entries(op.responses).map(([status, r]) => ({
          status,
          description: r.description ?? '',
          schema: r.content?.['application/json']?.schema,
        })),
      })
    }
  }
  return out
}

/** Operations grouped by tag, keeping the order tags first appear in. */
export function byTag(ops: Operation[]): [string, Operation[]][] {
  const groups = new Map<string, Operation[]>()
  for (const op of ops) groups.set(op.tag, [...(groups.get(op.tag) ?? []), op])
  return [...groups.entries()]
}

/** Follows a $ref into components.schemas. */
export function resolve(spec: OpenApiSpec, schema: Schema | undefined): Schema | undefined {
  if (!schema?.$ref) return schema
  const name = schema.$ref.split('/').pop()!
  return spec.components?.schemas?.[name]
}

/** The schema's name when it's a reference ("BookingResponse"), or its type ("BookingResponse[]"). */
export function schemaName(schema: Schema | undefined): string {
  if (!schema) return ''
  if (schema.$ref) return schema.$ref.split('/').pop()!
  if (schema.type === 'array') return `${schemaName(schema.items)}[]`
  return schema.type ?? ''
}

/** A plausible example value for a schema, preferring the examples written in the API code. */
export function example(spec: OpenApiSpec, schema: Schema | undefined, depth = 0): unknown {
  const s = resolve(spec, schema)
  if (!s || depth > 4) return null
  if (s.example !== undefined) return s.example
  if (s.default !== undefined) return s.default
  if (s.enum?.length) return s.enum[0]
  switch (s.type) {
    case 'object':
      return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, example(spec, v, depth + 1)]))
    case 'array':
      return [example(spec, s.items, depth + 1)]
    case 'number':
    case 'integer':
      return s.minimum ?? 1
    case 'boolean':
      return true
    case 'string':
      return s.format === 'uuid' ? '3f8a2c1e-5b7d-4e9f-a1c2-7d6e5f4a3b2c' : 'string'
    default:
      return null
  }
}
