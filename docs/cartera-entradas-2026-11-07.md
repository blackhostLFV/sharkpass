# Cartera de entradas y continuidad visual

El propietario solicitó mejorar Mis entradas y la confirmación, y después indicó expresamente conservar el ticket original con forma de tiburón. `src/ticket.mjs` se conserva byte por byte respecto al artefacto publicado anterior; se comprobó su hash. SVG descargado y PNG compartido conservan ese arte. No se han modificado tokens, validez ni reglas de ingreso.

Mis entradas agrupa compras con fecha, lugar, localidad y estado; acceso directo a sus boletas. Los intentos no confirmados quedan en Pagos por revisar, sin presentarse como entradas emitidas. La consulta de pedidos continúa filtrada por propietario y añade únicamente lugar y localidad.

Al abrir una compra: resumen compacto con cantidad/importe, cuadrícula 3/2/1 columnas, numeración y estado, Mostrar QR como acción principal y Guardar o compartir plegado. Correo, referencia y copia adicional quedan después de las boletas en Correo y comprobante. Un error al consultar el correo no impide mostrar las entradas.

Visor modal nativo: QR de una persona, evento/fecha/lugar/localidad, anterior/siguiente con límites, cierre con Escape y foco devuelto al activador. Entradas usadas/anuladas no cargan QR en el visor. No se añade Apple Wallet ni se presenta compartir un archivo como transferencia de propiedad. Cambios visuales con blanco/azul, tipografía regular, bordes discretos y sin sombras, coherentes con checkout y cuenta.

Referencias: https://baymard.com/research-articles/order-confirmation-page y https://developer.apple.com/wallet/get-started/ para claridad de confirmación e información prioritaria del pase; no se reutiliza marca ni código de terceros.

Validación: 72 pruebas (incluyen privacidad de compradores, usado/anulado sin QR en arte, texto escapado, contenido largo dentro del ticket y medianoche en America/Bogota), tipos, exportaciones iOS/Android/web y contenedor. QA visual local con seis boletas sintéticas: lista, compra, visor 1 a 6, límites, Escape/foco, opciones plegadas y descarga PNG individual correcta. Móvil 320/390 px sin desbordamiento; QR ampliado de 300 px a 390. El PNG de prueba se descargó en la carpeta de Descargas con datos sintéticos. Se revisaron los estilos de impresión para conservar el arte dentro de su nuevo botón contenedor; la impresión física/PDF mediante el diálogo del sistema queda pendiente de ensayo específico. SMTP y Wompi no se modifican ni se reenviaron correos durante esta revisión.

Se revisó también la continuidad desde catálogo/ficha hacia el carrito con la cuenta sintética. El navegador de QA se bloqueó en la transición final al carrito; no se declaró ese tramo de esta revisión como completado. El flujo de emisión se conserva y sus pruebas automatizadas pasaron.

Publicación `01a1b7ea-7dff-71d0-8a4a-1af073b00609` completada; health correcto. Se corrigió una transcripción de la referencia al abrirla desde el listado propio; se comprobó la compra de seis entradas, la galería con el arte original y el visor en la sesión real, sin ampliar permisos.
