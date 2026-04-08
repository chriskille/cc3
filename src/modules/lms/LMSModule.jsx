import { useState, useEffect } from "react"
import { Card, Btn, Modal, Badge, StatCard, Grid, SectionHeader, FormField, Empty, fmtDate, Avatar } from "../../components/UI.jsx"
import { getCourses, getCourseWithModules, createCourse, createModule, addQuizQuestion, getVAProgress, markModuleComplete, getCertificates, issueCertificate } from "../../lib/supabase.js"

const TYPE_ICONS = { pdf:'📄', video:'🎬', text:'📝', quiz:'❓' }
const TYPE_LABELS = { pdf:'PDF Document', video:'Video', text:'Reading', quiz:'Quiz' }

export default function LMSModule({ user, profiles = [] }) {
  const [courses, setCourses] = useState([])
  const [progress, setProgress] = useState([])
  const [certs, setCerts] = useState([])
  const [selected, setSelected] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [tab, setTab] = useState(user.role === 'admin' ? 'courses' : 'my-learning')

  useEffect(() => { load() }, [])

  const load = async () => {
    const [c, p, ce] = await Promise.all([
      getCourses(),
      user.role === 'va' ? getVAProgress(user.id) : Promise.resolve([]),
      user.role === 'va' ? getCertificates(user.id) : Promise.resolve([]),
    ])
    setCourses(c)
    setProgress(p)
    setCerts(ce)
  }

  const getCourseProgress = (courseId) => {
    const courseProgress = progress.filter(p => p.course_id === courseId && p.completed)
    const course = courses.find(c => c.id === courseId)
    const total = course?.lms_modules?.[0]?.count || 0
    return total > 0 ? Math.round((courseProgress.length / total) * 100) : 0
  }

  const hasCert = (courseId) => certs.some(c => c.course_id === courseId)

  const vas = profiles.filter(p => p.role === 'va')
  const allProgress = user.role === 'admin' ? [] : progress

  return (
    <div>
      <SectionHeader title="🎓 Learning Center" action={
        user.role === 'admin' && <Btn size="sm" onClick={() => setShowNew(true)}>+ New Course</Btn>
      } />

      <div style={{ display:'flex', gap:4, background:'#07090f', borderRadius:10, padding:4, border:'1px solid #1a2238', marginBottom:20, width:'fit-content' }}>
        {(user.role === 'admin'
          ? [{ id:'courses', label:'All Courses' }, { id:'progress', label:'VA Progress' }]
          : [{ id:'my-learning', label:'My Learning' }, { id:'certificates', label:'🏆 Certificates' }]
        ).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'6px 16px', borderRadius:8, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', background:tab===t.id?'linear-gradient(135deg,#4f8ef7,#7c5cf6)':'transparent', color:tab===t.id?'#fff':'#5a6a8a' }}>{t.label}</button>
        ))}
      </div>

      {(tab === 'courses' || tab === 'my-learning') && (
        <>
          {courses.filter(c => c.is_required).length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:'#e8344a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>⚠️ Required Courses</div>
              <Grid cols={3} gap={14}>
                {courses.filter(c => c.is_required).map(c => (
                  <CourseCard key={c.id} course={c} progress={getCourseProgress(c.id)} hasCert={hasCert(c.id)} onOpen={() => setSelected(c.id)} isAdmin={user.role==='admin'} />
                ))}
              </Grid>
            </div>
          )}
          {courses.filter(c => !c.is_required).length > 0 && (
            <div>
              <div style={{ fontSize:11, color:'#5a6a8a', fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>All Courses</div>
              <Grid cols={3} gap={14}>
                {courses.filter(c => !c.is_required).map(c => (
                  <CourseCard key={c.id} course={c} progress={getCourseProgress(c.id)} hasCert={hasCert(c.id)} onOpen={() => setSelected(c.id)} isAdmin={user.role==='admin'} />
                ))}
              </Grid>
            </div>
          )}
          {courses.length === 0 && <Empty icon="🎓" message="No courses yet. Admin can add courses from this page." />}
        </>
      )}

      {tab === 'certificates' && (
        <div>
          {certs.length === 0 ? <Empty icon="🏆" message="Complete a course to earn your first certificate!" /> :
            <Grid cols={3} gap={14}>
              {certs.map(c => (
                <Card key={c.id} style={{ textAlign:'center', padding:28 }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>🏆</div>
                  <div style={{ fontFamily:"'Familjen Grotesk',sans-serif", fontSize:16, fontWeight:700, marginBottom:4 }}>{c.course?.title}</div>
                  <div style={{ fontSize:12, color:'#5a6a8a', marginBottom:12 }}>Completed {fmtDate(c.issued_at)}</div>
                  <Badge color="#f09a2a">Certificate of Completion</Badge>
                </Card>
              ))}
            </Grid>
          }
        </div>
      )}

      {tab === 'progress' && user.role === 'admin' && (
        <Card>
          <div style={{ fontSize:13, fontWeight:600, color:'#8a9bc0', marginBottom:16 }}>VA Progress Overview</div>
          {vas.length === 0 ? <Empty icon="👥" message="No VAs yet" /> :
            vas.map(va => (
              <div key={va.id} style={{ padding:'12px 0', borderBottom:'1px solid #111827' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <Avatar name={va.name} size={32} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{va.name}</div>
                      <div style={{ fontSize:11, color:'#5a6a8a' }}>{va.email}</div>
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {courses.map(c => {
                    const pct = 0 // Would load per-VA progress in production
                    return (
                      <div key={c.id} style={{ fontSize:11, padding:'3px 10px', borderRadius:100, background:'#1a2238', color:'#5a6a8a' }}>
                        {c.title}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          }
        </Card>
      )}

      {selected && (
        <CourseViewer courseId={selected} user={user} progress={progress}
          onClose={() => setSelected(null)}
          onProgress={(courseId, moduleId, score) => {
            markModuleComplete(user.id, courseId, moduleId, score)
            setProgress(prev => [...prev.filter(p=>!(p.course_id===courseId&&p.module_id===moduleId)), { course_id:courseId, module_id:moduleId, completed:true, quiz_score:score }])
          }}
          onCertEarned={(courseId) => {
            issueCertificate(user.id, courseId)
            setCerts(prev => [...prev, { course_id: courseId, course: courses.find(c=>c.id===courseId), issued_at: new Date().toISOString() }])
          }}
        />
      )}

      {showNew && <NewCourseModal user={user} onClose={() => setShowNew(false)} onCreated={c => { setCourses(prev=>[...prev,c]); setShowNew(false) }} />}
    </div>
  )
}

function CourseCard({ course, progress, hasCert, onOpen, isAdmin }) {
  return (
    <Card style={{ cursor:'pointer', transition:'border-color .2s' }} onClick={onOpen}
      onMouseEnter={e=>e.currentTarget.style.borderColor='#4f8ef788'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='#1a2238'}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ fontSize:28 }}>🎓</div>
        <div style={{ display:'flex', gap:4 }}>
          {course.is_required && <Badge color="#e8344a">Required</Badge>}
          {hasCert && <span style={{ fontSize:16 }}>🏆</span>}
        </div>
      </div>
      <div style={{ fontFamily:"'Familjen Grotesk',sans-serif", fontSize:14, fontWeight:700, marginBottom:6 }}>{course.title}</div>
      {course.description && <div style={{ fontSize:12, color:'#5a6a8a', marginBottom:12, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{course.description}</div>}
      <div style={{ marginBottom:6 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#5a6a8a', marginBottom:4 }}>
          <span>Progress</span><span>{progress}%</span>
        </div>
        <div style={{ height:4, background:'#1a2238', borderRadius:2 }}>
          <div style={{ height:'100%', borderRadius:2, background: progress===100?'#0fba7a':'linear-gradient(90deg,#4f8ef7,#7c5cf6)', width:`${progress}%`, transition:'width .4s' }} />
        </div>
      </div>
    </Card>
  )
}

function CourseViewer({ courseId, user, progress, onClose, onProgress, onCertEarned }) {
  const [course, setCourse] = useState(null)
  const [activeModule, setActiveModule] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizScore, setQuizScore] = useState(null)

  useEffect(() => { getCourseWithModules(courseId).then(setCourse) }, [courseId])

  if (!course) return null

  const modules = course.lms_modules?.sort((a,b)=>a.order_index-b.order_index) || []
  const mod = modules[activeModule]
  const isCompleted = (moduleId) => progress.some(p => p.module_id === moduleId && p.completed)

  const handleComplete = async () => {
    await onProgress(courseId, mod.id, null)
    if (activeModule < modules.length - 1) {
      setActiveModule(activeModule + 1)
    } else {
      onCertEarned(courseId)
      alert('🏆 Congratulations! You completed the course and earned a certificate!')
    }
  }

  const handleQuizSubmit = () => {
    const questions = mod.lms_quiz_questions || []
    const correct = questions.filter((q, i) => quizAnswers[i] === q.correct_index).length
    const score = Math.round((correct / questions.length) * 100)
    setQuizScore(score)
    setQuizSubmitted(true)
    if (score >= 70) onProgress(courseId, mod.id, score)
  }

  return (
    <Modal title={course.title} onClose={onClose} width={800}>
      <div style={{ display:'flex', gap:20 }}>
        {/* Sidebar */}
        <div style={{ width:200, flexShrink:0, borderRight:'1px solid #1a2238', paddingRight:16 }}>
          <div style={{ fontSize:11, color:'#5a6a8a', fontWeight:600, textTransform:'uppercase', marginBottom:8 }}>Modules</div>
          {modules.map((m, i) => (
            <div key={m.id} onClick={() => { setActiveModule(i); setQuizSubmitted(false); setQuizAnswers({}) }}
              style={{ padding:'8px 10px', borderRadius:8, cursor:'pointer', marginBottom:4, background:i===activeModule?'#1a2238':'transparent',
                display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontSize:14 }}>{isCompleted(m.id)?'✅':TYPE_ICONS[m.type]}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:i===activeModule?600:400, color:i===activeModule?'#dde3f0':'#8a9bc0' }}>{m.title}</div>
                <div style={{ fontSize:10, color:'#3a4a6a' }}>{TYPE_LABELS[m.type]}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1 }}>
          {mod ? (
            <>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16 }}>
                <span style={{ fontSize:20 }}>{TYPE_ICONS[mod.type]}</span>
                <div>
                  <div style={{ fontSize:15, fontWeight:700 }}>{mod.title}</div>
                  <div style={{ fontSize:11, color:'#5a6a8a' }}>{TYPE_LABELS[mod.type]}</div>
                </div>
              </div>

              {mod.type === 'text' && (
                <div style={{ fontSize:13, color:'#8a9bc0', lineHeight:1.8, whiteSpace:'pre-wrap', maxHeight:320, overflowY:'auto', marginBottom:16 }}>{mod.content_text}</div>
              )}
              {mod.type === 'pdf' && mod.content_url && (
                <div style={{ marginBottom:16 }}>
                  <a href={mod.content_url} target="_blank" rel="noopener noreferrer">
                    <Btn variant="ghost" size="sm">📄 Open PDF</Btn>
                  </a>
                </div>
              )}
              {mod.type === 'video' && mod.content_url && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ background:'#111827', borderRadius:10, overflow:'hidden', aspectRatio:'16/9' }}>
                    <iframe src={mod.content_url} style={{ width:'100%', height:'100%', border:'none' }} allowFullScreen />
                  </div>
                </div>
              )}
              {mod.type === 'quiz' && (
                <div style={{ marginBottom:16 }}>
                  {(mod.lms_quiz_questions || []).map((q, qi) => (
                    <div key={q.id} style={{ marginBottom:16 }}>
                      <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>{qi+1}. {q.question}</div>
                      {(q.options || []).map((opt, oi) => (
                        <div key={oi} onClick={() => !quizSubmitted && setQuizAnswers(a=>({...a,[qi]:oi}))}
                          style={{ padding:'8px 12px', borderRadius:8, marginBottom:6, cursor:quizSubmitted?'default':'pointer', fontSize:12,
                            border:`1px solid ${quizSubmitted?(oi===q.correct_index?'#0fba7a':quizAnswers[qi]===oi?'#e8344a':'#1a2238'):(quizAnswers[qi]===oi?'#4f8ef7':'#1a2238')}`,
                            background: quizSubmitted?(oi===q.correct_index?'#0fba7a11':quizAnswers[qi]===oi?'#e8344a11':'transparent'):(quizAnswers[qi]===oi?'#4f8ef711':'transparent'),
                            color: quizSubmitted?(oi===q.correct_index?'#0fba7a':quizAnswers[qi]===oi?'#e8344a':'#5a6a8a'):(quizAnswers[qi]===oi?'#4f8ef7':'#8a9bc0') }}>
                          {opt}
                        </div>
                      ))}
                    </div>
                  ))}
                  {quizSubmitted ? (
                    <div style={{ padding:'12px 16px', borderRadius:10, background:quizScore>=70?'#0fba7a11':'#e8344a11', border:`1px solid ${quizScore>=70?'#0fba7a44':'#e8344a44'}`, fontSize:13, color:quizScore>=70?'#0fba7a':'#e8344a' }}>
                      {quizScore>=70 ? `🎉 Passed! Score: ${quizScore}%` : `❌ Score: ${quizScore}%. Need 70% to pass. Try again.`}
                    </div>
                  ) : (
                    <Btn onClick={handleQuizSubmit} disabled={Object.keys(quizAnswers).length < (mod.lms_quiz_questions?.length||0)}>Submit Quiz</Btn>
                  )}
                </div>
              )}

              {!isCompleted(mod.id) && mod.type !== 'quiz' && (
                <Btn onClick={handleComplete}>✓ Mark Complete → Next</Btn>
              )}
              {quizSubmitted && quizScore >= 70 && !isCompleted(mod.id) && (
                <Btn onClick={handleComplete} style={{ marginLeft:8 }}>Continue →</Btn>
              )}
            </>
          ) : <Empty icon="📚" message="Select a module to start" />}
        </div>
      </div>
    </Modal>
  )
}

function NewCourseModal({ user, onClose, onCreated }) {
  const [form, setForm] = useState({ title:'', description:'', is_required:false })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const submit = async () => {
    if (!form.title) return
    const course = await createCourse({ ...form, created_by: user.id })
    onCreated(course)
  }

  return (
    <Modal title="🎓 New Course" onClose={onClose}>
      <FormField label="Course Title *"><input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Client Communication Basics" /></FormField>
      <FormField label="Description"><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={3} placeholder="What will VAs learn?" /></FormField>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
        <input type="checkbox" id="req" checked={form.is_required} onChange={e=>set('is_required',e.target.checked)} style={{ width:'auto' }} />
        <label htmlFor="req" style={{ textTransform:'none', fontSize:13, letterSpacing:0, color:'#e8344a' }}>⚠️ Mark as required for all VAs</label>
      </div>
      <p style={{ fontSize:12, color:'#5a6a8a', marginBottom:16 }}>After creating the course, open it to add modules (PDF, video, text, or quiz).</p>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit}>Create Course</Btn>
      </div>
    </Modal>
  )
}
