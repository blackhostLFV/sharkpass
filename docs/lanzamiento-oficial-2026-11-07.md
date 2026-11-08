# Apertura oficial Shark Caribe

Condiciones confirmadas por el propietario el 7 de noviembre de 2026.

- Evento existente, sin sustituir organizador ni cuentas: Pitch Competition by Shark Caribe, 25 de noviembre de 2026, 16:00–21:30 America/Bogota. Hotel Dann Carlton, Salón Los Laureles, piso 12. El arte oficial suministrado prevalece frente al horario anterior del sitio del organizador.
- 100 sillas numeradas: A–E Preferencial (COP 79.900), F–J General (COP 50.000). Todos los cargos incluidos; únicamente ingreso.
- A1–C10: 30 ocupadas mediante bloqueo administrativo, sin simular ventas, ingresos, pagos ni QR. Disponibles iniciales: 20 Preferencial + 50 General.
- 50 cortesías internas en área aparte, sin puestos en el mapa ni compra pública gratuita.
- Registro nominal por asistente, silla garantizada, documento al ingreso, sin alimentos/bebidas ni menores de 8 años. No se almacena número de documento.
- Las claves y contraseña SMTP permanecen en variables privadas de hPanel. Cuatro credenciales Wompi y dos selectores: ambiente prod y habilitación yes.

## Cambios

Migraciones nuevas 003–005: sillas, asignaciones transaccionales, registro nominal, términos versionados y bloqueos. El servidor rechaza sillas ajenas, duplicadas, ocupadas o asignadas a otra reserva. Una aprobación tardía sin silla vigente pasa a revisión; no emite un QR duplicado. Se conserva el ticket con forma de tiburón.

Preparación y publicación limitadas a este evento mediante tareas privadas de un solo uso, no mediante una ruta HTTP. La publicación exige producción, correo e inventario esperado. El administrador puede revisar el borrador con vista previa protegida. Catálogo público sin eventos DEMO en producción.

El sitio permite indexación solo en páginas públicas de producción; cuentas, pedidos y vínculos con parámetros conservan noindex. Sitemap y datos estructurados del evento excluyen cortesías y datos de asistentes.

## Validación

- npm run check: 94 pruebas aprobadas, incluyendo concurrencia HTTP, idempotencia, aislamiento de permisos, escaneo único, reservas, aprobación tardía, cortesías ocultas, bloqueo de 30 sillas, registro nominal y migración de compras existentes con respaldo verificado.
- npm run build: exportación Android, iOS y web aprobada.
- Contenedor de servidor: construcción y arranque con src/hostinger.mjs aprobados; health correcto con servicios desactivados en el contenedor aislado.
- Navegación local: selección de silla, carrito, registro por asistente, términos, pago simulado exclusivamente local y QR con silla. Mapa comprobado en 390 y 320 px, sin desbordamiento global y con 30 sillas deshabilitadas.

## Pendiente operativo

La configuración de producción no equivale a una compra real aprobada. Falta una compra real realizada por el propietario para comprobar el webhook de producción, correo y QR de extremo a extremo. También faltan la lectura en tablets reales, restauración desde un respaldo externo y prueba de carga con concurrencia de campo. El escáner PWA requiere conexión: no garantiza exclusión de duplicados entre dispositivos desconectados.

## Presentación pública

Banner conceptual panorámico y tarjeta de tiburón separada del afiche oficial. Imágenes optimizadas, información de precios en HTML, revisión en escritorio y móvil sin desbordamiento global. El repositorio público incluye una guía para evaluación y los límites del alcance offline.

## Ajustes de disponibilidad y navegación

A petición del propietario, las sillas asignadas muestran una banda visual «Vendida» y mantienen el número legible encima. Las reservas temporales indican «Reservada». La etiqueta visual no crea pagos, ingresos ni tickets; el bloqueo del servidor permanece vigente. Se conserva un único acceso «Ingresar» junto al buscador. El footer agrupa sus enlaces en la franja inferior, con disposición adaptable. Revisión local de estados ocupados, vendidos y reservados con datos DEMO, separación geométrica entre número y banda en 390 px y ausencia de desbordamiento global.

Actualización del 8 de noviembre: el propietario indicó añadir IVA del 19% a las bases indicadas arriba. Véase [banner y desglose actualizado](banner-e-iva-2026-11-08.md). Los importes anteriores de este informe son el estado previo a esa instrucción.
