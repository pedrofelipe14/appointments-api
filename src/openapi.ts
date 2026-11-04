import { writeFileSync } from 'node:fs'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { createApp } from './app'

/** Writes the OpenAPI spec to a file, so the developer portal's reference is generated
    from the code itself and can't drift. No database is touched: the pool connects lazily. */
async function main(): Promise<void> {
  const out = process.argv[2] ?? 'openapi.json'
  const app = await createApp({
    databaseUrl: 'postgres://unused@localhost/unused',
    jwtSecret: 'only-building-the-openapi-document',
    port: 0,
    corsOrigins: [],
  })
  const spec = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Court Booking API')
      .setDescription('Book football courts: venues, courts, live availability and bookings that can never overlap.')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  )
  writeFileSync(out, JSON.stringify(spec, null, 2))
  console.log(`OpenAPI spec → ${out} (${Object.keys(spec.paths).length} paths)`)
  await app.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
