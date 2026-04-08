import { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { Card, StatCard, Btn, SectionHeader, fmtDate, fmtTime, fmtDuration, Grid, Empty } from "../../components/UI.jsx"
import { getAttendanceDaily } from "../../lib/supabase.js"

const PERIODS = [
  { id:'daily', label:'Daily' },
  { id:'weekly', label:'Weekly' },
  { id:'monthly', label:'Monthly' },
]

export default function AttendanceModule({ user, profiles = [] }) {
  const [period, setPeriod] = useState('weekly')
  const [records, setRecords] = useState([])
  const [selectedVA, setSelectedVA] = useState(user.role === 'va' ? user.id : 'all')
  const [loading, setLoading] = useState(true)

  const vas = profiles.filter(p => p.role === 'va')

  useEffect(() => { load() }, [period, selectedVA])

  const load = async () => {
    setLoading(true)
    const now = new Date()
    let from
    if (period === 'daily')   from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
    if (period === 'weekly')  from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 56)
    if (period === 'monthly') from = new Date(now.getFullYear() - 1, now.getMonth(), 1)
    const vaId = selectedVA === 'all' ? null : selectedVA
    const data = await getAttendanceDaily(vaId, from?.toISOString().split('T')[0], null)
    setRecords(data)
    setLoading(false)
  }

  // Aggregate by period
  const chartData = (() => {
    if (period === 'daily') {
      return records.slice(0, 30).map(r => ({
        label: new Date(r.work_date).toLocaleDateString('en-US', { month:'short', day:'numeric' }),
        hours: Math.round((r.work_seconds || 0) / 3600 * 10) / 10,
        va: r.va_name
      })).reverse()
    }
    if (period === 'weekly') {
      const weeks = {}
      records.forEach(r => {
        const d = new Date(r.work_date)
        d.setDate(d.getDate() - d.getDay() + 1)
        const key = d.toISOString().split('T')[0]
        if (!weeks[key]) weeks[key] = { label: `W/O ${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`, hours: 0, days: 0 }
        weeks[key].hours += (r.work_seconds || 0) / 3600
        weeks[key].days++
      })
      return Object.values(weeks).map(w => ({ ...w, hours: Math.round(w.hours * 10) / 10 })).slice(-8)
    }
    if (period === 'monthly') {
      const months = {}
      records.forEach(r => {
        const d = new Date(r.work_date)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        const label = d.toLocaleDateString('en-US', { month:'short', year:'numeric' })
        if (!months[key]) months[key] = { label, hours: 0, days: 0 }
        months[key].hours += (r.work_seconds || 0) / 3600
        months[key].days++
      })
      return Object.values(months).map(m => ({ ...m, hours: Math.round(m.hours * 10) / 10 }))
    }
  })()

  const totalHours = records.reduce((s, r) => s + (r.work_seconds || 0) / 3600, 0)
  const totalDays  = new Set(records.map(r => r.work_date)).size
  const avgDaily   = totalDays > 0 ? totalHours / totalDays : 0

  return (
    <div>
      <SectionHeader title="📊 Attendance Reports" action={
        <div style={{ display:'flex', gap:8 }}>
          {user.role !== 'va' && (
            <select value={selectedVA} onChange={e => setSelectedVA(e.target.value)}
              style={{ width:'auto', padding:'7px 12px', fontSize:12 }}>
              <option value="all">All VAs</option>
              {vas.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
          <div style={{ display:'flex', gap:4, background:'#07090f', borderRadius:8, padding:3, border:'1px solid #1a2238' }}>
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)} style={{
                padding:'5px 14px', borderRadius:6, border:'none', fontSize:12, fontWeight:600, cursor:'pointer',
                background: period===p.id ? 'linear-gradient(135deg,#4f8ef7,#7c5cf6)' : 'transparent',
                color: period===p.id ? '#fff' : '#5a6a8a'
              }}>{p.label}</button>
            ))}
          </div>
        </div>
      } />

      <Grid cols={3} gap={12} style={{ marginBottom:20 }}>
        <StatCard icon="⏱" label="Total Hours" value={`${Math.round(totalHours)}h`} color="#4f8ef7" />
        <StatCard icon="📅" label="Days Worked" value={totalDays} color="#0fba7a" />
        <StatCard icon="📈" label="Avg Hours/Day" value={`${avgDaily.toFixed(1)}h`} color="#f09a2a" />
      </Grid>

      <Card style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:16, color:'#8a9bc0' }}>
          Hours Worked — {period.charAt(0).toUpperCase()+period.slice(1)} View
        </div>
        {loading ? <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#3a4a6a' }}>Loading…</div> :
          chartData?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top:4, right:4, bottom:4, left:-20 }}>
                <XAxis dataKey="label" tick={{ fill:'#5a6a8a', fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'#5a6a8a', fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#0d1221', border:'1px solid #1a2238', borderRadius:8, fontSize:12 }} labelStyle={{ color:'#dde3f0' }} />
                <Bar dataKey="hours" fill="url(#barGrad)" radius={[4,4,0,0]} />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f8ef7" />
                    <stop offset="100%" stopColor="#7c5cf6" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty icon="📊" message="No attendance data for this period" />
        }
      </Card>

      {/* Detail table */}
      <Card>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:14, color:'#8a9bc0' }}>Detailed Log</div>
        {records.length === 0 ? <Empty icon="📋" message="No records found" /> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #1a2238' }}>
                  {['Date','VA','First Login','Last Logout','Hours Worked'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, color:'#5a6a8a', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 50).map((r, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #111827' }}>
                    <td style={{ padding:'10px 12px', color:'#dde3f0' }}>{fmtDate(r.work_date)}</td>
                    <td style={{ padding:'10px 12px', color:'#8a9bc0' }}>{r.va_name}</td>
                    <td style={{ padding:'10px 12px', color:'#5a6a8a' }}>{fmtTime(r.first_login)}</td>
                    <td style={{ padding:'10px 12px', color:'#5a6a8a' }}>{fmtTime(r.last_logout)}</td>
                    <td style={{ padding:'10px 12px', color:'#0fba7a', fontWeight:600 }}>{fmtDuration(r.work_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
