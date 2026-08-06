-- Corre esto SOLO si ya tenias una version anterior del proyecto en uso.
-- Instalacion nueva: ignora este archivo, schema.sql ya incluye todo.

-- 1. Marca blanca y preferencias
alter table company_settings add column if not exists logo_url text;
alter table company_settings add column if not exists brand_primary text not null default '#14213D';
alter table company_settings add column if not exists brand_secondary text not null default '#A87C3F';
alter table company_settings add column if not exists currency text not null default 'MXN';
alter table company_settings add column if not exists locale text not null default 'es-MX';
alter table company_settings add column if not exists default_tax_rate numeric(6,3) not null default 16;
alter table company_settings add column if not exists default_notes text;
alter table company_settings add column if not exists payment_terms_days int not null default 15;

-- 2. Contadores atomicos (reemplazan el conteo de filas)
create table if not exists document_counters (
  user_id uuid references auth.users(id) on delete cascade not null,
  doc_type text not null,
  year int not null,
  last_value int not null default 0,
  primary key (user_id, doc_type, year)
);

alter table document_counters enable row level security;
drop policy if exists "Users read own counters" on document_counters;
create policy "Users read own counters" on document_counters
  for select using (auth.uid() = user_id);

-- Siembra los contadores con los numeros que ya existen, para no repetir
insert into document_counters (user_id, doc_type, year, last_value)
select user_id, 'COT', extract(year from created_at)::int, count(*)
from quotes group by user_id, extract(year from created_at)
on conflict (user_id, doc_type, year) do update
  set last_value = greatest(document_counters.last_value, excluded.last_value);

insert into document_counters (user_id, doc_type, year, last_value)
select user_id, 'INV', extract(year from created_at)::int, count(*)
from invoices group by user_id, extract(year from created_at)
on conflict (user_id, doc_type, year) do update
  set last_value = greatest(document_counters.last_value, excluded.last_value);

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

-- 3. Restricciones de unicidad
create unique index if not exists quotes_user_number_idx on quotes(user_id, quote_number);
create unique index if not exists invoices_user_number_idx on invoices(user_id, invoice_number);
create unique index if not exists invoices_one_per_quote_idx
  on invoices(quote_id) where quote_id is not null;

-- 4. updated_at automatico
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

-- 5. Indices de listado
create index if not exists quotes_user_created_idx on quotes(user_id, created_at desc);
create index if not exists quotes_user_status_idx on quotes(user_id, status);
create index if not exists invoices_user_created_idx on invoices(user_id, created_at desc);
create index if not exists invoices_user_status_idx on invoices(user_id, status);

-- 6. Almacenamiento de logos
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
