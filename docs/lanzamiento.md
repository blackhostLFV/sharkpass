# SharkPass: estado de entrega y activación

Estado actualizado al 6/11/2026: web pública https://sharkpass.co y Wompi Sandbox configurado. Dos eventos DEMO publicados; Shark Caribe creado en borrador privado. No hay cobros reales habilitados. Correo propio y plantillas activos, con recepción real de verificación comprobada. La prueba completa de pago Sandbox, comprobante por correo y puerta física siguen pendientes.

## Primer evento

Pitch Competition by Shark Caribe, 25/11/2026 a las 15:00 America/Bogota, Hotel Dann Carlton Barranquilla, Salón Los Laureles. El evento existe como borrador privado con su afiche y dirección. Está asignado a la cuenta del propietario; no tiene tipos de entrada ni inventario porque faltan cupos, tarifas finales y condiciones. Se administra desde Para organizadores → Mis eventos. `content/pitch-competition.json` conserva las referencias públicas y lo pendiente.

SharkPass es la ticketera independiente; Shark Caribe aparece exclusivamente como organizador de su evento. El logo oficial conserva el ticket-aleta y el lema, sin monograma S, código de barras ni Shark Caribe.

## Compra y acceso

1. El comprador inicia sesión, elige cantidad y correo de entrega.
2. El servidor calcula el importe en COP, firma la referencia Wompi y reserva el cupo hasta 15 minutos. El precio no se acepta desde el cliente.
3. El checkout alojado de Wompi recibe la referencia única, importe, moneda, vencimiento y firma. Las claves privada, de integridad y de eventos nunca llegan al cliente.
4. `POST /api/payments/wompi/events/test` recibe exclusivamente Sandbox y `POST /api/payments/wompi/events` exclusivamente producción. Cada ruta exige el ambiente activo correspondiente, valida la firma y consulta la transacción canónica con la **llave privada** desde el backend; compara referencia, importe y COP. No se confía en el retorno del navegador.
5. La aprobación se procesa en una transacción SQLite: compra y QR individual por cada entrada. Reintentos no duplican emisión ni correo.
6. El comprador ve sus entradas en Mis entradas, descarga el ticket SVG con QR incorporado o imprime/guarda PDF desde el navegador.
7. La notificación de compra se coloca en una cola durable. Cuando se configure correo, envía un enlace privado que exige iniciar sesión, sin publicar los secretos QR. El correo no adjunta PDF automáticamente.
8. El personal autorizado valida un solo ingreso. Hay lector conectado/código manual y cámara únicamente en navegadores con BarcodeDetector/getUserMedia compatibles. Falta probar el dispositivo real de puerta. No hay admisión sin conexión ni reingreso.

Las reservas vencidas liberan capacidad. Un pago aprobado tarde, un evento cancelado o cupo no disponible pasan a **revisión**, sin emitir entradas ni sobrevendérselas a otro comprador. En la administración aparecen referencia Wompi, importe y entrega; el organizador debe conciliar y devolver el dinero desde Wompi. No existe devolución automática ni liquidación automática a organizadores externos. Un estado canónico VOIDED anula los QR. La consulta manual autenticada de estado permite recuperar notificaciones demoradas a partir del ID de transacción; no equivale a conciliación masiva automática.

## Configuración pendiente del propietario

- Wompi: llave pública, privada, secreto de integridad y de eventos de Sandbox. Configurarlos en `.env` privado, nunca en el chat ni en Git. Los cuatro deben pertenecer al mismo ambiente.
- La URL de webhook debe ser alcanzable por Wompi y HTTPS. `localhost` no recibe webhooks desde Internet: las pruebas locales automatizadas usan respuestas sintéticas identificadas. Para la prueba con Wompi real se necesita un endpoint de pruebas HTTPS; no se abrió un túnel ni se publicó el servidor.
- Correo: adaptador HTTP opcional de Resend, clave y remitente verificado. Si se prefiere el proveedor de correo ya contratado, adaptar este transporte antes de activarlo. No se creó ninguna cuenta externa ni se contrató un servicio.
- Con dominio HTTPS y correo configurado se habilitan verificación de correo y recuperación de contraseña con enlace de 15 minutos, un solo uso y revocación de sesiones al restablecer.
- Sandbox solo permite eventos marcados DEMO; producción rechaza DEMO. No poner claves Sandbox en un evento comercial para simular ventas reales.
- Hora, tipos/precios/cupos y condiciones de compra/cancelación. Identidad del responsable, canal de soporte, política de privacidad y términos deben confirmarse antes de abrir ventas. No se inventaron documentos legales ni se dio por aceptada una política comercial.
- Dominios, HTTPS, respaldo externo, alertas y prueba de restauración para la operación pública. La app Android/iPhone tiene código y bundles locales en `apps/mobile`; su distribución en tiendas y validación física siguen pendientes.

## Comandos

```sh
npm ci
npm run check
npm run build
node --env-file=.env --experimental-sqlite src/server.mjs
```

No usar la base de datos de producción para ensayar. Respaldar antes de actualizar y aplicar las nuevas migraciones mediante el arranque habitual; nunca modificar una migración aplicada ni ejecutar reset sobre el piloto. Mantener una sola instancia con su archivo SQLite.

`GET /api/health` informa si pagos/correo están configurados, sin revelar secretos. "configured" no prueba conexión al proveedor ni entrega real. La cola de correo se intenta cada minuto; usa idempotencia y detiene reintentos ambiguos tras 23 horas para revisión humana. `mail_outbox.state='attention'` exige intervención; la aceptación del proveedor no acredita entrega en la bandeja del destinatario. Los respaldos incluyen tablas de pagos/correos/tokens y deben tratarse como privados.

## Prueba de salida pendiente

Ejecutar con credenciales Sandbox reales: pago aprobado, rechazado, pendiente, vencimiento, retorno, webhook repetido, caída/reinicio, correo y escaneo en el dispositivo de puerta. Después realizar la prueba de producción bajo control del propietario. Sin esas comprobaciones no se declara el servicio listo para vender.

Documentación técnica utilizada: [Wompi checkout](https://docs.wompi.co/docs/colombia/widget-checkout-web/), [eventos](https://docs.wompi.co/docs/colombia/eventos/), [consulta de transacciones](https://docs.wompi.co/docs/colombia/transacciones/), [correo Resend](https://resend.com/docs/api-reference/emails/send-email).

## Validación de esta entrega

Los checks y build de Node se ejecutan en una copia temporal con las mismas fuentes. Se probaron aislamiento de compradores y organizadores, reservas simultáneas, idempotencia, firmas falsas, ambientes, pagos tardíos/anulados, recuperación y cola de correo. La comprobación Linux usa una imagen local existente con Node 22.17.1 y sin red. La construcción del Dockerfile oficial se intentó, pero Docker Hub agotó el tiempo al descargar metadatos de `node:22.17.1-bookworm-slim`; esa imagen final no se ha podido reconstruir. No se desplegó ninguna instalación. La revisión visual utiliza datos sintéticos en una base en memoria separada; no es una venta Wompi Sandbox real.

`npm run launch:status` muestra los pendientes sin imprimir secretos. Es un diagnóstico local que devuelve código 1 mientras falte la prueba de salida; no otorga una aprobación automática para vender.

## Vista local persistente

`npm run dev` abre SharkPass en `http://localhost:3201`, solo en la interfaz local, con datos de desarrollo persistentes y separados del piloto. En macOS guarda su base en `~/Library/Application Support/SharkPass/development.sqlite`; no se guarda en Git. No usar datos reales de compradores durante la revisión. Este comando rechaza Wompi producción. Para cargar configuración privada de pruebas: `node --env-file=.env --experimental-sqlite scripts/dev.mjs`.
