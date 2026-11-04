-- Providers offer services during their working hours; clients request appointments that the
-- provider confirms or rejects. The database itself refuses two active appointments that
-- overlap for the same provider (see appointments_no_overlap at the bottom).

create extension if not exists btree_gist;

create type user_role as enum ('client', 'provider', 'admin');

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text not null,
  password_hash text not null,
  role          user_role not null default 'client',
  created_at    timestamptz not null default now()
);

-- A provider's public profile: one per provider account.
create table providers (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references users (id) on delete cascade,
  name                 text not null,
  about                text not null default '',
  timezone             text not null default 'America/Argentina/Buenos_Aires',
  confirm_within_hours integer not null default 24 check (confirm_within_hours between 1 and 168),
  created_at           timestamptz not null default now()
);

-- Weekly schedule, local to the provider. weekday is ISO: 1 = Monday ... 7 = Sunday.
-- Several ranges per day are allowed (e.g. 10-13 and 15-19).
create table working_hours (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers (id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7),
  starts_at   time not null,
  ends_at     time not null,
  check (ends_at > starts_at)
);
create index working_hours_provider_idx on working_hours (provider_id, weekday);

create table services (
  id               uuid primary key default gen_random_uuid(),
  provider_id      uuid not null references providers (id) on delete cascade,
  name             text not null,
  description      text not null default '',
  duration_minutes integer not null check (duration_minutes between 15 and 480 and duration_minutes % 15 = 0),
  price_cents      integer not null check (price_cents >= 0),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (provider_id, name)
);

create type appointment_status as enum ('pending', 'confirmed', 'rejected', 'cancelled', 'expired');

create table appointments (
  id               uuid primary key default gen_random_uuid(),
  provider_id      uuid not null references providers (id) on delete cascade,
  service_id       uuid not null references services (id),
  client_id        uuid not null references users (id),
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  status           appointment_status not null default 'pending',
  price_cents      integer not null check (price_cents >= 0),
  note             text not null default '',
  rejection_reason text,
  respond_by       timestamptz not null, -- an unanswered request expires (and frees its time) after this
  created_at       timestamptz not null default now(),
  decided_at       timestamptz,
  check (ends_at > starts_at),

  -- No two active appointments may overlap for the same provider. Enforced by the database,
  -- so it holds even when many clients request at the same instant. '[)' ranges let one
  -- appointment end exactly when the next starts.
  constraint appointments_no_overlap exclude using gist (
    provider_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);
create index appointments_client_idx on appointments (client_id, starts_at desc);
create index appointments_provider_idx on appointments (provider_id, status, starts_at);

-- In-app notifications: "you have a request to confirm", "your appointment was confirmed"...
create table notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  kind           text not null check (kind in ('requested', 'confirmed', 'rejected', 'expired', 'cancelled')),
  appointment_id uuid not null references appointments (id) on delete cascade,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);
