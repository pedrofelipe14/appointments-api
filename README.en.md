<div align="center">

# Appointments API

**Clients ask for "this week, in the afternoon". The API picks a free time and the provider confirms it. Two appointments never land on the same time, even when the requests arrive in the same instant.**

[Español](README.md) · **English**

[![CI](https://github.com/pedrofelipe14/appointments-api/actions/workflows/ci.yml/badge.svg)](https://github.com/pedrofelipe14/appointments-api/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/Node-24-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-28_passing-2ea44f)

![Ten clients request at the same instant and get ten different times](docs/race.png)

</div>

**Developer portal:** [pedrofelipe14.github.io/appointments-api](https://pedrofelipe14.github.io/appointments-api/) has a quickstart with curl, JavaScript and Python examples, an integration guide, an auto-generated reference and a live playground. The image above comes from that playground: 10 clients request a time on a day with 10 free times, all at once.

The API is a backend for any business that works by appointment: a guitar teacher, a hairdresser, a physio, a tutor.

1. The **provider** publishes services (duration and price) and weekly working hours.
2. The **client** doesn't hunt through a grid. They say which days and which part of the day suit them, and the API **assigns the first free time**. They can still ask for an exact time.
3. The request stays **pending** and holds the time until the provider **confirms** it or **rejects** it with a reason.
4. If nobody answers in time (24 h by default), the request **expires** and the time frees up.
5. Both sides get **notifications** at every step.

## What this project shows

| | |
|---|---|
| **Concurrency done right** | **10 simultaneous "first free time" requests get 10 different times**, and an 11th gets `409`. With an exact time, **25 simultaneous requests produce exactly one appointment**. |
| **Scheduling logic** | Weekly hours with several ranges per day, a 15-minute grid, time-of-day preferences, minimum notice, and time zones. It is all pure, unit-tested functions. |
| **SQL and data modelling** | Hand-written migrations, enums, check constraints, a GiST exclusion constraint over time ranges, and row locks (`FOR UPDATE`, `FOR NO KEY UPDATE`). |
| **A real workflow** | A state machine (pending → confirmed / rejected / expired / cancelled), deadlines, cancellation rules per role, and notifications written in the same transaction as the change they describe. |
| **Auth and security** | JWT with roles (client, provider, admin), scrypt password hashing, the same error for a wrong password and an unknown email, and rejection of unexpected fields. |
| **Testing** | **28 tests**, mostly end-to-end over HTTP against a **real PostgreSQL**. Nothing is mocked. |
| **Delivery** | OpenAPI/Swagger docs, a Dockerfile, `docker compose up`, CI with a PostgreSQL service, and a bilingual developer portal deployed to GitHub Pages. |

## The hard part: ten clients, the same second

Ten clients ask for "the first free time on Friday" at the same moment. The naive implementation computes free times, then inserts. All ten see 09:00 as free and all ten try to take 09:00.

Two layers solve it:

```sql
-- 1. Requests for the same provider take turns (appointments.service.ts).
--    Each one sees what the previous one took, so it gets the next free time.
select 1 from providers where id = $1 for no key update;

-- 2. The database refuses overlaps anyway (migrations/001_init.sql).
constraint appointments_no_overlap exclude using gist (
  provider_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('pending', 'confirmed'))
```

The lock only queues requests **for the same provider**. Requests for different providers run in parallel. `FOR NO KEY UPDATE` doesn't block the foreign-key checks of other inserts.

The exclusion constraint is the final guarantee. If any code path ever tried to write two active appointments that overlap, PostgreSQL would reject it (`23P01` → `409`). Half-open `[)` ranges let an appointment that ends at 10:00 sit next to one that starts at 10:00.

Why not rely on the constraint alone? I tried that first and the tests caught the problem. When concurrent inserts conflict on an exclusion constraint, each one waits for the other, and PostgreSQL resolves that by aborting one with a **deadlock** error (`40P01`), not a clean conflict. Queuing per provider removes the deadlock.

## API

Interactive docs at **`/docs`** (Swagger UI) once the server is running.

| Method | Path | Who | What |
|---|---|---|---|
| `POST` | `/auth/register`, `/auth/login` | anyone | Create a client or provider account, get a JWT |
| `GET` | `/auth/me` | logged in | The current user |
| `POST` | `/providers` | provider | Create your provider profile (time zone, hours to confirm) |
| `GET` | `/providers`, `/providers/:id` | anyone | Providers with their services and hours |
| `PUT` | `/providers/:id/working-hours` | that provider | Replace the weekly schedule |
| `POST` | `/providers/:id/services` | that provider | Offer a service: duration and price |
| `GET` | `/providers/:id/availability?serviceId&date` | anyone | Every free start time that day |
| `POST` | `/appointments` | logged in | Request: `{serviceId, from, to, timeOfDay}` or `{serviceId, startsAt}` |
| `GET` | `/appointments/me` | logged in | My appointments as a client |
| `GET` | `/appointments/inbox?status=` | provider | The provider's agenda; `pending` = needs an answer |
| `POST` | `/appointments/:id/confirm` | that provider | Confirm a pending request |
| `POST` | `/appointments/:id/reject` | that provider | Reject with a reason |
| `POST` | `/appointments/:id/cancel` | client or provider | Clients need 12 h notice once confirmed |
| `GET` | `/notifications` | logged in | My notifications and the unread count |
| `POST` | `/notifications/read` | logged in | Mark all as read |

<details>
<summary>Screenshot of the Swagger docs</summary>

![Swagger UI](docs/swagger.png)

</details>

## The life of an appointment

```mermaid
stateDiagram-v2
  [*] --> pending: POST /appointments
  pending --> confirmed: provider confirms
  pending --> rejected: provider rejects (with reason)
  pending --> expired: no answer in time
  pending --> cancelled: either side cancels
  confirmed --> cancelled: client (12 h ahead) or provider
```

`pending` and `confirmed` hold the time. Every other state frees it.

## Data model

```mermaid
erDiagram
  USERS ||--o| PROVIDERS : "is a"
  PROVIDERS ||--o{ WORKING_HOURS : has
  PROVIDERS ||--o{ SERVICES : offers
  SERVICES ||--o{ APPOINTMENTS : "booked as"
  USERS ||--o{ APPOINTMENTS : requests
  USERS ||--o{ NOTIFICATIONS : receives

  PROVIDERS { uuid id PK
    uuid user_id FK
    text timezone
    int confirm_within_hours }
  WORKING_HOURS { uuid provider_id FK
    int weekday
    time starts_at
    time ends_at }
  SERVICES { uuid id PK
    int duration_minutes
    int price_cents }
  APPOINTMENTS { uuid id PK
    timestamptz starts_at
    timestamptz ends_at
    appointment_status status
    timestamptz respond_by
    text rejection_reason }
  NOTIFICATIONS { uuid id PK
    text kind
    timestamptz read_at }
```

## Engineering decisions

- **The scheduler is pure functions.** `freeSlots()` and `slotProblem()` in `src/scheduling/slots.ts` take hours, busy intervals and "now" as arguments, so they are unit-tested without a database or a clock.
- **Store UTC, reason in the provider's time zone.** Timestamps are `timestamptz`. Working hours and "afternoon" are interpreted in the provider's zone with Luxon, so a 16:00 class is at 16:00 *in Buenos Aires* wherever the server runs.
- **Deadlines without a cron job.** A request's `respond_by` is the sooner of the provider's confirmation window and the start time. Overdue requests expire on the next read or write for that provider, in the same transaction. Nothing can fall behind.
- **Notifications are part of the change.** Each notification is inserted in the same transaction as the state change it reports, so a confirmation can never happen without its notification, and the reverse can't happen either.
- **SQL instead of an ORM.** The key rules are an exclusion constraint and row locks. Plain SQL keeps them visible. Migrations are numbered `.sql` files, each applied once in its own transaction.
- **The tests run the real app.** `createApp()` builds the same server, with the same validation, guards and Swagger setup, for production and for tests.

## Running it

**With Docker** (API and PostgreSQL):

```sh
docker compose up --build
# → http://localhost:3000/docs
```

**Without Docker**, using your own PostgreSQL 14+:

```sh
cp .env.example .env               # set DATABASE_URL and JWT_SECRET
npm install
npm run build && npm start         # applies migrations, then serves on :3000
```

**Tests** need a PostgreSQL database they can wipe:

```sh
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/appointments_test npm test
```

## Tests

- **Auto-scheduling**: picks the first free time matching the preference and skips times held by pending requests. **10 simultaneous requests → 10 distinct times**, then `409` when the day is full.
- **Exact times**: **25 simultaneous requests for one time → 1 appointment**. Times outside working hours, off the grid or too soon are rejected with a clear reason.
- **Provider answers**: confirm and reject notify the client; a request can't be answered twice; only the right provider can answer; overdue requests expire and free their time.
- **Cancelling**: clients cancel pending requests anytime and confirmed ones with 12 h notice; providers can always cancel; strangers get `403`.
- **Providers**: working-hours and service validation, ownership checks, availability that shrinks as requests come in.
- **Scheduler** (unit tests): the grid, lunch breaks, time of day, busy overlaps, notice, multi-day windows and days off.
- **Auth**: register and login, duplicate emails ignoring case, no account enumeration, no self-made admins.

## Roadmap

- [ ] Deploy (Render + Neon) so the portal's playground works without running anything locally.
- [ ] Email or WhatsApp delivery for notifications.
- [ ] Reschedule: the provider proposes another time instead of only rejecting.

## Stack

Node 24 · TypeScript · NestJS · PostgreSQL 18 (`pg`, raw SQL) · Luxon · JWT · Swagger/OpenAPI · Vitest + Supertest · React + Vite (portal) · Docker · GitHub Actions
