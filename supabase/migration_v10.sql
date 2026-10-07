-- v10: diseño editable de cotizaciones y facturas (página "Diseño").
-- Idempotente: se puede correr más de una vez sin problema.
alter table company_settings add column if not exists default_payment_method text;
alter table company_settings add column if not exists doc_design jsonb not null default '{}'::jsonb;
