import 'reflect-metadata'
import { type INestApplication, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import type { AppConfig } from './config'

/** The configured app, shared by main.ts and the tests so both run exactly the same setup. */
export async function createApp(config: AppConfig): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(config), { logger: ['error', 'warn'] })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields...
      forbidNonWhitelisted: true, // ...and reject requests that send them
      transform: true,
    }),
  )
  app.enableShutdownHooks()

  const docs = new DocumentBuilder()
    .setTitle('Court Booking API')
    .setDescription('Book football courts: venues, courts, live availability and bookings that can never overlap.')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, docs))

  return app
}
