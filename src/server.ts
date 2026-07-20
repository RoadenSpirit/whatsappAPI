import express, { type Request, type Response, type NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import multer from 'multer'
import { sendMessage, listGroups, listContacts, getWASocket, sendWASocketFile, sendWASocketFileByUrl } from './whatsapp'

const app = express()
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } })
app.use(express.json())
app.use(helmet())
app.use(cors())

const API_KEY = process.env.API_KEY || 'CHANGE_ME'

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header('x-api-key')
  if (key !== API_KEY) {
    res.status(401).json({ error: 'Invalid API key' })
    return
  }
  next()
}

app.use(requireApiKey)

app.post('/auth/qr', async (_: Request, res: Response) => {
  await getWASocket()
  res.json({ message: 'QR generated in console. Scan it with WhatsApp.' })
})

app.get('/auth/qr/image', (_: Request, res: Response) => {
  res.sendFile('/home/carmay-dev/proyectos/whatsappAPI/qr.png')
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
