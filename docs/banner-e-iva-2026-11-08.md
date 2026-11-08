# Banner oficial y desglose de precios

Se integra el archivo terminado `Banner_Web_Shark_Pass.png` aportado por el propietario (1920 × 720). Se convierte a WebP de alta calidad (139.778 bytes), sin rediseñar ni recortar el arte. La imagen completa se puede ampliar; la fecha, ubicación, precios y enlace de venta están en HTML legible también en móvil.

El propietario indicó añadir IVA del 19% a las dos localidades. General: base 50.000 COP, IVA 9.500 COP, total 59.500 COP. Preferencial: base 79.900 COP, IVA 15.181 COP, total 95.081 COP. No se agregan cargos de servicio. La tasa es una instrucción comercial del propietario, no una determinación tributaria de la plataforma.

El servidor calcula los importes; `price_cop` representa el total final por entrada. La nueva migración registra configuración por localidad y una instantánea inmutable por reserva nueva. Wompi recibe el total en centavos. El carrito, resumen de pago, selección de sillas, confirmación y correo usan base, IVA y total; el desglose monetario permanece visible aunque se cierre la información del evento en móvil.

La actualización de precios del evento existente se realiza una sola vez mediante una tarea privada de despliegue auditada, sin rutas públicas. Rechaza precios de origen inesperados, otras organizaciones y eventos DEMO. No modifica pedidos, reservas, cupos, sillas, códigos QR ni pagos existentes. Los registros anteriores sin instantánea se identifican como compras originales sin desglose de IVA registrado, sin inventar un impuesto histórico. No se reenvían correos anteriores automáticamente.

Validación: 100 pruebas, incluido el importe enviado a Wompi, conservación de reservas y compras anteriores, idempotencia, rechazo de entradas inválidas, aislamiento de la tarea y desglose en HTML/texto. `npm run check`, exportación Expo y compilación/arranque de contenedor comprobados. Revisión visual en Chrome de escritorio y anchos 390 y 320 px; sin desbordamiento horizontal del inicio. La prueba física en Safari/tablets y una compra real completa siguen pendientes.

Impeccable: se conservó la identidad existente y el arte suministrado. El detector señaló 24 patrones existentes (fuente Helvetica elegida por el usuario, navegación, avisos y elementos fuera del alcance); no señaló el nuevo bloque del banner ni el desglose. No se cambió la marca por esas advertencias.

Publicación comprobada en sharkpass.co: precios finales 59.500 y 95.081 COP, 100 sillas visibles, 30 bloqueadas, 20 Preferencial y 50 General disponibles al momento de la revisión. Salud del servidor: pagos prod y correo configurado. Se revisó el carrito público en móvil sin preparar pagos ni crear compras y se retiró la selección de prueba.
