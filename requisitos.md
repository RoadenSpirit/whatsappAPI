# Requisitos y planificación del proyecto

## Estado actual (2026-07-02)
- **Migración de Green API Completada:** Todos los flujos activos de n8n en producción han sido redirigidos a la API local de Baileys de forma segura.
- **Soporte Multimedia Implementado:** Se añadió el endpoint `/send-file` que permite el envío de imágenes y archivos binarios comprimidos (ZIP) por carga directa (Multipart) y por URL.
- **Compilación de Dependencias Nativas en Alpine:** Instalada la biblioteca `libc6-compat` en el contenedor Alpine y reconstruido el módulo nativo `sharp` para procesar y adjuntar miniaturas legítimas a las imágenes de forma local.
- **Despliegue y Permisos:** API corriendo en contenedor Docker (`node:20-alpine`) en el puerto 3000 de forma aislada, utilizando volúmenes locales. Operado bajo el usuario `carmay-dev` sin `sudo`.
- **Sesión Activa:** La sesión de WhatsApp de trabajo está vinculada correctamente y almacenada de forma persistente en `REDACTED_AUTH_SESSION/`.
- **API Key Segura:** Validaciones activadas en todas las llamadas entrantes usando la clave configurada en `API_KEY`.
- **Monitoreo de Mensajes Entrantes (Nuevo):** Implementado el evento `messages.upsert` en `whatsapp.ts` para detectar mensajes entrantes en tiempo real. Configurada una respuesta automática instantánea de saludo ("¡Hola!") y el reenvío a la variable `WEBHOOK_URL` de n8n si se encuentra configurada en el `.env`.
- **Persistencia de Docker:** Actualizada la política de reinicio del contenedor `baileys-sales-api` a `--restart unless-stopped` para garantizar que inicie automáticamente cuando se reinicie el servidor VPS.

## Detalle de Flujos n8n Migrados
1. **Robot WhatsApp (Queue Worker) (`cVilQNdXYZAUH10M`):**
   - **Nativo (Envío de imágenes):** Redirigido a `/send-file` local con la clave API.
   - **Lotes ZIP (Envío de ZIP):** Redirigido a `/send-file` local con la clave API.
   - **¿Envío Exitoso? (IF):** Corregida la condición obsoleta del operador exists a una igualdad binaria limpia que verifica el estado `status === 'sent'` devuelto por la API local.
2. **Carmay Batch: Producción Real (`6FHeLxLFNFDoYyoh`):**
   - **Notificaciones (Inicio, Error Diseño, Error Subida):** Redirigido a `/send` local.
   - **Corrección de Red y Conectividad:** Se actualizaron las URLs locales de `localhost:3000` a `REDACTED_INTERNAL_IP_3000` para resolver los fallos de red inter-contenedor (ECONNREFUSED) dentro de Docker.
   - **Corrección de Sintaxis de Expresiones (ExpressionExtensionError):** Se corrigieron las comillas mal escapadas (`\\\\'`) y se removieron los operadores de encadenamiento opcional (`?.`), incompatibles con el parser de expresiones de n8n, sustituyéndolos por validaciones lógicas estándar de Javascript.

## Planificación de seguridad y mejores prácticas
1. **Rotación de API Key:** Cambiar `API_KEY` en el archivo `.env` en caso de sospecha de filtración.
2. **Protección de puertos:** Asegurar que el puerto 3000 del VPS solo responda a IPs autorizadas mediante el Firewall del VPS (o mantenerlo accesible localmente).
3. **Resguardo de credenciales:** El directorio `REDACTED_AUTH_SESSION` contiene las claves criptográficas de la sesión de WhatsApp; nunca debe ser compartido ni subido a repositorios públicos.

## Pendientes / Próximos pasos
- [x] Implementar un webhook/evento en `whatsapp.ts` para capturar y notificar eventos de mensajes entrantes.
- [x] Normalizar JIDs en la API y webhook para priorizar el JID telefónico (`remoteJidAlt`) sobre LIDs y garantizar la entrega.
- [x] Eliminar toda relación con el número de Alejandro en filtros y reportes, centralizando toda comunicación en Álvaro (`REDACTED_PHONE_1`).
- [x] Corregir la URL local del conector de `http://localhost:3000/send-file` a `http://REDACTED_INTERNAL_IP_3000/send-file` en el flujo de envío de fotos (`cVilQNdXYZAUH10M`) para permitir la comunicación inter-contenedor.
- [x] Redirigir el chat de destino de las imágenes en la cola al grupo "Carmay Feedback Post" (`120363425558134480@g.us`).
- [x] Corregir bug del loop infinito en los nodos de Google Sheets del Queue Worker (`cVilQNdXYZAUH10M`) sustituyendo expresiones obsoletas por la propiedad `.context.currentRunIndex` de n8n para resolver con precisión el producto actual del bucle, manteniendo el estado de fallo como `SALTADO` para evitar textos extensos según preferencia del usuario.
- [x] Evaluar y configurar el Queue Worker para que tome el estado `SALTADO` como si fuese `PENDIENTE` en cada nueva ejecución, garantizando reintentos en futuras corridas.
- [ ] Opcionalmente, agregar una cola de mensajes en memoria para mitigar límites de envío y evitar bloqueos por parte de WhatsApp.
- [ ] Evaluar integraciones con modelos de lenguaje (LLM) o almacenamiento de logs ligero en memoria si el VPS lo permite.




## Características Completadas
- [x] Documentación completa de la API Baileys (Endpoints, autenticación, payloads y webhooks).

## Características Pendientes
- [ ] Implementar el paquete `auto skills` de `midu dev`.
