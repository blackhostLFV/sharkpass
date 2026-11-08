# Ubicación y precios por localidad

Referencia aportada por el propietario: https://tuboleta.com/es/eventos/reykon-no-se-te-olvido , revisada el 7/11/2026. Se toma la separación de información del lugar, plano y comparación de localidades; no se copian sus precios, aforos, políticas, cargos ni etapas.

La ficha de SharkPass añade tabla accesible de localidad, precio por entrada COP y disponibilidad actual, con Elegir que selecciona la localidad y mueve el foco a cantidad. Agotados no se pueden elegir. Tabla dentro de un contenedor adaptable, sin desbordar la página a 320/390 px. Se conserva lugar/fecha/organizador y se aclara que el mapa DEMO no asigna puestos a las compras por localidad.

El catálogo devuelve min_price_cop y has_available_tickets basados en tipos con disponibilidad positiva. Comparte eventTypes con la ficha, sin duplicar la regla que descuenta ventas confirmadas y reservas pendientes vigentes. Las tarjetas muestran precio desde, acceso gratuito o ausencia de disponibilidad; no ofrecen el precio de una localidad agotada. El catálogo conserva el límite de 100 eventos; una consulta de tipos por evento en SQLite local, sin servicios nuevos. Precio informativo: la compra vuelve a comprobar disponibilidad.

No hay soporte nuevo de etapas de venta ni cargos de servicio. Se muestra el precio configurado actual y el desglose de la compra existente; no se presenta como implementada la silletería numerada comercial.

Validación: 71 pruebas, tipos, exportaciones iOS/Android/web, imagen Docker y health. Caso nuevo de precio inicial gratuito, agotamiento total y nueva localidad con precio disponible. UI local: tarjeta y tabla coinciden, Elegir selecciona la localidad y enfoca cantidad; móvil a 320 y 390 sin desbordamiento. Sin cambios de pagos, pedidos, permisos, secretos ni migraciones.

Publicado y comprobado: build `01a1b7df-306a-70cd-8035-def8e6bff147`. API del catálogo con precios disponibles; concierto con General 50.000 y Preferencial 80.000, selección Preferencial desde tabla actualiza radio y total y enfoca cantidad. Health correcto, pagos test y correo configurado.
