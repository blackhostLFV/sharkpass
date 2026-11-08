# Compra web MVP · 7 de noviembre de 2026

Alcance confirmado: un evento y una localidad por pedido, de 1 a 6 entradas. No se mezclan localidades ni eventos en un pago.

## Historias y aceptación

- Como comprador, elijo localidad y cantidad en la ficha y las añado al carrito. Veo agotados y disponibilidad del servidor.
- Como comprador, reviso evento, fecha, lugar, localidad, cantidad y total; puedo cambiar localidad, aumentar/reducir o quitar la selección.
- Como comprador sin sesión, inicio sesión o me registro sin perder la selección. Recargar conserva el carrito. El almacenamiento local solo contiene identificadores, cantidad y clave de idempotencia, nunca precios, contacto ni QR.
- Como comprador autenticado, reviso nombre, teléfono y correo de la compra pagada. Nombre/teléfono actualizan mi perfil. La entrega se consulta en Mis entradas; no se promete correo automático sin proveedor configurado.
- Como comprador, preparo el pago con precio validado en el servidor. Solo entonces se reserva cupo durante 15 minutos. El contador usa hora del servidor y conserva el vencimiento al recargar.
- Como comprador, continúo al checkout alojado de Wompi. SharkPass no solicita ni guarda datos de tarjeta. El retorno por sí solo no emite entradas: se consulta el servidor.
- Como comprador, retomo mi reserva sin crear otra. Editar libera la reserva previa; antes de cancelar/reintentar se comprueba su estado. Confirmado/revisión bloquean el reemplazo accidental.
- Como comprador, tras confirmar recibo un QR individual por entrada y acceso a descarga e impresión. Las gratuitas se confirman sin pasar por Wompi.

## Validación

Pruebas automáticas: carrito persistente/saneado, límites de cantidad, cálculo de vencimiento, precio reservado aunque cambie la tarifa, recuperación idempotente sin crear otro cupo, GET de recuperación propio 200/anónimo 401/otra cuenta 404. Se conserva la suite de permisos, sobreventa, firmas Wompi, emisión y escaneo único.

Prueba manual en contenedor con datos sintéticos: dos entradas → carrito → recarga en login → datos conservando cantidad → reserva pagada → recarga sin reiniciar contador → liberación → edición y eliminación. Compra gratuita de dos entradas → dos QR → carrito vacío. Ancho móvil 390 px sin desbordamiento horizontal.

`npm run check`, `npm run build` (export Android/iOS/web) y construcción/arranque del contenedor se ejecutan sobre la copia limpia de validación con el mismo lockfile; las dependencias del directorio original tienen problemas de acceso en esta máquina.

## Límites de lanzamiento

Wompi continúa en Sandbox. Esta entrega no demuestra un cobro externo aprobado; la suite usa un proveedor simulado. Falta ejecutar el recorrido completo con una tarjeta de prueba en Wompi y observar webhook/confirmación/QR en la instalación publicada.

Si Wompi no ha enviado webhook y no existe identificador de transacción guardado o recibido en el retorno, no puede consultarse ese pago por identificador; no se debe presentar un reintento como garantía contra un segundo cobro. El comprador ve la advertencia de comprobar si ya pagó; una aprobación tardía queda en revisión sin sobreventa.

Shark Caribe conserva su borrador mientras se confirman cupos, precios y políticas. Sin servicio de correo configurado no hay entrega automática por correo ni recuperación de cuenta por email. No se activaron ventas reales, no se cambiaron credenciales ni se modificó Localia.

## Publicación verificada

Publicado en https://sharkpass.co, build `01a1b60f-f6da-7257-b8f0-09d21d880c7e`. Los tres assets de compra coinciden byte a byte con los validados; salud HTTP 200 y Wompi configurado en test. Ficha DEMO pública 200, recuperación sin sesión 401, evento real en borrador 404 y archivo privado de preparación 404. Revisión visual del carrito y login en la instalación publicada. Evidencia: `evidencia-local/2026/11/07/sharkpass-carrito-publicado.png`.
