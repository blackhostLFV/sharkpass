# Registro visible desde el ingreso

La opción de registro estaba después de los accesos sociales, con margin-top automático dentro de un contenedor de altura mínima de pantalla. En algunas pantallas quedaba fuera del área visible.

Se movió el acceso «¿Aún no tienes cuenta? Crear cuenta» inmediatamente antes del formulario de ingreso, se eliminó el espacio automático de esa fila y se mantuvo la vuelta a iniciar sesión desde registro y recuperación. No cambian endpoints, permisos, envío de verificación ni contraseñas.

Validación: navegación real ingreso → registro → ingreso en navegador, enlace visible a 390 y 320 px sin desbordamiento horizontal. 79 pruebas, npm run check, npm run build y contenedor con entrada gestionada aprobados. El archivo de despliegue solo cambia app.js, app-shell.css e index.html respecto de la publicación anterior; no incluye operaciones de asignación de roles.

Publicado y comprobado en sharkpass.co: build 01a1b845-d84a-7300-a457-312ac8f3d6f8. El enlace abre el formulario real de registro. Health mantiene Wompi test y correo configurado.
