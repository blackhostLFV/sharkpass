# Guía de revisión de SharkPass

Estado: 8 de noviembre de 2026. Repositorio público para evaluación técnica. Sitio: https://sharkpass.co/. La revisión de código y las pruebas se pueden ejecutar sin claves comerciales; usar únicamente datos sintéticos. No realizar compras reales en producción como parte de una revisión sin coordinar con el propietario.

## Alcance de los hitos

| Hito | Implementación | Validación y límite |
| --- | --- | --- |
| 4. Control de ingreso | PWA instalable desde el navegador; cámara, lectura de QR, permisos por evento y respuesta de ingreso. No requiere una app nativa o híbrida. | Pruebas de permisos y rechazo del segundo ingreso aprobadas. Requiere conexión y HTTPS para la cámara; falta prueba física con tablets. |
| 5. Sincronización online/offline | La validación online se centraliza en el servidor y registra un solo uso. El service worker permite instalar y cargar la interfaz. | **No está completado el alcance offline**: no hay validación distribuida sin internet ni cola de admisiones. Un fallo de conexión no debe dar un ingreso por confirmado. Para operación se necesita red estable y contingencia. |
| 6. Sillas numeradas | Mapa web conectado al inventario, selección de silla, reserva de 15 minutos, confirmación individual y QR asociado a la silla. | 100 sillas del evento oficial: A–E Preferencial y F–J General. A–C bloqueadas. Pruebas de exclusión, concurrencia, idempotencia y aprobación tardía aprobadas. No es un editor de planos arbitrarios. |

## Compra y acceso

1. El comprador descubre el evento y revisa fecha, lugar, localidad y precio final.
2. Selecciona sillas disponibles; no quedan reservadas por mirar el mapa.
3. Revisa el carrito, inicia sesión por correo y registra un nombre por asistente.
4. Acepta las condiciones vigentes y prepara el pago. El servidor verifica disponibilidad y mantiene la reserva temporal.
5. La emisión depende de la confirmación validada del proveedor, no de la URL de retorno del navegador. Los callbacks repetidos no crean entradas adicionales.
6. Consulta su QR individual, silla y nombre en Mis entradas. El correo es una entrega complementaria con cola y reintentos.
7. El personal autorizado escanea. La primera validación válida se registra; un intento posterior del mismo QR se rechaza.

## Archivos que conviene revisar

- `src/store.mjs`: persistencia, permisos, cupos y transacciones.
- `src/payments.mjs`: configuración por ambiente, firmas, conciliación con Wompi, reserva e idempotencia.
- `src/seating.mjs` y migraciones 003–005: disponibilidad, asignación y sillas bloqueadas.
- `src/registration.mjs`: nombres de asistentes y versión de condiciones.
- `src/admin-console.mjs` y `public/admin-console.js`: administración, métricas y acciones protegidas.
- `public/ingreso/`: escáner PWA y estados de conexión.
- `src/mail.mjs`, `src/mail-templates.mjs`, `src/ticket.mjs`: notificaciones y ticket individual.
- `tests/`: casos permitidos y denegados, inventario concurrente, sesión, QR y migraciones.

## Evidencia reproducible

Con Node 22.17.1: `npm ci`, `npm run check` y `npm run build`. La revisión actual pasó 102 pruebas; el build exporta los clientes Expo y comprueba sintaxis del servidor. Hay una prueba HTTP concurrente que permite una compra por silla, y una prueba de migración que preserva entradas previas tras crear y abrir un respaldo independiente.

Los escenarios de pago en pruebas usan datos y adaptadores sintéticos. No demuestran por sí solos aprobación comercial, entrega a todos los proveedores de correo o rendimiento de un recinto en operación.

## Pendientes y límites

- Completar una compra real y comprobar webhook, correo y QR en producción.
- Ensayo de acceso con tablets/cámaras reales y red del recinto.
- Carga con el volumen previsto y recuperación desde copia externa.
- Validación offline multi-dispositivo, si se exige ese alcance.
- Cliente móvil Expo: pruebas físicas y distribución firmada; el mapa de sillas operativo se entrega en la web adaptable.
- El backend actual requiere una instancia y una base SQLite compartida. No hay garantía de seguridad absoluta ni certificación independiente.

No se publican cuentas, contraseñas, bases de compradores ni sesiones para los evaluadores. El acceso de administración de producción se gestiona por separado; registrar una cuenta no concede permisos de administrador.
