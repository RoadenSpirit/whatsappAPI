import express, { type Request, type Response, type NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import multer from 'multer'
import qrcode from 'qrcode'
import { sendMessage, listGroups, listContacts, getGroupParticipants, getWASocket, getWAStatus, resetWASession, sendWASocketFile, sendWASocketFileByUrl } from './whatsapp'

const app = express()
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } })
app.use(express.json())
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors())

const API_KEY = process.env.API_KEY || 'CHANGE_ME'

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header('x-api-key') || req.query.key
  if (key !== API_KEY) {
    res.status(401).json({ error: 'Invalid API key' })
    return
  }
  next()
}

app.use(requireApiKey)

app.get('/auth/qr/status', (_: Request, res: Response) => {
  res.json(getWAStatus())
})

app.post('/auth/qr', async (_: Request, res: Response) => {
  await getWASocket()
  res.json({ message: 'QR generated in console. Scan it with WhatsApp.', ...getWAStatus() })
})

app.post('/auth/reset', async (_: Request, res: Response) => {
  try {
    await resetWASession()
    res.json({ status: 'ok', message: 'Sesión reseteada y nuevo QR en proceso de generación.' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/auth/qr/image', async (req: Request, res: Response) => {
  const status = getWAStatus()
  if (status.qr) {
    try {
      const buffer = await qrcode.toBuffer(status.qr, { width: 350, margin: 2 })
      res.type('image/png').send(buffer)
      return
    } catch (e) {}
  }
  res.sendFile('/app/qr.png')
})

app.get('/auth/qr/view', (req: Request, res: Response) => {
  const key = (req.query.key || '').toString()
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp QR Live - Carmay</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #121b22; color: #e9edef; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
    .card { background: #1f2c34; border-radius: 16px; padding: 32px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #2a3942; }
    h1 { font-size: 24px; margin-bottom: 8px; color: #00a884; }
    p.subtitle { font-size: 14px; color: #8696a0; margin-bottom: 24px; }
    .qr-container { background: #ffffff; border-radius: 12px; padding: 16px; display: inline-block; margin-bottom: 24px; min-width: 280px; min-height: 280px; display: flex; align-items: center; justify-content: center; position: relative; }
    .qr-container img { width: 280px; height: 280px; object-fit: contain; display: block; }
    .status-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin-bottom: 20px; }
    .status-connecting { background: #3b2a0c; color: #f5a623; }
    .status-open { background: #0c3322; color: #00a884; }
    .status-close { background: #3b1414; color: #ea4335; }
    .btn { background: #00a884; color: #ffffff; border: none; padding: 12px 24px; font-size: 15px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: all 0.2s; width: 100%; margin-top: 10px; }
    .btn:hover { background: #06cf9c; }
    .btn-secondary { background: #374248; color: #e9edef; margin-top: 12px; }
    .btn-secondary:hover { background: #4a575e; }
    .pulse { animation: pulse 1.5s infinite; }
    @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
    .user-info { font-size: 15px; color: #e9edef; background: #2a3942; padding: 12px; border-radius: 8px; margin-bottom: 20px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>WhatsApp Carmay API</h1>
    <p class="subtitle">Escanea el código QR desde WhatsApp &gt; Dispositivos vinculados</p>
    <div id="statusContainer">
      <div class="status-badge status-connecting"><span class="pulse">●</span> Verificando estado...</div>
    </div>
    <div class="qr-container" id="qrBox">
      <img id="qrImg" src="./image?key=${key}&t=" + Date.now() alt="Código QR WhatsApp" />
    </div>
    <div id="userContainer" style="display: none;"></div>
    <button class="btn" onclick="fetchStatus()">🔄 Refrescar Estado</button>
    <button class="btn btn-secondary" onclick="resetSession()">⚠️ Forzar Nuevo QR (Reset)</button>
  </div>

  <script>
    const key = "${key}";
    let lastQrHash = "";

    async function fetchStatus() {
      try {
        const res = await fetch("./status?key=" + encodeURIComponent(key));
        if (!res.ok) throw new Error("Error HTTP " + res.status);
        const data = await res.json();
        
        const statusEl = document.getElementById("statusContainer");
        const qrBox = document.getElementById("qrBox");
        const qrImg = document.getElementById("qrImg");
        const userEl = document.getElementById("userContainer");

        if (data.status === "open") {
          statusEl.innerHTML = '<div class="status-badge status-open">● Conectado a WhatsApp</div>';
          qrBox.style.display = "none";
          userEl.style.display = "block";
          userEl.innerHTML = '<div class="user-info"><b>Dispositivo Vinculado:</b><br>' + (data.user?.name || data.user?.id || 'Sesión Activa') + '</div>';
        } else if (data.hasQr) {
          statusEl.innerHTML = '<div class="status-badge status-connecting"><span class="pulse">●</span> Listo para escanear</div>';
          qrBox.style.display = "flex";
          userEl.style.display = "none";
          if (data.qr !== lastQrHash) {
            lastQrHash = data.qr;
            qrImg.src = "./image?key=" + encodeURIComponent(key) + "&t=" + Date.now();
          }
        } else {
          statusEl.innerHTML = '<div class="status-badge status-close">● Desconectado / Esperando QR...</div>';
          qrBox.style.display = "flex";
          userEl.style.display = "none";
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function resetSession() {
      if (!confirm("¿Deseas reiniciar la sesión y generar un nuevo código QR limpio?")) return;
      document.getElementById("statusContainer").innerHTML = '<div class="status-badge status-connecting"><span class="pulse">●</span> Reiniciando sesión...</div>';
      try {
        const res = await fetch("../reset?key=" + encodeURIComponent(key), { method: "POST" });
        const data = await res.json();
        setTimeout(fetchStatus, 1500);
      } catch (e) {
        alert("Error al reiniciar: " + e.message);
      }
    }

    setInterval(fetchStatus, 2500);
    fetchStatus();
  </script>
</body>
</html>`
  res.send(html)
})

app.post('/send-file', upload.single('file'), async (req: Request, res: Response) => {
  const { chatId, fileUrl, fileName, caption } = req.body
  
  if (!chatId) {
    res.status(400).json({ error: 'chatId is required' })
    return
  }

  try {
    if (req.file) {
      const name = fileName || req.file.originalname
      const mime = req.file.mimetype
      await sendWASocketFile(chatId, req.file.buffer, name, mime, caption)
      res.json({ status: 'sent' })
      return
    }

    if (fileUrl) {
      const name = fileName || fileUrl.split('/').pop() || 'file'
      await sendWASocketFileByUrl(chatId, fileUrl, name, caption)
      res.json({ status: 'sent' })
      return
    }

    res.status(400).json({ error: 'Either file upload or fileUrl is required' })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to send file' })
  }
})

app.post('/send', async (req: Request, res: Response) => {
  const { chatId, message } = req.body
  if (!chatId || !message) {
    res.status(400).json({ error: 'chatId & message required' })
    return
  }
  try {
    await sendMessage(chatId, message)
    res.json({ status: 'sent' })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/groups', async (_: Request, res: Response) => {
  try {
    const groups = await listGroups()
    res.json({ groups })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/groups/:id/participants', async (req: Request, res: Response) => {
  try {
    res.json(await getGroupParticipants(String(req.params.id)))
  } catch (e: any) {
    res.status(e.statusCode === 400 ? 400 : 500).json({ error: e.message })
  }
})

app.get('/contacts', async (_: Request, res: Response) => {
  try {
    const contacts = await listContacts()
    res.json({ contacts })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/health', (_: Request, res: Response) => {
  res.json({ status: 'OK' })
})


const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  console.log(`⚡️ Baileys API listening on http://localhost:${PORT}`)
  try {
    console.log('🔄 Inicializando la conexión de WhatsApp...')
    await getWASocket()
  } catch (err: any) {
    console.error('❌ Error al inicializar el socket de WhatsApp:', err.message)
  }
})
