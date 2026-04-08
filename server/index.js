// ⚡ COMMAND CENTER — API Server (port 3001)
// Run: node server/index.js
// Production: deploy to Railway or Render

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import twilio from 'twilio'
import { Resend } from 'resend'

const app    = express()
const PORT   = process.env.SERVER_PORT || 3001
const twil   = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = `${process.env.RESEND_FROM_NAME || 'Command Center'} <${process.env.RESEND_FROM_EMAIL}>`

app.use(cors({ origin: process.env.VITE_APP_URL || 'http://localhost:3000' }))
app.use(express.json())

// ─── SMS ──────────────────────────────────────────────────────
app.post('/api/sms', async (req, res) => {
  const { to, message } = req.body
  if (!to || !message) return res.status(400).json({ error: 'Missing to or message' })
  try {
    const r = await twil.messages.create({ body: message, from: process.env.TWILIO_PHONE_NUMBER, to })
    console.log(`📱 SMS → ${to}`)
    res.json({ success: true, sid: r.sid })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── SINGLE EMAIL ─────────────────────────────────────────────
app.post('/api/email', async (req, res) => {
  const { to, subject, html } = req.body
  if (!to || !subject || !html) return res.status(400).json({ error: 'Missing fields' })
  try {
    const r = await resend.emails.send({ from: FROM, to, subject, html })
    console.log(`📧 Email → ${to}: ${subject}`)
    res.json({ success: true, id: r.id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── BULK EMAIL (Announcements) ───────────────────────────────
app.post('/api/email-bulk', async (req, res) => {
  const { emails, subject, html } = req.body
  if (!emails?.length) return res.status(400).json({ error: 'No recipients' })
  const results = []
  for (const to of emails) {
    try {
      const r = await resend.emails.send({ from: FROM, to, subject, html })
      results.push({ to, success: true, id: r.id })
      console.log(`📧 Bulk → ${to}`)
    } catch (e) {
      results.push({ to, success: false, error: e.message })
    }
  }
  res.json({ results })
})

app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  twilio: !!process.env.TWILIO_ACCOUNT_SID,
  resend: !!process.env.RESEND_API_KEY
}))

app.listen(PORT, () => {
  console.log(`⚡ API Server → http://localhost:${PORT}`)
  console.log(`   Twilio: ${process.env.TWILIO_ACCOUNT_SID ? '✅' : '❌ missing'}`)
  console.log(`   Resend: ${process.env.RESEND_API_KEY ? '✅' : '❌ missing'}`)
})
