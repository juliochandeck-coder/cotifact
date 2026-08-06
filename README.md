# Cotizador

Cotizaciones y facturas con login real y marca blanca. Next.js + Supabase + Vercel, cero costo.

## Qué hace

- Login real por usuario (Supabase Auth, contraseñas cifradas)
- Cotización: formulario → previsualizar → descargar PDF (el archivo se guarda con el número del documento, ej. `COT-2026-0001.pdf`)
- Estados de cotización: pendiente / aprobada / no aprobada / re-cotizar
- Editar, duplicar y eliminar cotizaciones
- **Resumen**: panel de KPIs (cotizado, facturado, cobrado, tasa de aprobación), embudo de conversión, servicios más vendidos y top clientes, con comparación contra el período anterior
- Facturación en un clic desde una cotización aprobada, con los mismos datos y fecha de vencimiento automática
- Botón "Aprobar y facturar" que resuelve ambos pasos de una vez
- Botón "Facturar" directo en las filas del listado, sin abrir el detalle
- Aviso en el dashboard del trabajo aprobado que sigue sin facturar, con opción de facturarlo todo de golpe
- Estados de factura: no pagada / enviada / pagada, con aviso de días de retraso
- Búsqueda, filtro por estado y paginación en ambos listados
- Marca blanca: cada usuario sube su logo, elige 2 colores, moneda, impuesto por defecto, plazo de pago y notas por defecto
- Directorio de clientes con autocompletado (se llena solo al cotizar) y catálogo de servicios con precios guardados
- Bandeja de seguimiento: cotizaciones sin respuesta y facturas vencidas, con mensaje de recordatorio listo para copiar. El plazo de "sin respuesta" lo define cada usuario en Ajustes (7 días por defecto)
- Envío por correo de cotizaciones y facturas, con tu logo y colores (opcional, vía Resend)
- Cada usuario solo ve sus propios documentos (seguridad a nivel de base de datos)

## Instalación nueva

1. **Supabase** → crea proyecto → **SQL Editor** → pega y corre `supabase/schema.sql` completo.
2. **Project Settings → API** → copia *Project URL* y *anon public key*.
3. Copia `.env.local.example` a `.env.local` y pega ambos valores.
4. **GitHub** → sube esta carpeta a un repositorio (el `.env.local` está excluido por `.gitignore`; verifica que no aparezca).
5. **Vercel** → Add New Project → importa el repo → agrega las dos variables de entorno → Deploy.

Prueba local opcional (requiere Node.js):

```
npm install
npm run dev
```

## Si ya tenías una versión anterior corriendo

No vuelvas a correr `schema.sql`. En **SQL Editor**, corre en orden los archivos de migración que te falten:

1. `supabase/migration_v2.sql` — contadores de numeración, marca blanca, índices y restricciones.
2. `supabase/migration_v3.sql` — directorio de clientes, catálogo de servicios y registro de envíos. Siembra el directorio con los clientes que ya aparecen en tus cotizaciones, así que no empiezas de cero.
3. `supabase/migration_v4.sql` — plazo de seguimiento configurable por usuario.

Ambos son idempotentes y no borran datos.

Después sube el código nuevo a GitHub — Vercel redespliega solo.

## Envío por correo (opcional)

El botón "Enviar por correo" funciona solo si configuras Resend. Sin esas variables el resto de la app opera igual y el botón avisa que falta configurarlo.

1. Crea cuenta gratis en [resend.com](https://resend.com) (3.000 correos/mes) y verifica tu dominio.
2. Genera una API key.
3. En Vercel → Settings → Environment Variables, agrega:
   - `RESEND_API_KEY` — la key generada
   - `RESEND_FROM` — el remitente, por ejemplo `Tu Empresa <facturacion@tudominio.com>`

El correo sale con tu logo, tus colores y el detalle de conceptos. Las respuestas del cliente llegan al correo que pusiste en Ajustes. Al enviar una factura, su estado pasa a "enviada" automáticamente.

## Notas técnicas

**Numeración de documentos.** Los números salen de la función `next_document_number()` en Postgres, que incrementa un contador atómico por usuario, tipo y año. No se repiten aunque se generen dos documentos al mismo tiempo o se borren documentos anteriores. Además hay índices únicos sobre `(user_id, número)` y uno parcial que impide dos facturas para la misma cotización.

**PDF.** El botón usa la impresión del navegador con una hoja de estilos dedicada: oculta la interfaz, respeta saltos de página entre conceptos, y fuerza `print-color-adjust: exact` para que los colores de marca sí salgan impresos (sin esto el navegador los descarta). El título de la página se cambia al vuelo para que el archivo se guarde con el número del documento.

**Importes.** Todo valor monetario pasa por `num()` antes de usarse, porque PostgREST puede devolver columnas `numeric` como texto. Los totales se redondean a 2 decimales con `round2()` para evitar arrastres de punto flotante. El formato usa `Intl.NumberFormat` con la moneda y el locale del usuario.

**Directorio automático.** Cuando cotizas a alguien que no está guardado, se agrega solo al directorio. No hay un paso de "dar de alta al cliente": la lista se construye trabajando. Los índices únicos usan `lower(btrim(name))`, así que "Juan Pérez" y "juan pérez " no se duplican.

**Correo.** Se manda por la API REST de Resend con `fetch`, sin dependencia extra. La plantilla es HTML de tablas planas, que es lo único que renderiza igual en Gmail, Outlook y Apple Mail.

**Rendimiento.** Los listados filtran y paginan en la base de datos, no en el navegador (25 por página), con índices sobre `(user_id, created_at)` y `(user_id, status)`. Las páginas de detalle disparan sus consultas en paralelo. La búsqueda tiene debounce de 350 ms y el texto se sanitiza antes de llegar al filtro de PostgREST.

**Límites del tier gratis.** Supabase: 500MB de base de datos, 1GB de almacenamiento (logos), 50k usuarios activos/mes. Vercel: sin límite de tiempo para tráfico de uso normal de negocio.

## Pendientes conocidos

Este código **no** hace timbrado fiscal — la plantilla es un documento comercial,
no una factura validada por la autoridad tributaria (SAT en México, DGI/SFEP en
Panamá). En Panamá, desde enero de 2026 la DGI exige un Proveedor Autorizado
Calificado (PAC) para quien factura más de B/.36,000 al año o más de 100
facturas al mes. Por debajo de eso, el facturador gratuito de la DGI se puede
usar en paralelo. CotiFact no sustituye esa obligación.

El resto de lo que falta —cobro de suscripción, equipos/marca blanca real,
analítica de negocio— está organizado por fases en **`ROADMAP.md`**, con lo
que ya tiene base de datos lista y lo que sigue pendiente de decisión.
