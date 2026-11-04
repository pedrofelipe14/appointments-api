<div align="center">

# Court Booking API

**Una API REST para reservar canchas de fútbol donde es imposible reservar dos veces el mismo turno, incluso bajo carga.**

[English](README.md) · **Español**

[![CI](https://github.com/pedrofelipe14/court-booking-api/actions/workflows/ci.yml/badge.svg)](https://github.com/pedrofelipe14/court-booking-api/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/Node-24-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-27_pasando-2ea44f)

</div>

Los dueños de un complejo publican sus canchas y horarios. Los jugadores ven qué turnos quedan libres en vivo, reservan y pueden cancelar con anticipación. Es el backend que necesita mi app [CoordeFutbol](https://github.com/pedrofelipe14/coordenadas-futbol), que organiza partidos entre amigos, para reservar la cancha.

## Qué demuestra este proyecto

| | |
|---|---|
| **Concurrencia bien resuelta** | **25 pedidos simultáneos** por el mismo turno: exactamente **uno** consigue la reserva y los otros 24 reciben `409 Conflict`. Lo garantiza una *exclusion constraint* de PostgreSQL, no un chequeo en el código que se puede pisar. |
| **SQL y modelado de datos** | Migraciones escritas a mano, enums, *check constraints*, una *exclusion constraint* GiST sobre rangos de tiempo y bloqueo de filas (`FOR UPDATE`) donde hace falta. |
| **Login y seguridad** | JWT con roles (jugador, dueño y admin) y contraseñas con scrypt, comparadas en tiempo constante. El login da el mismo error para una contraseña mal y para un email que no existe. Los pedidos con campos de más se rechazan. |
| **Reglas de negocio** | Zonas horarias, grilla de turnos, horarios de apertura, reservas sin pagar que vencen y 24 horas de anticipación para que un jugador cancele. |
| **Tests** | **27 tests**, la mayoría end-to-end por HTTP contra un **PostgreSQL real**: la base no está simulada. |
| **Entrega** | Documentación OpenAPI/Swagger, Dockerfile, `docker compose up` y CI con un PostgreSQL que además compila la imagen de Docker. |

## Lo difícil: que no haya dos reservas para el mismo turno

Dos jugadores tocan "reservar" en el mismo turno en el mismo instante. Primero chequear ("¿está libre?") y después insertar no alcanza, porque los dos chequeos pasan antes de que llegue cualquiera de los dos inserts.

Por eso la regla vive en la base de datos (`migrations/001_init.sql`):

```sql
constraint bookings_no_overlap exclude using gist (
  court_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('pending_payment', 'confirmed'))
```

PostgreSQL no permite dos reservas activas con horarios superpuestos en la misma cancha, sin importar en qué orden corran las transacciones. La API traduce ese error (`23P01`) a un `409 Conflict`. Con los rangos semiabiertos `[)`, una reserva que termina a las 20:00 no choca con una que empieza a las 20:00. Las reservas canceladas o vencidas dejan de contar, así que su turno se libera.

Los tests mandan 25 pedidos simultáneos al mismo turno y verifican que se guardó una sola fila.

## API

Documentación interactiva en **`/docs`** (Swagger UI) con el servidor corriendo.

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| `POST` | `/auth/register` | cualquiera | Crear una cuenta de jugador o de dueño |
| `POST` | `/auth/login` | cualquiera | Obtener un JWT (dura 1 h) |
| `GET` | `/auth/me` | con sesión | El usuario actual |
| `POST` | `/venues` | dueño, admin | Crear un complejo (con su zona horaria) |
| `GET` | `/venues`, `/venues/:id` | cualquiera | Ver complejos |
| `POST` | `/venues/:id/courts` | dueño del complejo | Sumar una cancha: deporte, precio por hora, horarios y largo del turno |
| `GET` | `/venues/:id/courts`, `/courts/:id` | cualquiera | Ver canchas |
| `GET` | `/courts/:id/availability?date=` | cualquiera | Todos los turnos del día, libres u ocupados |
| `POST` | `/bookings` | con sesión | Reservar. Se guarda 15 minutos hasta que se pague; `409` si está ocupado |
| `GET` | `/bookings/me` | con sesión | Mis reservas |
| `POST` | `/bookings/:id/cancel` | jugador o dueño | El jugador necesita 24 h de anticipación; el dueño puede cancelar siempre |
| `GET` | `/venues/:id/bookings?date=` | dueño del complejo | La agenda del complejo para un día |
| `GET` | `/health` | cualquiera | Funciona y llega a la base de datos |

<details>
<summary>Captura de la documentación Swagger</summary>

![Swagger UI](docs/swagger.png)

</details>

## Modelo de datos

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
  pending_payment --> confirmed: pago (próxima etapa)
  pending_payment --> expired: 15 min sin pagar
  pending_payment --> cancelled: cancelar
  confirmed --> cancelled: cancelar
```

## Decisiones técnicas

- **SQL en lugar de un ORM.** La regla central es una *exclusion constraint* sobre rangos de tiempo, y los ORMs no la modelan bien. Con SQL directo, la constraint, las transacciones y los bloqueos quedan a la vista. Las migraciones son archivos `.sql` numerados, y cada uno se aplica una sola vez dentro de su propia transacción.
- **Guardar en UTC, razonar en la hora del complejo.** Las fechas se guardan como `timestamptz`. Los horarios de apertura y la grilla de turnos se validan en la hora local del complejo con Luxon. Una cancha abre a las 09:00 *de Buenos Aires*, sin importar la zona horaria del servidor.
- **Las reservas sin pagar vencen solas.** Una reserva nueva guarda el turno 15 minutos. Las vencidas se marcan `expired` dentro de la misma transacción del siguiente intento de reserva en esa cancha, y la disponibilidad ya las ignora. No hay una tarea programada que se pueda atrasar.
- **Sin dependencias nativas.** Las contraseñas usan el scrypt que viene con Node, así `npm ci` funciona igual en Windows, macOS, Linux y en la imagen de Docker.
- **Los tests corren la app real.** `createApp()` arma el servidor con la misma validación, guards y Swagger para producción y para los tests. Lo único que cambia en los tests es la base de datos.

## Correrlo

**Con Docker** (API y PostgreSQL):

```sh
docker compose up --build
# → http://localhost:3000/docs
```

**Sin Docker**, con tu propio PostgreSQL 14 o más nuevo:

```sh
cp .env.example .env               # completar DATABASE_URL y JWT_SECRET
npm install
npm run build && npm start         # aplica las migraciones y levanta en :3000
```

**Los tests** necesitan una base de PostgreSQL que puedan borrar:

```sh
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/courts_test npm test
```

## Tests

- **Reservas**: precio y tiempo de espera del pago; superposiciones rechazadas y reservas pegadas permitidas; **25 pedidos simultáneos → 1 reserva**; horarios de apertura, grilla de turnos y horarios pasados; turnos liberados cuando vence una reserva sin pagar.
- **Disponibilidad**: los turnos reservados aparecen ocupados; los cancelados y vencidos, no.
- **Cancelaciones**: la regla de 24 horas para jugadores, el dueño que puede cancelar igual, turnos cancelados que se pueden volver a reservar, y `403` para quien no tiene nada que ver.
- **Dueños**: cada dueño ve y administra solo sus complejos.
- **Login**: registro e inicio de sesión, emails repetidos sin importar mayúsculas, sin forma de adivinar qué emails existen, sin admins creados por uno mismo, campos de más rechazados.
- **Horarios** (tests unitarios): generación de turnos y cada motivo por el que se rechaza un horario.

## Próximos pasos

- [ ] Pagos con Mercado Pago: un webhook idempotente que confirma la reserva una sola vez aunque el aviso llegue repetido.
- [ ] Deploy (Render / Fly.io) con una URL pública de demo.
- [ ] Conectarla con CoordeFutbol para que un partido reserve su cancha.

## Stack

Node 24 · TypeScript · NestJS · PostgreSQL 18 (`pg`, SQL directo) · Luxon · JWT · Swagger/OpenAPI · Vitest + Supertest · Docker · GitHub Actions
