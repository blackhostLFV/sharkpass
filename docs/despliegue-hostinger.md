## Estado vigente — 6 noviembre 2026

Publicado en https://sharkpass.co como vista previa sin ventas. Ver [evidencia de publicación](publicacion-2026-11-06.md). Se usó el Business de otra cuenta y la propiedad del dominio se verificó con TXT; los bloqueos y lecturas anteriores que siguen son antecedentes, no el estado final.

## Cuenta nueva de SharkPass — revisión 6 de noviembre de 2026

La conexión OAuth `hostinger-sharkpass` pertenece a la nueva cuenta indicada por el propietario. No reutilizar credenciales ni conclusiones de la cuenta revisada anteriormente.

Resultados de consultas MCP de solo lectura: `domains_portfolio_list` incluye sharkpass.co activo (registrado el 6/11/2026) y sharkcaribe.co activo. `hosting_orders_list`, `hosting_websites_list`, `agency-hosting_orders_list`, `agency-hosting_websites_list-plan` y `vps_virtual-machines_list` devuelven listas vacías. `billing_subscriptions_list` muestra dominios y Starter Business Email, sin plan de hosting. No hay destino de ejecución disponible en esta cuenta para subir el servidor. El dominio elegido para SharkPass es sharkpass.co; no modificar sharkcaribe.co.

No se compraron servicios, no se modificó DNS y no se publicaron archivos. Confirmar si el hosting se contrató en otra cuenta o falta contratarlo. Un dominio por sí solo no ejecuta la aplicación Node ni almacena la base de datos.

La revisión anterior que sigue corresponde a OTRA cuenta y se conserva como antecedente técnico, no como disponibilidad de recursos para este despliegue.

---

# SharkPass: preparación de Hostinger

Revisión del 5 de noviembre de 2026. Inspección de solo lectura; no se creó una aplicación, no se publicó código y no se modificaron dominios, servicios ni credenciales.

## Acceso y destino

Se verificó una sesión autenticada de hPanel en el navegador del propietario. Existe alojamiento activo con Web Apps de Node.js; no hace falta pedir nuevamente un acceso que ya funciona. El panel muestra dos aplicaciones Node existentes y ningún destino SharkPass. La sección VPS muestra opciones para configurar uno, sin instancias visibles. No se verificó acceso SSH a Hostinger; los alias SSH locales corresponden al servidor privado de oficina.

El plan observado permite 100 sitios, 200 GB de disco, 3 GB de RAM y 2 núcleos. Hay 13 sitios; el consumo visible es 18,96 GB de disco. La advertencia de 79 % corresponde a 471.843 de 600.000 inodos, no a CPU: conviene evitar subir node_modules y artefactos móviles. Estos recursos son compartidos; no prueban la capacidad de venta simultánea de SharkPass. El nombre comercial exacto y la cantidad máxima de Web Apps disponibles no quedaron confirmados.

**Destino público pendiente:** el propietario no ha confirmado el dominio de SharkPass. No sustituir sharkcaribe.co ni sitios existentes. El primer paso operativo es una Web App independiente en una URL temporal, con datos de prueba separados, una vez resuelta la persistencia descrita abajo.

## Compatibilidad y decisión de infraestructura

Hostinger documenta Web Apps administradas en planes Business y Cloud, soporte para Node 22.x/24.x y proyectos con framework “Other”. El panel de esta cuenta también muestra 22.x y 24.x. Esto permite evaluar el servidor HTTP propio de SharkPass; no obliga a contratar un VPS. [Despliegue oficial](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

La versión del repositorio es Node 22.17.1 y package.json exige Node >=22.17.1 <23. Node 24 no satisface ese contrato. Además, Hostinger recomienda Node 22.23.4 o posterior por las correcciones de seguridad de octubre de 2026. **Revisar y actualizar coordinadamente el pin de Node 22 antes de producción**, con pruebas y contenedor; esta revisión no cambió AGENTS.md, Dockerfile ni el runtime. [Aviso oficial de seguridad](https://www.hostinger.com/support/node-js-24-22-1-security-update-on-hostinger-hosting/).

Hostinger limita este servicio a un proceso Node de larga duración y no ofrece Docker ni workers permanentes separados. SharkPass usa un único servidor, SQLite local y un temporizador de correo en ese proceso. El envío debe recuperar trabajos persistentes después de reinicios; el temporizador no reemplaza una cola durable ni una política de reintentos comprobada. [Límites oficiales](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/).

**Bloqueo técnico previo a publicar:** verificar con una aplicación aislada que `node:sqlite` funciona y que DATABASE_PATH apunta a un directorio privado, escribible y persistente, fuera del artefacto que se reemplaza al desplegar. Crear un registro de prueba, reiniciar y volver a desplegar: el registro debe conservarse. La documentación pública revisada no garantiza esta condición. No colocar la base en public_html ni en public, ni asumir que un archivo incluido en el ZIP persistirá. Si no puede garantizarse, evaluar un VPS de Hostinger con volumen persistente; no contratarlo sin decisión del propietario.

## Ruta de publicación propuesta

1. Confirmar dominio de SharkPass y disponibilidad de Web App aislada. Usar URL temporal primero y pagos de prueba.
2. Resolver runtime Node 22 actualizado y persistencia SQLite. No activar varias instancias que compartan archivos SQLite por red.
3. Preparar artefacto de servidor con package.json, package-lock.json, src, public, migrations y scripts. Excluir .env, bases, backups, node_modules y bundles móviles. Instalar dependencias de servidor con `npm ci --omit=dev --workspaces=false`; arrancar con `npm start`, respetando PORT del proveedor y HOST=0.0.0.0.
4. Configurar variables privadas en el panel, nunca en archivos públicos: NODE_ENV, PUBLIC_URL, DATABASE_PATH, claves de sesión/tickets, Wompi y correo. El propietario configura Wompi; no compartir valores secretos por chat.
5. Ejecutar migraciones con copia de seguridad previa y validar health, registro, acceso, compra de prueba, emisión, correo y escaneo. Verificar acceso autorizado y denegado, dos lectores sobre el mismo QR y cupos simultáneos.
6. Probar HTTPS y certificado del dominio final, retornos Wompi y webhook HTTPS con firma e idempotencia. Verificar IP real y proxy: no confiar en cualquier X-Forwarded-For enviado por Internet. Probar que el límite de solicitudes de clientes no bloquea callbacks de pago.
7. Revisar capacidad y logs sin secretos ni QR completos. Ensayar caída/reinicio, recuperar correos pendientes y comprobar que no se emiten entradas dos veces.
8. Publicar el evento real únicamente tras confirmar cupos, condiciones y el ensayo completo. La app Android/iPhone tiene su propio proceso de distribución; no es requisito para vender desde la web adaptable.

El script deploy/install.py pertenece al piloto privado de oficina: usa Podman, una ruta del servidor interno y una IP Tailscale. **No ejecutarlo en Hostinger.**

## Backups y recuperación

El repositorio dispone de copia SQLite mediante VACUUM INTO y verificación de integridad. Una copia en el mismo disco no basta ante pérdida del alojamiento: definir copia externa cifrada, retención y responsable; probar restauración en otra ruta con la aplicación detenida. Confirmar qué incluye el backup administrado y su frecuencia, especialmente SQLite y secretos de recuperación. El panel muestra información contradictoria entre la ubicación de backup y su aviso general: no se afirma una región de respaldo garantizada.

Antes del lanzamiento deben quedar una copia anterior a cada despliegue, una programación diaria verificable, instrucciones de restauración y una recuperación ensayada de ventas y check-ins. Un rollback de código debe conservar la base y ser compatible con las migraciones; nunca borrar ventas para volver de versión.

## Primer evento: datos públicos verificados

Fuente: [Shark Caribe](https://www.sharkcaribe.co/), HTML y configuración pública enlazada `/assets/index-PjJxsR23.js`, consultados el 5 de noviembre de 2026. Se leyó el contenido público; no se ejecutó el bundle localmente.

| Dato | Publicado |
| --- | --- |
| Evento | Gran Final de Pitch Competition, Shark Caribe |
| Fecha | Miércoles 25 de noviembre de 2026 |
| Horario | 3:00 p. m. a 9:45 p. m. |
| Lugar | Hotel Dann Carlton, Salón Los Laureles, Barranquilla |
| Dirección | Calle 98 No. 52B-10, Riomar, Barranquilla |
| General | COP 50.000 |
| Preferencial | COP 79.900 |

Estos precios y horarios pueden precargarse como borrador con fuente y fecha. No se verificaron aforos por categoría, número de entradas disponible, inclusión de cargos, impuestos, edad mínima, condiciones de devolución ni diferencias detalladas entre categorías. La mención publicitaria de más de 300 asistentes no confirma un cupo de venta. Mantener los cupos sin definir y bloquear la publicación hasta confirmarlos. La imagen antigua aportada coincide en fecha y hotel, pero el sitio actual aporta horario y precios.

## Pendientes que impiden declarar producción lista

- Dominio independiente de SharkPass y destino aislado elegidos.
- Node 22 parcheado y persistencia SQLite comprobados en ese destino.
- Credenciales privadas Wompi/correo, remitente verificado y webhooks probados.
- Cupos y condiciones comerciales del evento confirmados.
- Compra, ticket, correo, escaneo único, carga y recuperación probados en el servidor público.
- Backup externo, restauración y responsable de operación definidos.

No se realizó una prueba de contenedor ni un despliegue como parte de esta revisión documental. Los checks y correcciones de la aplicación se registran por separado en el plan de QA.

## Revisión de conexiones anteriores — 6/11/2026

El propietario autoriza revisar los otros Hostinger. Consultas GET autenticadas a la API oficial (sin modificaciones):

- Conexión `hostinger-official-hosting`/`hostinger-official-billing`: pedido 201204854 activo, plan `hostinger_business`; facturación confirma Business Web Hosting activo. Inventario completo: 21 sitios, dos identificados como Node.js.
- Conexión `hostinger-hosting`/`hostinger-billing`: pedidos activos Premium y Cloud Professional; facturación confirma Cloud Professional. No se evaluó carga actual ni capacidad libre de este plan.
- Hostinger documenta cinco sitios Node.js para Business; las dos apps existentes sugieren espacio nominal para otra. No equivale a medir CPU/RAM ni aprobar producción.

Recomendación de coste: evaluar primero el Business existente para un sitio independiente sharkpass.co; el dominio permanece en la cuenta nueva. Antes de subir: confirmar recursos reales, persistencia privada SQLite ante reinicio/despliegue y superar validaciones. No se creó sitio, no se modificó DNS y no se contrató alojamiento.

Fuente de límites consultada: https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/.

## Preparación autorizada — 6/11/2026

Crear sharkpass.co directamente en el Business devolvió HTTP422: Access to domain is forbidden. No se cambió DNS. Se creó una URL temporal independiente: slategrey-elk-810355.hostingersite.com, pedido201204854, cuenta de alojamiento u436707861. Hostinger confirma setup completed. Falta verificación TXT de propiedad entre cuentas; no transferir dominio ni reemplazar sitios ajenos.

El bloqueo de validaciones locales se resolvió copiando las mismas fuentes y lockfile a /tmp/sharkpass-release-20261106 e instalando con npm ci. Check completo aprobado (tipos y30pruebas) y build/export de Android, iOS y web aprobados. Docker construido; primer arranque detectó que /data necesitaba propietario node. Dockerfile corregido para crear /data y asignarlo a node. Contenedor verificado con health y registro sintético de persistencia mantenido tras restart. No se cambió lógica de pagos ni migraciones.

Paquete fuente de9.278.606bytes subido mediante TUS (201/204 y offset igual al tamaño), sin .env, bases de datos ni node_modules. Nuevo script build:server verifica sintaxis sin exportar la app móvil en Hostinger. Pagos y correo quedan sin configurar. Aún pendientes validación de la aplicación en Hostinger y persistencia ante un segundo despliegue.
