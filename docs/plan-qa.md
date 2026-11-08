# Plan de QA y evidencia de lanzamiento

5 de noviembre de 2026. Revisión independiente a cargo del agente QA; propietario realiza aceptación comercial y prueba financiera real. Usar Store en memoria o base aislada, identidades sintéticas, sin tocar datos de compradores.

## Reglas de cierre

Defecto: ID, severidad, historia afectada, precondición, pasos, esperado, observado, evidencia, responsable, corrección y resultado de regresión. P0: pérdida/corrupción, cobro/emisión incorrectos o acceso a datos ajenos. P1: flujo crítico roto sin alternativa operativa comprobada. P2: error con alternativa. P3: presentación. P0/P1 bloquean ventas hasta corregir y volver a probar. Una suite verde no prueba correo, Wompi real, dispositivo físico ni servidor público.

## Casos mínimos

| Casos | Historias | Evidencia para aceptar |
|---|---|---|
| QA-01 válido/duplicado/inválido; login correcto/incorrecto; logout | 01 | HTTP y navegador móvil/PC; sesión revocada |
| QA-02 recuperación válido/vencido/reutilizado y nueva sesión | 02 | Correo recibido + rechazos API |
| QA-03 publicado/borrador/agotado y búsqueda de dos IDs diferentes | 03,05 | Navegador y permiso API |
| QA-04 avanzar/retroceder/revisión/Enter y datos obligatorios | 04 | Navegador autenticado con datos sintéticos |
| QA-05 precio/cantidad manipulados y último cupo concurrente | 06,08 | API y stock final consistente |
| QA-06 Wompi aprobado/rechazado/pendiente; firma falsa; webhook repetido | 07,08 | Suite + referencias Sandbox reales, sin secretos |
| QA-07 vencimiento/pago tardío/cancelación/reinicio durante confirmación | 08,14 | Estado final y resolución/conciliación |
| QA-08 compra de varias entradas y descarga ajena denegada | 09,10 | N IDs distintos, PNG/SVG/PDF legibles |
| QA-09 recepción, fallo/reintento de correo y recuperación de entrada | 02,10 | Buzón real de pruebas y cola consistente |
| QA-10 válido/usado/anulado/ajeno/desconocido | 11 | API y equipos reales |
| QA-11 dos lectores mismaentrada + siguienteQR sin recargar | 12 | Un solo ingreso; vídeo/registro de prueba |
| QA-12 permisos comprador/staff/propietario y organizaciones ajenas | 13 | Casos permitidos/denegados |
| QA-13 carga a volumen acordado sin bloquear webhook | 08,15 | Latencias/errores/stock; proxy real |
| QA-14 backup/restauración/reinicio/reversión | 15 | Entorno aislado restaurado y datos consistentes |
| QA-15 revisión de información comercial y asistencia soporte | 14,16 | Aceptación del propietario |

## Estado al iniciar

QA ejecutó suite base: 24/24 (log /tmp/sharkpass-independent-qa.log). Nuevas pruebas: tests/scan-ui.test.mjs (3), tests/rate-limit.test.mjs (3). Regresión inicial conjunta: 6/6, log /tmp/sharkpass-release-regressions.log. Check/build finales de esta intervención: revisar /tmp/sharkpass-sprint-check.log y /tmp/sharkpass-sprint-build.log; registrar resultado al terminar. Estos logs locales pueden ser temporales, conservar evidencia resumida aquí y en informe QA.

## Operación propuesta de puerta

Dos teléfonos: uno principal y uno de respaldo/segunda fila, cada operador con su cuenta de staff y acceso al mismo evento. Validación siempre en servidor, sin admisión offline automática. Internet principal y datos móviles de respaldo; baterías/cargadores. Tablet opcional como puesto fijo con lector QR 2D conectado que escriba código+Enter en el formulario. Probar hardware/navegador exacto antes de comprar o comprometer esa alternativa.

La cámara web utiliza BarcodeDetector, de disponibilidad limitada y contexto seguro: https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector . No prometer compatibilidad de todos los teléfonos/iPads. Antes del evento ensayar con pantallas de brillo bajo, QR impreso, entrada repetida, cambios de red y dos operadores. No convertir un fallo de red en ingreso autorizado. El plan manual de contingencia debe ser aprobado por el organizador y evitar que dos puertas admitan por separado el mismo registro.
