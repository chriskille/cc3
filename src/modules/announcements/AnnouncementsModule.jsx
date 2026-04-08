import { useState, useEffect } from "react"
import { Card, Btn, Modal, Badge, SectionHeader, FormField, Empty, fmtDate, Avatar } from "../../components/UI.jsx"
import { getAnnouncements, postAnnouncement, markAnnouncementRead, getAllProfiles } from "../../lib/supabase.js"
import { notifyAnnouncement } from "../../lib/notifications.js"

export default function AnnouncementsModule({ user, profiles = [] }) {
  const [announcements, setAnnouncements] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    const data = await getAnnouncements()
    setAnnouncements(data)
    // Mark unread as read
    data.forEach(a => {
      const alreadyRead = a.announcement_reads?.some(r => r.user_id === user.id)
      if (!alreadyRead) markAnnouncementRead(a.id, user.id)
    })
  }

  const isUnread = (a) => !a.announcement_reads?.some(r => r.user_id === user.id)
  const unreadCount = announcements.filter(isUnread).length
  const pinned = announcements.filter(a => a.pinned)
  const regular = announcements.filter(a => !a.pinned)

  return (
    <div>
      <SectionHeader title="📢 Announcements" action={
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {unreadCount > 0 && <Badge color="#4f8ef7">{unreadCount} new</Badge>}
          {user.role === 'admin' && <Btn size="sm" onClick={() => setShowNew(true)}>+ Post Announcement</Btn>}
        </div>
      } />

      {pinned.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:'#5a6a8a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>📌 Pinned</div>
          {pinned.map(a => <AnnouncementCard key={a.id} ann={a} user={user} expanded={expanded===a.id} onToggle={() => setExpanded(expanded===a.id?null:a.id)} unread={isUnread(a)} />)}
        </div>
      )}

      {regular.length === 0 && pinned.length === 0 ? (
        <Empty icon="📢" message="No announcements yet" />
      ) : (
        <div>
          {regular.length > 0 && <div style={{ fontSize:11, color:'#5a6a8a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Latest</div>}
          {regular.map(a => <AnnouncementCard key={a.id} ann={a} user={user} expanded={expanded===a.id} onToggle={() => setExpanded(expanded===a.id?null:a.id)} unread={isUnread(a)} />)}
        </div>
      )}

      {showNew && (
        <NewAnnouncementModal user={user} profiles={profiles} onClose={() => setShowNew(false)}
          onPosted={a => { setAnnouncements(prev=>[a,...prev]); setShowNew(false) }} />
      )}
    </div>
  )
}

function AnnouncementCard({ ann, user, expanded, onToggle, unread }) {
  return (
    <div style={{ background:'#0d1221', border:`1px solid ${unread?'#4f8ef744':'#1a2238'}`, borderRadius:12, marginBottom:10, overflow:'hidden', transition:'border-color .2s' }}>
      <div style={{ padding:'14px 18px', cursor:'pointer', display:'flex', gap:12, alignItems:'flex-start' }} onClick={onToggle}>
        {unread && <div style={{ width:8, height:8, borderRadius:'50%', background:'#4f8ef7', marginTop:5, flexShrink:0 }} />}
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
            <div>
              {ann.pinned && <span style={{ fontSize:10, color:'#f09a2a', fontWeight:700, marginRight:6 }}>📌 PINNED</span>}
              <span style={{ fontSize:13, fontWeight:600, color: unread?'#dde3f0':'#8a9bc0' }}>{ann.title}</span>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
              <span style={{ fontSize:10, padding:'2px 7px', borderRadius:100, background:'#1a2238', color:'#5a6a8a', textTransform:'uppercase' }}>{ann.audience}</span>
              <span style={{ fontSize:11, color:'#3a4a6a' }}>{fmtDate(ann.created_at)}</span>
              <span style={{ color:'#5a6a8a' }}>{expanded ? '▲' : '▼'}</span>
            </div>
          </div>
          <div style={{ fontSize:12, color:'#5a6a8a', marginTop:4, display:'flex', gap:8, alignItems:'center' }}>
            <Avatar name={ann.author?.name || 'A'} size={18} />
            {ann.author?.name}
            <span>·</span>
            <span>{ann.announcement_reads?.length || 0} read</span>
          </div>
        </div>
      </div>
      {expanded && (
        <div style={{ padding:'0 18px 18px', borderTop:'1px solid #111827' }}>
          <p style={{ fontSize:13, color:'#8a9bc0', lineHeight:1.7, paddingTop:14, whiteSpace:'pre-wrap' }}>{ann.body}</p>
        </div>
      )}
    </div>
  )
}

function NewAnnouncementModal({ user, profiles, onClose, onPosted }) {
  const [form, setForm] = useState({ title:'', body:'', audience:'all', pinned:false })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const submit = async () => {
    if (!form.title || !form.body) return alert('Title and body are required')
    const ann = await postAnnouncement({ ...form, author_id: user.id })
    // Send email to relevant users
    const targets = profiles.filter(p => {
      if (form.audience === 'all') return p.role !== 'admin'
      if (form.audience === 'vas') return p.role === 'va'
      if (form.audience === 'clients') return p.role === 'client'
      return false
    })
    const emails = targets.map(p => p.email).filter(Boolean)
    if (emails.length) notifyAnnouncement(emails, form.title, form.body)
    onPosted(ann)
  }

  return (
    <Modal title="📢 Post Announcement" onClose={onClose}>
      <FormField label="Title *"><input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Announcement title" /></FormField>
      <FormField label="Message *"><textarea value={form.body} onChange={e=>set('body',e.target.value)} rows={5} placeholder="Write your announcement here…" /></FormField>
      <FormField label="Send To">
        <select value={form.audience} onChange={e=>set('audience',e.target.value)}>
          <option value="all">👥 Everyone (VAs + Clients)</option>
          <option value="vas">🎧 VAs only</option>
          <option value="clients">🏢 Clients only</option>
        </select>
      </FormField>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
        <input type="checkbox" id="pin" checked={form.pinned} onChange={e=>set('pinned',e.target.checked)} style={{ width:'auto' }} />
        <label htmlFor="pin" style={{ textTransform:'none', fontSize:13, letterSpacing:0, color:'#f09a2a' }}>📌 Pin to top</label>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit}>📢 Post Announcement</Btn>
      </div>
    </Modal>
  )
}
