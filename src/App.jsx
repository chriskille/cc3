import { useState, useEffect } from "react"
import { GlobalStyles, Btn, Card, Avatar, Modal, FormField, fmtTime, fmtDuration } from "./components/UI.jsx"
import AttendanceModule from "./modules/attendance/AttendanceModule.jsx"
import TasksModule from "./modules/tasks/TasksModule.jsx"
import SurveysModule from "./modules/surveys/SurveysModule.jsx"
import LeaveModule from "./modules/leave/LeaveModule.jsx"
import AnnouncementsModule from "./modules/announcements/AnnouncementsModule.jsx"
import LMSModule from "./modules/lms/LMSModule.jsx"
import CommsModule from "./modules/comms/CommsModule.jsx"
import { signIn, signOut, getAllProfiles, getNotifications, markAllRead, subscribeToNotifications, pushNotification,
  getActiveSession, clockIn, clockOut, startBreak, resumeWork } from "./lib/supabase.js"
import { notifyClockIn, notifyBreak, notifyResume, notifyClockOut } from "./lib/notifications.js"

// ─── MOCK DB (replace with Supabase when ready) ───────────────
// Set USE_MOCK=true to run without Supabase configured
const USE_MOCK = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('your-project')

const MOCK_USERS = [
  { id:'admin1', role:'admin',  name:'Chris (Admin)',   email:'chris@eostaff.com',        password:'admin',        avatar:'CA', phone:'+10000000001' },
  { id:'va1',    role:'va',     name:'Chris (VA)',       email:'chris@paymentpilot.com',   password:'Chris - VA',   avatar:'CV', phone:'+10000000002', client_id:'c1' },
  { id:'va2',    role:'va',     name:'Ana Reyes',        email:'ana@va.com',               password:'va456',        avatar:'AR', phone:'+10000000003', client_id:'c2' },
  { id:'c1',     role:'client', name:'Chris Kille LLC',  email:'chriskillellc@gmail.com',  password:'Chris - Client', avatar:'CK', phone:'+10000000004' },
  { id:'c2',     role:'client', name:'TechStart LLC',    email:'tech@client.com',          password:'client456',   avatar:'TS', phone:'+10000000005' },
]

// ─── NAV CONFIG PER ROLE ──────────────────────────────────────
const NAV = {
  admin: [
    { id:'home',          icon:'🏠', label:'Home' },
    { id:'attendance',    icon:'📊', label:'Attendance' },
    { id:'tasks',         icon:'📌', label:'Tasks' },
    { id:'surveys',       icon:'⭐', label:'Surveys' },
    { id:'leave',         icon:'🏖️', label:'Leave' },
    { id:'announcements', icon:'📢', label:'Announcements' },
    { id:'lms',           icon:'🎓', label:'Learning' },
    { id:'comms',         icon:'💬', label:'Comms' },
    { id:'team',          icon:'👥', label:'Team' },
  ],
  va: [
    { id:'home',          icon:'🏠', label:'Home' },
    { id:'attendance',    icon:'📊', label:'Attendance' },
    { id:'tasks',         icon:'📌', label:'Tasks' },
    { id:'surveys',       icon:'⭐', label:'My Reviews' },
    { id:'leave',         icon:'🏖️', label:'Leave' },
    { id:'announcements', icon:'📢', label:'News' },
    { id:'lms',           icon:'🎓', label:'Learning' },
    { id:'comms',         icon:'💬', label:'Comms' },
  ],
  client: [
    { id:'home',          icon:'🏠', label:'Home' },
    { id:'attendance',    icon:'📊', label:'Attendance' },
    { id:'tasks',         icon:'📌', label:'Tasks' },
    { id:'surveys',       icon:'⭐', label:'Rate VA' },
    { id:'announcements', icon:'📢', label:'News' },
    { id:'comms',         icon:'💬', label:'Comms' },
  ],
}

// ─── APP ──────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('home')
  const [profiles, setProfiles] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [session, setSession] = useState(null)  // attendance session
  const [elapsed, setElapsed] = useState(0)
  const [showEOD, setShowEOD] = useState(false)
  const [eodForm, setEodForm] = useState({ tasks:'', blockers:'', plans:'' })
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const login = async (email, password) => {
    if (USE_MOCK) {
      const u = MOCK_USERS.find(u => u.email === email && u.password === password)
      if (!u) throw new Error('Invalid credentials')
      setUser(u)
      setProfiles(MOCK_USERS)
      setNotifications([
        { id:1, title:'👋 Welcome!', message:'Welcome to Command Center', read:false, created_at:new Date().toISOString() }
      ])
    } else {
      const { user: authUser } = await signIn(email, password)
      const allProfiles = await getAllProfiles()
      const profile = allProfiles.find(p => p.id === authUser.id)
      setUser(profile)
      setProfiles(allProfiles)
      const notifs = await getNotifications(authUser.id)
      setNotifications(notifs)
      // Subscribe to realtime notifications
      subscribeToNotifications(authUser.id, notif => setNotifications(prev => [notif, ...prev]))
      // Load active session for VA
      if (profile?.role === 'va') {
        const active = await getActiveSession(authUser.id)
        if (active) setSession(active)
      }
    }
  }

  const logout = async () => {
    if (!USE_MOCK) await signOut()
    setUser(null); setSession(null); setPage('home')
  }

  // Clock actions
  const handleClockIn = async () => {
    const client = profiles.find(p => p.id === user.client_id)
    let s
    if (USE_MOCK) {
      s = { id:'mock-session', va_id:user.id, client_id:user.client_id, status:'online', login_time:new Date().toISOString(), breaks:[] }
    } else {
      s = await clockIn(user.id, user.client_id)
    }
    setSession(s)
    const time = new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})
    if (client?.phone) notifyClockIn({ vaName:user.name, time, clientPhone:client.phone })
    if (!USE_MOCK && client) await pushNotification(client.id, '🟢 VA Online', `${user.name} clocked in at ${time}`, 'clock')
  }

  const handleBreak = async () => {
    let s
    if (USE_MOCK) {
      s = { ...session, status:'break', breaks:[...(session.breaks||[]),{start:new Date().toISOString(),end:null}] }
    } else {
      s = await startBreak(session.id, session.breaks || [])
    }
    setSession(s)
    const client = profiles.find(p => p.id === user.client_id)
    const time = new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})
    if (client?.phone) notifyBreak({ vaName:user.name, time, clientPhone:client.phone })
  }

  const handleResume = async () => {
    let s
    if (USE_MOCK) {
      const breaks = (session.breaks||[]).map((b,i) => i===session.breaks.length-1?{...b,end:new Date().toISOString()}:b)
      s = { ...session, status:'online', breaks }
    } else {
      s = await resumeWork(session.id, session.breaks || [])
    }
    setSession(s)
    const client = profiles.find(p => p.id === user.client_id)
    const time = new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})
    if (client?.phone) notifyResume({ vaName:user.name, time, clientPhone:client.phone })
  }

  const handleClockOut = async () => setShowEOD(true)

  const submitEOD = async () => {
    const workSecs = calcWorkSeconds()
    const workTime = fmtDuration(workSecs)
    const client = profiles.find(p => p.id === user.client_id)
    if (!USE_MOCK) await clockOut(session.id, eodForm)
    if (client) {
      notifyClockOut({ vaName:user.name, loginTime:fmtTime(session.login_time), logoutTime:fmtTime(new Date().toISOString()), workTime, eod:eodForm, clientPhone:client.phone, clientEmail:client.email })
      if (!USE_MOCK) await pushNotification(client.id, '🔴 VA Clocked Out', `${user.name} finished. Worked ${workTime}. EOD report sent.`, 'clock')
    }
    setSession(null); setShowEOD(false); setEodForm({ tasks:'', blockers:'', plans:'' })
  }

  const calcWorkSeconds = () => {
    if (!session?.login_time) return 0
    const total = (Date.now() - new Date(session.login_time)) / 1000
    const breakSecs = (session.breaks||[]).reduce((s,b) => {
      if (!b.start) return s
      const end = b.end ? new Date(b.end) : new Date()
      return s + (end - new Date(b.start)) / 1000
    }, 0)
    return Math.max(0, total - breakSecs)
  }

  const unread = notifications.filter(n => !n.read).length

  if (!user) return <LoginPage onLogin={login} />

  const navItems = NAV[user.role] || []

  return (
    <>
      <GlobalStyles />
      <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: sidebarOpen ? 220 : 60, background:'#07090f', borderRight:'1px solid #111827', display:'flex', flexDirection:'column', transition:'width .2s', flexShrink:0, overflow:'hidden' }}>
          {/* Logo */}
          <div style={{ padding:'18px 16px', borderBottom:'1px solid #111827', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20 }}>⚡</span>
            {sidebarOpen && <span style={{ fontFamily:"'Familjen Grotesk',sans-serif", fontWeight:800, fontSize:15, background:'linear-gradient(135deg,#4f8ef7,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Command Center</span>}
          </div>

          {/* VA Clock Widget */}
          {user.role === 'va' && sidebarOpen && (
            <div style={{ padding:'12px 14px', borderBottom:'1px solid #111827' }}>
              <div style={{ fontSize:11, color:'#5a6a8a', marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:.4 }}>Attendance</div>
              {session ? (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:session.status==='break'?'#f09a2a':'#0fba7a', animation:'pulse 1.5s infinite' }} />
                    <span style={{ fontSize:12, fontWeight:600, color:session.status==='break'?'#f09a2a':'#0fba7a' }}>{session.status==='break'?'On Break':'Working'}</span>
                  </div>
                  <div style={{ fontSize:18, fontWeight:700, fontFamily:"'Familjen Grotesk',sans-serif", color:'#dde3f0', marginBottom:8 }}>
                    {fmtDuration(calcWorkSeconds())}
                  </div>
                  <div style={{ display:'flex', gap:4' }}>
                    {session.status==='online' && <button onClick={handleBreak} style={{ flex:1, padding:'5px 0', borderRadius:6, border:'1px solid #f09a2a', background:'transparent', color:'#f09a2a', fontSize:11, fontWeight:600, cursor:'pointer' }}>Break</button>}
                    {session.status==='break' && <button onClick={handleResume} style={{ flex:1, padding:'5px 0', borderRadius:6, border:'1px solid #0fba7a', background:'transparent', color:'#0fba7a', fontSize:11, fontWeight:600, cursor:'pointer' }}>Resume</button>}
                    <button onClick={handleClockOut} style={{ flex:1, padding:'5px 0', borderRadius:6, border:'1px solid #e8344a', background:'transparent', color:'#e8344a', fontSize:11, fontWeight:600, cursor:'pointer' }}>Clock Out</button>
                  </div>
                </>
              ) : (
                <button onClick={handleClockIn} style={{ width:'100%', padding:'8px 0', borderRadius:8, border:'none', background:'linear-gradient(135deg,#0fba7a,#06d68a)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>🟢 Clock In</button>
              )}
            </div>
          )}

          {/* Nav */}
          <nav style={{ flex:1, overflowY:'auto', padding:'8px 8px' }}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setPage(item.id)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:10, border:'none',
                background: page===item.id ? 'linear-gradient(135deg,#4f8ef722,#7c5cf622)' : 'transparent',
                color: page===item.id ? '#4f8ef7' : '#5a6a8a', cursor:'pointer', marginBottom:2, transition:'all .15s',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                borderLeft: page===item.id ? '2px solid #4f8ef7' : '2px solid transparent'
              }}>
                <span style={{ fontSize:16 }}>{item.icon}</span>
                {sidebarOpen && <span style={{ fontSize:13, fontWeight:600 }}>{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* User */}
          <div style={{ padding:'12px 14px', borderTop:'1px solid #111827', display:'flex', alignItems:'center', gap:10 }}>
            <Avatar name={user.name} size={32} />
            {sidebarOpen && (
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</div>
                <div style={{ fontSize:10, color:'#5a6a8a', textTransform:'uppercase' }}>{user.role}</div>
              </div>
            )}
            {sidebarOpen && <button onClick={logout} style={{ background:'none', border:'none', color:'#5a6a8a', cursor:'pointer', fontSize:16 }}>→</button>}
          </div>
        </div>

        {/* Main */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Topbar */}
          <div style={{ height:52, background:'#07090f', borderBottom:'1px solid #111827', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', flexShrink:0 }}>
            <button onClick={() => setSidebarOpen(o=>!o)} style={{ background:'none', border:'none', color:'#5a6a8a', cursor:'pointer', fontSize:18, padding:4 }}>☰</button>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {/* Notification bell */}
              <div style={{ position:'relative' }}>
                <button onClick={() => { setShowNotifs(o=>!o); if(unread>0&&!USE_MOCK) markAllRead(user.id) }} style={{ background:'none', border:'1px solid #1a2238', borderRadius:8, color:'#8a9bc0', cursor:'pointer', padding:'5px 8px', fontSize:16 }}>🔔</button>
                {unread > 0 && <div style={{ position:'absolute', top:-4, right:-4, background:'#e8344a', borderRadius:'50%', width:16, height:16, fontSize:9, fontWeight:700, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>{unread}</div>}
                {showNotifs && (
                  <div style={{ position:'absolute', right:0, top:40, width:320, background:'#0d1221', border:'1px solid #1a2238', borderRadius:12, zIndex:100, boxShadow:'0 8px 32px #00000088', overflow:'hidden' }}>
                    <div style={{ padding:'12px 16px', borderBottom:'1px solid #1a2238', display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:13, fontWeight:600 }}>Notifications</span>
                      <button onClick={()=>{setNotifications(p=>p.map(n=>({...n,read:true})));setShowNotifs(false)}} style={{ background:'none', border:'none', color:'#5a6a8a', cursor:'pointer', fontSize:11 }}>Mark all read</button>
                    </div>
                    <div style={{ maxHeight:360, overflowY:'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding:24, textAlign:'center', color:'#3a4a6a', fontSize:12 }}>All caught up ✓</div>
                      ) : notifications.slice(0,20).map(n => (
                        <div key={n.id} style={{ padding:'10px 16px', borderBottom:'1px solid #111827', background:n.read?'transparent':'#4f8ef708' }}>
                          <div style={{ fontSize:12, fontWeight:n.read?400:600, color:n.read?'#5a6a8a':'#dde3f0' }}>{n.title}</div>
                          <div style={{ fontSize:11, color:'#3a4a6a', marginTop:2 }}>{n.message}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Btn variant="ghost" size="sm" onClick={logout}>Sign out</Btn>
            </div>
          </div>

          {/* Page content */}
          <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
            {page === 'home'          && <HomePage user={user} profiles={profiles} session={session} onClockIn={handleClockIn} calcWork={calcWorkSeconds} notifications={notifications} setPage={setPage} />}
            {page === 'attendance'    && <AttendanceModule user={user} profiles={profiles} />}
            {page === 'tasks'         && <TasksModule user={user} profiles={profiles} />}
            {page === 'surveys'       && <SurveysModule user={user} profiles={profiles} />}
            {page === 'leave'         && <LeaveModule user={user} profiles={profiles} />}
            {page === 'announcements' && <AnnouncementsModule user={user} profiles={profiles} />}
            {page === 'lms'           && <LMSModule user={user} profiles={profiles} />}
            {page === 'comms'         && <CommsModule user={user} profiles={profiles} />}
            {page === 'team'          && user.role==='admin' && <TeamPage profiles={profiles} />}
          </div>
        </div>
      </div>

      {/* EOD Modal */}
      {showEOD && (
        <Modal title="📋 End of Day Report" onClose={() => setShowEOD(false)}>
          <p style={{ fontSize:13, color:'#5a6a8a', marginBottom:16 }}>This will be sent to your client via SMS and email.</p>
          <FormField label="✅ Tasks Completed Today">
            <textarea value={eodForm.tasks} onChange={e=>setEodForm(f=>({...f,tasks:e.target.value}))} rows={3} placeholder="What did you accomplish today?" />
          </FormField>
          <FormField label="🚧 Challenges / Blockers">
            <textarea value={eodForm.blockers} onChange={e=>setEodForm(f=>({...f,blockers:e.target.value}))} rows={2} placeholder="Any issues or blockers?" />
          </FormField>
          <FormField label="📅 Plans for Tomorrow">
            <textarea value={eodForm.plans} onChange={e=>setEodForm(f=>({...f,plans:e.target.value}))} rows={2} placeholder="What will you focus on tomorrow?" />
          </FormField>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
            <Btn variant="ghost" onClick={() => setShowEOD(false)}>Cancel</Btn>
            <Btn variant="danger" onClick={submitEOD}>🔴 Submit & Clock Out</Btn>
          </div>
        </Modal>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </>
  )
}

// ─── HOME PAGE ────────────────────────────────────────────────
function HomePage({ user, profiles, session, onClockIn, calcWork, notifications, setPage }) {
  const vas = profiles.filter(p => p.role === 'va')
  const unreadNotifs = notifications.filter(n => !n.read).length

  if (user.role === 'admin') {
    const online = profiles.filter(p => p.role === 'va') // Would check live sessions
    return (
      <div>
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontFamily:"'Familjen Grotesk',sans-serif", fontSize:24, fontWeight:800, marginBottom:4 }}>Good {getGreeting()}, Chris 👋</h1>
          <p style={{ color:'#5a6a8a', fontSize:13 }}>Here's your team overview</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
          {[['👥','Total VAs',profiles.filter(p=>p.role==='va').length,'#4f8ef7'],['🏢','Clients',profiles.filter(p=>p.role==='client').length,'#7c5cf6'],['🔔','Unread Notifs',unreadNotifs,'#f09a2a'],['📌','Total Users',profiles.length,'#0fba7a']].map(([icon,label,val,color])=>(
            <Card key={label} style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:color+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{icon}</div>
              <div><div style={{ fontSize:22, fontWeight:700, color, fontFamily:"'Familjen Grotesk',sans-serif" }}>{val}</div><div style={{ fontSize:11, color:'#5a6a8a' }}>{label}</div></div>
            </Card>
          ))}
        </div>
        <QuickLinks setPage={setPage} role="admin" />
      </div>
    )
  }

  if (user.role === 'va') {
    return (
      <div>
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontFamily:"'Familjen Grotesk',sans-serif", fontSize:24, fontWeight:800, marginBottom:4 }}>Good {getGreeting()}, {user.name.split(' ')[0]} 👋</h1>
          <p style={{ color:'#5a6a8a', fontSize:13 }}>{session ? `You're currently ${session.status === 'break' ? 'on break' : 'working'} — ${fmtDuration(calcWork())} so far` : "You haven't clocked in yet today"}</p>
        </div>
        {!session && (
          <Card style={{ marginBottom:20, textAlign:'center', padding:32 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🟢</div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Ready to start your day?</div>
            <Btn onClick={onClockIn}>Clock In Now</Btn>
          </Card>
        )}
        <QuickLinks setPage={setPage} role="va" />
      </div>
    )
  }

  if (user.role === 'client') {
    return (
      <div>
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontFamily:"'Familjen Grotesk',sans-serif", fontSize:24, fontWeight:800, marginBottom:4 }}>Good {getGreeting()}, {user.name.split(' ')[0]} 👋</h1>
        </div>
        <QuickLinks setPage={setPage} role="client" />
      </div>
    )
  }
}

function QuickLinks({ setPage, role }) {
  const links = {
    admin: [['📊','Attendance Reports','attendance'],['📌','All Tasks','tasks'],['⭐','Surveys','surveys'],['🏖️','Leave Requests','leave'],['📢','Post Announcement','announcements'],['🎓','Learning Center','lms']],
    va:    [['📌','My Tasks','tasks'],['🏖️','File Leave','leave'],['🎓','Learning Center','lms'],['💬','Team Comms','comms'],['📢','Announcements','announcements'],['⭐','My Reviews','surveys']],
    client:[['📌','Assign Tasks','tasks'],['⭐','Rate My VA','surveys'],['📊','Attendance Log','attendance'],['💬','Team Comms','comms'],['📢','Announcements','announcements']],
  }
  return (
    <div>
      <div style={{ fontSize:11, color:'#5a6a8a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:12 }}>Quick Access</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {(links[role]||[]).map(([icon,label,page])=>(
          <Card key={page} onClick={()=>setPage(page)} style={{ cursor:'pointer', padding:'16px 18px', display:'flex', alignItems:'center', gap:12, transition:'border-color .2s' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#4f8ef788'} onMouseLeave={e=>e.currentTarget.style.borderColor='#1a2238'}>
            <span style={{ fontSize:22 }}>{icon}</span>
            <span style={{ fontSize:13, fontWeight:600 }}>{label}</span>
          </Card>
        ))}
      </div>
    </div>
  )
}

function TeamPage({ profiles }) {
  const vas = profiles.filter(p => p.role === 'va')
  const clients = profiles.filter(p => p.role === 'client')
  return (
    <div>
      <h2 style={{ fontFamily:"'Familjen Grotesk',sans-serif", fontSize:20, fontWeight:700, marginBottom:20 }}>👥 Team Directory</h2>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div>
          <div style={{ fontSize:11, color:'#5a6a8a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:12 }}>Virtual Assistants ({vas.length})</div>
          {vas.map(v => (
            <Card key={v.id} style={{ marginBottom:10, display:'flex', gap:12, alignItems:'center' }}>
              <Avatar name={v.name} size={40} />
              <div>
                <div style={{ fontSize:14, fontWeight:600 }}>{v.name}</div>
                <div style={{ fontSize:12, color:'#5a6a8a' }}>{v.email}</div>
                {v.client_id && <div style={{ fontSize:11, color:'#4f8ef7', marginTop:2 }}>→ {profiles.find(p=>p.id===v.client_id)?.name || 'Unassigned'}</div>}
              </div>
            </Card>
          ))}
        </div>
        <div>
          <div style={{ fontSize:11, color:'#5a6a8a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:12 }}>Clients ({clients.length})</div>
          {clients.map(c => (
            <Card key={c.id} style={{ marginBottom:10, display:'flex', gap:12, alignItems:'center' }}>
              <Avatar name={c.name} size={40} />
              <div>
                <div style={{ fontSize:14, fontWeight:600 }}>{c.name}</div>
                <div style={{ fontSize:12, color:'#5a6a8a' }}>{c.email}</div>
                <div style={{ fontSize:11, color:'#0fba7a', marginTop:2 }}>{vas.filter(v=>v.client_id===c.id).length} VA(s) assigned</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── LOGIN PAGE ───────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const DEMOS = [
    ['chris@eostaff.com','admin','👑 Admin — Chris'],
    ['chris@paymentpilot.com','Chris - VA','🎧 VA — Chris'],
    ['chriskillellc@gmail.com','Chris - Client','🏢 Client — Chris Kille LLC'],
  ]

  const submit = async () => {
    setLoading(true); setError('')
    try { await onLogin(email, password) } catch(e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <>
      <GlobalStyles />
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#07090f', padding:20 }}>
        <div style={{ width:'100%', maxWidth:400 }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>⚡</div>
            <h1 style={{ fontFamily:"'Familjen Grotesk',sans-serif", fontSize:28, fontWeight:800, background:'linear-gradient(135deg,#4f8ef7,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Command Center</h1>
            <p style={{ color:'#5a6a8a', fontSize:13, marginTop:4 }}>VA Operations Platform</p>
          </div>
          <Card style={{ padding:28 }}>
            <FormField label="Email"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" onKeyDown={e=>e.key==='Enter'&&submit()} /></FormField>
            <FormField label="Password"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&submit()} /></FormField>
            {error && <div style={{ fontSize:12, color:'#e8344a', marginBottom:12, padding:'8px 12px', background:'#e8344a11', borderRadius:8 }}>{error}</div>}
            <Btn onClick={submit} disabled={loading} style={{ width:'100%', justifyContent:'center' }}>{loading?'Signing in…':'Sign In →'}</Btn>

            <div style={{ marginTop:24, borderTop:'1px solid #1a2238', paddingTop:18 }}>
              <div style={{ fontSize:11, color:'#3a4a6a', textAlign:'center', marginBottom:12, textTransform:'uppercase', letterSpacing:.5 }}>Demo Accounts</div>
              {DEMOS.map(([e,p,label]) => (
                <button key={e} onClick={() => { setEmail(e); setPassword(p) }} style={{ width:'100%', padding:'7px 12px', marginBottom:6, borderRadius:8, border:'1px solid #1a2238', background:'transparent', color:'#8a9bc0', cursor:'pointer', fontSize:12, textAlign:'left', transition:'border-color .2s' }}
                  onMouseEnter={ev=>ev.currentTarget.style.borderColor='#4f8ef7'} onMouseLeave={ev=>ev.currentTarget.style.borderColor='#1a2238'}>
                  {label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
