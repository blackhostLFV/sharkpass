# Superadministración de SharkPass

Implementación del 6 de noviembre de 2026. Rol de plataforma separado de los miembros owner/scanner de cada organización. El registro público nunca asigna este rol, ni se promociona automáticamente al primer usuario.

## Panel

`/?view=admin` requiere una sesión y un registro vigente en platform_admins. La navegación y Mi cuenta muestran Administración solo a esa cuenta. El servidor vuelve a comprobar el permiso en cada petición.

- Métricas de usuarios, organizaciones, eventos y pedidos confirmados; importes de pedidos, no liquidaciones.
- Listados de organizadores/propietarios, eventos, usuarios, pedidos y auditoría (lectores anteriores con máximo de 200; el panel central nuevo utiliza paginación).
- Publicar, volver a borrador o cancelar eventos con contraseña actual y motivo de 12–500 caracteres. Se mantienen fecha futura y tipos obligatorios, imposibilidad de ocultar eventos con entradas emitidas y cancelación definitiva. Cancelar invalida entradas; no ejecuta reembolsos.
- Cerrar sesiones de otra cuenta con contraseña y motivo. No cambia su contraseña ni sus pedidos.
- Auditoría de asignaciones, retiradas, cambios de estado y cierres de sesiones. No contiene contraseñas, tokens ni QR.

El rol global no convierte al administrador en miembro de todas las organizaciones ni da acceso a descargar entradas ajenas. No hay ruta HTTP para promover cuentas, modificar pagos o recuperar contraseñas en claro.

## Asignación inicial privada

1. El propietario registra su cuenta en `https://sharkpass.co/?view=account&auth=register`, con su propia contraseña.
2. Operaciones verifica el UUID de ESA cuenta ya creada. Si no dispone de consola ni sesión del propietario, puede configurar temporalmente SHARKPASS_ADMIN_LOOKUP_USERNAME: informa en el log privado estructurado solo el UUID encontrado o null, sin asignar permisos ni crear cuentas. Retirar esa variable después de consultar. No configurar asignación futura por nombre de usuario.
3. En el alojamiento privado, añadir SHARKPASS_INITIAL_ADMIN_USER_ID con ese UUID, conservando todas las variables existentes. Nunca introducir esta variable en código público ni ofrecerla en formularios.
4. Reiniciar la aplicación. La activación se consume atómicamente una sola vez en platform_admin_setup, crea la membresía y registra private-startup en auditoría. Las sesiones anteriores de esa cuenta se cierran; el propietario inicia sesión de nuevo.
5. Retirar la variable de activación tras verificar. Aunque permanezca por error, reiniciar no vuelve a otorgar un permiso retirado.

Sin un UUID confirmado no se activa a nadie. No se usa la cuenta sintética de QA para administrar producción.

## Operaciones posteriores

En una consola privada del servidor, con DATABASE_PATH explícito:

```
node --experimental-sqlite scripts/platform-admin.mjs grant usuario operador "Motivo documentado de la asignación"
node --experimental-sqlite scripts/platform-admin.mjs revoke usuario operador "Motivo documentado de la retirada"
```

La cuenta debe existir. Las acciones son auditadas y cierran sus sesiones. La retirada del último administrador se rechaza. Los comandos no crean contraseñas ni son accesibles desde el navegador.

## Datos y validación

Nueva migración 202611060001_platform_admin.sql; las cuatro anteriores se conservan intactas. La entrada de Hostinger hace una copia VACUUM INTO antes de aplicar esta migración a una base existente, verifica integrity_check y foreign_key_check y detiene el arranque si falla. Esa copia local no sustituye un respaldo externo.

Check de tipos y 39 pruebas aprobados en copia limpia con el lockfile del proyecto. Build/export móvil/web aprobado, sin cambiar el código nativo. QA visual del panel con cuentas y evento sintéticos solo en localhost13204, separados de producción. Desplegado en Hostinger. Se verificó la respuesta 401 para visitantes, 403 para una cuenta de QA sin privilegios y la conservación de esa cuenta tras migrar. La cuenta del propietario ya fue identificada en producción mediante consulta privada y activada por su UUID existente. La activación confirmó changed=true y active=true, cerró sus sesiones anteriores y consumió el alta inicial. Se retiraron las variables temporales de consulta y activación. Falta que el propietario vuelva a iniciar sesión para comprobar su vista. Doble factor queda pendiente de una entrega posterior; los cambios sensibles actuales requieren reautenticación con contraseña.

QA independiente: sin defectos bloqueantes en rutas, permisos y activación inicial. Se igualó el respaldo al fallback data/sharkpass.sqlite cuando falta DATABASE_PATH. Los recursos JS/CSS de esta entrega incluyen versión para evitar reutilizar archivos antiguos en navegadores abiertos.

Despliegue final verificado: build 01a1b179-18cd-731f-84a0-8e267096f0b8 completado, health HTTP 200. Wompi y correo continúan sin configurar; esta entrega no habilita ventas.

Actualización del 6/11: 41 pruebas aprobadas (incluyen consulta privada sin concesión de permisos ni creación de cuentas), build/export y contenedor aprobados. Publicación 01a1b190-0b4e-70ea-9515-ddd18ee27f95. Verificación posterior: visitante 401, cuenta sintética no administradora 403 y platformAdmin=false. El usuario real y su UUID no se guardan en el repositorio.


## Panel central del 7 de noviembre

La versión actual incorpora nueve secciones, métricas comerciales/DEMO separadas y búsqueda paginada. Ver [operación y alta adicional privada](administrador-central-2026-11-07.md). Los estados históricos de correo y Wompi anteriores no representan la configuración actual.
