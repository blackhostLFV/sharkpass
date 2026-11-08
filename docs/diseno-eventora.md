# Figma Eventora → SharkPass

Referencia: [Main File](https://www.figma.com/design/po6LFlquhVPcKgX6x5f6Dh/Main-File). Se leyó la documentación del kit local de Localia y se obtuvo contexto de alta fidelidad con capturas para implementar las pantallas. El diseño se aplica exclusivamente a SharkPass; Localia conserva el tema morado anterior.

## Aplicación y web

La app Android/iPhone está en `apps/mobile`, con Expo SDK 58 y Expo Router. La web existente conserva su backend y sus flujos de compra y administración; `public/app-shell.css` cambia la estructura de landing por navegación de aplicación y acceso/registro separados. Los cuatro destinos de la app son Inicio, Mis entradas, Favoritos y Perfil. En escritorio la web presenta navegación lateral; en móvil presenta navegación inferior.

Se conservan el logo oficial ticket-aleta y el verde mar de SharkPass sobre fondo `#0d0d0d`. El azul del kit se sustituye por el acento de marca. No se añaden monograma S, código de barras ni Shark Caribe al logo. Shark Caribe aparece en el nombre de su evento.

## Correspondencia de pantallas

| Referencia Figma                   | Implementación                                                                                                                                                                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inicio, contenido 1:6813           | `apps/mobile/src/app/(tabs)/index.tsx` y plantilla web: Manrope, tarjetas de 231 px, imagen 215 × 160, categorías y próximos eventos con fecha lateral.                                                                                                                                   |
| Búsqueda 1:7406, resultados 1:7509 | `search.tsx`; búsqueda y categorías del catálogo existente. No se inventan búsquedas recientes ni ubicaciones.                                                                                                                                                                            |
| Detalle 1:7762                     | `event/[id].tsx`: hero 340 px, controles superpuestos, descripción, fecha, lugar y entrada.                                                                                                                                                                                               |
| Acceso 1:9377                      | `auth.tsx`, modo login: título 24 px, campos y botón de 56 px, ojo de contraseña, recuperación y enlace de registro al pie.                                                                                                                                                               |
| Registro 1:5523                    | La misma pantalla en modo registro, con nombre y teléfono guardados en el perfil, usuario y contraseña. El usuario reemplaza el campo de correo del kit para conservar la compatibilidad de acceso; el correo de recuperación se verifica por separado. No se inventan políticas legales. |
| Onboarding 1:6102                  | `welcome.tsx`: tres pasos, imagen, degradado, indicadores, omitir y continuar; marca de ilustración DEMO.                                                                                                                                                                                 |
| Perfil 1:6190                      | `profile.tsx`: avatar, grupos de filas y preferencias con datos reales de sesión.                                                                                                                                                                                                         |
| Revisión 1:8373                    | `checkout.tsx`: tipo, cantidad, importe y Wompi. No se copian impuestos/descuentos ficticios.                                                                                                                                                                                             |
| Estados de compra                  | `payment.tsx`, `tickets.tsx`, `order.tsx`: estado canónico y QR individual autenticado.                                                                                                                                                                                                   |

Las variantes de foco y formulario lleno utilizan el estado real del componente. No se dibujan hora, batería ni barra de gestos falsas: las áreas seguras y la barra de estado pertenecen al sistema. El primer evento sigue en preparación, sin inventar hora, precio o cupo.

## Assets y límites

Fuentes locales Manrope 400/500/600/700 de `@expo-google-fonts/manrope` 0.4.3, con licencia OFL. Los SVG originales exportados de Figma están en `public/design/eventora` y en los assets de la app. Se conservan las dimensiones raíz: búsqueda 16.8869 × 17.2683; ubicación 16 × 16; volver/inicio/perfil/corazón/ojo/social 24 × 24; entradas 18.165 × 19.91; usuario/candado/seguridad/salir 20 × 20; flecha de fila 18 × 18; línea divisoria 115.5 × 1. Avatar de inicio 46.829 × 48 y perfil 64 × 64. El icono PNG de la app se rasterizó del símbolo SVG oficial sin modificar su silueta.

Las imágenes de eventos son datos del catálogo; las imágenes ficticias se identifican. No se utilizan capturas de Figma como interfaz ni URLs temporales en runtime. Los accesos Google/Apple/Facebook conservan sus iconos y ubicación, pero están deshabilitados con aviso de disponibilidad pendiente.

No hay mensajería, reseñas, mapas interactivos ni notificaciones push conectados. El kit no proporciona el backend de esas funciones. La recuperación utiliza enlaces de correo del sistema existente, no códigos OTP simulados. Las políticas comerciales y el canal oficial de soporte deben confirmarse antes del lanzamiento.

Code Connect no se registró: Figma rechazó la asociación anterior por el plan de biblioteca. No se trasladó GuideNav de Localia al proyecto SharkPass.

## Validación

`npm run check`: tipos móviles y 24 pruebas del backend, incluyendo sesión móvil permitida/denegada, aislamiento entre compradores, revocación, ausencia de tokens en el login web, cupos, idempotencia y escaneo único. `npm run build`: sintaxis del servidor y exportación de bundles iOS, Android y web. La instalación de servidor con `--workspaces=false` se verificó por separado para no instalar Expo en el contenedor de backend.

La vista Expo web permite revisar los mismos componentes móviles a 375 × 812; no equivale a una prueba física. No se han creado APK/IPA firmados, publicado en tiendas ni realizado pagos reales. Dominios, correo y prueba Wompi real siguen pendientes. Ver `apps/mobile/README.md` para configuración y límites.

## Ajuste web: blanco y azul (29 octubre 2026)

La web pública utiliza fondo blanco y azul primario `#2970FF` del contexto Figma 1:6813, con texto azul profundo `#001847`. La portada y catálogo utilizan fotografía seleccionada de Canva, sin flechas ni ilustraciones decorativas. Este ajuste sustituye las descripciones de navegación lateral y verde mar anteriores para la web; la app nativa no se modifica en este ajuste.
