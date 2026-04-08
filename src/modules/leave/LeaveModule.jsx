import { useState, useEffect } from "react"
import { Card, Btn, Modal, Badge, StatCard, Grid, SectionHeader, FormField, Empty, fmtDate, Avatar } from "../../components/UI.jsx"
import { getLeaveTypes, getLeaveBalances, getLeaveRequests, fileLeaveRequest, reviewLeaveRequest, getLeaveCalendar, pushNotification } from "../../lib/supabase.js"
import { notifyLeaveApproved, notifyEmergencyLeave } from "../../lib/notifications.js"

const STATUS_COLORS = { pending:'#f09a2a', approved:'#0fba7a', rejected:'#e8344a' }

export default function LeaveModule({ user, profiles = [] }) {
  const [requests, setRequests] = useState([])
  const [balances, setBalances] = useState([])
  const [leaveTypes, setLeaveTypes] = useState([])
  const [calendar, setCalendar] = useState([])
  const [tab, setTab] = useState(user.role === 'admin' ? 'requests' : 'my-leave')
  const [showNew, setShowNew] = useState(false)
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1)
  const [calYear, setCalYear] = useState(new Date().getFullYear())

  useEffect(() => { load() }, [])
  useEffect(() => { loadCalendar() }, [calMonth, calYear])

  const load = async () => {
    const filters = user.role === 'va' ? { vaId: user.id } : {}
    const [reqs, bals, types] = await Promise.all([
      getLeaveRequests(filters),
      user.role === 'va' ? getLeaveBalances(user.id) : Promise.resolve([]),
      getLeaveTypes()
    ])
    setRequests(reqs)
    setBalances(bals)
    setLeaveTypes(types)
  }

  const loadCalendar = async () => {
    const data = await getLeaveCalendar(calMonth, calYear)
    setCalendar(data)
  }

  const handleReview = async (id, status, note = '') => {
    const updated = await reviewLeaveRequest(id, status, note, user.id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r))
    const req = requests.find(r => r.id === id)
    if (req && status === 'approved') {
      const va = profiles.find(p => p.id === req.va_id)
      const client = profiles.find(p => p.id === va?.client_id)
      if (va && client) {
        await pushNotification(req.va_id, '✅ Leave Approved', `Your ${req.leave_type?.name} request has been approved`, 'leave')
        notifyLeaveApproved({ vaName: va.name, startDate: req.start_date, endDate: req.end_date, leaveType: req.leave_type?.name, clientPhone: client.phone, clientEmail: client.email })
      }
    }
    if (status === 'rejected') {
      await pushNotification(req.va_id, '❌ Leave Rejected', `Your leave request has been rejected`, 'leave')
    }
  }

  const pending = requests.filter(r => r.status === 'pending')
  const tabs = user.role === 'admin'
    ? [{ id:'requests', label:'Requests', badge: pending.length }, { id:'calendar', label:'📅 Calendar' }]
    : [{ id:'my-leave', label:'My Leave' }, { id:'balances', label:'Balances' }, { id:'calendar', label:'📅 Calendar' }]

  return (
    <div>
      <SectionHeader title="🏖️ Leave Management" action={
        user.role === 'va' && <Btn size="sm" onClick={() => setShowNew(true)}>+ File Leave</Btn>
      } />

      <div style={{ display:'flex', gap:4, background:'#07090f', borderRadius:10, padding:4, border:'1px solid #1a2238', marginBottom:20, width:'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'6px 16px', borderRadius:8, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', position:'relative', background:tab===t.id?'linear-gradient(135deg,#4f8ef7,#7c5cf6)':'transparent', color:tab===t.id?'#fff':'#5a6a8a' }}>
            {t.label}
            {t.badge > 0 && <span style={{ position:'absolute', top:2, right:2, background:'#e8344a', borderRadius:'50%', width:8, height:8 }} />}
          </button>
        ))}
      </div>

      {tab === 'my-leave' && (
        <>
          <Grid cols={4} gap={12} style={{ marginBottom:20 }}>
            {balances.map(b => (
              <Card key={b.id}>
                <div style={{ fontSize:11, color:'#5a6a8a', marginBottom:4, textTransform:'uppercase', letterSpacing:.4 }}>{b.leave_type?.name}</div>
                <div style={{ fontSize:22, fontWeight:700, color:b.leave_type?.color, fontFamily:"'Familjen Grotesk',sans-serif" }}>{b.total_days - b.used_days} <span style={{ fontSize:13, color:'#5a6a8a' }}>left</span></div>
                <div style={{ fontSize:11, color:'#3a4a6a', marginTop:4 }}>{b.used_days} used of {b.total_days}</div>
                <div style={{ marginTop:8, height:4, background:'#1a2238', borderRadius:2 }}>
                  <div style={{ height:'100%', borderRadius:2, background:b.leave_type?.color, width:`${Math.min(100,(b.used_days/b.total_days)*100)}%` }} />
                </div>
              </Card>
            ))}
          </Grid>
          <LeaveRequestList requests={requests} onReview={null} />
        </>
      )}

      {tab === 'balances' && (
        <Card>
          <div style={{ fontSize:13, fontWeight:600, color:'#8a9bc0', marginBottom:16 }}>Leave Balances — {new Date().getFullYear()}</div>
          {balances.length === 0 ? <Empty icon="📋" message="No balances set up yet. Ask your admin." /> :
            balances.map(b => (
              <div key={b.id} style={{ padding:'12px 0', borderBottom:'1px solid #111827', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:b.leave_type?.color }}>{b.leave_type?.name}</div>
                  <div style={{ fontSize:11, color:'#5a6a8a', marginTop:2 }}>{b.used_days} days used · {b.total_days - b.used_days} days remaining</div>
                </div>
                <div style={{ fontSize:20, fontWeight:700, color:b.leave_type?.color }}>{b.total_days}</div>
              </div>
            ))
          }
        </Card>
      )}

      {tab === 'requests' && (
        <>
          {pending.length > 0 && (
            <div style={{ background:'#f09a2a11', border:'1px solid #f09a2a33', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#f09a2a' }}>
              ⏳ {pending.length} pending leave request{pending.length>1?'s':''} awaiting review
            </div>
          )}
          <LeaveRequestList requests={requests} onReview={handleReview} isAdmin />
        </>
      )}

      {tab === 'calendar' && (
        <LeaveCalendar calendar={calendar} month={calMonth} year={calYear}
          onPrev={() => { if(calMonth===1){setCalMonth(12);setCalYear(y=>y-1)}else setCalMonth(m=>m-1) }}
          onNext={() => { if(calMonth===12){setCalMonth(1);setCalYear(y=>y+1)}else setCalMonth(m=>m+1) }} />
      )}

      {showNew && <FileLeaveModal user={user} leaveTypes={leaveTypes} balances={balances} onClose={() => setShowNew(false)}
        onFiled={req => { setRequests(prev=>[req,...prev]); setShowNew(false) }} />}
    </div>
  )
}

function LeaveRequestList({ requests, onReview, isAdmin }) {
  const [noteId, setNoteId] = useState(null)
  const [note, setNote] = useState('')
  if (requests.length === 0) return <Empty icon="🏖️" message="No leave requests yet" />

  return (
    <Card style={{ padding:0, overflow:'hidden' }}>
      {requests.map((r, i) => (
        <div key={r.id} style={{ padding:'14px 18px', borderBottom: i<requests.length-1?'1px solid #111827':'none' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600 }}>{r.va?.name || 'VA'}</span>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:r.leave_type?.color+'22', color:r.leave_type?.color, fontWeight:600 }}>{r.leave_type?.name}</span>
                {r.is_emergency && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:100, background:'#e8344a22', color:'#e8344a', fontWeight:700 }}>EMERGENCY</span>}
              </div>
              <div style={{ fontSize:12, color:'#5a6a8a' }}>{fmtDate(r.start_date)} → {fmtDate(r.end_date)} · {r.total_days} day{r.total_days>1?'s':''}</div>
              {r.reason && <div style={{ fontSize:12, color:'#8a9bc0', marginTop:4, fontStyle:'italic' }}>"{r.reason}"</div>}
              {r.admin_note && <div style={{ fontSize:11, color:'#3a4a6a', marginTop:4 }}>Admin note: {r.admin_note}</div>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
              <span style={{ fontSize:11, padding:'3px 10px', borderRadius:100, background:STATUS_COLORS[r.status]+'22', color:STATUS_COLORS[r.status], fontWeight:700, textTransform:'uppercase' }}>{r.status}</span>
              {isAdmin && r.status === 'pending' && (
                <div style={{ display:'flex', gap:4 }}>
                  <Btn size="sm" variant="success" onClick={() => onReview(r.id,'approved','')}>Approve</Btn>
                  <Btn size="sm" variant="danger" onClick={() => { setNoteId(r.id); setNote('') }}>Reject</Btn>
                </div>
              )}
            </div>
          </div>
          {noteId === r.id && (
            <div style={{ marginTop:10, display:'flex', gap:8 }}>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Reason for rejection (optional)" />
              <Btn size="sm" variant="danger" onClick={() => { onReview(r.id,'rejected',note); setNoteId(null) }}>Confirm</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setNoteId(null)}>Cancel</Btn>
            </div>
          )}
        </div>
      ))}
    </Card>
  )
}

function LeaveCalendar({ calendar, month, year, onPrev, onNext }) {
  const monthName = new Date(year, month-1).toLocaleDateString('en-US',{month:'long',year:'numeric'})
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDay = new Date(year, month-1, 1).getDay()

  const leavesOnDay = (day) => {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return calendar.filter(l => l.start_date <= dateStr && l.end_date >= dateStr)
  }

  return (
    <Card>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <Btn variant="ghost" size="sm" onClick={onPrev}>← Prev</Btn>
        <span style={{ fontFamily:"'Familjen Grotesk',sans-serif", fontSize:16, fontWeight:700 }}>{monthName}</span>
        <Btn variant="ghost" size="sm" onClick={onNext}>Next →</Btn>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:11, color:'#5a6a8a', fontWeight:600, padding:'4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const leaves = leavesOnDay(day)
          const isToday = day === new Date().getDate() && month === new Date().getMonth()+1 && year === new Date().getFullYear()
          return (
            <div key={day} style={{ minHeight:52, border:`1px solid ${isToday?'#4f8ef7':'#1a2238'}`, borderRadius:8, padding:4, background:isToday?'#4f8ef711':'transparent' }}>
              <div style={{ fontSize:11, fontWeight:isToday?700:400, color:isToday?'#4f8ef7':'#5a6a8a', marginBottom:3 }}>{day}</div>
              {leaves.map(l => (
                <div key={l.id} style={{ fontSize:9, fontWeight:700, padding:'1px 4px', borderRadius:3, background:l.leave_type?.color+'33', color:l.leave_type?.color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:1 }}>
                  {l.va?.name?.split(' ')[0]}
                </div>
              ))}
            </div>
          )
        })}
      </div>
      {calendar.length > 0 && (
        <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid #1a2238' }}>
          <div style={{ fontSize:11, color:'#5a6a8a', marginBottom:8, fontWeight:600 }}>ON LEAVE THIS MONTH</div>
          {calendar.map(l => (
            <div key={l.id} style={{ display:'flex', gap:8, alignItems:'center', padding:'5px 0' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:l.leave_type?.color }} />
              <span style={{ fontSize:12, color:'#dde3f0' }}>{l.va?.name}</span>
              <span style={{ fontSize:11, color:'#5a6a8a' }}>{fmtDate(l.start_date)} – {fmtDate(l.end_date)}</span>
              <span style={{ fontSize:10, padding:'1px 6px', borderRadius:100, background:l.leave_type?.color+'22', color:l.leave_type?.color }}>{l.leave_type?.name}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function FileLeaveModal({ user, leaveTypes, balances, onClose, onFiled }) {
  const [form, setForm] = useState({ leave_type_id:'', start_date:'', end_date:'', reason:'', is_emergency:false })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const totalDays = form.start_date && form.end_date
    ? Math.max(1, Math.ceil((new Date(form.end_date)-new Date(form.start_date)) / 86400000) + 1)
    : 0

  const submit = async () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) return alert('Please fill required fields')
    const clientId = user.client_id
    const req = await fileLeaveRequest({ ...form, va_id: user.id, client_id: clientId, total_days: totalDays })
    if (form.is_emergency) {
      notifyEmergencyLeave({ vaName: user.name, reason: form.reason, clientPhone: '', clientEmail: '' })
    }
    await pushNotification(null, '🏖️ Leave Request Filed', `${user.name} filed a leave request`, 'leave') // notify admin
    onFiled(req)
  }

  return (
    <Modal title="🏖️ File Leave Request" onClose={onClose}>
      <FormField label="Leave Type *">
        <select value={form.leave_type_id} onChange={e=>set('leave_type_id',e.target.value)}>
          <option value="">Select type</option>
          {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </FormField>
      <Grid cols={2}>
        <FormField label="Start Date *"><input type="date" value={form.start_date} onChange={e=>set('start_date',e.target.value)} /></FormField>
        <FormField label="End Date *"><input type="date" value={form.end_date} onChange={e=>set('end_date',e.target.value)} /></FormField>
      </Grid>
      {totalDays > 0 && <div style={{ fontSize:12, color:'#4f8ef7', marginBottom:12 }}>📅 {totalDays} working day{totalDays>1?'s':''}</div>}
      <FormField label="Reason"><textarea value={form.reason} onChange={e=>set('reason',e.target.value)} rows={2} placeholder="Optional — provide context" /></FormField>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
        <input type="checkbox" id="emergency" checked={form.is_emergency} onChange={e=>set('is_emergency',e.target.checked)} style={{ width:'auto' }} />
        <label htmlFor="emergency" style={{ color:'#e8344a', textTransform:'none', fontSize:13, letterSpacing:0 }}>🚨 Emergency leave — notify client immediately</label>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit}>Submit Request</Btn>
      </div>
    </Modal>
  )
}
