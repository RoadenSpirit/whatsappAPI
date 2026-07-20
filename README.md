# 📱 WhatsApp Baileys Sales API - Documentación

Esta es una API ligera construida sobre la librería **Baileys** (un cliente TypeScript de alto rendimiento para el protocolo de WhatsApp Web) ejecutada dentro de un entorno Docker optimizado ("on-the-fly").

---

## 🔒 Seguridad e Infraestructura

1. **Autenticación por API Key:**
   Todas las rutas principales (excepto la obtención de la imagen QR en navegador) requieren la cabecera `x-api-key`.
   - **Clave configurada:** `REDACTED_BAILEYS_API_KEY` (almacenada de forma segura en el archivo local `.env` del VPS).

2. **Privacidad de Sesión:**
   Las claves de cifrado y el estado de la sesión de WhatsApp se almacenan en el directorio `REDACTED_AUTH_SESSION/`. Este directorio **nunca** debe compartirse ni subirse a repositorios públicos, ya que otorga acceso total a la cuenta de WhatsApp vinculada.

3. **Sin almacenamiento de logs pesados:**
   Para conservar los recursos de tu VPS, la aplicación utiliza el logger estructurado `pino` configurado en modo `warn`. No almacena archivos de log locales ni consume espacio en disco para el registro de auditoría.

---

## 🚀 Endpoints de la API

La API escucha de manera predeterminada en el puerto `3000` de tu VPS.

### 1. Estado de la API
Verifica que el servidor de la API está levantado y respondiendo.
- **Método:** `GET`
- **Ruta:** `/health`
- **Cabecera requerida:** `x-api-key: REDACTED_BAILEYS_API_KEY`
- **Respuesta:**
  ```json
  { "status": "OK" }
  ```

### 2. Generar Código QR (Inicialización de Sesión)
Dispara la conexión interna de WhatsApp. Si no hay sesión previa activa, genera el código QR.
- **Método:** `POST`
- **Ruta:** `/auth/qr`
- **Cabecera requerida:** `x-api-key: REDACTED_BAILEYS_API_KEY`
- **Respuesta:**
  ```json
  { "message": "QR generated in console. Scan it with WhatsApp." }
  ```
  *(Al dispararse este endpoint, se genera el archivo `qr.png` en el VPS).*

### 3. Visualizar Código QR
Permite visualizar la imagen del código QR generado en el navegador de tu móvil o computadora para un escaneo rápido.
- **Método:** `GET`
- **Ruta:** `/auth/qr/image`
- **Cabecera requerida:** Ninguna (para permitir el acceso directo en navegadores).
- **Enlace directo en VPS:** `http://<IP_DE_TU_VPS>:3000/auth/qr/image`

### 4. Enviar Mensaje de Texto
Envía un mensaje a un número individual o a un grupo.
- **Método:** `POST`
- **Ruta:** `/send`
- **Cabecera requerida:**
  - `x-api-key: REDACTED_BAILEYS_API_KEY`
  - `Content-Type: application/json`
- **Cuerpo (JSON):**
  ```json
  {
    "chatId": "REDACTED_WHATSAPP_JID_1",
    "message": "Mensaje de prueba"
  }
  ```
  *(El `chatId` para chats individuales debe tener el formato `[NúmeroSinSigno+]@s.whatsapp.net`).*
- **Respuesta:**
  ```json
  { "status": "sent" }
  ```

### 5. Enviar Archivos Multimedia (Imágenes, ZIP, PDF, etc.)
Permite enviar archivos mediante dos métodos opcionales (Multipart Upload o URL de descarga).
- **Método:** `POST`
- **Ruta:** `/send-file`
- **Cabecera requerida:**
  - `x-api-key: REDACTED_BAILEYS_API_KEY`

#### Modalidad A: Mediante URL de descarga (JSON)
- **Content-Type:** `application/json`
- **Cuerpo (JSON):**
  ```json
  {
    "chatId": "REDACTED_WHATSAPP_JID_1",
    "fileUrl": "https://url-publica.com/imagen.jpg",
    "fileName": "opcional_nombre.jpg",
    "caption": "Texto opcional que acompaña al archivo"
  }
  ```

#### Modalidad B: Carga directa de archivo binario (Multipart Form-Data)
- **Content-Type:** `multipart/form-data`
- **Cuerpo (Form-Data):**
  - `chatId` (text): `REDACTED_WHATSAPP_JID_1`
  - `file` (file): *archivo binario cargado (imágenes, PDFs, ZIPs, etc.)*
  - `fileName` (text, opcional): `archivo.zip`
  - `caption` (text, opcional): `Texto descriptivo`

- **Respuesta:**
  ```json
  { "status": "sent" }
  ```

### 6. Listar Grupos Activos
Devuelve una lista de los IDs de los grupos en los que participa la cuenta vinculada (disponible una vez completada la sincronización inicial de la cuenta).
- **Método:** `GET`
- **Ruta:** `/groups`
- **Cabecera requerida:** `x-api-key: REDACTED_BAILEYS_API_KEY`

### 7. Listar Contactos Recientes
Devuelve los identificadores de chats de los contactos recientes.
- **Método:** `GET`
- **Ruta:** `/contacts`
- **Cabecera requerida:** `x-api-key: REDACTED_BAILEYS_API_KEY`

---

## 🛠️ Comandos de Administración del Contenedor

Para administrar el servicio desde la terminal del VPS usando tu usuario `carmay-dev` (sin `sudo`):

* **Ver estado del contenedor:**
  ```bash
  docker ps -f name=baileys-sales-api
  ```
* **Reiniciar el servicio:**
  ```bash
  docker restart baileys-sales-api
  ```
* **Ver logs de arranque y compilación:**
  ```bash
  docker logs baileys-sales-api
  ```
