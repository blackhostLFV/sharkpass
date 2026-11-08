# Notificaciones con un buzón existente de Hostinger

El transporte SMTP está preparado para verificación de correo, recuperación de contraseña y comprobantes de compras confirmadas. No se declara envío real hasta verificarlo desde el servidor publicado. El proveedor anterior Resend sigue disponible; seleccionarlo explícitamente con MAIL_PROVIDER=resend.

## hPanel del alojamiento de la aplicación

En la aplicación Node.js `slategrey-elk-810355.hostingersite.com`, configurar las variables privadas sin borrar las de pagos, base de datos ni otras existentes:

- MAIL_PROVIDER: smtp
- SMTP_HOST: el servidor saliente mostrado en Correos → Administrar → Conectar aplicaciones y dispositivos (Hostinger Email: smtp.hostinger.com).
- SMTP_PORT: 465 (TLS desde el inicio); alternativa 587 exige STARTTLS.
- SMTP_USER: dirección completa del buzón existente.
- SMTP_PASSWORD: contraseña del buzón, introducida únicamente en el panel privado.
- MAIL_FROM: SharkPass <dirección del mismo buzón>
- PUBLIC_URL: https://sharkpass.co

No usar credenciales de acceso a hPanel como contraseña SMTP. No colocar estas variables en el cliente, un archivo público, Git ni el chat. Desplegar la nueva versión del servidor y reiniciar después de configurar. No basta con configurar variables sobre la versión antigua, que solo soporta Resend.

El buzón puede pertenecer a un dominio diferente del dominio web, y estar en otra cuenta. No es necesario mover ninguno. Revisar SPF, DKIM y DMARC del dominio del remitente en su DNS activo con los valores de su servicio de correo; no sobrescribir los registros web ni crear varios registros SPF. Si el servicio del buzón es Titan u otro, usar sus datos salientes en lugar de asumir smtp.hostinger.com.

## Comprobación de activación

`/api/health` indica si hay configuración completa; no demuestra autenticación ni entrega. El propietario debe solicitar una verificación de cuenta o recuperación de su propia cuenta, confirmar que llega el mensaje y comprobar el enlace. Después realizar una compra Sandbox y comprobar el mensaje [PRUEBA], el acceso con sesión propia y el rechazo desde otra cuenta. Comprobar SPF/DKIM/DMARC en las cabeceras del mensaje recibido. No enviar a compradores reales durante el ensayo.

El transporte valida certificados y exige TLS, tiene tiempos de espera y no registra credenciales. Solo marca comprobantes enviados cuando el servidor SMTP acepta al destinatario; esto no garantiza llegada a bandeja de entrada. Los fallos temporales explícitos se reintentan desde la cola persistente. Rechazos permanentes y resultados inciertos (por ejemplo, desconexión después de DATA o reinicio con un envío en curso) quedan en `attention` para revisión operativa. SMTP no ofrece la idempotencia de Resend y un Message-ID estable no garantiza deduplicación. No reenviar automáticamente estados inciertos: comprobar primero la entrega con el proveedor.

Documentación consultada el 7/11/2026:
- https://www.hostinger.com/support/1575756-how-to-get-email-account-configuration-details-for-hostinger-email/
- https://nodemailer.com/smtp

Validación local y publicación se registran por separado: no se han configurado credenciales ni probado entregas reales como parte de la preparación.

## Validación de la implementación — 7/11/2026

`npm run check`: 60 pruebas aprobadas, incluidas cinco de configuración SMTP, TLS obligatorio, mensajes de cuenta, aceptación/rechazo de destinatario, reintentos y resultados inciertos; tipos móviles aprobados. `npm run build`: exportación Android/iOS/web aprobada. Por bloqueos de lectura de node_modules en la carpeta Documents, se ejecutaron en /tmp/sharkpass-release-20261106 con las fuentes de servidor/pruebas actuales y manifiestos coincidentes. Las pruebas SMTP usan un transporte inyectado, sin credenciales ni destinatarios reales. Publicación y entrega real pendientes.

Contenedor Docker construido con instalación limpia de dependencias de servidor (npm ci, cero vulnerabilidades reportadas); arranque y /api/health comprobados: status=ok, email=not_configured sin credenciales. Contenedor de prueba detenido.

## Publicación — 7/11/2026

Build 01a1b673-26cc-70d4-9460-109e64a29192 completado en Hostinger, entry src/hostinger.mjs. Archivo de servidor sin secretos, base, node_modules ni bundles móviles. /api/health público: status=ok, payments=test, email=not_configured. No se reemplazaron variables privadas existentes. Falta que el propietario configure las variables SMTP en hPanel y comprobar recepción real; no se envió correo de prueba.

## Activación en hPanel y prueba — 7/11/2026

Variables SMTP guardadas desde hPanel conservando las existentes; contraseña aportada por el propietario, sin revelar ni copiar su valor. hPanel generó un despliegue con src/server.mjs como arranque y la web devolvió 503. Se restauró mediante archivo limpio y src/hostinger.mjs: build 01a1b6a9-ce75-70a0-98e3-887d3ae285b7 completado; health status=ok, payments=test, email=configured. Mantener src/hostinger.mjs al redistribuir desde hPanel.

Se creó una cuenta sintética DEMO sin privilegios para una única verificación SMTP hacia el destinatario autorizado por el propietario. El envío respondió 503 con error general de verificación; sesión de prueba revocada. No se verificó recepción ni autenticación SMTP y no se afirma entrega. La cuenta sintética permanece sin correo verificado. El error actual no permite distinguir autenticación, conectividad o rechazo del proveedor. Pendiente diagnóstico del transporte y comprobación del buzón con el propietario.

## Buzón propio y respuestas — 7/11/2026

El propietario creó notificaciones@sharkpass.co. Se creó soporte@sharkpass.co como alias del mismo buzón (no es una bandeja ni contraseña separada). MAIL_REPLY_TO permite enviar las respuestas a ese alias en mensajes de cuenta y comprobantes. SMTP_USER y MAIL_FROM están preparados en hPanel para el nuevo buzón; falta la contraseña nueva aportada por el propietario y aplicar los cambios.

Se añade main=src/hostinger.mjs y se alinea npm start con esa entrada para evitar que la detección del proveedor elija src/server.mjs al guardar variables. Los errores SMTP registran exclusivamente código acotado y código de respuesta numérico; nunca direcciones, respuesta del proveedor ni credenciales.

Validación local: npm run check aprobado con 61 pruebas y tipos; npm run build/export Android, iOS y web aprobado. Pendiente prueba externa de verificación, recuperación y comprobante tras activar el nuevo buzón.

Build 01a1b703-c3d5-70f9-bd41-b4057c5d70b9 completado con soporte Reply-To y diagnóstico SMTP acotado. Contenedor construido y arranque src/hostinger.mjs comprobado con health ok; detenido tras la prueba. Web pública status=ok, payments=test. El estado email=configured todavía corresponde a las variables anteriores: nuevo remitente pendiente de contraseña privada y aplicación en hPanel.

## Activación verificada — 7/11/2026, 12:25 America/Bogota

El propietario actualizó SMTP_PASSWORD en privado. Aplicadas las variables del buzón propio y MAIL_REPLY_TO hacia el alias de soporte. Se corrigió el archivo de entrada en la pantalla persistente Ajustes y reimplementación de hPanel: src/hostinger.mjs. Build 01a1b70a-31d0-7395-8388-4506f25e28aa completado. El cambio previo de package main/npm start por sí solo no evita que hPanel conserve un entry_file antiguo.

Health público status=ok, payments=test, email=configured. Una verificación solicitada desde cuenta sintética DEMO respondió 200 y su sesión se revocó. Recepción confirmada por Gmail en INBOX; Authentication-Results: spf=pass, dkim=pass, dmarc=pass. Remitente del buzón propio y Reply-To de soporte comprobados. No se registran destinatarios personales, credenciales ni enlaces de verificación en este informe.

Se volvió a guardar SPF en la cuenta del dominio con TTL 300, conservando su contenido y los demás registros. La consulta DNS local todavía mostraba una respuesta antigua mientras Gmail ya confirmaba SPF aprobado en la entrega real; no duplicar SPF ni borrar otros registros por una respuesta cacheada.

Los mensajes de recuperación y los comprobantes de compras confirmadas comparten el transporte SMTP probado, con cobertura automatizada (61 pruebas aprobadas). No se ejecutó una compra completa contra Wompi Sandbox como parte de esta activación ni se declara comprobante comercial enviado. Los cobros reales siguen deshabilitados.

## Plantillas visuales — 7/11/2026

Las tres notificaciones existentes usan el mismo sistema visual: logo oficial, fondo claro, cabecera azul oscuro, CTA azul, resumen del pedido y ayuda. Verificación y recuperación destacan caducidad de 15 minutos, un solo uso y enlace personal; comprobantes muestran evento, lugar, cantidad y total solo cuando esos datos existen. Enlaces de acceso QR no se incluyen en el correo: el comprador accede con sesión a sus entradas. Sandbox mantiene aviso explícito sin cobro real ni validez comercial.

HTML con tablas de presentación e inline CSS para compatibilidad, logo remoto con alt y dimensiones, preheader oculto, enlace alternativo y versión text/plain. Sin dependencias, fuentes remotas, imágenes de seguimiento ni cambios de permisos/pagos. Datos y URLs personalizados se escapan; las rutas de verificación, recuperación y pedido se conservan. No se añadieron avisos de cancelación ni recordatorios sin un evento de negocio que los dispare.

Validación: 63 pruebas aprobadas y tipos móviles; export Android/iOS/web aprobada; imagen Docker construida y arranque comprobado. Revisión visual en navegador: comprobante en escritorio y las tres plantillas a 360 px, scrollWidth=360; no sustituye pruebas en todas las versiones de Outlook, Gmail y Apple Mail. La vista previa utiliza datos DEMO y enlaces no funcionales.

Publicación del diseño: build 01a1b713-f0a8-7326-9cb8-57858db1908c completado con src/hostinger.mjs. Health público status=ok, payments=test, email=configured. Plantillas integradas en los tres disparadores existentes. No se modificaron credenciales ni variables privadas durante esta publicación.

## Rediseño minimalista solicitado — 7/11/2026

El propietario eligió fondo blanco con detalles azules. Se reemplaza la cabecera oscura por tipografía editorial sobre blanco, logo oficial más pequeño fuera de la tarjeta, etiqueta azul tenue, botón azul, separador de ticket y ayuda compacta. La composición, textos y enlaces alternativos se simplifican en las tres plantillas; no se modifican rutas, tokens, tiempos de expiración, envío ni permisos.

Revisión de los tres diseños a 320 px: contenido de 320 px, sin desbordamiento. Se acorta el CTA de recuperación a Restablecer contraseña para evitar una tercera línea en pantallas pequeñas. Vista de escritorio del comprobante guardada con datos DEMO. Plantillas en HTML de tablas y estilos inline; prueba de cliente real Outlook/Apple Mail no realizada.

Rediseño minimalista publicado: build 01a1b729-7719-7396-b749-29e564b0a1a8 completado. 63 pruebas, build/export y contenedor aprobados; health público status=ok, payments=test, email=configured. Sin cambios de credenciales ni permisos.
