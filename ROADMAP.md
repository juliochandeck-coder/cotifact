# CotiFact — Roadmap

Lo que falta construir, no lo que falta hacer para lanzar (eso está en `CHECKLIST.md`).
Este documento es la lista de trabajo de producto; se actualiza cada vez que se
decide posponer algo o se termina algo.

---

## Fase 2 — Analítica de negocio

**Estado: construido.** Panel "Resumen" (`/summary`), segunda pestaña del
menú. KPIs del período con tendencia contra el período anterior, embudo
Enviadas → Aprobadas → Facturadas → Cobradas, ranking de servicios (por
frecuencia y por ingreso), top clientes, ticket promedio, días promedio hasta
aprobación y hasta cobro.

Aterrizaje inteligente: una cuenta nueva o con pocos documentos entra a
Cotizaciones (Resumen con puros ceros es peor primera impresión que no
mostrarlo); a partir de 5 documentos y 14 días de antigüedad, entra a Resumen.
Ver `MIN_ACCOUNT_AGE_DAYS` / `MIN_DOCUMENTS_FOR_SUMMARY` en `app/page.tsx`.

Decisión de diseño: sin librería de gráficas. El embudo y los rankings son
barras con CSS — para 4-6 puntos de datos, una librería como recharts es peso
sin beneficio. La página pesa 1.6kB, igual que las más simples de la app.

- [x] KPIs con comparación contra el período anterior
- [x] Embudo de conversión
- [x] Ranking de servicios (frecuencia e ingreso)
- [x] Ticket promedio, días a aprobación, días a cobro
- [x] Top clientes

- [ ] **Margen por servicio — sigue pospuesto.** Necesita un campo `cost`
      opcional en `services` que hoy no existe. Sin costo no hay margen real
      que calcular. Cuando se retome: agregar el campo, dejarlo opcional, y
      que la métrica de margen simplemente no aparezca para los servicios sin
      costo cargado.

---

## Fase 3 — Cobro de suscripción

**Estado: base de datos lista (`migration_v5.sql`), pasarela sin conectar.**

Las tablas `subscriptions` y la función `quotes_this_month()` (para el límite
del plan gratis) ya existen. Falta:

- [ ] **Decisión pendiente del dueño:** Paguelo Fácil/Yappy (pagos locales en
      Panamá) vs Stripe (solo sirve si se vende al exterior)
- [ ] Página de precios pública
- [ ] Webhook que reciba el pago y cree la cuenta
- [ ] Correo de bienvenida con enlace mágico (nunca contraseña en texto plano)
- [ ] Aplicar el límite del plan gratis usando `quotes_this_month()`

---

## Fase 4 — Equipos / marca blanca real (Modelo B)

**Estado: esquema listo (`organizations`, `organization_members`,
`organization_id` en todas las tablas, políticas de seguridad ya aceptan
acceso por organización). Falta solo la interfaz.**

No se activa hasta que haya señal real de que el canal existe (ver
`CHECKLIST.md` → "Cuándo escalar"): un mismo contador trayendo 3-4 clientes
por su cuenta.

- [ ] Pantalla de invitar miembros a una organización
- [ ] Selector de organización activa si un usuario pertenece a más de una
- [ ] Ajustar `Navbar`/`Settings` para mostrar de qué organización se está
      trabajando

---

## Fase 5 — Ideas sin compromiso de fecha

Cosas mencionadas en el camino que valen la pena pero no tienen fase asignada:

- **Facturas recurrentes** para clientes con iguala/retainer mensual
- **Timbrado fiscal (PAC/DGI)** — integración con un Proveedor Autorizado
  Calificado para quien cruce el umbral de B/.36,000/año. Es un producto
  distinto (requiere certificación), no una función más.
- **Atajos de teclado** y duplicar-desde-lista para el usuario avanzado

---

## Ya resuelto (para no reabrir la discusión)

- ~~Multi-usuario / organizaciones~~ → esquema listo en `migration_v5.sql`,
  solo falta la interfaz (ver Fase 4)
- ~~Exportar CSV~~ → construido
- ~~Recuperar contraseña~~ → construido
- ~~Onboarding~~ → construido (`/welcome`)
- ~~Envío de correo~~ → construido (Resend, opcional)
