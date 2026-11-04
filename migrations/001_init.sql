-- Users, venues, courts and bookings. The interesting part is at the bottom:
-- the database itself refuses two active bookings that overlap on the same court.

create extension if not exists btree_gist;

create type user_role as enum ('player', 'owner', 'admin');

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text not null,
  password_hash text not null,
  role          user_role not null default 'player',
  created_at    timestamptz not null default now()
);

create table venues (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references users (id),
  name       text not null,
  address    text not null,
  timezone   text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now()
);

create type sport as enum ('futbol5', 'futbol7', 'futbol11');

create table courts (
  id                   uuid primary key default gen_random_uuid(),
  venue_id             uuid not null references venues (id) on delete cascade,
  name                 text not null,
  sport                sport not null,
  price_per_hour_cents integer not null check (price_per_hour_cents > 0),
  opens_at             time not null,
  closes_at            time not null,
  slot_minutes         integer not null default 60 check (slot_minutes in (30, 60, 90, 120)),
  created_at           timestamptz not null default now(),
  unique (venue_id, name),
  check (closes_at > opens_at)
);

create type booking_status as enum ('pending_payment', 'confirmed', 'cancelled', 'expired');

create table bookings (
  id           uuid primary key default gen_random_uuid(),
  court_id     uuid not null references courts (id) on delete cascade,
  user_id      uuid not null references users (id),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       booking_status not null default 'pending_payment',
  price_cents  integer not null check (price_cents > 0),
  expires_at   timestamptz, -- an unpaid booking stops holding the slot after this
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz,
  check (ends_at > starts_at),

  -- No two active bookings may overlap on the same court. Enforced by the database, so it
  -- holds even when many requests race for the same slot. '[)' ranges let one booking
  -- end exactly when the next starts.
  constraint bookings_no_overlap exclude using gist (
    court_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending_payment', 'confirmed'))
);

create index bookings_user_idx on bookings (user_id, starts_at desc);
create index bookings_court_time_idx on bookings (court_id, starts_at);
