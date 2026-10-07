-- v9: forma de pago fija para las facturas (se guarda en Ajustes).
-- Idempotente: se puede correr más de una vez sin problema.
alter table company_settings add column if not exists default_payment_method text;
