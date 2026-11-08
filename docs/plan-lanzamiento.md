# SharkPass — control del lanzamiento

Actualizado: 5 de noviembre de 2026. Responsable técnico/coordinación: Codex. Revisión independiente: agente QA de esta tarea. Decisiones comerciales, Wompi y compra real: propietario. La revisión automatizada no sustituye el ensayo humano de puerta.

## Estado para la sesión de pruebas — 7/11/2026

Web HTTPS y dominio operativos. Wompi configurado en Sandbox; cobros reales deshabilitados. Correo propio activo y recepción en Gmail comprobada con SPF/DKIM/DMARC aprobados. Las tres plantillas visuales están publicadas. Última suite: 63 pruebas y export Android/iOS/web aprobados; Docker construido y probado. La revisión pública confirma los dos DEMO disponibles, el evento comercial privado (404 anónimo) y pedidos/gestión/administración protegidos (401 sin sesión).

Pendientes de aceptación: compra completa con proveedor Sandbox, correo de compra, recuperación real y escaneo en los dispositivos de puerta; recuperación desde respaldo externo y carga a volumen acordado antes de ventas. Cupos y condiciones del evento comercial requieren al propietario. Ver [guion de la sesión](sesion-pruebas-2026-11-07.md). La tabla histórica siguiente conserva antecedentes; no representa el estado actualizado por sí sola.

## Objetivo y alcance

Lanzar la web móvil de SharkPass para vender entradas de los eventos del propietario, con Wompi, identificador individual por entrada, entrega, descarga y check-in único en línea. Primer evento: Pitch Competition by Shark Caribe, fuente https://www.sharkcaribe.co/. No confundir con Localia, que es un proyecto independiente.

Identidad objetivo: Sora + Manrope, #0033CC, fondo blanco y PNG azul oficial nuevo. La actualización completa de tipografía y color sigue pendiente. Congelar rediseños mientras se cierran flujos críticos. Fuera del primer lanzamiento: tiendas móviles, marketplace abierto a terceros, liquidación automática, lector offline, reingresos y funcionalidades sociales. Cualquier excepción necesita una decisión comercial registrada.

## Tablero de trabajo

| ID | Prioridad | Resultado | Responsable | Estado y evidencia |
|---|---|---|---|---|
| L-01 | P0 | Backlog y criterios de aceptación | Coordinación | Documentado en historias-usuario.md |
| L-02 | P0 | Registro, acceso y permisos | Desarrollo/QA | Implementados; suite base 24/24 verificada por QA; aceptación de navegador aún pendiente |
| L-03 | P1 | Cámara vuelve a leer tras primer QR y descarta resultados viejos | Desarrollo/QA | Corregido; 3/3 regresiones sintéticas. Ensayo físico pendiente |
| L-04 | P1 | Tráfico público no bloquea webhook Wompi; proxy explícitamente confiable | Desarrollo/QA | Corregido; 3/3 regresiones. Proxy real pendiente |
| L-05 | P2 | Preparar Pitch lleva al campo hora visible | Desarrollo | Corregido; verificación del asistente autenticado pendiente |
| L-06 | P0 | Primer evento fiel a fuente, sin inventar cupos | Propietario/Contenido | Fuente pública verificada: 15:00–21:45, General $50.000, Preferencial $79.900; cupos y cargos aún pendientes |
| L-07 | P0 | Hostinger compatible y acceso operativo | Operaciones | Sesión hPanel autenticada verificada; comprobar destino/runtime/disco antes de desplegar |
| L-08 | P0 | Dominio/subdominio, HTTPS y webhook público | Operaciones/Propietario | Nombre público de SharkPass por confirmar; no reemplazar sharkcaribe.co |
| L-09 | P0 | Wompi Sandbox y producción | Propietario/Desarrollo/QA | Propietario confirma que configurará las claves; integración real pendiente |
| L-10 | P0 | Correo de entradas y recuperación | Propietario/Desarrollo/QA | Remitente/proveedor y recepción en buzón pendientes |
| L-11 | P0 | Ensayo completo de compra e ingreso | QA/Propietario | Pendiente Sandbox externo y dispositivos de puerta |
| L-12 | P0 | Respaldo externo, restauración y reversión | Operaciones | Pendiente destino público y ensayo de restauración |
| L-13 | P0 | Carga y límites según pico de ventas/puertas | Desarrollo/QA/Propietario | Volumen y equipos por confirmar; no asumir capacidad por métricas del sitio |
| L-14 | P0 | Reglas de ingreso, cancelación, soporte y recaudo | Propietario | Confirmación pendiente; no inventar términos ni comisiones |
| L-15 | P0 | Prueba controlada con dinero real | Propietario/QA | Solo tras Sandbox y despliegue preparados; la ejecuta el propietario |
| L-16 | P1 | Runtime Node seguro y compatible con destino | Desarrollo/Operaciones | Revisar versión mantenida compatible; pin actual 22.17.1 no implica aprobación de seguridad |
| L-17 | P1 | Completar check/build globales | Desarrollo | QA-ENV-01: ejecución TypeScript/Expo local no completó; suite Node30/30 sí aprobada. Repetir en entorno operativo antes de desplegar |

P0 significa necesario para abrir ventas; P1 también bloquea si afecta compra, entrega, privacidad o ingreso. No marcar cerrado solo porque existe código o una variable configured.

## Secuencia de cinco días

Día 1: requisitos comerciales, historias, fuente del evento, QA inicial, corrección de defectos reproducibles y confirmación Hostinger. Día 2: entorno HTTPS de pruebas, Wompi Sandbox, correo. Día 3: compra→entrada→descarga→dos dispositivos de ingreso, reintentos y fallos. Día 4: carga acordada, restauración, soporte y aceptación del propietario. Día 5: despliegue preparado, compra real controlada por propietario, decisión de apertura y seguimiento inicial. Son objetivos sujetos a accesos y evidencias, no garantía de fecha por sí sola.

## Condiciones para abrir ventas

- Historias críticas aceptadas y cero P0/P1 abiertos.
- Pago aprobado, rechazado, pendiente, vencido y notificación repetida verificados con Wompi real de pruebas.
- Pago aprobado confirmado en servidor genera exactamente N entradas para N unidades; no hay sobreventa ni emisión por retorno de navegador.
- Correo llega al destinatario; comprador puede recuperar acceso y descargar cada entrada.
- Dos equipos validan una entrada simultáneamente: un solo ingreso; QR ajeno/anulado/repetido rechazados.
- Copia externa restaurada en entorno aislado, reinicio y reversión ensayados.
- Cuenta organizadora, personal de ingreso y soporte probados con permisos permitidos/denegados.
- Propietario confirma datos, precio final, políticas, destinatario del recaudo y prueba real.

Evidencia y defectos: plan-qa.md y qa-lanzamiento-2026-11-05.md. Publicar entorno de pruebas no habilita automáticamente ventas reales.

## Avance 6 noviembre

Web publicada en https://sharkpass.co sobre Business existente; dominio verificado, HTTPS activo y persistencia comprobada tras restart y nuevo despliegue. Check completo31/31 y exportaciones completados en copia limpia de mismas fuentes/lockfile. Se cierra el bloqueo de validación QA-ENV-01 para estas fuentes. Ver publicacion-2026-11-06.md para pruebas y pendientes comerciales.

## Superadministración — 6 noviembre

Implementados rol global independiente, panel protegido, asignación privada por UUID existente y de un solo uso, reautenticación para moderación/cierre de sesiones y auditoría. 39/39 pruebas y tipos aprobados en copia limpia; build/export aprobado. El contenedor actualizó una base de4a5migraciones conservando su registro de prueba y generando una copia verificada. Pendiente asignar la cuenta del propietario (no ha facilitado todavía su usuario). Ver superadministracion.md.
