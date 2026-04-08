import { useState, useEffect } from "react"
import { Card, Btn, Modal, Stars, StatCard, Grid, SectionHeader, Empty, fmtDate, Badge } from "../../components/UI.jsx"
import { getSurveys, submitSurvey, getPendingSurveys } from "../../lib/supabase.js"
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts"

const CATEGORIES = [
  { key:'overall_rating',       label:'Overall Performance', icon:'⭐' },
  { key:'quality_rating',       label:'Quality of Work',     icon:'🎯' },
  { key:'communication_rating', label:'Communication',       icon:'💬' },
  { key:'timeliness_rating',    label:'Timeliness',          icon:'⏱' },
  { key:'initiative_rating',    label:'Initiative',          icon:'🚀' },
]

export default function SurveysModule({ user, profiles = [] }) {
  const [surveys, setSurveys] = useState([])
  const [pending, setPending] = useState([])
  const [activeSurvey, setActiveSurvey] = useState(null)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const filters = user.role === 'va' ? { vaId: user.id } : user.role === 'client' ? { clientId: user.id } : {}
    const [all, pend] = await Promise.all([
      getSurveys(filters),
      user.role === 'client' ? getPendingSurveys(user.id) : Promise.resolve([])
    ])
    setSurveys(all)
    setPending(pend)
    setLoading(false)
  }

  const submitted = surveys.filter(s => s.submitted_at)
  const avgRating = submitted.length > 0
    ? (submitted.reduce((s, r) => s + (r.overall_rating || 0), 0) / submitted.length).toFixed(1)
    : '—'

  // Trend data for chart
  const trendData = submitted.slice(-8).map(s => ({
    week: new Date(s.week_start).toLocaleDateString('en-US',{month:'short',day:'numeric'}),
    overall: s.overall_rating,
    quality: s.quality_rating,
    comms: s.communication_rating,
    time: s.timeliness_rating,
    init: s.initiative_rating,
  }))

  // Radar data for latest survey
  const latestSurvey = submitted[0]
  const radarData = latestSurvey ? CATEGORIES.map(c => ({
    category: c.label.split(' ')[0],
    value: latestSurvey[c.key] || 0
  })) : []

  return (
    <div>
      <SectionHeader title="⭐ Performance Surveys" action={
        pending.length > 0 && <Badge color="#f09a2a">{pending.length} pending</Badge>
      } />

      {/* Pending surveys for client */}
      {pending.length > 0 && (
        <div style={{ marginBottom:20 }}>
          {pending.map(s => (
            <div key={s.id} style={{ background:'#f09a2a11', border:'1px solid #f09a2a33', borderRadius:12, padding:'14px 18px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#f09a2a' }}>⭐ Rate {s.va?.name} — Week of {fmtDate(s.week_start)}</div>
                <div style={{ fontSize:11, color:'#5a6a8a', marginTop:2 }}>Takes less than 2 minutes</div>
              </div>
              <Btn size="sm" variant="warning" onClick={() => setActiveSurvey(s)}>Rate Now</Btn>
            </div>
          ))}
        </div>
      )}

      <Grid cols={3} gap={12} style={{ marginBottom:20 }}>
        <StatCard icon="⭐" label="Avg Rating" value={avgRating} sub="overall performance" color="#f09a2a" />
        <StatCard icon="📋" label="Surveys Submitted" value={submitted.length} color="#4f8ef7" />
        <StatCard icon="⏳" label="Pending" value={pending.length} color="#e8344a" />
      </Grid>

      {/* Tab switcher */}
      <div style={{ display:'flex', gap:4, background:'#07090f', borderRadius:10, padding:4, border:'1px solid #1a2238', marginBottom:16, width:'fit-content' }}>
        {['overview','trend','history'].map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{ padding:'6px 16px', borderRadius:8, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', textTransform:'capitalize', background:tab===t?'linear-gradient(135deg,#4f8ef7,#7c5cf6)':'transparent', color:tab===t?'#fff':'#5a6a8a' }}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <Grid cols={2} gap={16}>
          <Card>
            <div style={{ fontSize:13, fontWeight:600, color:'#8a9bc0', marginBottom:16 }}>Latest Week — Category Breakdown</div>
            {latestSurvey ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#1a2238" />
                    <PolarAngleAxis dataKey="category" tick={{ fill:'#5a6a8a', fontSize:11 }} />
                    <Radar dataKey="value" stroke="#4f8ef7" fill="#4f8ef7" fillOpacity={0.2} />
                  </RadarChart>
                </ResponsiveContainer>
                <div style={{ marginTop:12 }}>
                  {CATEGORIES.map(c => (
                    <div key={c.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #111827' }}>
                      <span style={{ fontSize:12, color:'#8a9bc0' }}>{c.icon} {c.label}</span>
                      <Stars value={latestSurvey[c.key] || 0} size={16} />
                    </div>
                  ))}
                </div>
              </>
            ) : <Empty icon="⭐" message="No surveys submitted yet" />}
          </Card>

          <Card>
            <div style={{ fontSize:13, fontWeight:600, color:'#8a9bc0', marginBottom:16 }}>Latest Feedback</div>
            {submitted.slice(0, 5).map(s => (
              <div key={s.id} style={{ padding:'10px 0', borderBottom:'1px solid #111827' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#5a6a8a' }}>Week of {fmtDate(s.week_start)}</span>
                  <Stars value={s.overall_rating || 0} size={14} />
                </div>
                {s.feedback && <p style={{ fontSize:12, color:'#8a9bc0', fontStyle:'italic', lineHeight:1.5 }}>"{s.feedback}"</p>}
              </div>
            ))}
            {submitted.length === 0 && <Empty icon="💬" message="No feedback yet" />}
          </Card>
        </Grid>
      )}

      {tab === 'trend' && (
        <Card>
          <div style={{ fontSize:13, fontWeight:600, color:'#8a9bc0', marginBottom:16 }}>Rating Trend — Last 8 Weeks</div>
          {trendData.length > 1 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData} margin={{ top:4, right:4, bottom:4, left:-20 }}>
                <XAxis dataKey="week" tick={{ fill:'#5a6a8a', fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0,5]} ticks={[1,2,3,4,5]} tick={{ fill:'#5a6a8a', fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#0d1221', border:'1px solid #1a2238', borderRadius:8, fontSize:12 }} />
                <Line type="monotone" dataKey="overall" stroke="#f09a2a" strokeWidth={2} dot={{ fill:'#f09a2a', r:3 }} name="Overall" />
                <Line type="monotone" dataKey="quality" stroke="#4f8ef7" strokeWidth={1.5} dot={false} name="Quality" />
                <Line type="monotone" dataKey="comms" stroke="#0fba7a" strokeWidth={1.5} dot={false} name="Comms" />
                <Line type="monotone" dataKey="time" stroke="#7c5cf6" strokeWidth={1.5} dot={false} name="Timeliness" />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty icon="📈" message="Need at least 2 weeks of data for trend" />}
        </Card>
      )}

      {tab === 'history' && (
        <Card style={{ padding:0, overflow:'hidden' }}>
          {surveys.length === 0 ? <Empty icon="📋" message="No surveys yet" /> : surveys.map((s, i) => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:i<surveys.length-1?'1px solid #111827':'none' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>Week of {fmtDate(s.week_start)}</div>
                <div style={{ fontSize:11, color:'#5a6a8a', marginTop:2 }}>{s.va?.name || 'VA'} → {s.client?.name || 'Client'}</div>
              </div>
              {s.submitted_at ? (
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Stars value={s.overall_rating || 0} size={14} />
                  <span style={{ fontSize:11, color:'#5a6a8a' }}>{fmtDate(s.submitted_at)}</span>
                </div>
              ) : (
                <Badge color="#f09a2a">Pending</Badge>
              )}
            </div>
          ))}
        </Card>
      )}

      {activeSurvey && (
        <SurveyForm survey={activeSurvey} onClose={() => setActiveSurvey(null)} onSubmitted={updated => {
          setSurveys(prev => prev.map(s => s.id===updated.id ? updated : s))
          setPending(prev => prev.filter(s => s.id !== updated.id))
          setActiveSurvey(null)
        }} />
      )}
    </div>
  )
}

function SurveyForm({ survey, onClose, onSubmitted }) {
  const [ratings, setRatings] = useState({ overall_rating:0, quality_rating:0, communication_rating:0, timeliness_rating:0, initiative_rating:0, feedback:'' })

  const submit = async () => {
    if (!ratings.overall_rating) return alert('Please provide an overall rating')
    const updated = await submitSurvey(survey.id, ratings)
    onSubmitted(updated)
  }

  return (
    <Modal title={`⭐ Rate ${survey.va?.name} — Week of ${fmtDate(survey.week_start)}`} onClose={onClose} width={500}>
      <p style={{ fontSize:13, color:'#5a6a8a', marginBottom:20 }}>Rate on a scale of 1–5 stars. Your feedback helps the VA grow.</p>
      {CATEGORIES.map(c => (
        <div key={c.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid #111827' }}>
          <span style={{ fontSize:13, color:'#dde3f0' }}>{c.icon} {c.label}</span>
          <Stars value={ratings[c.key]} onChange={v => setRatings(r=>({...r,[c.key]:v}))} />
        </div>
      ))}
      <div style={{ marginTop:16 }}>
        <label>Additional Feedback (optional)</label>
        <textarea value={ratings.feedback} onChange={e=>setRatings(r=>({...r,feedback:e.target.value}))} rows={3} placeholder="What did they do well? Any areas for improvement?" />
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="warning" onClick={submit}>Submit Review ⭐</Btn>
      </div>
    </Modal>
  )
}
