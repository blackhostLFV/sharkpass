# Publicación de vista previa — 6 noviembre 2026

SharkPass está publicado en https://sharkpass.co y www redirige al dominio principal. Alojamiento: Business existente, pedido201204854; sitio independiente slategrey-elk-810355.hostingersite.com, cuenta u436707861. No se contrató otro plan ni se reemplazó un sitio anterior. Localia y Shark Caribe no se modificaron.

Se resolvió la propiedad entre cuentas con hosting_domains_verify-ownership y un TXT añadido sin sobrescribir registros. Hostinger confirmó is_accessible true. Se vinculó sharkpass.co como alias del nuevo sitio; Hostinger actualizó la configuración DNS/CDN y emitió HTTPS. La cuenta propietaria del dominio se mantiene.

PUBLIC_URL=https://sharkpass.co. DATABASE_PATH apunta a /home/u436707861/.local/share/sharkpass-preview/sharkpass.sqlite, fuera de public_html y de hbuilds. Los nombres y rutas no contienen secretos. Pagos y correo no configurados; WOMPI_ENABLE_PRODUCTION=no. No hay evento comercial publicado ni cupos inventados.

## Validación

- Copia limpia de fuentes y lockfile en /tmp/sharkpass-release-20261106, npm ci: dependencia local restaurada sin cambiar versiones del proyecto.
- npm run check completo: tipos móviles y31/31 pruebas aprobadas. Incluye redirección www y rechazo de origen no confiable. Log /tmp/sharkpass-final-check.log.
- npm run build: exportaciones Android/iOS/web completas; fuentes móviles sin cambios. Log /tmp/sharkpass-clean-build.log.
- Dockerfile corrige permisos de /data para el usuario node. Imagen construida y contenedor nuevo iniciado con volumen nuevo: health correcto sin ajustar manualmente permisos.
- Entrada src/hostinger.mjs: arranca explícitamente al importarse por el gestor de procesos. La entrada src/server.mjs tenía guardia para ejecución directa; el primer despliegue construía pero no atendía peticiones. Una prueba local importando la nueva entrada y el despliegue real verifican el arranque.
- Health HTTPS y portada200; PNG oficial comparado byte a byte con original.
- Registro sintético (sin datos personales), login y sesión autorizada comprobados. Las cookies tienen HttpOnly, Secure y SameSite=Strict. Pedidos sin sesión401; .env403, fuente del servidor404, ZIP fuente404.
- El usuario sintético persistió tras restart y tras el despliegue exitoso final. Su contraseña aleatoria de ensayo solo está en /tmp/sharkpass-preview-probe.json, no en el repositorio ni el informe. No se crearon compras ni entradas.
- Build final confirmado completed: 01a1b143-6c34-701f-8272-b32cc179df61. Un intento intermedio sin archivo fuente disponible falló antes de generar logs; se volvió a subir el archivo y el despliegue final terminó correctamente.

## Pendientes antes de ventas

Wompi, correo, evento/cupos/precio final, backup externo/restauración, carga, proxy de confianza y ensayo físico de puerta siguen pendientes. El instalador remoto incluyó dependencias móviles y reportó vulnerabilidades en ese árbol; separar el paquete del servidor y evaluar auditoría antes de abrir ventas. La persistencia comprobada no sustituye un respaldo. La identidad Sora/#0033CC del manual aún no se ha aplicado completa: esta publicación conserva el diseño web actual y el logo azul nuevo.

Esta entrega es una vista previa pública y no una aprobación de venta comercial.
