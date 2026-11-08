# SharkPass Ingreso

PWA independiente en https://sharkpass.co/ingreso/ . Usa las sesiones y permisos existentes; no crea operadores ni administradores. El organizador añade el correo ya registrado del personal en Personal de ingreso. Cada persona usa su propia cuenta y confirma un evento publicado antes de abrir el lector.

Android/Chrome y escritorio compatible: menú del navegador → Instalar aplicación, o botón Instalar cuando el navegador lo ofrezca. iPhone/iPad: Safari → Compartir → Agregar a inicio. Manifest con id/start_url/scope /ingreso/, standalone, iconos PNG 192/512 y service worker del mismo ámbito. La instalación física en las tablets se debe ensayar allí; no se ha instalado una app en esos dispositivos desde esta entrega.

Lector: BarcodeDetector nativo cuando ofrece qr_code, cámara trasera solicitada con permiso explícito, sin micrófono. Se detiene al ocultar/salir/cambiar de evento. Tras cada resultado se pulsa Siguiente entrada; evita varias lecturas simultáneas. Alternativa mediante lector QR 2D en modo teclado + Enter, o pegado del código completo. La cámara depende del navegador; probar el dispositivo exacto. No se incorporó una biblioteca decodificadora ni se promete cámara en todos los iPads.

Verde exclusivamente para respuesta HTTP 200 con accepted=true y ticketId del servidor. Rojo para rechazo explícito (incluye utilizada, anulada, inválida y sin permiso). Ámbar para respuesta desconocida, fallo de red o servidor. Un resultado perdido no se interpreta como autorizado, no se pone en cola ni se reintenta automáticamente. Si el servidor validó pero se perdió la respuesta, una nueva lectura puede devolver utilizada: consultar con el coordinador antes de admitir. Contador en memoria desde esta apertura, sin presentarlo como asistencia global; se reinicia al recargar.

El service worker solo conserva una lista exacta de archivos públicos (HTML estático, CSS, JS, manifest, iconos y logo). Nunca almacena API, sesiones, contraseñas, códigos de entradas o validaciones. La app puede abrir su interfaz sin red, pero no permite autorizar ingresos sin confirmación del servidor. No hay validación offline.

Validación: 75 pruebas, exportaciones iOS/Android/web y contenedor. Casos nuevos: verde solo con aceptación explícita; red/5xx desconocidos; caché excluye API/auth/tickets/POST y limpia solo su propio namespace; recursos instalables servidos con MIME correcto; operador autorizado ve solo sus eventos, no ventas ni QR ajenos, la sesión revocada se rechaza y dos solicitudes simultáneas admiten una vez. QA local real de UI con cuenta scanner sintética: login/logout, elección de evento, aceptada, repetida, siguiente código sin nueva sesión y corte del servidor simulado durante una solicitud. El resultado quedó sin confirmar; al recuperar la conexión la repetición se rechazó como utilizada. Antes de instalar, revisar también cámara/lector físico, filas simultáneas y red del recinto.

Referencias técnicas: https://web.dev/learn/pwa/web-app-manifest y https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers .

Publicado: build `01a1b801-b654-7352-955e-d9d9f788e1f5`. Verificados recursos/manifest, app preparada para instalación en Chrome y sesión real sin permisos bloqueada sin acceso al lector. La instalación y la cámara física en las tablets del evento siguen pendientes.
