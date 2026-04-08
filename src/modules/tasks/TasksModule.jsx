import { useState, useEffect } from "react"
import { Card, Btn, Modal, Badge, Avatar, SectionHeader, StatCard, Grid, FormField, Empty, fmtDate } from "../../components/UI.jsx"
import { getTasks, createTask, updateTask, addTaskComment } from "../../lib/supabase.js"
import { pushNotification } from "../../lib/supabase.js"

const PRIORITY_COLORS = { high:'#e8344a', medium:'#f09a2a', low:'#0fba7a' }
const STATUS_LABELS = { todo:'To Do', inprogress:'In Progress', done:'Done' }

export default function TasksModule({ user, profiles = [] }) {
  const [tasks, setTasks] = useState([])
  const [view, setView] = useState('kanban')
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const filters = user.role === 'va' ? { vaId: user.id } : user.role === 'client' ? { clientId: user.id } : {}
    const data = await getTasks(filters)
    setTasks(data)
    setLoading(false)
  }

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')

  const handleStatusChange = async (taskId, status) => {
    const updated = await updateTask(taskId, { status })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated } : t))
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      const notifyId = user.role === 'va' ? task.client_id : task.va_id
      if (notifyId) await pushNotification(notifyId, '📌 Task Updated', `"${task.title}" moved to ${STATUS_LABELS[status]}`, 'task')
    }
  }

  // Stats
  const stats = { todo: tasks.filter(t=>t.status==='todo').length, inprogress: tasks.filter(t=>t.status==='inprogress').length, done: tasks.filter(t=>t.status==='done').length }

  return (
    <div>
      <SectionHeader title="📌 Tasks" action={
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', gap:4, background:'#07090f', borderRadius:8, padding:3, border:'1px solid #1a2238' }}>
            {['kanban','list','reports'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding:'5px 12px', borderRadius:6, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', background:view===v?'linear-gradient(135deg,#4f8ef7,#7c5cf6)':'transparent', color:view===v?'#fff':'#5a6a8a', textTransform:'capitalize' }}>{v}</button>
            ))}
          </div>
          <Btn size="sm" onClick={() => setShowNew(true)}>+ New Task</Btn>
        </div>
      } />

      {overdue.length > 0 && (
        <div style={{ background:'#e8344a11', border:'1px solid #e8344a33', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#e8344a' }}>
          ⚠️ {overdue.length} overdue task{overdue.length>1?'s':''}: {overdue.map(t=>t.title).join(', ')}
        </div>
      )}

      {view === 'kanban' && <KanbanView tasks={filtered} onStatusChange={handleStatusChange} onSelect={setSelected} filter={filter} setFilter={setFilter} />}
      {view === 'list' && <ListView tasks={filtered} onStatusChange={handleStatusChange} onSelect={setSelected} filter={filter} setFilter={setFilter} />}
      {view === 'reports' && <TaskReports tasks={tasks} stats={stats} />}

      {showNew && <NewTaskModal user={user} profiles={profiles} onClose={() => setShowNew(false)} onCreated={t => { setTasks(prev=>[t,...prev]); setShowNew(false) }} />}
      {selected && <TaskDetailModal task={selected} user={user} profiles={profiles} onClose={() => setSelected(null)} onUpdate={updated => { setTasks(prev=>prev.map(t=>t.id===updated.id?updated:t)); setSelected(updated) }} />}
    </div>
  )
}

function KanbanView({ tasks, onStatusChange, onSelect, filter, setFilter }) {
  const cols = ['todo','inprogress','done']
  return (
    <>
      <FilterBar filter={filter} setFilter={setFilter} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
        {cols.map(col => {
          const colTasks = tasks.filter(t => t.status === col)
          return (
            <div key={col}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#8a9bc0', textTransform:'uppercase', letterSpacing:.5, fontSize:11 }}>{STATUS_LABELS[col]}</span>
                <span style={{ background:'#1a2238', borderRadius:100, padding:'1px 8px', fontSize:11, color:'#5a6a8a' }}>{colTasks.length}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, minHeight:80 }}>
                {colTasks.map(t => <TaskCard key={t.id} task={t} onSelect={onSelect} onStatusChange={onStatusChange} />)}
                {colTasks.length === 0 && <div style={{ border:'1px dashed #1a2238', borderRadius:10, height:60, display:'flex', alignItems:'center', justifyContent:'center', color:'#2a3a5a', fontSize:12 }}>Empty</div>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function ListView({ tasks, onStatusChange, onSelect, filter, setFilter }) {
  return (
    <>
      <FilterBar filter={filter} setFilter={setFilter} />
      <Card style={{ padding:0, overflow:'hidden' }}>
        {tasks.length === 0 ? <Empty icon="📋" message="No tasks found" /> : tasks.map((t, i) => (
          <div key={t.id} onClick={() => onSelect(t)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: i<tasks.length-1?'1px solid #111827':'none', cursor:'pointer', transition:'background .15s' }}
            onMouseEnter={e=>e.currentTarget.style.background='#111827'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:PRIORITY_COLORS[t.priority], flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color: t.status==='done'?'#5a6a8a':'#dde3f0', textDecoration:t.status==='done'?'line-through':'none' }}>{t.title}</div>
              {t.due_date && <div style={{ fontSize:11, color: new Date(t.due_date)<new Date()&&t.status!=='done' ? '#e8344a' : '#5a6a8a', marginTop:2 }}>Due {fmtDate(t.due_date)}</div>}
            </div>
            <select value={t.status} onChange={e=>{e.stopPropagation();onStatusChange(t.id,e.target.value)}} style={{ width:'auto', padding:'4px 8px', fontSize:11 }} onClick={e=>e.stopPropagation()}>
              <option value="todo">To Do</option><option value="inprogress">In Progress</option><option value="done">Done</option>
            </select>
          </div>
        ))}
      </Card>
    </>
  )
}

function TaskCard({ task, onSelect, onStatusChange }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  return (
    <div onClick={() => onSelect(task)} style={{ background:'#0d1221', border:`1px solid ${isOverdue?'#e8344a44':'#1a2238'}`, borderRadius:10, padding:14, cursor:'pointer', transition:'all .15s' }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='#4f8ef788'} onMouseLeave={e=>e.currentTarget.style.borderColor=isOverdue?'#e8344a44':'#1a2238'}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:100, background:PRIORITY_COLORS[task.priority]+'22', color:PRIORITY_COLORS[task.priority], textTransform:'uppercase' }}>{task.priority}</span>
        {task.due_date && <span style={{ fontSize:10, color: isOverdue?'#e8344a':'#5a6a8a' }}>{fmtDate(task.due_date)}</span>}
      </div>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>{task.title}</div>
      {task.description && <div style={{ fontSize:11, color:'#5a6a8a', marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.description}</div>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:11, color:'#3a4a6a' }}>{task.task_comments?.length || 0} comments</span>
        <div style={{ display:'flex', gap:4 }}>
          {task.status !== 'done' && <button onClick={e=>{e.stopPropagation();onStatusChange(task.id, task.status==='todo'?'inprogress':'done')}} style={{ fontSize:10, padding:'2px 8px', borderRadius:6, border:'1px solid #1a2238', background:'transparent', color:'#5a6a8a', cursor:'pointer' }}>
            {task.status==='todo'?'▶ Start':'✓ Done'}
          </button>}
        </div>
      </div>
    </div>
  )
}

function FilterBar({ filter, setFilter }) {
  const opts = [['all','All'],['todo','To Do'],['inprogress','In Progress'],['done','Done']]
  return (
    <div style={{ display:'flex', gap:6, marginBottom:16 }}>
      {opts.map(([v,l]) => <button key={v} onClick={()=>setFilter(v)} style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${filter===v?'#4f8ef7':'#1a2238'}`, background:filter===v?'#4f8ef722':'transparent', color:filter===v?'#4f8ef7':'#5a6a8a', fontSize:12, fontWeight:600, cursor:'pointer' }}>{l}</button>)}
    </div>
  )
}

function TaskReports({ tasks, stats }) {
  const completedThisWeek = tasks.filter(t => {
    if (t.status !== 'done' || !t.completed_at) return false
    const d = new Date(t.completed_at)
    const now = new Date()
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate()-7)
    return d >= weekAgo
  })
  const completedThisMonth = tasks.filter(t => {
    if (t.status !== 'done' || !t.completed_at) return false
    const d = new Date(t.completed_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const completionRate = tasks.length > 0 ? Math.round((stats.done / tasks.length) * 100) : 0

  return (
    <div>
      <Grid cols={4} gap={12} style={{ marginBottom:20 }}>
        <StatCard icon="📋" label="Total Tasks" value={tasks.length} color="#4f8ef7" />
        <StatCard icon="✅" label="Completed" value={stats.done} sub={`${completionRate}% completion rate`} color="#0fba7a" />
        <StatCard icon="⏳" label="In Progress" value={stats.inprogress} color="#f09a2a" />
        <StatCard icon="⚠️" label="Overdue" value={overdue.length} color="#e8344a" />
      </Grid>
      <Grid cols={2} gap={16}>
        <Card>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'#8a9bc0' }}>✅ Completed This Week ({completedThisWeek.length})</div>
          {completedThisWeek.length === 0 ? <Empty icon="📋" message="None this week" /> :
            completedThisWeek.map(t => (
              <div key={t.id} style={{ padding:'8px 0', borderBottom:'1px solid #111827', fontSize:13 }}>
                <div style={{ color:'#0fba7a', fontWeight:600 }}>{t.title}</div>
                <div style={{ fontSize:11, color:'#5a6a8a', marginTop:2 }}>Completed {fmtDate(t.completed_at)}</div>
              </div>
            ))}
        </Card>
        <Card>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'#8a9bc0' }}>⚠️ Overdue Tasks ({overdue.length})</div>
          {overdue.length === 0 ? <Empty icon="🎉" message="Nothing overdue!" /> :
            overdue.map(t => (
              <div key={t.id} style={{ padding:'8px 0', borderBottom:'1px solid #111827', fontSize:13 }}>
                <div style={{ color:'#e8344a', fontWeight:600 }}>{t.title}</div>
                <div style={{ fontSize:11, color:'#5a6a8a', marginTop:2 }}>Due {fmtDate(t.due_date)}</div>
              </div>
            ))}
        </Card>
      </Grid>
    </div>
  )
}

function NewTaskModal({ user, profiles, onClose, onCreated }) {
  const [form, setForm] = useState({ title:'', description:'', priority:'medium', due_date:'', va_id: user.role==='va'?user.id:'' })
  const vas = profiles.filter(p => p.role === 'va')
  const set = (k, v) => setForm(f => ({...f, [k]:v}))

  const submit = async () => {
    if (!form.title) return
    const task = await createTask({ ...form, client_id: user.role==='client'?user.id:(profiles.find(p=>p.id===form.va_id)?.client_id||user.id), created_by: user.id, va_id: form.va_id || null })
    onCreated(task)
  }

  return (
    <Modal title="📌 New Task" onClose={onClose}>
      <FormField label="Task Title *"><input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="What needs to be done?" /></FormField>
      <FormField label="Description"><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={3} placeholder="Details…" /></FormField>
      <Grid cols={2}>
        <FormField label="Priority">
          <select value={form.priority} onChange={e=>set('priority',e.target.value)}>
            <option value="high">🔴 High</option><option value="medium">🟡 Medium</option><option value="low">🟢 Low</option>
          </select>
        </FormField>
        <FormField label="Due Date"><input type="date" value={form.due_date} onChange={e=>set('due_date',e.target.value)} /></FormField>
      </Grid>
      {user.role !== 'va' && vas.length > 0 && (
        <FormField label="Assign to VA">
          <select value={form.va_id} onChange={e=>set('va_id',e.target.value)}>
            <option value="">Unassigned</option>
            {vas.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </FormField>
      )}
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit}>Create Task</Btn>
      </div>
    </Modal>
  )
}

function TaskDetailModal({ task, user, profiles, onClose, onUpdate }) {
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState(task.status)

  const handleStatus = async (s) => {
    setStatus(s)
    const updated = await updateTask(task.id, { status: s })
    onUpdate({ ...task, ...updated })
  }
  const handleComment = async () => {
    if (!comment.trim()) return
    await addTaskComment(task.id, user.id, comment)
    setComment('')
    const updated = await getTasks({ vaId: user.role==='va'?user.id:null }).then(tasks => tasks.find(t=>t.id===task.id))
    if (updated) onUpdate(updated)
  }

  return (
    <Modal title={task.title} onClose={onClose} width={600}>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <select value={status} onChange={e=>handleStatus(e.target.value)} style={{ width:'auto', padding:'6px 12px', fontSize:12 }}>
          <option value="todo">To Do</option><option value="inprogress">In Progress</option><option value="done">Done</option>
        </select>
        <span style={{ padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:700, background:PRIORITY_COLORS[task.priority]+'22', color:PRIORITY_COLORS[task.priority] }}>{task.priority}</span>
        {task.due_date && <span style={{ fontSize:12, color:'#5a6a8a', padding:'4px 10px' }}>Due {fmtDate(task.due_date)}</span>}
      </div>
      {task.description && <p style={{ fontSize:13, color:'#8a9bc0', marginBottom:16, lineHeight:1.6 }}>{task.description}</p>}

      <div style={{ borderTop:'1px solid #1a2238', paddingTop:16 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'#5a6a8a', marginBottom:12, textTransform:'uppercase', letterSpacing:.5 }}>Comments ({task.task_comments?.length || 0})</div>
        <div style={{ maxHeight:200, overflowY:'auto', marginBottom:12 }}>
          {(task.task_comments || []).map(c => (
            <div key={c.id} style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, color:'#3a4a6a', marginBottom:3 }}>{fmtDate(c.created_at)}</div>
              <div style={{ fontSize:13, color:'#dde3f0', background:'#111827', padding:'8px 12px', borderRadius:8 }}>{c.text}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add a comment…" onKeyDown={e=>e.key==='Enter'&&handleComment()} />
          <Btn size="sm" onClick={handleComment}>Send</Btn>
        </div>
      </div>
    </Modal>
  )
}
