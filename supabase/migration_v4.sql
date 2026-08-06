-- Corre esto en Supabase (SQL Editor) si ya tienes el proyecto en uso.
-- Instalacion nueva: schema.sql ya lo incluye.

-- Dias sin respuesta antes de que una cotizacion aparezca en Seguimiento.
-- 7 por defecto; cada usuario lo ajusta a su ciclo de venta.
alter table company_settings
  add column if not exists followup_days int not null default 7;

alter table company_settings
  drop constraint if exists company_settings_followup_days_check;
alter table company_settings
  add constraint company_settings_followup_days_check
  check (followup_days between 1 and 180);
