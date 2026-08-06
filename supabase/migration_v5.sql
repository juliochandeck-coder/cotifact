-- Corre esto en Supabase (SQL Editor) si ya tienes el proyecto en uso.
-- Instalacion nueva: schema.sql ya lo incluye.
--
-- Cubre tres cosas:
--   1. Capa de organizaciones (deja la puerta abierta a marca blanca real sin migrar datos despues)
--   2. Vistas y funciones que evitan traer tablas completas al dashboard
--   3. Tabla de suscripciones para cuando se active el cobro

-- =====================================================================
-- 1. ORGANIZACIONES
-- Hoy cada usuario es su propia organizacion de un miembro. La experiencia
-- no cambia. El dia que se venda a agencias, ya existe el eje para colgar
-- equipos sin tocar los datos existentes.
-- =====================================================================

create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text,
  owner_id uuid references auth.users(id) on delete cascade not null,
  plan text not null default 'free' check (plan in ('free','pro')),
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  organization_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'owner' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists org_members_user_idx on organization_members(user_id);

-- Cada usuario existente recibe su organizacion
insert into organizations (owner_id, name)
select u.id, coalesce(cs.company_name, 'Mi empresa')
from auth.users u
left join company_settings cs on cs.user_id = u.id
where not exists (select 1 from organizations o where o.owner_id = u.id);

insert into organization_members (organization_id, user_id, role)
select o.id, o.owner_id, 'owner'
from organizations o
on conflict do nothing;

-- Columna organization_id en todo lo que es "de la empresa"
alter table quotes            add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table invoices          add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table clients           add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table services          add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table company_settings  add column if not exists organization_id uuid references organizations(id) on delete cascade;

update quotes q           set organization_id = o.id from organizations o where o.owner_id = q.user_id and q.organization_id is null;
update invoices i         set organization_id = o.id from organizations o where o.owner_id = i.user_id and i.organization_id is null;
update clients c          set organization_id = o.id from organizations o where o.owner_id = c.user_id and c.organization_id is null;
update services s         set organization_id = o.id from organizations o where o.owner_id = s.user_id and s.organization_id is null;
update company_settings x set organization_id = o.id from organizations o where o.owner_id = x.user_id and x.organization_id is null;

create index if not exists quotes_org_idx   on quotes(organization_id, created_at desc);
create index if not exists invoices_org_idx on invoices(organization_id, created_at desc);
create index if not exists clients_org_idx  on clients(organization_id);
create index if not exists services_org_idx on services(organization_id);

-- Organizacion automatica al registrarse un usuario nuevo
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  insert into organizations (owner_id, name) values (new.id, 'Mi empresa') returning id into v_org;
  insert into organization_members (organization_id, user_id, role) values (v_org, new.id, 'owner');
  insert into company_settings (user_id, organization_id) values (new.id, v_org)
    on conflict (user_id) do update set organization_id = excluded.organization_id;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Helper: organizaciones a las que pertenece quien hace la consulta
create or replace function my_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from organization_members where user_id = auth.uid();
$$;
grant execute on function my_org_ids() to authenticated;

alter table organizations enable row level security;
alter table organization_members enable row level security;

drop policy if exists "Members read own orgs" on organizations;
create policy "Members read own orgs" on organizations
  for select using (id in (select my_org_ids()));

drop policy if exists "Owner updates org" on organizations;
create policy "Owner updates org" on organizations
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Members read membership" on organization_members;
create policy "Members read membership" on organization_members
  for select using (user_id = auth.uid());

-- Politicas ampliadas: acceso por usuario (como hoy) O por organizacion.
-- Asi nada se rompe ahora y equipos funcionan cuando se activen.
drop policy if exists "Users manage own quotes" on quotes;
create policy "Users manage own quotes" on quotes for all
  using (auth.uid() = user_id or organization_id in (select my_org_ids()))
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own invoices" on invoices;
create policy "Users manage own invoices" on invoices for all
  using (auth.uid() = user_id or organization_id in (select my_org_ids()))
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own clients" on clients;
create policy "Users manage own clients" on clients for all
  using (auth.uid() = user_id or organization_id in (select my_org_ids()))
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own services" on services;
create policy "Users manage own services" on services for all
  using (auth.uid() = user_id or organization_id in (select my_org_ids()))
  with check (auth.uid() = user_id);

-- =====================================================================
-- 2. RENDIMIENTO
-- El dashboard traia TODAS las cotizaciones aprobadas y TODAS las facturas
-- solo para contar las no facturadas. Esto lo resuelve en la base de datos.
-- =====================================================================

create or replace function unbilled_summary()
returns table (total_count int, total_amount numeric)
language sql stable security definer set search_path = public as $$
  select count(*)::int, coalesce(sum(q.total), 0)
  from quotes q
  where q.user_id = auth.uid()
    and q.status = 'aprobada'
    and not exists (select 1 from invoices i where i.quote_id = q.id);
$$;
grant execute on function unbilled_summary() to authenticated;

-- Ids de cotizaciones aprobadas sin factura (para marcar filas del listado)
create or replace function unbilled_quote_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select q.id from quotes q
  where q.user_id = auth.uid()
    and q.status = 'aprobada'
    and not exists (select 1 from invoices i where i.quote_id = q.id);
$$;
grant execute on function unbilled_quote_ids() to authenticated;

-- Total por cobrar sin traer todas las facturas al navegador
create or replace function outstanding_total()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(total), 0) from invoices
  where user_id = auth.uid() and status <> 'pagada';
$$;
grant execute on function outstanding_total() to authenticated;

-- Facturar en lote: un solo viaje al servidor en vez de uno por cotizacion
create or replace function bill_all_approved()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_days int;
  v_count int := 0;
  q record;
  v_num text;
begin
  if v_user is null then raise exception 'No autenticado'; end if;
  select coalesce(payment_terms_days, 15) into v_days from company_settings where user_id = v_user;
  v_days := coalesce(v_days, 15);

  for q in
    select * from quotes
    where user_id = v_user and status = 'aprobada'
      and not exists (select 1 from invoices i where i.quote_id = quotes.id)
    order by created_at
  loop
    v_num := next_document_number('INV');
    insert into invoices (quote_id, user_id, organization_id, invoice_number, client_name,
      client_company, client_email, client_phone, items, subtotal, tax_rate, tax_amount,
      total, notes, due_date, status)
    values (q.id, v_user, q.organization_id, v_num, q.client_name,
      q.client_company, q.client_email, q.client_phone, q.items, q.subtotal, q.tax_rate,
      q.tax_amount, q.total, q.notes, (current_date + v_days), 'pendiente');
    v_count := v_count + 1;
  end loop;

  return v_count;
end; $$;
grant execute on function bill_all_approved() to authenticated;

-- =====================================================================
-- 3. SUSCRIPCIONES (listo para cuando se conecte la pasarela de pago)
-- =====================================================================

create table if not exists subscriptions (
  organization_id uuid references organizations(id) on delete cascade primary key,
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','canceled')),
  plan text not null default 'free' check (plan in ('free','pro')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into subscriptions (organization_id, status, plan)
select id, 'active', 'free' from organizations
on conflict do nothing;

alter table subscriptions enable row level security;
drop policy if exists "Members read own subscription" on subscriptions;
create policy "Members read own subscription" on subscriptions
  for select using (organization_id in (select my_org_ids()));
-- Solo el webhook de pagos (service role) escribe aqui; por eso no hay policy de insert/update.

-- Cotizaciones creadas este mes, para el limite del plan gratis
create or replace function quotes_this_month()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from quotes
  where user_id = auth.uid()
    and created_at >= date_trunc('month', now());
$$;
grant execute on function quotes_this_month() to authenticated;

-- Marca de onboarding completado (para no repetir el asistente)
alter table company_settings add column if not exists onboarded_at timestamptz;
