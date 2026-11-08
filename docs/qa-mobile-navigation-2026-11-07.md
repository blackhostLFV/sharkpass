# Navegación y fechas móviles · 7 de noviembre de 2026

La captura del usuario mostró un defecto que no detecta comprobar solo el ancho total de página: la fecha cabía en la página, pero su columna se comprimía y cortaba el mes. Se retiró esa columna. Las próximas tarjetas muestran fecha completa en el contenido, miniatura separada y botón en su propia fila. Las fechas usan el formateador existente en America/Bogota.

La cabecera móvil tiene logo, menú y carrito accesibles durante el desplazamiento. El menú es un desplegable no modal con aria-expanded/aria-controls, navegación completa y permisos conservados. Cierra al elegir destino, pulsar fuera, abrir carrito, usar Escape o cambiar al escritorio. Escape devuelve foco al botón; Tab permite entrar en los destinos. No se dibujaron barras de estado del teléfono.

## Validación ejecutada

- Anchos 320/390/430 px: fecha completa visible, sin exceso de scrollWidth en cada fecha y sin desbordamiento horizontal de la página. En 320 px la fecha ocupa dos líneas; en 390/430 una. Ver mediciones en `docs/qa/mobile-layout-2026-11-07.json`.
- Controles medidos: menú 44 px de alto, carrito 45 px y Ver evento 44 px. Las filas del menú definen 48 px mínimos.
- Navegación real a Mis entradas cierra el menú; Tab desde el disparador entra a Explorar eventos; Escape cierra y restaura foco; clic fuera cierra.
- Al pasar a 1024 px el menú móvil se oculta, la navegación de escritorio permanece visible y no hay desbordamiento.
- Pruebas del controlador cubren estado inicial, apertura, Escape, foco, destinos, elementos deshabilitados, clic fuera, carrito y cambio de ancho.
- `npm run check`, `npm run build` (export Android/iOS/web) y construcción/arranque del artefacto Docker antes de publicar. No se cambiaron dependencias, credenciales, datos del evento ni configuración de pagos.

Esta revisión corresponde a la web adaptable. No sustituye una prueba en Safari de un iPhone físico ni una prueba nativa; esos dispositivos no se utilizaron en esta entrega. Correo y Wompi mantienen su estado previo.

## Publicación verificada

Build `01a1b63f-f3a6-700e-ad05-72acfb2acdc9` completado. HTML, app, estilos y módulo de navegación coinciden con los archivos validados. 55 pruebas aprobadas, exportación y contenedor comprobados. En la web publicada se verificó menú anónimo con Explorar eventos, Para organizadores, Mis entradas, Favoritos, Iniciar sesión y Crear cuenta. A 390 px las dos fechas completas están visibles y contenidas en ancho y alto; no hay desbordamiento horizontal y el botón Menú permanece visible. Evidencia en `evidencia-local/2026/11/07/sharkpass-menu-movil-publicado.png` y `sharkpass-fechas-movil-publicadas.png`. El correo sigue sin configurar y Wompi sigue en test.
