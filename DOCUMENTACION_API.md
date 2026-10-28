# Documentación Completa de la API de WhatsApp (Baileys Wrapper)

Esta API proporciona una interfaz HTTP REST sobre la biblioteca Baileys (cliente WebSocket de protocolo binario Noise/Protobuf para WhatsApp Web).

---

## 1. Configuración General y Autenticación

- **Base URL:** `http://localhost:3000` (o `http://REDACTED_INTERNAL_IP_3000` en red Docker inter-contenedor).
- **Autenticación (API Key):** 
  - Todas las peticiones requieren validación mediante una clave secreta configurada en la variable de entorno `API_KEY`.
  - Puede enviarse de dos formas:
    1. **Header HTTP:** `x-api-key: <API_KEY>`
    2. **Query Parameter:** `?key=<API_KEY>`
  - En caso de clave inválida o ausente, la API responderá con estado `401 Unauthorized`:
    ```json
    {
      "error": "Invalid API key"
    }
    ```

---

## 2. Endpoints Configurados

### 2.1 Health Check

#### `GET /health`
Verifica el estado de disponibilidad básica de la API web Express.

- **Headers:** `x-api-key: <API_KEY>`
- **Respuesta de Éxito (`200 OK`):**
  ```json
  {
    "status": "OK"
  }
  ```

---

### 2.2 Gestión de Sesión y Autenticación QR

#### `GET /auth/qr/status`
Consulta el estado de conexión del socket de WhatsApp y la disponibilidad del código QR.

- **Headers:** `x-api-key: <API_KEY>`
- **Respuesta de Éxito (`200 OK`):**
  ```json
  {
    "status": "open",
    "user": {
      "id": "REDACTED_PHONE_1:42@s.whatsapp.net",
      "name": "Nombre Usuario"
    },
    "hasQr": false,
    "qr": null
  }
  ```
  *Valores de `status`:* `'connecting'` | `'open'` | `'close'`

---

#### `POST /auth/qr`
Fuerza la inicialización del socket de Baileys para la generación del código QR en caso de no haber una sesión activa.

- **Headers:** `x-api-key: <API_KEY>`
- **Respuesta de Éxito (`200 OK`):**
  ```json
  {
    "message": "QR generated in console. Scan it with WhatsApp.",
    "status": "connecting",
    "user": null,
    "hasQr": true,
    "qr": "2@41XYZ..."
  }
  ```

---

#### `POST /auth/reset`
Reinicia completamente la sesión actual. Cierra el socket activo, crea un respaldo del directorio `REDACTED_AUTH_SESSION` (con timestamp) y regenera un nuevo par de claves/QR.

- **Headers:** `x-api-key: <API_KEY>`
- **Respuesta de Éxito (`200 OK`):**
  ```json
  {
    "status": "ok",
    "message": "Sesión reseteada y nuevo QR en proceso de generación."
  }
  ```
- **Respuesta de Error (`500 Internal Server Error`):**
  ```json
  {
    "error": "Descripción del error"
  }
  ```

---

#### `GET /auth/qr/image`
Obtiene el código QR actual formateado como una imagen PNG lista para ser visualizada o incrustada.

- **Query Params:** `?key=<API_KEY>` o Header `x-api-key`
- **Respuesta (`200 OK`):**
  - `Content-Type: image/png`
  - Devuelve el buffer binario de la imagen del código QR (350x350px).

---

#### `GET /auth/qr/view`
Interfaz web interactiva (HTML/CSS oscuro responsivo) para monitorear el estado de la conexión en tiempo real y escanear el QR desde el navegador.

- **Query Params:** `?key=<API_KEY>`
- **Respuesta (`200 OK`):**
  - `Content-Type: text/html`
  - Incluye refresco automático del QR/Estado cada 2.5 segundos y botón para resetear la sesión.

---

### 2.3 Mensajería y Envíos

#### `POST /send`
Envía un mensaje de texto simple a un usuario o grupo de WhatsApp.

- **Headers:** 
  - `x-api-key: <API_KEY>`
  - `Content-Type: application/json`
- **Cuerpo de la Petición (JSON):**
  ```json
  {
    "chatId": "REDACTED_WHATSAPP_JID_1",
    "message": "Hola, este es un mensaje de prueba."
  }
  ```
  *Nota sobre `chatId`:* Acepta JIDs completos (`REDACTED_WHATSAPP_JID_1`), JIDs de grupo (`120363425558134480@g.us`), o números de teléfono formateados (`REDACTED_PHONE_1` o `REDACTED_PHONE_1@c.us`), los cuales se normalizan automáticamente a `@s.whatsapp.net`.
- **Respuesta de Éxito (`200 OK`):**
  ```json
  {
    "status": "sent"
  }
  ```
- **Errores:**
  - `400 Bad Request`: Si falta `chatId` o `message`.
  - `500 Internal Server Error`: En caso de fallo en el socket o formateo.

---

#### `POST /send-file`
Envía archivos multimedia (imágenes, videos, audios o documentos) a un chat o grupo. Soporta carga directa via `multipart/form-data` o descarga remota via URL.

- **Headers:** `x-api-key: <API_KEY>`
- **Tamaño Máximo Permitido:** 50 MB.

##### Modo A: Carga Directa (Multipart / Form Data)
- **Form Fields:**
  - `chatId` (string, requerido): ID o número de destino.
  - `file` (binary, requerido): Archivo adjunto.
  - `fileName` (string, opcional): Nombre personalizado para el archivo.
  - `caption` (string, opcional): Texto o leyenda del mensaje.

##### Modo B: Envió por URL (JSON Body)
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "chatId": "REDACTED_WHATSAPP_JID_1",
    "fileUrl": "https://ejemplo.com/archivo.pdf",
    "fileName": "documento.pdf",
    "caption": "Adjunto el reporte en PDF."
  }
  ```

##### Clasificación Automática de Tipo de Medio (`getMediaType`):
- `image/*` -> Se envía como mensaje de tipo Imagen.
- `video/*` -> Se envía como mensaje de tipo Video.
- `audio/*` -> Se envía como mensaje de tipo Audio.
- Cualquier otro mime (ej: `application/zip`, `application/pdf`) -> Se envía como Documento con `fileName` y `caption`.

- **Respuesta de Éxito (`200 OK`):**
  ```json
  {
    "status": "sent"
  }
  ```

---

### 2.4 Información de Cuenta y Contactos

#### `GET /groups`
Lista los grupos de WhatsApp en los que la cuenta conectada es participante active.

- **Headers:** `x-api-key: <API_KEY>`
- **Respuesta de Éxito (`200 OK`):**
  ```json
  {
    "groups": [
      {
        "id": "120363425558134480@g.us",
        "subject": "Carmay Feedback Post"
      }
    ]
  }
  ```

---

#### `GET /contacts`
Devuelve la lista de JIDs de contactos almacenados en la memoria del socket.

- **Headers:** `x-api-key: <API_KEY>`
- **Respuesta de Éxito (`200 OK`):**
  ```json
  {
    "contacts": [
      "REDACTED_WHATSAPP_JID_1"
    ]
  }
  ```

---

## 3. Webhooks y Procesamiento de Mensajes Entrantes

En `src/whatsapp.ts`, la API escucha el evento `messages.upsert` de Baileys en tiempo real:

1. **Filtro de Mensajes:** Solo se procesan mensajes con `type === 'notify'` y `!msg.key.fromMe` (mensajes recibidos de otros usuarios).
2. **Descarga de Imágenes:** Si el mensaje contiene una imagen (`imageMessage`), se descarga automáticamente al directorio `/app/downloads/` del contenedor.
3. **Reenvío a Webhook (n8n):** Si está configurada la variable `WEBHOOK_URL` en el archivo `.env`, se reenvía un `POST` JSON a la URL indicada con el header `x-api-key`:
   ```json
   {
     "chatId": "REDACTED_WHATSAPP_JID_1",
     "senderName": "Nombre Remitente",
     "message": "Texto del mensaje",
     "imagePath": "/home/carmay-dev/proyectos/whatsappAPI/downloads/<id>.jpg",
     "raw": { ... }
   }
   ```
4. **Auto-respuesta de Prueba:** Si el mensaje es exactamente "hola" (case-insensitive), responde automáticamente "como estas".

---

## 4. Resumen de Rutas de la API

| Método | Endpoint | Descripción | Formato Entrada |
|---|---|---|---|
| `GET` | `/health` | Chequeo de salud | - |
| `GET` | `/auth/qr/status` | Estado de la sesión y QR raw | - |
| `POST` | `/auth/qr` | Inicializar socket y generar QR | - |
| `POST` | `/auth/reset` | Reiniciar sesión y regenerar credenciales | - |
| `GET` | `/auth/qr/image` | Obtener código QR en formato PNG | - |
| `GET` | `/auth/qr/view` | Vista HTML interactiva de autenticación | - |
| `POST` | `/send` | Envío de mensajes de texto | JSON (`chatId`, `message`) |
| `POST` | `/send-file` | Envío de multimedia/archivos por multipart o URL | Multipart o JSON (`chatId`, `fileUrl`/`file`) |
| `GET` | `/groups` | Listar grupos participantes | - |
| `GET` | `/contacts` | Listar JIDs de contactos conocidos | - |
