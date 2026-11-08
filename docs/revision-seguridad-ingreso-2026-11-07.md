# Controles y pendientes de operación

Administración general: /?view=admin . Existe un rol global separado de propietario/operador; el registro no lo concede. El panel incluye métricas, listados y auditoría; las moderaciones requieren contraseña actual y motivo. La cuenta adicional solicitada para administración requiere registro, verificación de correo y alta privada del rol; crear el buzón no crea la cuenta ni concede el rol.

Organizador: /?view=organizer . Sus eventos, cupos, ventas, pagos y operadores están separados de otras organizaciones. Ingreso: /ingreso/ . El operador solo puede validar eventos de su organización; no recibe acceso a ventas ni descarga de entradas ajenas.

Controles comprobados por pruebas: tokens de QR únicos en base, transición de estado dentro de BEGIN IMMEDIATE, rechazo de un QR repetido y dos solicitudes simultáneas, validez y evento correctos, idempotencia de pedido/pago, reservas en disponibilidad, verificación de firma y datos canónicos de Wompi, cancelación que anula tickets, permisos en cada ruta y auditoría administrativa. La red perdida no produce una aprobación en la PWA. Copiar una imagen de QR no crea un segundo derecho de ingreso: el primer uso válido consume la misma entrada.

Límites pendientes antes de venta comercial: aprobación central obligatoria de cada evento (hoy el propietario puede publicar sus propios eventos), ensayo físico con tablets/lectores y segunda puerta, prueba completa de los estados de pago en Sandbox, carga con concurrencia prevista, copia externa/restauración y contingencia de red acordada. La app usa una instancia con SQLite; no ejecutar réplicas con bases independientes. No hay segundo factor ni validación offline. Las pruebas automatizadas no certifican ausencia de incidentes ni sustituyen una auditoría externa.

No se modifican estas políticas de publicación o privilegios como efecto de instalar la PWA. Se conserva Wompi en pruebas y el evento comercial en borrador.
