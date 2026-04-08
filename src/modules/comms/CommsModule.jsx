import { useState, useEffect, useRef } from "react"
import { Card, Btn, Modal, Badge, SectionHeader, FormField, Empty, fmtDate, Avatar } from "../../components/UI.jsx"
import { getChatRooms, createChatRoom, getRoomMessages, sendMessage, subscribeToRoom } from "../../lib/supabase.js"

export default function CommsModule({ user, profiles = [] }) {
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    const data = await getChatRooms(user.id)
    setRooms(data)
    if (data.length > 0 && !activeRoom) setActiveRoom(data[0])
  }

  const unreadCount = 0 // Would track per room in production

  return (
    <div>
      <SectionHeader title="💬 Team Comms" action={
        user.role === 'admin' && <Btn size="sm" onClick={() => setShowNew(true)}>+ New Group</Btn>
      } />

      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:16, height:'calc(100vh - 240px)', minHeight:480 }}>
        {/* Sidebar */}
        <Card style={{ padding:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #1a2238', fontSize:12, color:'#5a6a8a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5 }}>Channels</div>
          <div style={{ overflowY:'auto', flex:1 }}>
            {rooms.length === 0 ? (
              <div style={{ padding:20, textAlign:'center', color:'#3a4a6a', fontSize:12 }}>No rooms yet</div>
            ) : rooms.map(room => (
              <RoomItem key={room.id} room={room} active={activeRoom?.id===room.id} onClick={() => setActiveRoom(room)} />
            ))}
          </div>
        </Card>

        {/* Chat */}
        {activeRoom ? (
          <ChatRoom room={activeRoom} user={user} profiles={profiles} />
        ) : (
          <Card style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Empty icon="💬" message="Select a channel to start chatting" />
          </Card>
        )}
      </div>

      {showNew && (
        <NewRoomModal user={user} profiles={profiles} onClose={() => setShowNew(false)}
          onCreated={room => { setRooms(prev=>[room,...prev]); setActiveRoom(room); setShowNew(false) }} />
      )}
    </div>
  )
}

function RoomItem({ room, active, onClick }) {
  const typeIcon = room.type === 'group' ? '👥' : '💬'
  return (
    <div onClick={onClick} style={{ padding:'12px 16px', cursor:'pointer', transition:'background .15s', background:active?'#1a2238':'transparent', borderLeft:`3px solid ${active?'#4f8ef7':'transparent'}` }}>
      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ width:36, height:36, borderRadius:10, background:'#1a2238', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{typeIcon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:active?'#dde3f0':'#8a9bc0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>#{room.name}</div>
          <div style={{ fontSize:11, color:'#3a4a6a', marginTop:1 }}>{room.type}</div>
        </div>
      </div>
    </div>
  )
}

function ChatRoom({ room, user, profiles }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)
  const subRef = useRef(null)

  useEffect(() => {
    load()
    subRef.current = subscribeToRoom(room.id, msg => {
      setMessages(prev => [...prev, msg])
    })
    return () => subRef.current?.unsubscribe()
  }, [room.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  const load = async () => {
    setLoading(true)
    const data = await getRoomMessages(room.id)
    setMessages(data)
    setLoading(false)
  }

  const handleSend = async () => {
    if (!text.trim()) return
    const msg = await sendMessage(room.id, user.id, text)
    setText('')
    // Optimistically add with sender info
    setMessages(prev => [...prev, { ...msg, sender: { name: user.name, avatar: user.avatar, role: user.role } }])
  }

  const grouped = messages.reduce((acc, msg) => {
    const last = acc[acc.length - 1]
    if (last && last.sender_id === msg.sender_id && Date.now() - new Date(last.created_at) < 300000) {
      last.msgs.push(msg)
    } else {
      acc.push({ sender_id: msg.sender_id, sender: msg.sender, created_at: msg.created_at, msgs: [msg] })
    }
    return acc
  }, [])

  return (
    <Card style={{ display:'flex', flexDirection:'column', padding:0, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 18px', borderBottom:'1px solid #1a2238', display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ width:32, height:32, borderRadius:8, background:'#1a2238', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>{room.type==='group'?'👥':'💬'}</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700 }}>#{room.name}</div>
          {room.description && <div style={{ fontSize:11, color:'#5a6a8a' }}>{room.description}</div>}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 18px' }}>
        {loading ? (
          <div style={{ textAlign:'center', color:'#3a4a6a', fontSize:12, paddingTop:40 }}>Loading…</div>
        ) : grouped.length === 0 ? (
          <Empty icon="💬" message="No messages yet — say hello!" />
        ) : grouped.map((g, i) => {
          const isMe = g.sender_id === user.id
          const sender = g.sender || profiles.find(p=>p.id===g.sender_id)
          return (
            <div key={i} style={{ marginBottom:16, display:'flex', gap:10, flexDirection:isMe?'row-reverse':'row' }}>
              {!isMe && <Avatar name={sender?.name||'?'} size={32} />}
              <div style={{ maxWidth:'70%' }}>
                {!isMe && <div style={{ fontSize:11, color:'#5a6a8a', marginBottom:4 }}>{sender?.name}</div>}
                {g.msgs.map((m, mi) => (
                  <div key={m.id} style={{ padding:'8px 12px', borderRadius:isMe?'12px 4px 12px 12px':'4px 12px 12px 12px', marginBottom:2, fontSize:13, lineHeight:1.5,
                    background: isMe?'linear-gradient(135deg,#4f8ef7,#7c5cf6)':'#1a2238',
                    color: isMe?'#fff':'#dde3f0' }}>
                    {m.text}
                  </div>
                ))}
                <div style={{ fontSize:10, color:'#3a4a6a', marginTop:3, textAlign:isMe?'right':'left' }}>
                  {new Date(g.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding:'12px 18px', borderTop:'1px solid #1a2238', display:'flex', gap:8 }}>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder={`Message #${room.name}…`}
          onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),handleSend())} />
        <Btn size="sm" onClick={handleSend} disabled={!text.trim()}>Send ↑</Btn>
      </div>
    </Card>
  )
}

function NewRoomModal({ user, profiles, onClose, onCreated }) {
  const [form, setForm] = useState({ name:'', description:'', type:'group' })
  const [members, setMembers] = useState([])
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const toggleMember = (id) => setMembers(prev => prev.includes(id) ? prev.filter(m=>m!==id) : [...prev,id])

  const submit = async () => {
    if (!form.name) return
    const allMembers = [...new Set([user.id, ...members])]
    const room = await createChatRoom({ ...form, created_by: user.id }, allMembers)
    onCreated(room)
  }

  return (
    <Modal title="👥 New Chat Group" onClose={onClose}>
      <FormField label="Group Name *"><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. All VAs, Acme Team" /></FormField>
      <FormField label="Description"><input value={form.description} onChange={e=>set('description',e.target.value)} placeholder="What is this group for?" /></FormField>
      <div style={{ marginBottom:16 }}>
        <label>Add Members</label>
        <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:200, overflowY:'auto' }}>
          {profiles.filter(p=>p.id!==user.id).map(p => (
            <div key={p.id} onClick={() => toggleMember(p.id)} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 10px', borderRadius:8, cursor:'pointer', border:`1px solid ${members.includes(p.id)?'#4f8ef7':'#1a2238'}`, background:members.includes(p.id)?'#4f8ef711':'transparent' }}>
              <Avatar name={p.name} size={28} />
              <div><div style={{ fontSize:12, fontWeight:600 }}>{p.name}</div><div style={{ fontSize:10, color:'#5a6a8a', textTransform:'uppercase' }}>{p.role}</div></div>
              {members.includes(p.id) && <span style={{ marginLeft:'auto', color:'#4f8ef7' }}>✓</span>}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit}>Create Group</Btn>
      </div>
    </Modal>
  )
}
