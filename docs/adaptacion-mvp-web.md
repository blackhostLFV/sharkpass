# Adaptación visual del prototipo MVP — 29 octubre 2026

Referencia revisada: SharkPass-Codex-Diseno-MVP.zip. Se adapta la estructura al cliente web existente, sin ejecutar CODEX_PROMPT.md ni migrar el backend. Identidad confirmada: Manrope, azul #2970FF y fondo blanco. Se conserva el logo compacto vigente. Fotografías de Canva: public/media/SOURCES.md.

Implementado:
- Inicio con buscador integrado y fotografía, categorías, tarjetas, guía y CTA para organizadores.
- Filtros del catálogo existentes; la búsqueda del inicio filtra los datos y lleva al resultado.
- Detalle real con información a la izquierda y formularios de entrada a la derecha; se conservan cantidades, cupos, autenticación, idempotencia y bloqueo de pagos no configurados.
- Landing para organizadores; dashboard con contadores obtenidos de los eventos reales del usuario.
- Formulario de creación del borrador en tres pasos que conserva los campos al retroceder y valida cada sección; revisión previa a crear. Configurar entradas y publicar siguen siendo acciones separadas del backend existente.
- Estilos comunes para cuenta, entradas emitidas y formulario de acceso.

No se trasladan las ventas ficticias, simulación de pago aprobado, QR decorativo, escáner simulado ni comisión del 5% del prototipo. El checkout continúa usando Wompi y las entradas reales siguen usando los endpoints autenticados existentes. No se añaden supuestos de liquidación marketplace ni servicios nuevos.

Validación: npm run check (tipos móviles y 24 pruebas del backend) y npm run build. Revisión visual de inicio de escritorio y móvil 390×844, filtrado Sabores y apertura de su ficha, y landing de organizadores. El asistente autenticado y los contadores no se probaron manualmente con una cuenta organizadora en el navegador en esta entrega; los flujos autenticados del servidor se cubren con las pruebas existentes. No se realizaron pagos reales ni despliegues. Esta entrega modifica la web, no la app nativa.
