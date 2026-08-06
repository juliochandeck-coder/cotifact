-- Corre esto en Supabase (SQL Editor) si ya tienes el proyecto en uso.
-- Instalacion nueva: schema.sql ya lo incluye.

-- 1. Directorio de clientes
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  company text,
  email text,
  phone text,
  tax_id text,
  address text,
  created_at timestamptz not null default now()
);

-- Un mismo nombre no se duplica por diferencias de mayusculas o espacios
create unique index if not exists clients_user_name_idx
  on clients(user_id, lower(btrim(name)));
create index if not exists clients_user_idx on clients(user_id, name);

-- 2. Catalogo de servicios
create table if not exists services (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  unit_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists services_user_name_idx
  on services(user_id, lower(btrim(name)));
create index if not exists services_user_idx on services(user_id, name);

-- 3. Enlace de documentos con el cliente y registro de envio
alter table quotes   add column if not exists client_id uuid references clients(id) on delete set null;
alter table quotes   add column if not exists sent_at timestamptz;
alter table invoices add column if not exists sent_at timestamptz;

create index if not exists quotes_client_idx on quotes(client_id);

-- 4. Seguridad por usuario
alter table clients enable row level security;
alter table services enable row level security;

drop policy if exists "Users manage own clients" on clients;
create policy "Users manage own clients" on clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own services" on services;
create policy "Users manage own services" on services
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Siembra el directorio con los clientes que ya aparecen en cotizaciones,
--    para no empezar de cero.
insert into clients (user_id, name, company, email, phone)
select distinct on (user_id, lower(btrim(client_name)))
  user_id, btrim(client_name), client_company, client_email, client_phone
from quotes
where btrim(coalesce(client_name,'')) <> ''
order by user_id, lower(btrim(client_name)), created_at desc
on conflict do nothing;

-- Enlaza las cotizaciones existentes con el cliente correspondiente
update quotes q set client_id = c.id
from clients c
where q.client_id is null
  and c.user_id = q.user_id
  and lower(btrim(c.name)) = lower(btrim(q.client_name));
