-- Corre esto en Supabase (SQL Editor) si ya tienes el proyecto en uso.
-- Instalacion nueva: schema.sql ya lo incluye.

-- 1. Usuario elige un nombre de usuario al registrarse
alter table company_settings add column if not exists username text;

-- 2. Nombre y descripcion del proyecto, en cotizaciones y facturas
alter table quotes   add column if not exists project_name text;
alter table quotes   add column if not exists project_description text;
alter table invoices add column if not exists project_name text;
alter table invoices add column if not exists project_description text;

-- 3. Metodo de pago en la factura
alter table invoices add column if not exists payment_method text;

-- 4. Los colores de marca dejan de ser obligatorios: se puede facturar sin
-- elegir ninguno, y el documento cae en los valores neutros por defecto.
alter table company_settings alter column brand_primary drop not null;
alter table company_settings alter column brand_secondary drop not null;
alter table company_settings alter column brand_primary drop default;
alter table company_settings alter column brand_secondary drop default;

-- 5. Par de fuentes elegido (presets por ahora; fuente propia queda para
-- una siguiente fase, sube archivos de fuente real y hay que servirlos).
alter table company_settings add column if not exists font_pair text not null default 'roboto';

-- 6. El trigger de usuario nuevo ahora tambien guarda username y nombre de
-- empresa que se piden en el registro (llegan en los metadatos del usuario).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  insert into organizations (owner_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'company_name', 'Mi empresa'))
  returning id into v_org;

  insert into organization_members (organization_id, user_id, role)
  values (v_org, new.id, 'owner');

  insert into company_settings (user_id, organization_id, username, company_name)
  values (
    new.id,
    v_org,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'company_name'
  )
  on conflict (user_id) do update
    set organization_id = excluded.organization_id,
        username = coalesce(company_settings.username, excluded.username),
        company_name = coalesce(company_settings.company_name, excluded.company_name);

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
