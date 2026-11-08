# QA independiente de lanzamiento — SharkPass

Fecha: 5 de noviembre de 2026 (America/Bogota).
Estado de esta revisión: **no aprobar ventas públicas todavía**. Registro y login existen y están cubiertos parcialmente por pruebas; no se consideran funciones por construir.

## Alcance y evidencia

Revisión de AGENTS.md, backend de cuentas/pagos/entradas, cliente web, formulario asistido y control de acceso. Sin cambios en producto, sin publicación, sin datos personales, sin llamadas de pago real y sin modificar la base persistente del propietario.

- `node --experimental-sqlite --test tests/*.test.mjs`: **24 aprobadas / 24, 0 fallos**, duración reportada 11 178 ms. Log de ejecución: `/tmp/sharkpass-independent-qa.log`.
- Se cubren registro de perfil, privacidad, sesiones móviles/web, revocación, permisos de organizador/staff, cupos, reservas, firmas de pago alteradas, reintentos, pagos tardíos/anulados, recuperación y QR anulados/usados.
- Las pruebas de proveedores usan respuestas sintéticas. No prueban Wompi Sandbox real, recepción de correo en buzón ni cámara física.
- Dos defectos P1 se reprodujeron mediante harnesses aislados del producto; uno ejecuta `scan()` real extraído de public/app.js con APIs de cámara sintéticas; el otro usa `Store(':memory:')` y el servidor HTTP real.
- No se ejecutó build/export ni prueba de contenedor en esta subrevisión. El agente principal debe registrar esos resultados por separado.

## Defectos

### QA-SCAN-01 — P1 — Segunda lectura de cámara no procesa la entrada

Origen revisado: `public/app.js`, función `scan()`, líneas originales 1343–1401; estado `busy` y botón «Escanear con cámara».

Pasos:
1. Entrar con personal autorizado y seleccionar evento publicado en navegador compatible.
2. Iniciar cámara y detectar un primer QR. `busy` cambia a true y se detiene el flujo.
3. Volver a pulsar «Escanear con cámara» y detectar un segundo QR.

Esperado: iniciar un nuevo ciclo de lectura y enviar el segundo código una sola vez.
Actual: el segundo código es detectado pero no se envía: `busy` permanece true en el cierre de la función. Solo se restaura al volver a construir la pantalla.

Evidencia de harness con `scan()` real, dos detecciones sintéticas y sin servidor persistente:

```json
{"cameraStarts":2,"detections":2,"submissions":1,"scheduled":1,"expectedSubmissions":2}
```

Impacto: bloquea la operación repetida de cámara en puerta, incluso cuando la primera validación fue rechazada. Si se lanza con lectores físicos exclusivamente, documentar esa restricción y probarlos; si se ofrece cámara, corregir y volver a probar secuencia válida → válida, inválida → válida, usada → válida, detener → iniciar y denegar permiso → iniciar.

Estado: **corregido y verificado mediante tres regresiones sintéticas** el 5/11. El controlador reinicia busy, invalida la sesión de cámara, comprueba resultados asíncronos y desconecta el observador. `node --test tests/scan-ui.test.mjs`: 3/3 aprobadas. Sigue pendiente la prueba en el dispositivo físico de ingreso.

### QA-RATE-02 — P1 — Tráfico general puede bloquear notificaciones Wompi

Origen: `src/server.mjs`, líneas originales 80–89. El bucket de API se calcula con `req.socket.remoteAddress` y aplica también a `/api/payments/wompi/events`.

Reproducción aislada:
1. Crear `Store(':memory:')`, `createApp({store, paymentConfig:null, mailConfig:{}})` y puerto efímero en loopback.
2. Hacer 300 GET de `/api/me` desde la misma dirección, sin cookies.
3. Enviar POST JSON a `/api/payments/wompi/events` desde esa dirección.

Resultado observado:

```json
{"requestsBeforeWebhook":300,"lastReadStatus":200,"webhookStatus":429,"body":{"error":"Demasiados intentos. Espera un minuto."}}
```

Esperado: el tráfico de catálogo/compradores no agota el presupuesto de recepción de notificaciones del proveedor. La validación de firma y ambiente del webhook debe seguir intacta.

Impacto: con proxy inverso delante de Node, muchos clientes y el proveedor pueden aparecer bajo la misma dirección del proxy. Se comparten además 20 solicitudes de autenticación/minuto entre todos los compradores bajo esa dirección. El despliegue público no está definido en el repositorio, por lo que la amplificación por proxy es un riesgo condicionado a esa arquitectura; el bucket compartido y el 429 sí están reproducidos.

Acción: diseñar buckets separados para webhook/autenticación/API y una estrategia de identidad que no confíe en cabeceras reenviadas por cualquiera. Probar bajo el proxy real, carga de compradores, staff simultáneo y webhooks válidos/falsos; no eliminar controles de abuso para solucionar el problema.

Estado: **bucket compartido corregido y reproducción aislada revalidada** el 5/11. El webhook usa bucket propio y la API autenticada se limita por usuario. Se añadió identidad de cliente mediante lista explícita de proxies de confianza; falta validar su configuración bajo el proxy público real. Tras las mismas 300 lecturas, el webhook devuelve 503 por proveedor no configurado (esperado para el fixture), en lugar de 429. No se ha probado una notificación Wompi real.

### QA-WIZ-03 — P2 — Precarga no enfoca hora en asistente

Origen: `public/app.js`, botón «Preparar Pitch Competition» de `organizer()` (líneas originales 1154–1175) y `eventDraftSteps()` (1034–1087).

En el paso inicial «Información», el botón precarga los campos e intenta `f.elements.time.focus()`, pero el campo hora pertenece al paso «Fecha y lugar» y su label está hidden. El foco no llega al campo solicitado. La información no se pierde y se puede continuar manualmente; no bloquea por sí solo ventas.

Esperado: precargar y explicar el siguiente paso o navegar expresamente al paso adecuado. Probar ida/vuelta conservando valores, Enter en cada paso y validación de campos ocultos.

Estado: hallazgo de inspección estática; pendiente reproducción visual con cuenta organizadora aislada.

## Creación asistida y retorno de compra

- Los campos se mantienen en el mismo formulario al cambiar de paso; no hay recreación del DOM que descarte valores.
- `required` se desactiva para los pasos ocultos y se restaura para revisión; se valida cada campo antes de continuar.
- La captura de submit impide guardar antes del paso de revisión. En revisión se crea borrador; publicación y tipos de entrada siguen separados.
- El retorno a un evento tras login usa `returnEvent`. Los enlaces de pago/orden iniciales se conservan en `params` para el retorno tras autenticación. Falta comprobar visualmente estas variantes con recarga y pérdida de sesión.
- No se registró un defecto P0/P1 adicional en esos recorridos por inspección. Esto no equivale a aprobación end-to-end.

## Pruebas manuales de salida pendientes

1. Registrar comprador real de ensayo, login, logout, login fallido y recuperación por correo verificado; privacidad entre dos compradores.
2. Crear organizador y evento en tres pasos: retroceder sin pérdida, precarga, Enter, fecha pasada, campos inválidos y confirmar borrador solo una vez.
3. Publicar con/sin tipos de entrada y permisos permitidos/denegados.
4. Compra pagada desde anónimo → registro/login → continuar; cantidades y total revisados; aprobada/rechazada/pendiente/vencida.
5. Wompi Sandbox real: firma, referencia, webhook repetido, llegada tardía, pérdida de retorno del navegador y recuperación del estado.
6. Recibir correo y abrir entradas tras sesión vencida; comprobar cantidad de QR, descarga e impresión.
7. Dos lectores autorizados intentan la misma entrada simultáneamente: exactamente un ingreso.
8. Cámara del dispositivo real en HTTPS: secuencia repetida y fallos de permisos; alternativa de lector físico.
9. Reiniciar servicio tras compra y durante correo pendiente; comprobar persistencia y ausencia de duplicados.
10. Carga representativa bajo el proxy real, copia externa y restauración en un entorno separado.

## Bloqueos operativos ajenos a esta suite

El archivo del primer evento sigue sin hora ni tipos/precios/cupos confirmados. No hay evidencia de dominio HTTPS operativo, credenciales Wompi validadas, remitente probado, compra real controlada, restauración externa ni ensayo de puerta. Son puertas de salida pendientes, no prueba de ausencia de backend.

La aprobación final requiere resolver P1 o limitar formalmente el alcance afectado, ejecutar regresión, adjuntar evidencia de Sandbox/correo/dispositivo y que el propietario valide la compra controlada y la operación. No hay garantía de cero defectos.

## Ampliación autorizada: regresión automatizada de cámara

A solicitud del responsable de implementación se añadió únicamente `tests/scan-ui.test.mjs`, sin modificar producto ni introducir dependencias. Ejecuta la función `scan()` del cliente real en `node:vm` con superficies de navegador deterministas.

Resultado inicial antes del arreglo: **3 fallos / 3**, confirmando:
- Reiniciar cámara no registra el segundo QR.
- Detener mientras `detect()` espera no evita un submit tardío del QR detectado.
- Un resultado antiguo después de reiniciar puede dejar un ciclo de lectura programado que ya no pertenece al flujo activo.

Comando de regresión: `node --test tests/scan-ui.test.mjs`. Reejecutado después de corregir el controlador: **3 aprobadas / 3**, duración reportada 86,6 ms. La reproducción sintética no reemplaza el ensayo con cámara física.

## Cierre de correcciones de esta intervención

- QA-SCAN-01: corrección de reinicio/generaciones y limpieza de cámara; tres regresiones sintéticas aprobadas.
- QA-RATE-02: webhook en bucket separado, API autenticada por usuario, IP reenviada solo desde proxies configurados explícitamente; pruebas de saturación, permiso y rechazo de cabeceras falsas aprobadas.
- Precarga de Pitch: `f.showField("time")` lleva al paso visible antes de enfocar. Corregido por desarrollo; aceptación visual autenticada pendiente.
- Suite completa tras correcciones: **30/30 aprobadas**, 5 de noviembre, log `/tmp/sharkpass-release-all-tests.log`. Datos sintéticos en memoria, sin ventas reales.
- Check global incluye TypeScript móvil: esta ejecución local quedó sin completar y fue detenida, al igual que una ejecución previa, tras varios minutos. La exportación global y una comprobación en copia aislada se intentaron por separado; no declarar esos checks verdes sin su salida de finalización. Las fuentes móviles no se modificaron en esta intervención.
- Los datos oficiales del evento se verificaron en Shark Caribe y se guardaron en content/pitch-competition.json; cupos pendientes. El archivo no publica automáticamente el evento.

QA-ENV-01 (validación pendiente, no defecto funcional demostrado): el check global quedó en TypeScript móvil durante varios minutos y la exportación quedó sin avance tras iniciar Expo; el intento de copiar a entorno temporal tampoco completó. Se detuvieron esas ejecuciones para evitar procesos colgados. **No se aprueban build/export globales de esta entrega.** Resolver el entorno y repetir ambos antes de desplegar. La suite independiente Node de30casos sí terminó con código0.

## Actualización de validación — 6/11/2026

QA-ENV-01 se resolvió para las fuentes actuales en una copia limpia con el mismo lockfile, npm ci y runtime22.17.1: check completo (tipos y39pruebas), exportaciones Android/iOS/web y contenedor aprobados. Las pruebas nuevas de plataforma cubren roles forjados, activación inicial, rechazo de compradores/organizadores/scanner, reautenticación, reglas de publicación/cancelación, sesiones, auditoría, retirada de privilegios y backup previo a migración. QA visual con datos sintéticos en localhost13204. No se ha asignado el rol a una cuenta real del propietario mientras no esté identificada.

## Corrección de contraste — 6 de noviembre de 2026

Se sustituyó el fondo negro heredado de `.auth-form input` por fondo claro y texto azul oscuro explícitos. Se definieron cursor, placeholder, foco visible y texto de autocompletado, con color-scheme light. Sin cambios en cuentas, contraseñas o permisos. Recursos CSS con nueva versión para navegadores abiertos.

Validación en copia limpia con el mismo lockfile: npm run check (39 pruebas), npm run build (Android/iOS/web) y construcción de contenedor aprobados. QA visual con texto sintético sin enviar formularios en registro e inicio de sesión, usando el contenedor en localhost:13207. Publicado en sharkpass.co: build 01a1b184-b151-71a0-8b52-53e0a5ad0793 completado y health HTTP 200; estilos actualizados comprobados por HTTP.

## Banner HD y activación inicial — 6/11/2026

Banner generado 2172 × 724 px, WebP de 258482 bytes; HTTP 200 image/webp y comprobación visual en portada pública. Prompt y procedencia en public/media/SOURCES.md. Pruebas: 41/41, build/export y contenedor aprobados. Publicación 01a1b190-0b4e-70ea-9515-ddd18ee27f95. Identificación de propietario por consulta en log privado y activación por UUID existente confirmada active=true; permisos de visitante y cuenta QA siguen rechazados. No hubo cambios de contraseñas, ventas ni claves de pago.

## Configuración Wompi Sandbox — 6/11/2026

Se publicaron rutas separadas: Sandbox /api/payments/wompi/events/test y producción /api/payments/wompi/events. Cada ruta rechaza el ambiente contrario antes de procesar el pago; ambas conservan firma, consulta canónica y límite independiente de notificaciones. Pruebas permitidas y denegadas incluidas: 42/42, build/export y contenedor aprobados. Build Hostinger 01a1b1b4-2aca-705f-b76e-811313bb66a5 completado. Endpoint Sandbox verificado públicamente: 503 sin credenciales, esperado; no se omitió la validación ni se procesaron pagos.

Panel Wompi confirmado en Sandbox. El intento de guardar la URL devolvió al login: falta confirmar su persistencia tras iniciar sesión de nuevo. Se preparó un formulario temporal en 127.0.0.1 para entrada manual de las cuatro claves por el propietario, que las transmite al alojamiento por API sin guardarlas localmente ni registrarlas. El formulario restringe Origin, Host, ruta aleatoria y token de formulario, acepta solo prefijos test y conserva las variables existentes conocidas; ante claves nuevas inesperadas en Hostinger detiene el cambio. Verificados rechazo sin Origin (403) y valores inválidos (400), sin modificar el servidor. Las claves están pendientes de entrada por el propietario. No se declara conectado Wompi ni se habilitan cobros reales.

## Activación técnica Sandbox — 6/11/2026

Las cuatro claves Sandbox se transfirieron en memoria al alojamiento privado, sin imprimir sus valores ni guardarlos en archivos. Hostinger aceptó la configuración y GET /api/health devolvió payments=test; /api/me confirmó paymentsConfigured=true y paymentEnvironment=test. WOMPI_ENABLE_PRODUCTION continúa deshabilitado. No se realizaron transacciones reales ni se considera validado todavía un pago Sandbox completo. El correo permanece sin configurar.

El formulario local rechazó el primer envío por Origin nulo generado por su anterior Referrer-Policy:no-referrer. Se corrigió a same-origin; para formularios antiguos en caché, se exige Fetch Metadata same-origin además del token y ruta privada. Comprobación real con navegador: un envío sintético inválido llegó a validación de campos (400), conservando rechazo 403 para Origin ausente, externo o nulo con cross-site. El envío válido posterior confirmó el guardado. No se conservaron valores de claves en el repositorio.

La URL Sandbox es https://sharkpass.co/api/payments/wompi/events/test. Wompi regresó a login tras intentar guardarla: falta comprobar persistencia desde una nueva sesión Sandbox. No afirmar recepción de notificaciones hasta completar esta comprobación y el pago de prueba.

## URL Wompi Sandbox confirmada — 6/11/2026

Se comprobó en el panel autenticado la leyenda Sandbox y la llave pública de pruebas (sin registrar su valor). Se navegó a Inicio y se volvió a Programadores: la URL https://sharkpass.co/api/payments/wompi/events/test volvió a cargar desde la configuración, sin aviso de cambios pendientes. Queda confirmada su persistencia. SharkPass respondió HTTP 200 con payments=test. Pendiente ejecutar la compra Sandbox completa y comprobar notificación firmada, emisión y escaneo del QR; correo aún sin configurar. No se habilitaron cobros reales.

## Eventos creados — 6/11/2026

Build Hostinger 01a1b1e0-be3d-72f5-984f-c0e6073a76b6 completado. Se aplicó la nueva migración inmutable 202611060002_event_presentation.sql, sin cambiar las anteriores. Las portadas y categorías se guardan por evento y se muestran en catálogo, ficha y administración. El afiche oficial de Shark Caribe está permitido como recurso público.

Dos DEMO publicados: Noche Azul (594af92b-8d80-48ca-a4f6-2e694e48f29b), General COP 5000/cupo20 y Preferencial COP10000/cupo10, ambos ficticios de ensayo; Encuentro SharkPass QR gratuito (0a1516f0-6878-425b-9713-c6be2c18bccc), cupo20. Shark Caribe (f73a9bc4-337b-4d83-a067-6d8722c1a8c6) permanece draft, is_demo=0 y sin tipos de entrada. Todos asignados al propietario ya registrado, validando su rol vigente en el servidor; ningún ID de cuenta ni contraseña se añadió al repositorio.

La carga se ejecutó mediante tarea privada de un uso incluida solo en el archivo de despliegue, no en el repositorio. Requiere propietario existente y superadministrador, aplica la preparación transaccional y usa marcas de auditoría para evitar duplicados. Publica exclusivamente los DEMO mediante las reglas normales. El archivo se consume tras éxito y su ruta no es pública. No se alteraron claves Wompi ni variables privadas.

Validación: 48/48 pruebas y build/export aprobados en copia limpia con el mismo lockfile. El check en el árbol original se detuvo en TypeScript por las dependencias locales previas; se interrumpió y se verificó la copia limpia. Contenedor de actualización de esquema5 a6: respaldo consistente, usuario previo conservado, tarea consumida, dos DEMO públicos y real privado. Revisión independiente sin bloqueantes. QA visual local de las tarjetas y del afiche en la administración del borrador; comprobación posterior de las tarjetas públicas en sharkpass.co. HTTP real: catálogo2 DEMO, fichas200, borrador404 para visitantes, source/ops404, afiche200; health mantiene payments=test.

Ensayo no comercial en el DEMO gratuito con cuenta sintética: una entrada confirmada por COP0, token QR presente y descarga HTTP200 con QR PNG y etiqueta DEMO. Reintento con la misma clave no duplicó la entrada. El comprador sin permiso de ingreso recibe403 al intentar escanear. No se afirmó un escaneo físico ni una aprobación Wompi: esas comprobaciones siguen pendientes. El correo aún no está configurado. Hallazgo visual menor previo: la administración usa “Gratis recaudados” para COP0; corregir el formato monetario antes de lanzamiento.
