# Bot de Telegram — Aprobación de cambios de precio

**Fecha:** 2026-07-09 · **Estado:** aprobado, en implementación

## Objetivo
Cuando alguien cambia/fija un precio en la pantalla de Precios del WMS, el cambio **no se aplica de inmediato**: queda pendiente y se publica una alerta en un **grupo de Telegram** con botones **Aceptar / Denegar**. Un aprobador autorizado resuelve desde el celular; queda **registro inmutable** de quién y cuándo. Si se deniega, se mantiene el precio actual. El solicitante puede **cancelar** su solicitud mientras siga pendiente.

## Decisiones (acordadas con el CEO)
- **1 bot, 1 grupo** con 3+ personas. Telegram identifica quién toca el botón.
- **Lista blanca** de aprobadores (IDs de Telegram). Fuera de la lista → "no autorizado".
- **Bloqueante**: pendiente hasta resolver. Rechazo mantiene el precio.
- **Primero que responde manda** (claim atómico anti-doble-tap).
- **Cancelable** por el solicitante mientras esté pendiente.
- Cambios en grupo (varios productos) → **1 sola solicitud = 1 mensaje** con `cambios[]`.
- **Transporte: long-polling** (demo local sin URL pública). Webhook queda para producción.

## Arquitectura
```
Precios.jsx → POST /api/price-approvals  → crea PriceApproval (pendiente)
                                          → telegram.sendMessage al grupo [✅][❌]
grupo Telegram → (long-polling getUpdates) → priceApprovalService.handleTelegramUpdate
   1. ¿from.id en lista blanca? (si no hay ninguno configurado, modo bootstrap abierto)
   2. claim atómico findOneAndUpdate(estado:"pendiente")
   3. Aceptar → aplica tiers a cada Product (save → recalcula min_price) + busta cache
      Denegar → no toca precios
   4. editMessageText: "✅ Aprobado por X · fecha" y quita botones
Cancelar: PATCH /api/price-approvals/:id/cancel (solicitante/admin) → cancelada + edita mensaje
```

## Modelos
- **PriceApproval**: `estado` (pendiente/aprobada/rechazada/cancelada), `solicitante{user_id,nombre,role}`, `motivo`, `cambios[{product_id,nombre,precio_actual,precio_propuesto,tiers_actuales,tiers_propuestos}]` (immutable), `telegram_chat_id`, `telegram_message_id`, `resuelto_por{telegram_id,nombre}`, `resuelto_en`, `cancelada_por`, timestamps.
- **TelegramApprover**: `telegram_id` (unique), `nombre`, `activo`. Sembrado desde `TELEGRAM_APPROVER_IDS`.

## Endpoints (gate `products.manage`)
- `POST /api/price-approvals` `{ items:[{product_id, tiers_propuestos}], motivo? }` → crea + notifica. Backend re-snapshotea precio/nombre desde la BD (no confía en el cliente). 409 si un producto ya tiene solicitud pendiente. Si Telegram no está configurado o falla el envío → error (no deja cambios fantasma).
- `GET /api/price-approvals?estado=pendiente` → items (chips + cancelar).
- `PATCH /api/price-approvals/:id/cancel` → cancela (solo solicitante o admin/manager).

## Comandos del bot (en el grupo)
- `/id` → responde chat_id + tu telegram_id (para configurar el grupo y agregar aprobadores).
- `/aprobadores` → lista la lista blanca.
- `/agregar <id> <nombre>` / `/quitar <id>` → solo un aprobador ya autorizado.

## Variables de entorno (nunca en código)
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID`, `TELEGRAM_APPROVER_IDS` (csv, semilla), `TELEGRAM_WEBHOOK_SECRET` (futuro). Sin token → módulo desactivado, Precios sigue en modo directo.

## Frontend (Precios.jsx)
- "Fijar" individual y por lote → crean solicitud en vez de aplicar.
- Chip "⏳ Pendiente de aprobación" en filas con solicitud abierta + botón "Cancelar".
- Sin tiempo real (v1): al recargar, el precio aprobado ya aparece.

## Seguridad / notas
- El token de la captura quedó expuesto; para el demo se usa igual, revocar en @BotFather antes de producción.
- Claim atómico cierra la carrera de doble-tap y tap-tras-cancelación.
- El registro (PriceApproval + AuditLog) es la evidencia permanente de quién aprobó/denegó.
