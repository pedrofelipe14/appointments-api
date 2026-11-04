<div align="center">

# Court Booking API

**A REST API for booking football courts, where a double booking is impossible, even under load.**

**English** · [Español](README.es.md)

[![CI](https://github.com/pedrofelipe14/court-booking-api/actions/workflows/ci.yml/badge.svg)](https://github.com/pedrofelipe14/court-booking-api/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/Node-24-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-27_passing-2ea44f)

</div>

**Developer portal:** [pedrofelipe14.github.io/court-booking-api](https://pedrofelipe14.github.io/court-booking-api/) has a quickstart with curl, JavaScript and Python examples, an integration guide, an auto-generated reference and a live playground.

Venue owners publish their courts and opening hours. Players see live availability, book a slot and cancel with enough notice. It's the backend that my app [CoordeFutbol](https://github.com/pedrofelipe14/coordenadas-futbol), which organizes matches among friends, needs in order to book the pitch.

## What this project shows

| | |
|---|---|
| **Concurrency done right** | **25 simultaneous requests** for the same slot: exactly **one** gets the booking and the other 24 get `409 Conflict`. The guarantee comes from a PostgreSQL exclusion constraint, not from application code that can race. |
| **SQL and data modelling** | Hand-written migrations, enums, check constraints, a GiST exclusion constraint over time ranges, and row locking (`FOR UPDATE`) where it matters. |
| **Auth and security** | JWT with roles (player, owner, admin) and scrypt password hashing with constant-time comparison. Login returns the same error for a wrong password and an unknown email. Requests with unexpected fields are rejected. |
| **Domain rules** | Time zones, a slot grid, opening hours, unpaid holds that expire, and a 24-hour notice before a player can cancel. |
| **Testing** | **27 tests**, mostly end-to-end over HTTP against a **real PostgreSQL**: no mocked database. |
| **Delivery** | OpenAPI/Swagger docs, a Dockerfile, `docker compose up`, and CI with a PostgreSQL service that also builds the Docker image. |
| **Developer experience** | A bilingual developer portal: quickstart, integration guide, a reference generated from the OpenAPI spec on every build (so it never drifts from the code), and a playground that runs real scenarios against the API, including the 25-request race. |

## The hard part: no double bookings

Two players press "book" on the same slot in the same instant. Checking first ("is it free?") and then inserting doesn't work, because both checks pass before either insert lands.

The rule lives in the database instead (`migrations/001_init.sql`):

```sql
constraint bookings_no_overlap exclude using gist (
  court_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('pending_payment', 'confirmed'))
```

PostgreSQL refuses to keep two active bookings whose time ranges overlap on the same court, whatever order the transactions run in. The API turns that error (`23P01`) into a `409 Conflict`. Thanks to the half-open `[)` ranges, a booking that ends at 20:00 doesn't collide with one that starts at 20:00. Cancelled and expired bookings stop counting, so their slot frees up.

The test suite fires 25 concurrent requests at one slot and checks that exactly one row was written.

## API

Interactive docs at **`/docs`** (Swagger UI) once the server is running.

| Method | Path | Who | What |
|---|---|---|---|
| `POST` | `/auth/register` | anyone | Create a player or owner account |
| `POST` | `/auth/login` | anyone | Get a JWT (valid 1 h) |
| `GET` | `/auth/me` | logged in | The current user |
| `POST` | `/venues` | owner, admin | Create a venue (with its time zone) |
| `GET` | `/venues`, `/venues/:id` | anyone | Browse venues |
| `POST` | `/venues/:id/courts` | venue owner | Add a court: sport, price per hour, opening hours, slot length |
| `GET` | `/venues/:id/courts`, `/courts/:id` | anyone | Browse courts |
| `GET` | `/courts/:id/availability?date=` | anyone | Every slot that day, free or taken |
| `POST` | `/bookings` | logged in | Book. Held for 15 minutes until paid; `409` if taken |
| `GET` | `/bookings/me` | logged in | My bookings |
| `POST` | `/bookings/:id/cancel` | player or venue owner | Players need 24 h notice; owners can always cancel |
| `GET` | `/venues/:id/bookings?date=` | venue owner | The venue's agenda for a day |
| `GET` | `/health` | anyone | Up and connected to the database |

<details>
<summary>Screenshot of the Swagger docs</summary>

![Swagger UI](docs/swagger.png)

</details>

## Data model

```mermaid
erDiagram
  USERS ||--o{ VENUES : owns
  USERS ||--o{ BOOKINGS : makes
  VENUES ||--o{ COURTS : has
  COURTS ||--o{ BOOKINGS : "is booked in"

  USERS { uuid id PK
    text email UK
    text password_hash
    user_role role }
  VENUES { uuid id PK
    uuid owner_id FK
    text name
    text timezone }
  COURTS { uuid id PK
    uuid venue_id FK
    sport sport
    int price_per_hour_cents
    time opens_at
    time closes_at
    int slot_minutes }
  BOOKINGS { uuid id PK
    uuid court_id FK
    uuid user_id FK
    timestamptz starts_at
    timestamptz ends_at
    booking_status status
    int price_cents
    timestamptz expires_at }
```

```mermaid
stateDiagram-v2
  [*] --> pending_payment: POST /bookings
  pending_payment --> confirmed: payment (next milestone)
  pending_payment --> expired: 15 min without payment
  pending_payment --> cancelled: cancel
  confirmed --> cancelled: cancel
```

## Engineering decisions

- **SQL instead of an ORM.** The core rule is an exclusion constraint over time ranges, and ORMs don't model that well. Plain SQL keeps the constraint, the transactions and the locks in plain sight. Migrations are numbered `.sql` files, each applied once inside its own transaction.
- **Store UTC, reason in the venue's time zone.** Timestamps are `timestamptz`. Opening hours and the slot grid are checked in the venue's local time with Luxon. A court opens at 09:00 *in Buenos Aires*, whatever time zone the server runs in.
- **Unpaid holds expire lazily.** A new booking holds its slot for 15 minutes. Expired holds are marked `expired` inside the same transaction as the next booking attempt on that court, and availability ignores them, so there's no cron job that could fall behind.
- **No native dependencies.** Passwords use Node's built-in scrypt, so `npm ci` works the same on Windows, macOS, Linux and in the Docker image.
- **The tests run the real app.** `createApp()` builds the server with the same validation, guards and Swagger setup for production and for tests. The tests only point it at a different database.

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
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/courts_test npm test
```

## Tests

- **Bookings**: price and payment hold; overlapping requests rejected and back-to-back bookings allowed; **25 concurrent requests → 1 booking**; opening hours, the slot grid and past times; expired holds freeing their slot.
- **Availability**: booked slots are marked; cancelled and expired ones are not.
- **Cancelling**: the 24-hour rule for players, owner overrides, cancelled slots can be booked again, and strangers get `403`.
- **Owners**: each owner sees and manages only their own venues.
- **Auth**: register and login, duplicate emails ignoring case, no account enumeration, no self-made admins, unknown fields rejected.
- **Schedule** (unit tests): slot generation and every reason a booking time can be rejected.

## Roadmap

- [ ] Payments with Mercado Pago: an idempotent webhook that confirms a hold exactly once, even if the notification arrives twice.
- [ ] Deploy (Render / Fly.io) with a public demo URL.
- [ ] Connect it to CoordeFutbol so a match can book its pitch.

## Stack

Node 24 · TypeScript · NestJS · PostgreSQL 18 (`pg`, raw SQL) · Luxon · JWT · Swagger/OpenAPI · Vitest + Supertest · Docker · GitHub Actions
