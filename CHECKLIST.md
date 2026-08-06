# CotiFact — Puesta en marcha

*Cotiza y factura en un mismo lugar.*

Este documento es tu lista de tareas. El README técnico explica cómo funciona el código;
esto explica qué tienes que hacer tú.

---

## FASE 0 — Antes de que alguien lo use (costo: $0)

### Base de datos
- [ ] Crear proyecto en [supabase.com](https://supabase.com)
- [ ] SQL Editor → correr `supabase/schema.sql` completo (instalación nueva)
- [ ] **Si ya lo tenías corriendo:** correr en orden `migration_v2.sql` → `v3` → `v4` → `v5` → `v6`
      (no vuelvas a correr `schema.sql`; los migration son idempotentes y no borran datos)
- [ ] Authentication → URL Configuration → agregar tu dominio en *Site URL* y en
      *Redirect URLs* incluir `https://tudominio.com/auth/callback`
      **Sin esto, los correos de recuperar contraseña no funcionan.**

### Despliegue
- [ ] Subir el código a un repositorio de GitHub (privado)
- [ ] Verificar que `.env.local` **no** aparece en GitHub
- [ ] Importar el repo en [vercel.com](https://vercel.com)
- [ ] Agregar variables de entorno en Vercel:
      - `NEXT_PUBLIC_SUPABASE_URL`
      - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Correo (opcional pero recomendado)
- [ ] Cuenta en [resend.com](https://resend.com) — gratis 3.000 correos/mes
- [ ] Verificar tu dominio en Resend (requiere tocar los DNS)
- [ ] Agregar en Vercel: `RESEND_API_KEY` y `RESEND_FROM`

### Prueba tú mismo, de punta a punta
- [ ] Crear una cuenta nueva y pasar por el asistente de bienvenida
- [ ] Crear cotización → aprobar → generar factura → marcar pagada
- [ ] Descargar un PDF y revisar que salgan tus colores y logo
- [ ] **Probar recuperar contraseña con un correo real**
- [ ] Exportar CSV y abrirlo en Excel (revisar acentos)
- [ ] Abrir todo en el teléfono

---

## FASE 1 — El día que cobres el primer peso

> Estas dos no son opcionales ni se pueden posponer.

- [ ] **Vercel Pro ($20/mes)** — el plan Hobby prohíbe uso comercial.
      Cobrar en Hobby te expone a que tumben el despliegue sin aviso.
- [ ] **Supabase Pro ($25/mes)** — el plan gratis pausa el proyecto tras ~7 días
      sin actividad. Un cliente que entra cada quince días se encuentra la app muerta.
- [ ] Activar respaldos automáticos en Supabase
- [ ] Comprar el dominio y conectarlo en Vercel

**Piso de costos al monetizar: ~$45/mes.** Con un plan de $12 USD, el punto de
equilibrio son 4 clientes.

---

## FASE 2 — Cobro (lo que falta construir)

La base ya está: la migración v5 creó las tablas `organizations` y `subscriptions`,
y la función `quotes_this_month()` para aplicar límites del plan gratis.

Falta conectar la pasarela:
- [ ] Elegir pasarela. **En Panamá: Paguelo Fácil o Yappy** (Stripe no recibe pagos
      locales panameños bien). Stripe solo si vendes al exterior.
- [ ] Página de precios pública
- [ ] Webhook que reciba el pago y cree la cuenta
- [ ] Correo de bienvenida con **enlace mágico** para que ponga su contraseña
      (nunca mandes una contraseña por correo)

**Flujo correcto:** paga → webhook crea usuario → recibe enlace → pone su clave → entra.

---

## FASE 3 — Legal (antes de facturarle a terceros)

- [ ] Términos de servicio y Política de privacidad
- [ ] **Confirmar con un contador panameño qué puedes prometer.**
      Desde enero 2026 la DGI exige un PAC para quien factura más de B/.36,000 al año
      o más de 100 facturas al mes. CotiFact genera un **documento comercial**, no una
      factura fiscal timbrada. Dilo claro en tu página de precios: prometer de más aquí
      te trae un problema legal, no una queja.

---

## Cuándo escalar (señales, no calendario)

| Señal | Qué hacer |
|---|---|
| Base pasa de 400MB | Supabase Pro ya lo cubre (8GB) |
| Un usuario pasa de ~2.000 documentos | Revisar índices; ya está paginado |
| Un mismo contador te trae 3-4 clientes | Activar el modelo B (equipos), ya hay estructura |
| Los correos rebotan | Subir plan de Resend |

**Sobre el modelo B (marca blanca real / agencias):** no está activo, pero la
migración v5 ya dejó `organizations`, `organization_members` y `organization_id`
en todas las tablas. Activarlo es agregar la interfaz de invitar miembros —
no una migración de datos riesgosa. Esa era la puerta que te dije que dejáramos
con bisagras.

---

## Recomendación de secuencia

1. Fase 0 completa y **úsalo tú** para cotizar de verdad un mes
2. Dáselo gratis a 3-5 solopreneurs conocidos; escucha dónde se traban
3. Recién ahí construye el cobro
4. Los contadores como **referidores** (comisión), no revendedores, hasta que
   el canal se demuestre solo
