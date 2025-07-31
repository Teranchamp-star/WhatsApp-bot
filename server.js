const express = require('express')
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

let sock = null
let isConnected = false
let currentCode = null
let groupList = []

app.get('/code', async (req, res) => {
  const phone = req.query.phone?.replace(/\D/g, '')
  if (!phone) return res.status(400).json({ error: 'Missing or invalid phone number' })

  try {
    const { state, saveCreds } = await useMultiFileAuthState(`auth/${phone}`)
    sock = makeWASocket({ auth: state, printQRInTerminal: false })

    const code = await sock.requestPairingCode(phone)
    currentCode = code

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async ({ connection }) => {
      if (connection === 'open') {
        isConnected = true
        currentCode = null
        const groups = await sock.groupFetchAllParticipating()
        groupList = Object.values(groups)
      } else if (connection === 'close') {
        isConnected = false
        sock = null
      }
    })

    return res.json({ code })
  } catch (err) {
    console.error('Failed to generate session code:', err)
    return res.status(500).json({ error: 'Something went wrong while generating code' })
  }
})

app.get('/status', (req, res) => {
  res.json({ connected: isConnected, groupCount: groupList.length })
})

app.get('/groups', (req, res) => {
  if (!isConnected) return res.status(400).json({ error: 'Bot is not connected' })
  res.json(groupList.map(g => ({ id: g.id, name: g.subject })))
})

app.post('/send-bulk', async (req, res) => {
  const { message } = req.body
  if (!message) return res.status(400).json({ error: 'Message required' })

  try {
    for (const group of groupList) {
      for (const p of group.participants || []) {
        if (!p.id.includes('@g.us')) {
          await sock.sendMessage(p.id, { text: message })
        }
      }
    }
    res.json({ success: true })
  } catch (err) {
    console.error('Failed to send messages:', err)
    res.status(500).json({ error: 'Sending failed' })
  }
})

app.post('/logout', async (req, res) => {
  try {
    if (sock) await sock.logout()
    isConnected = false
    sock = null
    groupList = []
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' })
  }
})

app.listen(PORT, () => {
  console.log(`✅ Server is live on port ${PORT}`)
})