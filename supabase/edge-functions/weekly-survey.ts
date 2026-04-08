// supabase/edge-functions/weekly-survey/index.ts
// Deploy: supabase functions deploy weekly-survey
// Schedule via Supabase Dashboard → Edge Functions → Cron: 0 9 * * 1 (every Monday 9am)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  // Get all active VA-client pairs
  const { data: vas } = await supabase
    .from('profiles')
    .select('id, name, client_id, profiles!client_id(id, name, email, phone)')
    .eq('role', 'va')
    .not('client_id', 'is', null)

  if (!vas?.length) return new Response('No VAs found', { status: 200 })

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const weekStartStr = weekStart.toISOString().split('T')[0]

  let sent = 0

  for (const va of vas) {
    const client = va.profiles as any
    if (!client) continue

    // Check if survey already exists for this week
    const { data: existing } = await supabase
      .from('surveys')
      .select('id')
      .eq('va_id', va.id)
      .eq('client_id', client.id)
      .eq('week_start', weekStartStr)
      .maybeSingle()

    if (existing) continue

    // Create blank survey record
    await supabase.from('surveys').insert({
      va_id: va.id,
      client_id: client.id,
      week_start: weekStartStr,
    })

    // Notify client via in-app notification
    await supabase.from('notifications').insert({
      to_id: client.id,
      title: '⭐ Weekly Performance Survey Ready',
      message: `Please rate ${va.name}'s performance for the week of ${weekStartStr}`,
      type: 'survey',
    })

    // Send email via API server
    try {
      await fetch(`${Deno.env.get('APP_URL')}/api/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: client.email,
          subject: `⭐ Rate ${va.name}'s performance this week`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
              <h2 style="color:#1E3A5F;">⭐ Weekly Performance Review</h2>
              <p>Hi ${client.name},</p>
              <p>It's time to rate <strong>${va.name}</strong>'s performance for the week of <strong>${weekStartStr}</strong>.</p>
              <p>This takes less than 2 minutes.</p>
              <a href="${Deno.env.get('APP_URL')}/surveys" 
                 style="display:inline-block;margin-top:16px;padding:12px 24px;background:linear-gradient(135deg,#4f8ef7,#7c5cf6);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
                Complete Survey →
              </a>
              <p style="margin-top:24px;color:#9CA3AF;font-size:12px;">Sent by ⚡ Command Center</p>
            </div>
          `
        })
      })
    } catch (e) {
      console.error('Email failed for', client.email, e)
    }

    sent++
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
