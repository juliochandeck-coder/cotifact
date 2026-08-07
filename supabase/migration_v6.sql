-- Corre esto en Supabase (SQL Editor) si ya tienes el proyecto en uso.
-- Instalacion nueva: schema.sql ya lo incluye.
--
-- Agrega lo necesario para el panel "Resumen":
--   1. Momento exacto de aprobacion/pago (no existia, solo habia updated_at
--      generico que se mueve con cualquier edicion, no solo el cambio de estado)
--   2. Funciones de agregados para no traer documentos completos al navegador

-- =====================================================================
-- 1. MOMENTOS DE APROBACION Y PAGO
-- =====================================================================

alter table quotes   add column if not exists approved_at timestamptz;
alter table invoices add column if not exists paid_at timestamptz;

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

-- Datos historicos: no hay forma de saber el momento exacto en que se
-- aprobaron/pagaron antes de esta migracion. updated_at es la mejor
-- aproximacion disponible (puede estar corrida si se edito el documento
-- despues de aprobarlo). Los promedios de "dias hasta aprobar/cobrar" en el
-- panel avisan cuando hay documentos historicos sin esta marca.
update quotes set approved_at = updated_at
  where status = 'aprobada' and approved_at is null;
update invoices set paid_at = updated_at
  where status = 'pagada' and paid_at is null;

-- =====================================================================
-- 2. FUNCIONES DE RESUMEN
-- Todas security definer + filtradas por auth.uid(): cada quien ve solo lo
-- suyo, y el calculo ocurre en la base de datos, no trayendo tablas enteras.
-- =====================================================================

create or replace function summary_kpis(p_from date, p_to date)
returns table(
  quoted_total numeric, quoted_count bigint,
  invoiced_total numeric, invoiced_count bigint,
  collected_total numeric, outstanding_total numeric,
  approved_count bigint, rejected_count bigint
)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(total) from quotes where user_id=auth.uid() and created_at >= p_from and created_at < (p_to + 1)),0),
    coalesce((select count(*) from quotes where user_id=auth.uid() and created_at >= p_from and created_at < (p_to + 1)),0),
    coalesce((select sum(total) from invoices where user_id=auth.uid() and created_at >= p_from and created_at < (p_to + 1)),0),
    coalesce((select count(*) from invoices where user_id=auth.uid() and created_at >= p_from and created_at < (p_to + 1)),0),
    coalesce((select sum(total) from invoices where user_id=auth.uid() and status='pagada' and created_at >= p_from and created_at < (p_to + 1)),0),
    coalesce((select sum(total) from invoices where user_id=auth.uid() and status<>'pagada' and created_at >= p_from and created_at < (p_to + 1)),0),
    coalesce((select count(*) from quotes where user_id=auth.uid() and status='aprobada' and created_at >= p_from and created_at < (p_to + 1)),0),
    coalesce((select count(*) from quotes where user_id=auth.uid() and status='rechazada' and created_at >= p_from and created_at < (p_to + 1)),0);
$$;
grant execute on function summary_kpis(date,date) to authenticated;

create or replace function summary_funnel(p_from date, p_to date)
returns table(sent bigint, approved bigint, invoiced bigint, collected bigint)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select count(*) from quotes where user_id=auth.uid() and created_at >= p_from and created_at < (p_to + 1)),0),
    coalesce((select count(*) from quotes where user_id=auth.uid() and approved_at >= p_from and approved_at < (p_to + 1)),0),
    coalesce((select count(*) from invoices where user_id=auth.uid() and created_at >= p_from and created_at < (p_to + 1)),0),
    coalesce((select count(*) from invoices where user_id=auth.uid() and paid_at >= p_from and paid_at < (p_to + 1)),0);
$$;
grant execute on function summary_funnel(date,date) to authenticated;

-- Top servicios: se desarma el JSON de conceptos de cada cotizacion. Se pide
-- de una vez suficientes filas (15) para armar el ranking por frecuencia Y
-- por ingreso en el mismo viaje, sin consultar dos veces.
create or replace function summary_top_services(p_from date, p_to date, p_limit int default 15)
returns table(description text, times_used bigint, total_revenue numeric)
language sql stable security definer set search_path = public as $$
  select
    trim(item->>'description') as description,
    count(*) as times_used,
    sum(coalesce((item->>'quantity')::numeric,0) * coalesce((item->>'unit_price')::numeric,0)) as total_revenue
  from quotes q, jsonb_array_elements(q.items) as item
  where q.user_id = auth.uid()
    and q.created_at >= p_from and q.created_at < (p_to + 1)
    and trim(coalesce(item->>'description','')) <> ''
  group by trim(item->>'description')
  order by total_revenue desc
  limit p_limit;
$$;
grant execute on function summary_top_services(date,date,int) to authenticated;

-- Top clientes por lo que realmente facturaron (no por lo cotizado, que
-- puede no convertirse nunca).
create or replace function summary_top_clients(p_from date, p_to date, p_limit int default 5)
returns table(client_name text, total_amount numeric, document_count bigint)
language sql stable security definer set search_path = public as $$
  select client_name, sum(total) as total_amount, count(*) as document_count
  from invoices
  where user_id = auth.uid() and created_at >= p_from and created_at < (p_to + 1)
  group by client_name
  order by total_amount desc
  limit p_limit;
$$;
grant execute on function summary_top_clients(date,date,int) to authenticated;

create or replace function summary_averages(p_from date, p_to date)
returns table(avg_ticket numeric, avg_days_to_approval numeric, avg_days_to_payment numeric)
language sql stable security definer set search_path = public as $$
  select
    (select avg(total) from quotes where user_id=auth.uid() and created_at >= p_from and created_at < (p_to + 1)),
    (select avg(extract(epoch from (approved_at - created_at))/86400) from quotes
       where user_id=auth.uid() and approved_at is not null and created_at >= p_from and created_at < (p_to + 1)),
    (select avg(extract(epoch from (paid_at - created_at))/86400) from invoices
       where user_id=auth.uid() and paid_at is not null and created_at >= p_from and created_at < (p_to + 1));
$$;
grant execute on function summary_averages(date,date) to authenticated;

-- Indices para que estos agregados no escaneen tabla completa al crecer
create index if not exists quotes_user_approved_idx on quotes(user_id, approved_at) where approved_at is not null;
create index if not exists invoices_user_paid_idx on invoices(user_id, paid_at) where paid_at is not null;
