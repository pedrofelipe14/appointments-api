<div align="center">

# Appointments API

**El cliente pide "esta semana, a la tarde", la API le asigna un horario libre y el profesional lo confirma. Nunca se dan dos turnos a la misma hora, aunque los pedidos lleguen en el mismo instante.**

[English](README.md) · **Español**

[![CI](https://github.com/pedrofelipe14/appointments-api/actions/workflows/ci.yml/badge.svg)](https://github.com/pedrofelipe14/appointments-api/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/Node-24-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-28_passing-2ea44f)

![Diez clientes piden turno en el mismo instante y reciben diez horarios distintos](docs/race.png)

</div>

**Portal para desarrolladores:** [pedrofelipe14.github.io/appointments-api](https://pedrofelipe14.github.io/appointments-api/) tiene una guía rápida con ejemplos en curl, JavaScript y Python, una guía de integración, la referencia generada automáticamente y un playground en vivo. La imagen de arriba sale de ese playground: 10 clientes piden turno a la vez en un día que tiene 10 horarios libres.

Es el backend para cualquier negocio que trabaja con turnos: una profe de guitarra, una peluquería, un kinesiólogo, un profesor particular.

1. El **profesional** publica sus servicios (duración y precio) y su horario semanal.
2. El **cliente** no busca en una grilla: dice qué días y qué parte del día le sirven, y la API **le asigna el primer horario libre**. También puede pedir un horario exacto.
3. El pedido queda **pendiente** y guarda el horario hasta que el profesional lo **confirma** o lo **rechaza** con un motivo.
4. Si nadie responde a tiempo (24 h por defecto), el pedido **vence** y el horario se libera.
5. Las dos partes reciben **notificaciones** en cada paso.

## Qué muestra este proyecto

| | |
|---|---|
| **Concurrencia bien resuelta** | **10 pedidos simultáneos de "el primer horario libre" reciben 10 horarios distintos**, y el 11.º recibe `409`. Con un horario exacto, **25 pedidos simultáneos generan un solo turno**. |
| **Lógica de agenda** | Horarios semanales con varios rangos por día, grilla de 15 minutos, preferencia de parte del día, anticipación mínima y zonas horarias. Todo en funciones puras con tests unitarios. |
| **SQL y modelado** | Migraciones escritas a mano, enums, check constraints, una exclusion constraint GiST sobre rangos de tiempo y bloqueos de fila (`FOR UPDATE`, `FOR NO KEY UPDATE`). |
| **Un flujo real** | Una máquina de estados (pendiente → confirmado / rechazado / vencido / cancelado), plazos, reglas de cancelación por rol y notificaciones escritas en la misma transacción que el cambio que informan. |
| **Autenticación y seguridad** | JWT con roles (cliente, profesional, admin), contraseñas con scrypt, el mismo error para contraseña incorrecta y email inexistente, y rechazo de campos inesperados. |
| **Testing** | **28 tests**, casi todos de punta a punta por HTTP contra un **PostgreSQL real**. No hay nada mockeado. |
| **Entrega** | Documentación OpenAPI/Swagger, Dockerfile, `docker compose up`, CI con un servicio de PostgreSQL y un portal bilingüe publicado en GitHub Pages. |

## Lo difícil: diez clientes en el mismo segundo

Diez clientes piden "el primer horario libre del viernes" en el mismo momento. La implementación ingenua calcula los horarios libres y después inserta: los diez ven las 09:00 libres y los diez intentan quedarse con las 09:00.

Lo resuelven dos capas:

```sql
-- 1. Los pedidos para un mismo profesional toman turno (appointments.service.ts).
--    Cada uno ve lo que tomó el anterior, así que recibe el siguiente horario libre.
select 1 from providers where id = $1 for no key update;

-- 2. Y la base rechaza superposiciones igual (migrations/001_init.sql).
constraint appointments_no_overlap exclude using gist (
  provider_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('pending', 'confirmed'))
```

El bloqueo solo pone en fila los pedidos **del mismo profesional**: los de profesionales distintos corren en paralelo. `FOR NO KEY UPDATE` no frena los chequeos de claves foráneas de otros inserts.

La exclusion constraint es la garantía final. Si algún camino del código intentara guardar dos turnos activos que se superponen, PostgreSQL lo rechazaría (`23P01` → `409`). Con rangos semiabiertos `[)`, un turno que termina a las 10:00 puede ir pegado a uno que empieza a las 10:00.

¿Por qué no alcanza con la constraint sola? Fue lo primero que probé, y los tests encontraron el problema. Cuando dos inserts concurrentes chocan en una exclusion constraint, cada uno espera al otro, y PostgreSQL lo resuelve abortando uno con un error de **deadlock** (`40P01`), no con un conflicto limpio. Poner en fila los pedidos de cada profesional elimina el deadlock.

## API

Documentación interactiva en **`/docs`** (Swagger UI) con el servidor corriendo.

| Método | Ruta | Quién | Qué |
|---|---|---|---|
| `POST` | `/auth/register`, `/auth/login` | cualquiera | Crear una cuenta de cliente o profesional y obtener un JWT |
| `GET` | `/auth/me` | con sesión | El usuario actual |
| `POST` | `/providers` | profesional | Crear el perfil (zona horaria, horas para confirmar) |
| `GET` | `/providers`, `/providers/:id` | cualquiera | Profesionales con sus servicios y horarios |
| `PUT` | `/providers/:id/working-hours` | ese profesional | Reemplazar el horario semanal |
| `POST` | `/providers/:id/services` | ese profesional | Ofrecer un servicio: duración y precio |
| `GET` | `/providers/:id/availability?serviceId&date` | cualquiera | Cada horario libre de ese día |
| `POST` | `/appointments` | con sesión | Pedir turno: `{serviceId, from, to, timeOfDay}` o `{serviceId, startsAt}` |
| `GET` | `/appointments/me` | con sesión | Mis turnos como cliente |
| `GET` | `/appointments/inbox?status=` | profesional | La agenda del profesional; `pending` = por responder |
| `POST` | `/appointments/:id/confirm` | ese profesional | Confirmar un pedido |
| `POST` | `/appointments/:id/reject` | ese profesional | Rechazar con un motivo |
| `POST` | `/appointments/:id/cancel` | cliente o profesional | El cliente necesita 12 h de anticipación si ya estaba confirmado |
| `GET` | `/notifications` | con sesión | Mis notificaciones y cuántas no leí |
| `POST` | `/notifications/read` | con sesión | Marcar todas como leídas |

<details>
<summary>Captura de la documentación en Swagger</summary>

![Swagger UI](docs/swagger.png)

</details>

## La vida de un turno

```mermaid
stateDiagram-v2
  [*] --> pending: POST /appointments
  pending --> confirmed: el profesional confirma
  pending --> rejected: el profesional rechaza (con motivo)
  pending --> expired: nadie respondió a tiempo
  pending --> cancelled: cualquiera de los dos cancela
  confirmed --> cancelled: el cliente (con 12 h) o el profesional
```

`pending` y `confirmed` ocupan el horario. Los demás estados lo liberan.

## Decisiones de ingeniería

- **La agenda son funciones puras.** `freeSlots()` y `slotProblem()` en `src/scheduling/slots.ts` reciben horarios, intervalos ocupados y "ahora" como argumentos, así que se testean sin base de datos y sin reloj.
- **Guardar en UTC, razonar en la zona del profesional.** Las fechas son `timestamptz`. El horario de trabajo y "a la tarde" se interpretan en la zona del profesional con Luxon, así que una clase de las 16:00 es a las 16:00 *de Buenos Aires*, corra donde corra el servidor.
- **Plazos sin cron.** El `respond_by` de un pedido es lo que llegue primero entre el plazo para confirmar y el inicio del turno. Los pedidos vencidos se marcan en la siguiente lectura o escritura de ese profesional, dentro de la misma transacción. Nada puede quedar atrasado.
- **Las notificaciones son parte del cambio.** Cada notificación se inserta en la misma transacción que el cambio de estado que informa. Una confirmación nunca existe sin su notificación, y al revés tampoco.
- **SQL en lugar de un ORM.** Las reglas clave son una exclusion constraint y bloqueos de fila, y con SQL directo quedan a la vista. Las migraciones son archivos `.sql` numerados, cada uno aplicado una sola vez en su propia transacción.
- **Los tests corren la app real.** `createApp()` arma el mismo servidor, con la misma validación, los mismos guards y el mismo Swagger, para producción y para los tests.

## Cómo correrlo

**Con Docker** (API y PostgreSQL):

```sh
docker compose up --build
# → http://localhost:3000/docs
```

**Sin Docker**, con tu propio PostgreSQL 14 o más nuevo:

```sh
cp .env.example .env               # completá DATABASE_URL y JWT_SECRET
npm install
npm run build && npm start         # aplica las migraciones y escucha en :3000
```

**Los tests** necesitan una base de PostgreSQL que puedan borrar:

```sh
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/appointments_test npm test
```

## Tests

- **Agenda automática**: elige el primer horario libre según la preferencia y saltea los que ocupan pedidos pendientes. **10 pedidos simultáneos → 10 horarios distintos**, y `409` cuando el día está lleno.
- **Horarios exactos**: **25 pedidos simultáneos por el mismo horario → 1 turno**. Los horarios fuera del horario de trabajo, fuera de la grilla o demasiado pronto se rechazan con un motivo claro.
- **Respuestas del profesional**: confirmar y rechazar notifican al cliente; un pedido no se responde dos veces; solo responde el profesional correcto; los pedidos vencidos liberan su horario.
- **Cancelaciones**: el cliente cancela un pendiente cuando quiera y un confirmado con 12 h; el profesional cancela siempre; un extraño recibe `403`.
- **Profesionales**: validación de horarios y servicios, permisos sobre el propio perfil, y una disponibilidad que se achica a medida que entran pedidos.
- **Agenda** (tests unitarios): la grilla, el corte del mediodía, la parte del día, superposiciones, la anticipación, búsquedas de varios días y días libres.
- **Autenticación**: registro y login, emails duplicados sin importar mayúsculas, sin enumeración de cuentas y sin admins autoproclamados.

## Próximos pasos

- [ ] Publicarla (Render + Neon) para que el playground del portal funcione sin correr nada localmente.
- [ ] Mandar las notificaciones por email o WhatsApp.
- [ ] Reprogramar: que el profesional proponga otro horario en lugar de solo rechazar.

## Stack

Node 24 · TypeScript · NestJS · PostgreSQL 18 (`pg`, SQL directo) · Luxon · JWT · Swagger/OpenAPI · Vitest + Supertest · React + Vite (portal) · Docker · GitHub Actions
