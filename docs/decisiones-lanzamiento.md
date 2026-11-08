# Decisiones y dependencias del propietario

5 de noviembre de 2026.

## Confirmado por el propietario

- La plataforma es SharkPass; el primer evento es el publicado en https://www.sharkcaribe.co/.
- Publicar en Hostinger; hay sesión autenticada de hPanel, verificada en esta tarea. Esto no acredita que ya esté desplegada la ticketera.
- El propietario configurará Wompi en privado. No pedir claves por chat ni guardar secretos en Git.
- La operación de ingreso debe ser sencilla, con tablet o teléfonos. Recomendación inicial: dos teléfonos (principal/respaldo) y conexión de respaldo, sujetos al ensayo real de cámara. Una tablet fija con lector QR 2D conectado también es posible tras comprobar compatibilidad.
- Registro de compradores ya existe. Se prueba; no es un desarrollo desde cero.

## Datos recuperados de fuente pública

Fuente: https://www.sharkcaribe.co/, HTML y bundle de esa página consultados el 5 de noviembre. Primer evento Pitch Competition by Shark Caribe, 25/11/2026, 15:00–21:45, Hotel Dann Carlton, Salón Los Laureles, Calle98No52B-10, Riomar, Barranquilla. Publica GeneralCOP50.000 y PreferencialCOP79.900. Estos datos se guardan en content/pitch-competition.json; no crean ni publican un evento de base de datos.

La mención promocional a más de300asistentes no es un cupo autorizado. No convertirla en inventario. Confirmar si los precios incluyen cargos y siguen vigentes para venta por SharkPass.

## Aún necesarios

| Decisión | Responsable | Motivo |
|---|---|---|
| Cupos General/Preferencial y total autorizado | Propietario | Sin inventario confirmado no se habilitan ventas |
| Dominio/subdominio de SharkPass | Propietario/Operaciones | DNS, HTTPS, retorno y webhook; no sobreescribir sitio SharkCaribe |
| Remitente de entradas/soporte y proveedor de correo | Propietario | Entrega y recuperación verificables |
| Política de transferencias/nominación, reingreso y cancelación | Propietario | Presentar reglas antes de pagar; actual permite un único ingreso |
| Cuenta receptora Wompi y precio final/cargos | Propietario | Conciliación comercial y compra real |
| Pico esperado de compras, puertas y dispositivos disponibles | Propietario/QA | Prueba de carga y ensayo físico |
| Encargado de incidencias y devolución | Propietario | Pago tardío/sin entrada, email no recibido y soporte de puerta |

## Infraestructura

Plan Node disponible en Hostinger verificado por Operaciones; falta comprobar persistencia SQLite, proceso en ejecución, proxy, copias y compatibilidad de runtime antes de publicar. El repositorio actual usa una sola instancia SQLite, no una base independiente por réplica. No contratar VPS ni cambiar stack sin demostrar necesidad y acordar coste.

## Actualización 6/11: nueva cuenta

Propietario aclara que se usará una cuenta nueva de Hostinger, autenticada mediante `hostinger-sharkpass`. Dominio sharkpass.co activo confirmado por API. No hay hosting web, Agency o VPS accesible en esta cuenta; la suscripción de correo no sustituye el alojamiento. Dominio ya identificado; ejecución y persistencia pendientes de un plan disponible.
