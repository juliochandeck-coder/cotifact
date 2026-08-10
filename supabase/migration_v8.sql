-- Corre esto en Supabase (SQL Editor) si ya tienes el proyecto en uso.
-- Instalacion nueva: schema.sql ya lo incluye.
--
-- Resuelve tres escenarios reales de un cliente en prueba:
--   1. Facturas que requieren factura fiscal aparte (DGI) — se anota el
--      numero y la fecha una vez que existe, sin inventar un segundo tipo
--      de documento.
--   2. Facturas sin cotizacion previa (cliente de comision recurrente).
--   3. Retainers: la misma cotizacion se factura mes a mes, y si el fee
--      sube, se crea una cotizacion nueva encadenada a las anteriores.

-- =====================================================================
-- 1. FACTURA FISCAL (DGI)
-- =====================================================================

alter table clients add column if not exists requires_dgi_default boolean not null default false;

alter table invoices add column if not exists requires_dgi boolean not null default false;
alter table invoices add column if not exists dgi_invoice_number text;
alter table invoices add column if not exists dgi_issued_at date;

-- =====================================================================
-- 2. FACTURA SIN COTIZACION
-- =====================================================================
-- quote_id ya era nullable desde el principio (on delete set null);
-- faltaba poder enlazar la factura a un cliente del directorio (las
-- cotizaciones ya podian, las facturas nunca tuvieron esa columna).

alter table invoices add column if not exists client_id uuid references clients(id) on delete set null;
create index if not exists invoices_client_idx on invoices(client_id);

-- =====================================================================
-- 3. RETAINERS
-- =====================================================================

alter table quotes add column if not exists is_retainer boolean not null default false;
alter table quotes add column if not exists retainer_group_id uuid;

-- Cada cotizacion de retainer apunta a si misma o a la original de su
-- cadena: filtrar por retainer_group_id trae toda la historia de fees.
create index if not exists quotes_retainer_group_idx on quotes(retainer_group_id)
  where retainer_group_id is not null;

-- La regla de "una sola factura por cotizacion" existia para evitar
-- duplicados por doble clic — pero bloquea a un retainer, que se factura
-- cada mes desde la misma cotizacion. Se marca cada factura con si nacio
-- de un retainer, y la regla de unicidad deja de aplicar solo para esas.
alter table invoices add column if not exists is_retainer_invoice boolean not null default false;

drop index if exists invoices_one_per_quote_idx;
create unique index invoices_one_per_quote_idx on invoices(quote_id)
  where quote_id is not null and is_retainer_invoice = false;

-- Indices para los filtros nuevos en los listados
create index if not exists invoices_requires_dgi_idx on invoices(user_id, requires_dgi);
create index if not exists quotes_is_retainer_idx on quotes(user_id, is_retainer);
