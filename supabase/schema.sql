-- Ejecuta este script completo en Supabase: Dashboard -> SQL Editor -> New query -> Run
-- Si ya tenias una version anterior corriendo, NO corras esto: usa migration_v2.sql

create extension if not exists "uuid-ossp";

-- Cotizaciones
create table if not exists quotes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  quote_number text not null,
  client_name text not null,
  client_email text,
  client_phone text,
  client_company text,
  items jsonb not null default '[]',
  subtotal numeric(14,2) not null default 0,
  tax_rate numeric(6,3) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  valid_until date,
  status text not null default 'pendiente' check (status in ('pendiente','aprobada','rechazada','recotizar')),
  client_id uuid,
  sent_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, quote_number)
);

-- Facturas
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid references quotes(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade not null,
  invoice_number text not null,
  client_name text not null,
  client_email text,
  client_phone text,
  client_company text,
  items jsonb not null default '[]',
  subtotal numeric(14,2) not null default 0,
  tax_rate numeric(6,3) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  due_date date,
  status text not null default 'pendiente' check (status in ('pendiente','enviada','pagada')),
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, invoice_number)
);

-- Una sola factura por cotizacion (evita duplicados por doble clic)
create unique index if not exists invoices_one_per_quote_idx
  on invoices(quote_id) where quote_id is not null;

-- Datos de empresa y marca blanca
create table if not exists company_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  company_name text,
  company_email text,
  company_phone text,
  company_address text,
  tax_id text,
  logo_url text,
  brand_primary text not null default '#14213D',
  brand_secondary text not null default '#A87C3F',
  currency text not null default 'USD',
  locale text not null default 'es-PA',
  default_tax_rate numeric(6,3) not null default 7,
  default_notes text,
  payment_terms_days int not null default 15,
  followup_days int not null default 7 check (followup_days between 1 and 180),
  onboarded_at timestamptz
);

-- Contadores atomicos por usuario/tipo/anio.
-- Reemplaza el conteo de filas: no se repiten numeros aunque borres documentos
-- ni aunque dos se generen al mismo tiempo.
create table if not exists document_counters (
  user_id uuid references auth.users(id) on delete cascade not null,
  doc_type text not null,
  year int not null,
  last_value int not null default 0,
  primary key (user_id, doc_type, year)
);

create or replace function next_document_number(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from (now() at time zone 'utc'));
  v_seq int;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'No autenticado';
  end if;

  insert into document_counters (user_id, doc_type, year, last_value)
  values (v_user, p_prefix, v_year, 1)
  on conflict (user_id, doc_type, year)
  do update set last_value = document_counters.last_value + 1
  returning last_value into v_seq;

  return p_prefix || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

revoke all on function next_document_number(text) from public;
grant execute on function next_document_number(text) to authenticated;

-- updated_at automatico
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quotes_touch on quotes;
create trigger quotes_touch before update on quotes
  for each row execute function touch_updated_at();

drop trigger if exists invoices_touch on invoices;
create trigger invoices_touch before update on invoices
  for each row execute function touch_updated_at();

-- Seguridad a nivel de fila
alter table quotes enable row level security;
alter table invoices enable row level security;
alter table company_settings enable row level security;
alter table document_counters enable row level security;

drop policy if exists "Users manage own quotes" on quotes;
create policy "Users manage own quotes" on quotes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own invoices" on invoices;
create policy "Users manage own invoices" on invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own settings" on company_settings;
create policy "Users manage own settings" on company_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users read own counters" on document_counters;
create policy "Users read own counters" on document_counters
  for select using (auth.uid() = user_id);

-- Indices para busqueda y orden en el listado
create index if not exists quotes_user_created_idx on quotes(user_id, created_at desc);
create index if not exists quotes_user_status_idx on quotes(user_id, status);
create index if not exists quotes_client_name_idx on quotes using gin (to_tsvector('simple', client_name));
create index if not exists invoices_user_created_idx on invoices(user_id, created_at desc);
create index if not exists invoices_user_status_idx on invoices(user_id, status);
create index if not exists invoices_quote_id_idx on invoices(quote_id);

-- Directorio de clientes (autocompletado en cotizaciones)
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
create unique index if not exists clients_user_name_idx on clients(user_id, lower(btrim(name)));
create index if not exists clients_user_idx on clients(user_id, name);

-- Catalogo de servicios con precio guardado
create table if not exists services (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  unit_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists services_user_name_idx on services(user_id, lower(btrim(name)));
create index if not exists services_user_idx on services(user_id, name);

alter table quotes add constraint quotes_client_fk
  foreign key (client_id) references clients(id) on delete set null;
create index if not exists quotes_client_idx on quotes(client_id);

alter table clients enable row level security;
alter table services enable row level security;

drop policy if exists "Users manage own clients" on clients;
create policy "Users manage own clients" on clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own services" on services;
create policy "Users manage own services" on services
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger: marca el momento exacto en que un documento entra a su estado
-- final, para poder medir "dias hasta aprobar" y "dias hasta cobrar".
create or replace function track_status_timestamps()
returns trigger language plpgsql as $$
begin
  if TG_TABLE_NAME = 'quotes' then
    if new.status = 'aprobada' and old.status is distinct from 'aprobada' then
      new.approved_at = now();
    end if;
  elsif TG_TABLE_NAME = 'invoices' then
    if new.status = 'pagada' and old.status is distinct from 'pagada' then
      new.paid_at = now();
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists quotes_track_status on quotes;
create trigger quotes_track_status before update on quotes
  for each row execute function track_status_timestamps();

drop trigger if exists invoices_track_status on invoices;
create trigger invoices_track_status before update on invoices
  for each row execute function track_status_timestamps();

-- Funciones del panel Resumen: agregados calculados en la base de datos,
-- nunca trayendo tablas completas al navegador.
create or replace function summary_kpis(p_from date, p_to date)
returns table(
  quoted_total numeric, quoted_count bigint,
  invoiced_total numeric, invoiced_count bigint,
  collected_total numeric, outstanding_total numeric,
  approved_count bigint, rejected_count bigint
)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(total) from quotes where user_id=auth.uid() and created_at::date between p_from and p_to),0),
    coalesce((select count(*) from quotes where user_id=auth.uid() and created_at::date between p_from and p_to),0),
    coalesce((select sum(total) from invoices where user_id=auth.uid() and created_at::date between p_from and p_to),0),
    coalesce((select count(*) from invoices where user_id=auth.uid() and created_at::date between p_from and p_to),0),
    coalesce((select sum(total) from invoices where user_id=auth.uid() and status='pagada' and created_at::date between p_from and p_to),0),
    coalesce((select sum(total) from invoices where user_id=auth.uid() and status<>'pagada' and created_at::date between p_from and p_to),0),
    coalesce((select count(*) from quotes where user_id=auth.uid() and status='aprobada' and created_at::date between p_from and p_to),0),
    coalesce((select count(*) from quotes where user_id=auth.uid() and status='rechazada' and created_at::date between p_from and p_to),0);
$$;
grant execute on function summary_kpis(date,date) to authenticated;

create or replace function summary_funnel(p_from date, p_to date)
returns table(sent bigint, approved bigint, invoiced bigint, collected bigint)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select count(*) from quotes where user_id=auth.uid() and created_at::date between p_from and p_to),0),
    coalesce((select count(*) from quotes where user_id=auth.uid() and approved_at::date between p_from and p_to),0),
    coalesce((select count(*) from invoices where user_id=auth.uid() and created_at::date between p_from and p_to),0),
    coalesce((select count(*) from invoices where user_id=auth.uid() and paid_at::date between p_from and p_to),0);
$$;
grant execute on function summary_funnel(date,date) to authenticated;

create or replace function summary_top_services(p_from date, p_to date, p_limit int default 15)
returns table(description text, times_used bigint, total_revenue numeric)
language sql stable security definer set search_path = public as $$
  select
    trim(item->>'description') as description,
    count(*) as times_used,
    sum(coalesce((item->>'quantity')::numeric,0) * coalesce((item->>'unit_price')::numeric,0)) as total_revenue
  from quotes q, jsonb_array_elements(q.items) as item
  where q.user_id = auth.uid()
    and q.created_at::date between p_from and p_to
    and trim(coalesce(item->>'description','')) <> ''
  group by trim(item->>'description')
  order by total_revenue desc
  limit p_limit;
$$;
grant execute on function summary_top_services(date,date,int) to authenticated;

create or replace function summary_top_clients(p_from date, p_to date, p_limit int default 5)
returns table(client_name text, total_amount numeric, document_count bigint)
language sql stable security definer set search_path = public as $$
  select client_name, sum(total) as total_amount, count(*) as document_count
  from invoices
  where user_id = auth.uid() and created_at::date between p_from and p_to
  group by client_name
  order by total_amount desc
  limit p_limit;
$$;
grant execute on function summary_top_clients(date,date,int) to authenticated;

create or replace function summary_averages(p_from date, p_to date)
returns table(avg_ticket numeric, avg_days_to_approval numeric, avg_days_to_payment numeric)
language sql stable security definer set search_path = public as $$
  select
    (select avg(total) from quotes where user_id=auth.uid() and created_at::date between p_from and p_to),
    (select avg(extract(epoch from (approved_at - created_at))/86400) from quotes
       where user_id=auth.uid() and approved_at is not null and created_at::date between p_from and p_to),
    (select avg(extract(epoch from (paid_at - created_at))/86400) from invoices
       where user_id=auth.uid() and paid_at is not null and created_at::date between p_from and p_to);
$$;
grant execute on function summary_averages(date,date) to authenticated;

create index if not exists quotes_user_created_date_idx on quotes(user_id, (created_at::date));
create index if not exists quotes_user_approved_idx on quotes(user_id, approved_at) where approved_at is not null;
create index if not exists invoices_user_created_date_idx on invoices(user_id, (created_at::date));
create index if not exists invoices_user_paid_idx on invoices(user_id, paid_at) where paid_at is not null;

-- Almacenamiento de logos
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "Public read logos" on storage.objects;
create policy "Public read logos" on storage.objects
  for select using (bucket_id = 'logos');

drop policy if exists "Users upload own logos" on storage.objects;
create policy "Users upload own logos" on storage.objects
  for insert with check (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users update own logos" on storage.objects;
create policy "Users update own logos" on storage.objects
  for update using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users delete own logos" on storage.objects;
create policy "Users delete own logos" on storage.objects
  for delete using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);
