# Administrador central

Ruta: `/?view=admin`. Solo cuentas con rol de plataforma. El buzón de correo por sí solo no es una cuenta de la aplicación ni concede privilegios.

## Operación

- Resumen: ventas comerciales confirmadas separadas de importes DEMO, pedidos, entradas disponibles para ingreso, usadas/anuladas, ingresos del día de Colombia, usuarios, organizaciones y eventos publicados. Son importes de pedidos vigentes, no liquidaciones ni conciliación bancaria.
- Actividad de los últimos siete días, delimitada por medianoche de America/Bogota. Actualización manual con hora de consulta visible.
- Listados con búsqueda y paginación de 25 registros: eventos, organizadores, usuarios, pedidos, pagos, entradas/ingresos, correos de compra y auditoría. Los estados y ambientes se filtran en el servidor. No se limita el total a 200 registros.
- Las fichas de eventos muestran cupo, emisión e ingresos. La revisión de estado requiere contraseña actual y motivo. Cancelar invalida entradas y no reembolsa pagos. Los organizadores conservan su capacidad actual de publicar: no se introdujo aprobación central obligatoria.
- Usuarios muestra correo de acceso y verificación; permite cerrar sesiones ajenas con reautenticación y motivo. No cambia contraseñas ni convierte al administrador en organizador o lector de todas las organizaciones.
- Pagos y entradas son de consulta. No hay aprobación manual de cobros, reactivación de QR usado ni descarga de entradas ajenas. Correo muestra destinatario, estado e intentos; no garantiza recepción en bandeja. El listado corresponde a la cola persistente de compras, no a todos los mensajes de recuperación/verificación.

## Alta adicional privada

La cuenta debe registrarse con correo y verificarlo. La operación de alojamiento `ops/admin-grant.json` contiene un identificador UUID único, email y un motivo de 12–500 caracteres. Nunca se añade al repositorio ni a recursos públicos. `src/admin-grant-task.mjs` resuelve exclusivamente una cuenta cuyo correo de acceso coincide con el correo verificado. No crea usuarios, contraseñas, enlaces de recuperación ni verificaciones.

La tarea se reclama al arrancar y su consumo se registra persistentemente en auditoría antes de conceder permisos, evitando reactivación por volver a desplegar el mismo archivo. Se consume una vez incluso si falta la cuenta verificada. No queda esperando para conceder privilegios a futuras cuentas. Los logs informan active/awaiting_verified_account/failed sin correo, contraseña ni tokens. Una concesión nueva es auditada y revoca las sesiones existentes: es necesario volver a entrar. Las repeticiones son idempotentes. No existe ruta HTTP para este alta. La carpeta ops está ignorada por Git.

## Validación

79 pruebas aprobadas, incluyendo lectores nuevos con visitante 401, usuario sin rol 403 y administrador 200, paginación, consultas parametrizadas, filtros inválidos, exclusión de secretos y QR, separación de importes, medianoche de Bogotá y concesión privada solo después de verificar correo. También se conservan pruebas concurrentes de un solo ingreso, cupos e idempotencia de compra. Check de tipos, export móvil/web y contenedor verificados en copia limpia con el lockfile del proyecto.

QA visual con datos sintéticos en localhost: navegación, búsqueda, fichas y rechazo de contraseña incorrecta. Anchos 390 y 320 sin desbordamiento de la página; tablas con desplazamiento horizontal propio. Los datos sintéticos de QA no se publican.

Pendientes operativos: verificación y acceso del propietario de la cuenta administrativa, doble factor, respaldo externo con restauración ensayada, carga real y pruebas físicas de tablets/cámara. El panel no sustituye estas pruebas ni implica ausencia absoluta de riesgos.

## Publicación

Build `01a1b810-8a0f-71d7-b814-b570d49addfc` completado en Hostinger. Health correcto, Wompi Sandbox y SMTP conservados. Recursos nuevos públicos verificados; rutas administrativas anónimas responden 401 y el archivo operativo privado 404. La sesión existente sin rol muestra denegación sin consultar registros. El alta privada devolvió awaiting_verified_account: aún falta registrar/verificar la cuenta indicada por el propietario; no se concedieron privilegios. Una nueva tarea explícita es necesaria después de completar esa verificación.

## Activación posterior de la cuenta solicitada

La cuenta administrativa indicada por el propietario se registró y verificó. Build 01a1b84b-184d-71b7-9ab5-8a4812fdfce7 completado; la operación privada confirmó status=active, changed=true. Las sesiones previas se revocaron y la asignación quedó auditada. El propietario debe iniciar sesión de nuevo. No se crearon ni cambiaron contraseñas.

El diagnóstico privado ahora distingue cuenta inexistente, correo no verificado y asociación distinta, sin imprimir correo ni identificadores personales. Se comprobaron nuevamente 79 pruebas, check/build y el contenedor gestionado. La operación anterior que informó pendiente permanece consumida; no concederá permisos en el futuro.
