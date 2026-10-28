import makeWASocket, { DisconnectReason, useMultiFileAuthState, type AnyMessageContent, downloadMediaMessage } from './index'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import qrcodeTerminal from 'qrcode-terminal'
import qrcode from 'qrcode'
import { writeFileSync } from 'fs'
import axios from 'axios'

const logger = pino({ level: 'info' })
let sock: any = undefined
let currentQR: string | null = null
let connectionStatus: 'connecting' | 'open' | 'close' = 'close'
let connectedUser: any = null

export function getWAStatus() {
  return {
    status: connectionStatus,
    user: connectedUser,
    hasQr: !!currentQR,
    qr: currentQR
  }
}

export async function resetWASession() {
  try {
    if (sock) {
      try {
        sock.end(new Error('Session reset requested'))
      } catch (e) {}
      sock = undefined
    }
    currentQR = null
    connectionStatus = 'close'
    connectedUser = null

    // Respaldar y limpiar REDACTED_AUTH_SESSION
    const fs = await import('fs')
    const path = await import('path')
    const authDir = path.resolve('REDACTED_AUTH_SESSION')
    if (fs.existsSync(authDir)) {
      const backupDir = path.resolve(`REDACTED_AUTH_SESSION_backup_${Date.now()}`)
      fs.renameSync(authDir, backupDir)
      console.log(`📦 Directorio REDACTED_AUTH_SESSION respaldado en: ${backupDir}`)
    }

    // Volver a iniciar socket
    return await getWASocket()
  } catch (err: any) {
    console.error('❌ Error al reiniciar sesión de WhatsApp:', err.message)
    throw err
  }
}

export function formatJid(jid: string): string {
  if (!jid) return jid
  let formatted = jid.trim()
  if (formatted.endsWith('@c.us')) {
    formatted = formatted.replace('@c.us', '@s.whatsapp.net')
  }
  if (!formatted.includes('@')) {
    formatted = `${formatted}@s.whatsapp.net`
  }
  return formatted
}

// Helper function to detect if mime type belongs to image, document, etc.
function getMediaType(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}

export async function sendWASocketFile(
  chatId: string,
  fileContent: Buffer,
  fileName: string,
  mimeType: string,
  caption?: string
) {
  const socket = await getWASocket()
  const mediaType = getMediaType(mimeType)

  const messagePayload: any = {}
  if (mediaType === 'image') {
    messagePayload.image = fileContent
    if (caption) messagePayload.caption = caption
  } else if (mediaType === 'video') {
    messagePayload.video = fileContent
    if (caption) messagePayload.caption = caption
  } else if (mediaType === 'audio') {
    messagePayload.audio = fileContent
    messagePayload.mimetype = mimeType
  } else {
    messagePayload.document = fileContent
    messagePayload.mimetype = mimeType
    messagePayload.fileName = fileName
    if (caption) messagePayload.caption = caption
  }

  const formattedChatId = formatJid(chatId)
  return await socket.sendMessage(formattedChatId, messagePayload)
}

export async function sendWASocketFileByUrl(
  chatId: string,
  url: string,
  fileName: string,
  caption?: string
) {
  const response = await axios.get(url, { responseType: 'arraybuffer' })
  const buffer = Buffer.from(response.data)
  
  let mimeType = 'application/octet-stream'
  const contentType = response.headers['content-type']
  if (typeof contentType === 'string') {
    mimeType = contentType
  } else if (Array.isArray(contentType) && contentType[0]) {
    mimeType = contentType[0]
  }

  return await sendWASocketFile(chatId, buffer, fileName, mimeType, caption)
}

export async function getWASocket() {
  if (sock) return sock

  const { state, saveCreds } = await useMultiFileAuthState('REDACTED_AUTH_SESSION')

  sock = makeWASocket({
    auth: state,
    logger,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      currentQR = qr
      connectionStatus = 'connecting'
      // Intentar renderizar con caracteres grandes en la consola por si acaso
      qrcodeTerminal.generate(qr, { small: false })
      
      try {
        // Guardar como imagen PNG en la carpeta raíz
        const buffer = await qrcode.toBuffer(qr)
        writeFileSync('qr.png', buffer)
        console.log('📌 Imagen QR guardada como qr.png en la carpeta raíz del proyecto.')
      } catch (err) {
        logger.error(err, 'Error generando imagen QR')
      }
    }

    if (connection === 'open') {
      connectionStatus = 'open'
      connectedUser = sock.user
      currentQR = null
      console.log('✅ Conexión de WhatsApp abierta correctamente!')
      console.log('👤 Usuario conectado:', sock.user)
    }

    if (connection === 'close') {
      connectionStatus = 'close'
      connectedUser = null
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
      logger.info({ shouldReconnect }, 'Connection closed, reconnecting...')
      sock = undefined
      if (shouldReconnect) getWASocket()
    }
  })

  // Escuchar todos los mensajes entrantes en tiempo real
  sock.ev.on('messages.upsert', async (upsert: any) => {
    // Solo procesamos mensajes de tipo notificación (recibidos de la red)
    if (upsert.type !== 'notify') return

    for (const msg of upsert.messages) {
      // Ignorar mensajes enviados por nosotros mismos para evitar bucles
      if (!msg.key.fromMe) {
        let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
        let imagePath = ''

        // Si es una imagen, extraemos el caption y la descargamos a disco
        if (msg.message?.imageMessage) {
          text = msg.message.imageMessage.caption || ''
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {})
            const downloadsDir = '/app/downloads'
            const hostDownloadsDir = '/home/carmay-dev/proyectos/whatsappAPI/downloads'
            const fs = await import('fs')
            if (!fs.existsSync(downloadsDir)) {
              fs.mkdirSync(downloadsDir, { recursive: true })
            }
            const fileName = `${msg.key.id}.jpg`
            const localPath = `${downloadsDir}/${fileName}`
            fs.writeFileSync(localPath, buffer)
            imagePath = `${hostDownloadsDir}/${fileName}`
            console.log(`📸 Imagen de WhatsApp descargada con éxito en: ${localPath} (Host path: ${imagePath})`)
          } catch (err: any) {
            console.error('❌ Error al descargar imagen de WhatsApp:', err.message)
          }
        }
        
        if (text || imagePath) {
          // Si el JID tiene un alternativo (ej. LID -> PN), preferimos el alternativo
          const remoteJid = msg.key.remoteJidAlt || msg.key.remoteJid
          console.log(`📩 Mensaje recibido de ${remoteJid}: "${text || '[Imagen sin texto]'}"`)

          // 1. Reenviar a un Webhook de n8n si está configurado en el .env
          const webhookUrl = process.env.WEBHOOK_URL
          if (webhookUrl) {
            try {
              await axios.post(webhookUrl, {
                chatId: remoteJid,
                senderName: msg.pushName || 'Contacto',
                message: text || '',
                imagePath: imagePath,
                raw: msg
              }, {
                headers: { 
                  'Content-Type': 'application/json',
                  'x-api-key': process.env.API_KEY || ''
                }
              })
            } catch (err: any) {
              console.error('❌ Error al enviar evento al Webhook de n8n:', err.message)
            }
          }

          // 2. Respuesta automática en caliente al detectar "hola"
          const cleanText = text.toLowerCase().trim()
          if (cleanText === 'hola') {
            try {
              await sendMessage(remoteJid!, 'como estas')
              console.log(`📤 Respuesta automática enviada con éxito a ${remoteJid}`)
            } catch (err: any) {
              console.error(`❌ Error al enviar respuesta automática a ${remoteJid}:`, err.message)
            }
          }
        }
      }
    }
  })

  return sock
}

export async function sendMessage(chatId: string, text: string): Promise<void> {
  const socket = await getWASocket()
  const formattedChatId = formatJid(chatId)
  const msg: AnyMessageContent = { text }
  await socket.sendMessage(formattedChatId, msg)
}

export async function listGroups(): Promise<any[]> {
  const socket = await getWASocket()
  if (typeof socket.groupFetchAllParticipating === 'function') {
    const groups = await socket.groupFetchAllParticipating()
    return Object.values(groups).map((g: any) => ({
      id: g.id,
      subject: g.subject
    }))
  }
  return []
}

export async function getGroupParticipants(groupId: string) {
  if (!groupId.endsWith('@g.us')) {
    throw Object.assign(new Error('groupId must end with @g.us'), { statusCode: 400 })
  }
  const socket = await getWASocket()
  const meta = await socket.groupMetadata(groupId)
  return {
    id: meta.id,
    subject: meta.subject,
    addressingMode: meta.addressingMode,
    size: meta.size,
    participants: meta.participants.map((p: any) => ({
      id: p.id,
      phoneNumber: p.phoneNumber ?? null,
      lid: p.lid ?? null,
      admin: p.admin ?? null
    }))
  }
}

export async function listContacts(): Promise<string[]> {
  const socket = await getWASocket()
  const contacts = Object.keys(socket.contacts || {})
  return contacts
}
