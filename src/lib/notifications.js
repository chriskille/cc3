// ⚡ All notification triggers — calls /api server which holds secret keys
const API = '/api'

const post = async (path, body) => {
  try {
    const r = await fetch(`${API}${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    return await r.json()
  } catch(e) { console.error(`API ${path} failed:`, e) }
}

// ─── SMS ──────────────────────────────────────────────────────
export const sendSMS = (to, message) => post('/sms', { to, message })

// ─── EMAIL ────────────────────────────────────────────────────
export const sendEmail = (to, subject, html) => post('/email', { to, subject, html })

// ─── ATTENDANCE EVENTS ────────────────────────────────────────
export const notifyClockIn = ({ vaName, time, clientPhone }) =>
  sendSMS(clientPhone, `🟢 ${vaName} is now online. Login: ${time}`)

export const notifyBreak = ({ vaName, time, clientPhone }) =>
  sendSMS(clientPhone, `☕ ${vaName} started a break at ${time}`)

export const notifyResume = ({ vaName, time, clientPhone }) =>
  sendSMS(clientPhone, `▶ ${vaName} is back from break at ${time}`)

export const notifyClockOut = async ({ vaName, loginTime, logoutTime, workTime, eod, clientPhone, clientEmail, clientName }) => {
  await sendSMS(clientPhone, `🔴 ${vaName} logged out. Worked: ${workTime}. EOD report sent to email.`)
  await sendEmail(clientEmail, `📋 EOD Report — ${vaName}`, `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;">
      <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #e5e7eb;">
        <h2 style="color:#1E3A5F;margin-bottom:4px;">📋 End of Day Report</h2>
        <p style="color:#6B7280;font-size:13px;margin-bottom:20px;">From <strong>${vaName}</strong> · ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;width:140px;">Login</td><td style="font-weight:600;">${loginTime}</td></tr>
          <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Logout</td><td style="font-weight:600;">${logoutTime}</td></tr>
          <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Total worked</td><td style="font-weight:600;color:#0fba7a;">${workTime}</td></tr>
        </table>
        <h3 style="color:#1E3A5F;margin:0 0 8px;">✅ Tasks Completed</h3>
        <p style="color:#374151;line-height:1.6;margin-bottom:16px;">${eod?.tasks || '—'}</p>
        <h3 style="color:#1E3A5F;margin:0 0 8px;">🚧 Blockers</h3>
        <p style="color:#374151;line-height:1.6;margin-bottom:16px;">${eod?.blockers || '—'}</p>
        <h3 style="color:#1E3A5F;margin:0 0 8px;">📅 Tomorrow</h3>
        <p style="color:#374151;line-height:1.6;">${eod?.plans || '—'}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;"/>
        <p style="color:#9CA3AF;font-size:12px;">⚡ Command Center · EOStaff</p>
      </div>
    </div>`)
}

// ─── LEAVE EVENTS ─────────────────────────────────────────────
export const notifyLeaveApproved = ({ vaName, startDate, endDate, leaveType, clientPhone, clientEmail }) => {
  sendSMS(clientPhone, `📅 ${vaName} has approved leave: ${leaveType} from ${startDate} to ${endDate}. Plan accordingly.`)
  sendEmail(clientEmail, `📅 VA Leave Notice — ${vaName}`, `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#1E3A5F;">📅 VA Leave Approved</h2>
      <p><strong>${vaName}</strong> has been approved for <strong>${leaveType}</strong>.</p>
      <p>Dates: <strong>${startDate}</strong> to <strong>${endDate}</strong></p>
      <p style="color:#6B7280;font-size:13px;">Please plan your tasks accordingly. Contact your admin if you have concerns.</p>
    </div>`)
}

export const notifyEmergencyLeave = ({ vaName, reason, clientPhone, clientEmail }) => {
  sendSMS(clientPhone, `🚨 URGENT: ${vaName} has filed emergency leave. Reason: ${reason}. Admin has been notified.`)
  sendEmail(clientEmail, `🚨 Emergency Leave — ${vaName}`, `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#e8344a;">🚨 Emergency Leave Filed</h2>
      <p><strong>${vaName}</strong> has filed an emergency leave request.</p>
      <p><strong>Reason:</strong> ${reason || 'Not specified'}</p>
      <p>Your admin has been notified and will follow up shortly.</p>
    </div>`)
}

// ─── ANNOUNCEMENT ─────────────────────────────────────────────
export const notifyAnnouncement = (emails, title, body) =>
  post('/email-bulk', { emails, subject: `📢 ${title}`, html: `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#1E3A5F;">📢 ${title}</h2>
      <div style="color:#374151;line-height:1.6;">${body}</div>
      <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">⚡ Command Center · EOStaff</p>
    </div>` })
