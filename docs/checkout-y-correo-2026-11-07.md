# Compra, acceso por correo y boletas individuales

La web utiliza correo y contraseña para el registro y el acceso. Los identificadores de cuenta, compras, equipos y privilegios se conservan. Las cuentas anteriores con correo verificado lo reciben como identificador; las que no lo tienen deben vincularlo desde su sesión o mediante «Vincular correo a mi cuenta anterior». Un correo de compra no se convierte automáticamente en identidad verificada.

El checkout muestra el correo del comprador y pide confirmarlo antes de crear la reserva o las entradas gratuitas. El carrito presenta portada, localidad, cantidad y total. En móvil hay una barra inferior con total y acción principal; se comprobó que no hay desbordamiento horizontal en 320 y 390 px.

Las boletas aparecen en columnas cuando hay espacio y en una columna en teléfonos. Cada una tiene su descarga y los botones Compartir / Guardar imagen. Compartir usa el menú del dispositivo cuando admite archivos; la alternativa descarga un PNG individual. El QR mantiene el uso único. Compartir el archivo permite a su destinatario ingresar; no cambia el propietario de la compra ni revoca la copia anterior. La impresión conserva el contenedor de boletas.

La confirmación muestra el destino y el estado del correo. «Aceptado por el servidor» no equivale a entrega garantizada en bandeja. La compra Sandbox reportada se comprobó también en Gmail y estaba en INBOX; su destino correspondía al correo escrito en el checkout. No se guardan direcciones de compradores en este documento.

La cola ahora cubre entradas gratuitas además de compras Wompi. La consulta y reenvío exigen ser propietario del pedido. Un envío en curso no se repite, hay espera tras un envío aceptado y cada reenvío explícito usa un identificador nuevo para no quedar suprimido por la idempotencia del proveedor. Las migraciones nuevas conservan las verificaciones y estados de envío anteriores, con respaldo previo verificado.

Validación: 67 pruebas, comprobación de tipos móviles, exportación iOS/Android/web y contenedor Node 22.17.1 con /api/health correcto. Incluye acceso permitido/denegado, apropiación de correos rechazada, conservación de cuentas/roles, migración con datos previos, aislamiento del correo, idempotencia, cupos y escaneo único. El checkout y la descarga PNG se probaron con datos sintéticos; el menú de compartir nativo requiere además ensayo en dispositivos físicos.

Los ejecutables de node_modules del directorio original presentan un fallo local de shebang en tsc. La validación completa se ejecutó en la copia limpia de preparación, con el mismo código y lockfile. No se modificaron dependencias.

No hay nuevas variables privadas que configurar en hPanel para estos cambios. SMTP sigue en el servidor y Wompi continúa en Sandbox. No se habilitan cobros reales.

Publicación verificada: build `01a1b744-e85d-7195-9199-f3e41ade31ba`, entrada `src/hostinger.mjs`.

El propietario puede enviar una copia de la confirmación a otra dirección desde su pedido. Esta acción requiere sesión y compra confirmada, valida el destino, limita los intentos y registra una auditoría sin guardar direcciones en ella. La copia se envía por el transporte transaccional configurado, sin cambiar el correo original de la compra. Si falla, la interfaz lo informa para reintentar; no se da por entregada silenciosamente. Las pruebas cubren destinatario, aislamiento, validación y límite de frecuencia.

## Cabecera con búsqueda integrada

La referencia visual del propietario se adaptó a la identidad SharkPass: cabecera azul, logo oficial sobre fondo blanco, menú móvil y búsqueda persistente con lupa y filtros desplegables. La consulta busca en título, lugar, organizador y descripción; las categorías provienen del catálogo. No hay un directorio independiente de artistas. La búsqueda conserva consulta y categoría en la URL y permite limpiar resultados. El formulario anterior del catálogo queda oculto para evitar buscadores duplicados.

Comprobado en navegador a 320, 390 y 1280 px: navegación, filtros, consulta sin tildes, resultados vacíos, limpieza y recarga conservando la búsqueda. Sin desbordamiento horizontal a 320 px. Se ejecutaron nuevamente las 67 pruebas, exportaciones iOS/Android/web y contenedor. Sin nuevas dependencias ni cambios en SMTP o pagos.

Cabecera publicada y búsqueda comprobada en sharkpass.co: build `01a1b74b-3e99-704a-9b58-87eef4d9a8c9`.

La cabecera usa ahora `sharkpass-logo-light.svg`: contiene el PNG oficial original intacto y un filtro SVG que intercambia azul #0033cc y blanco, conservando alfa, letras, contorno y proporciones. Se quitó el recuadro blanco. El pie y los demás usos conservan el original azul. Cambio de color solicitado expresamente por el propietario; comprobado visualmente en móvil, con 67 pruebas, exportaciones y contenedor correctos.

Versión blanca publicada y comprobada en sharkpass.co: build `01a1b753-a6f6-7391-9ae6-c6834d2b343d`.

## Logo blanco vectorial

Se sustituyó el SVG con PNG y filtro por cuatro trazados SVG, obtenidos del arte oficial mediante vectorización binaria de sus formas. No incluye imágenes incrustadas ni filtros; los espacios de las letras son transparentes. El original PNG permanece intacto. Se compararon silueta y letras a tamaño nativo y se revisó la cabecera móvil. La cabecera muestra 96 px en escritorio, 88 px en móvil y 80 px en pantallas pequeñas, conservando la proporción original. Los parámetros de caché se actualizaron. Sin dependencias nuevas en la aplicación: la herramienta de conversión se utilizó únicamente en un entorno temporal. Validación: 67 pruebas, exportaciones y contenedor correctos.

SVG vectorial publicado y comprobado: build `01a1b75c-42b3-7092-8fbd-671c20ee5d15`.

## Mi cuenta y nueva identidad transaccional

Mi cuenta presenta avatar por iniciales, accesos a entradas/favoritos, resumen de datos y panel separado de correo. Editar abre los campos; cancelar conserva los datos; guardar actualiza el resumen y confirma junto al formulario. Los errores se muestran en la misma sección con foco accesible. El correo distingue verificado de solicitud activa pendiente, sin presentar una solicitud como identidad confirmada. El endpoint de sesión devuelve únicamente dirección y vencimiento de la solicitud propia; no devuelve token ni hash. Las solicitudes vencidas se excluyen.

Los tres correos existentes (compra, verificación y recuperación) comparten logo azul oficial, blanco, azul real, titulares grandes, pie de marca y una acción principal. La compra incorpora un pase con localidad, fecha de Bogotá, lugar, cantidad y total, además del enlace a las entradas. Se preservan escape de contenido, versión de texto, enlaces temporales de un uso, etiquetas Sandbox y ausencia de secretos QR. No se crearon notificaciones nuevas para acciones que no tenían un flujo implementado.

Referencias de investigación: [formularios Carbon](https://www.carbondesignsystem.com/building-blocks/core/components/form/guidelines), [carga cognitiva en formularios NN/g](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/), [ejemplos Postmark](https://postmarkapp.com/transactional-email-templates), [NSW Email Toolkit](https://email.digital.nsw.gov.au/templates/transactional-and-service). La composición visual y el HTML son propios de SharkPass; no se añadió un proveedor de correo ni una dependencia de plantillas.

Validación: 69 pruebas, tipos móviles, exportaciones iOS/Android/web y contenedor. Incluye privacidad permitida/denegada del correo pendiente, vencimiento y ausencia de tokens; los correos prueban fecha antes/después de medianoche en America/Bogota. Revisión visual a 320, 390 y 1280 px, con casos de perfil pendiente/verificado, guardar/cancelar/error y navegación. Los correos caben sin desplazamiento horizontal a 320 px. Las solicitudes de verificación del fixture local se capturaron sin enviar mensajes reales. La compatibilidad de Outlook clásico y otros clientes físicos queda pendiente de ensayo específico.

Publicación comprobada: build `01a1b772-b705-71dc-8d5e-409edc4a7b3d`. Se revisó Mi cuenta en la sesión real y se solicitó un reenvío de la compra Sandbox existente. La prueba con el diseño nuevo llegó a INBOX de Gmail. No se generó una nueva compra ni un cobro.

## Preferencia de tipografía e indicador de sesión

El propietario indicó que prefiere letras sencillas, peso regular, títulos compactos y bloques planos, con sus ejemplos de correos de TuBoleta como referencia visual. Se quitaron de los correos los titulares publicitarios grandes, el espaciado negativo, flechas decorativas, esquinas muy redondeadas y tarjetas rellenas. La tipografía usa Helvetica/Arial con alternativas de sistema, peso regular y etiquetas funcionales. Mi cuenta conserva su organización, con el mismo criterio plano y sin sombras/degradados. Referencias complementarias: [tipografía de correo Litmus](https://www.litmus.com/blog/email-typography-fonts) y [diseño para la bandeja Campaign Monitor](https://www.campaignmonitor.com/dev-resources/guides/design/). Los ejemplos proporcionados no se interpretaron como petición de cambiar la verificación por enlace a un sistema de códigos.

La cabecera muestra «Hola, [nombre]» después del registro/inicio de sesión, usando el nombre de la cuenta autenticada. En escritorio aparece en navegación; en móvil hay un acceso visible incluso con el menú cerrado. Si la cuenta no tiene nombre, se muestra «Sesión iniciada». Al cerrar sesión se elimina el saludo y vuelve «Iniciar sesión». Cambiar el nombre en Mi cuenta actualiza el saludo. No se guardan nombres ni credenciales en almacenamiento del navegador para este indicador.

Validación: 69 pruebas, exportaciones y contenedor correctos. Revisión visual de compra, verificación y recuperación a 320/390 px sin desbordamiento; sesión con datos sintéticos, persistencia al recargar, menú cerrado/abierto y salida. Se conserva SMTP, la cola y los enlaces de un uso.

## Identidad de usuario sin apariencia de botón

El saludo de la cabecera es texto estático junto a un avatar de iniciales y la etiqueta «Sesión iniciada». «Mi cuenta» es un enlace independiente con foco visible; no se presenta un menú desplegable inexistente. Se quitó el botón duplicado de acceso cuando hay sesión. En móvil la identidad permanece visible con el menú cerrado. Referencia: [Avatar de Atlassian](https://atlassian.design/components/avatar). Se conserva el nombre real de cada sesión y las iniciales se insertan como texto, sin HTML de usuario.

Validación: 69 pruebas, exportaciones iOS/Android/web y contenedor con health correcto. Revisión con cuenta sintética de la identidad como DIV, enlace a Mi cuenta, recarga y ocultación al salir; móvil a 320 y 390 px sin desplazamiento horizontal.

## Cabecera organizada en dos niveles

Se reorganizó la composición completa: logo, buscador, identidad y carrito en la fila principal; navegación y acceso de organización en la segunda. En móvil quedan logo, saludo, carrito y menú en una fila, y el buscador debajo: 142 px de cabecera a 390 px, sin la fila extra de identidad. El saludo es texto estático y el enlace a Mi cuenta está separado. El carrito conserva su etiqueta accesible y contador; los filtros conservan su formulario. Referencias de estructura: [Shopify Top bar](https://polaris-react.shopify.com/components/internal-only/top-bar) y [separación de cabecera/navegación GOV.UK](https://design-system.service.gov.uk/patterns/navigate-a-service/); identidad gráfica propia de SharkPass.

69 pruebas, tipos, exportaciones y contenedor correctos. Comprobados menú móvil, selección de Mis entradas y cierre automático, enlace de cuenta, estado sin sesión y ausencia de desbordamiento a 320/390 px. La prueba del correo plano anterior llegó a INBOX de Gmail; no hubo compra ni cobro nuevo.

Cabecera final publicada y comprobada en la sesión real: build `01a1b78a-656e-738c-b492-5dcfbcc91b0b`. Salud pública correcta, correo configurado y pagos en test.
