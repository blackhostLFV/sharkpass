# SharkPass para Android y iPhone

Aplicación independiente de Localia. Expo SDK 58, React Native y Expo Router. Comparte el backend de SharkPass; no incorpora claves de Wompi ni código de servidor. Fuentes, iconos y geometrías proceden del Figma Eventora, con el verde mar de SharkPass.

Desde la raíz:

```sh
npm ci
npm run dev:mobile
npm run typecheck:mobile
npm run build:mobile
```

`npm run check` incluye tipos móviles y las pruebas del servidor. `npm run build` comprueba el servidor y exporta bundles iOS, Android y web. Una exportación no es un APK/IPA firmado ni una publicación en tiendas.

Por defecto muestra **DEMO** y no emite entradas. Para el catálogo real, tocar el aviso de demostración o configurar `EXPO_PUBLIC_DEMO=0`. No se debe usar información real durante las revisiones.

## Backend y dispositivos

`EXPO_PUBLIC_API_URL` es una URL pública de API, nunca una clave. Por defecto usa `http://10.0.2.2:3201` en emulador Android y `http://127.0.0.1:3201` en simulador iOS. El servidor de desarrollo solo escucha en loopback. Un teléfono físico requiere un backend de pruebas HTTPS accesible: localhost en el teléfono no es el Mac. No se abrió un túnel ni se publicó el servidor.

Las versiones de producción rechazan API HTTP. El dominio web oficial es https://sharkpass.co. La distribución de este cliente en tiendas sigue pendiente. Los identificadores `com.sharkpass.app` son configuración de proyecto, no un registro en Apple/Google ni una comprobación de disponibilidad de marca.

La sesión móvil usa `POST /api/mobile/login` y se conserva con Expo SecureStore, sin almacenar la contraseña. Caduca en 12 horas y se revoca al cerrar sesión o restablecer contraseña. El navegador conserva su cookie HttpOnly; su login no devuelve tokens. La vista Expo web sirve para revisar las pantallas, no para autenticar contra otro origen: la web operativa está en el servidor SharkPass.

El pago continúa en el checkout alojado de Wompi. El servidor determina importe, cupo e idempotencia. El comprador consulta el estado al volver y solo ve QR emitidos por el backend. El retorno web ofrece un enlace `sharkpass://payment` para regresar a la app instalada. No se configuraron Universal Links y su configuración y prueba física siguen pendientes.

## Pantallas

- Onboarding de tres pasos y splash con el logo oficial.
- Inicio, categorías, búsqueda, detalle y favoritos locales.
- Acceso, registro, recuperación por correo y perfil.
- Selección de entrada y cantidad, revisión, checkout Wompi y estado de pago.
- Mis entradas y QR individual autenticado.

El registro conserva cuatro campos del diseño: nombre completo, teléfono, usuario y contraseña. Nombre y teléfono se guardan en un perfil privado de la sesión; el usuario reemplaza el campo de correo del kit para mantener las cuentas existentes. El teléfono no implica verificación por SMS. No hay acceso social, mensajería, reseñas, notificaciones push ni mapas interactivos conectados. No se copian sus controles como si fueran funciones disponibles. La recuperación requiere correo configurado. Los organizadores administran el evento desde la web existente.

La revisión visual se hace con las mismas pantallas exportadas en web. Faltan pruebas físicas iPhone/Android, builds firmados y validación de la compra completa con Wompi real antes de distribuir. Las herramientas Expo tienen ocho avisos de auditoría npm (tres de severidad alta); la propuesta automática implica cambiar de SDK y no se aplicó. La instalación de servidor sin workspaces conserva sus dependencias separadas y su auditoría sin avisos.
