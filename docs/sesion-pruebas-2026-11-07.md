# Sesión de pruebas SharkPass · 7 de noviembre de 2026

Entorno público https://sharkpass.co, Wompi Sandbox, eventos ficticios identificados. No usar tarjetas reales ni datos de asistentes. El ensayo de hoy no habilita ventas comerciales. No se programó un recordatorio: la sesión se realizará cuando el propietario vuelva al chat.

## Preparación comprobada

- HTTPS y /api/health responden 200: status=ok, payments=test, email=configured.
- Remitente notificaciones@sharkpass.co; respuestas a soporte@sharkpass.co, alias del mismo buzón. Verificación recibida en Gmail con SPF/DKIM/DMARC aprobados.
- Tres plantillas publicadas: compra, verificación y recuperación. Datos DEMO identificados y enlaces de vista previa no funcionales.
- Evento DEMO de pago: 594af92b-8d80-48ca-a4f6-2e694e48f29b. General de prueba COP 5.000, 20 disponibles; Preferencial COP 10.000, 10 disponibles al revisar. Estos cupos pueden cambiar durante ensayos.
- Evento DEMO gratuito: 0a1516f0-6878-425b-9713-c6be2c18bccc, 19 disponibles de 20 al revisar. Sirve para validar QR sin pasarela; no acredita pago ni correo de compra Wompi.
- Evento comercial f73a9bc4-337b-4d83-a067-6d8722c1a8c6 permanece privado; lectura anónima 404.
- Sin sesión: pedidos, gestión y administración devuelven 401.

## Qué tener a mano

Un ordenador para comprar, teléfono/tablet real de puerta y segundo equipo para repetir el escaneo. Internet principal, datos móviles de respaldo y cargadores. Cuenta organizadora y cuenta del operador con acceso al mismo DEMO; no compartir contraseñas. Correo de prueba accesible. El propietario completa cualquier autenticación y las operaciones de pago que requieran su intervención.

## Guion de 45–60 minutos

1. Acceso y privacidad (5–10 min). Crear una cuenta de comprador de prueba, iniciar sesión, verificar su correo y cerrar sesión. Comprobar que otro comprador no puede abrir sus pedidos. Solicitar recuperación, comprobar recepción y nuevo acceso; el enlace reutilizado debe ser rechazado.
2. Compra Sandbox (15–20 min). Desde Explorar eventos elegir DEMO · Noche Azul — pago Wompi. Comprar dos unidades con los medios oficiales de prueba de Wompi. Comprobar aprobado, rechazado y pendiente; registrar únicamente referencia/estado, sin claves ni datos sensibles. El retorno del navegador por sí solo no prueba el pago: confirmar estado del servidor. Verificar caducidad de reserva y liberación del cupo.
3. Entrega (5–10 min). Confirmado el pago, deben existir dos entradas y dos QR diferentes. Comprobar el correo, el enlace con sesión de comprador y las descargas. La imagen del comprobante no sustituye el QR. No usar el enlace de una verificación enviada a una cuenta DEMO anterior para vincular el correo personal.
4. Puerta (10–15 min). Con operador autorizado, escanear primera entrada: permitido. Repetir desde el otro equipo: rechazado como utilizada. Escanear la segunda sin recargar el lector. Probar código inválido y QR de otro evento: denegados. Si BarcodeDetector no funciona en el navegador real, ensayar el método manual o lector compatible existente; no declarar cámara compatible sin comprobarla.
5. Cierre (5 min). Revisar vendidos/disponibles e ingresos; anotar defectos y referencias de prueba. No borrar pedidos para ocultar fallos ni activar producción para resolver un problema Sandbox.

## Lo que todavía impide abrir ventas reales

Compra y estados Wompi verificados externamente, correo de compra, recuperación y puerta aceptados; cupos finales y condiciones comerciales; responsable de soporte y devoluciones; respaldo externo/restauración y carga según concurrencia acordada. Los resultados automatizados no sustituyen estos ensayos.

## Evidencia técnica

63 pruebas, tipos y export de Android/iOS/web aprobados en copia limpia de fuentes. Contenedor construido y arranque comprobado. Última publicación visual 01a1b713-f0a8-7326-9cb8-57858db1908c. No se modificaron claves, permisos ni datos comerciales durante la preparación de esta sesión. launch:status local se actualizó para reconocer SMTP además de Resend y sigue indicando readyForPublicSales=false mientras falte aceptación.
