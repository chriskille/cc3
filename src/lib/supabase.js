// ⚡ COMMAND CENTER — Supabase client + all data functions
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
)

// ─── AUTH ──────────────────────────────────────────────────────
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}
export const signOut = () => supabase.auth.signOut()
export const getSession = async () => (await supabase.auth.getSession()).data.session
export const onAuthChange = (cb) => supabase.auth.onAuthStateChange((_e, s) => cb(s))

// ─── PROFILES ─────────────────────────────────────────────────
export const getProfile = async (id) => {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
  return data
}
export const getAllProfiles = async () => {
  const { data } = await supabase.from('profiles').select('*')
  return data || []
}
export const getVAsForClient = async (clientId) => {
  const { data } = await supabase.from('profiles').select('*').eq('client_id', clientId).eq('role', 'va')
  return data || []
}
export const createProfile = async (profile) => {
  const { data, error } = await supabase.from('profiles').insert(profile).select().single()
  if (error) throw error
  return data
}

// ─── SESSIONS ─────────────────────────────────────────────────
export const clockIn = async (vaId, clientId) => {
  const { data, error } = await supabase.from('sessions')
    .insert({ va_id: vaId, client_id: clientId, status: 'online', login_time: new Date().toISOString() })
    .select().single()
  if (error) throw error
  return data
}
export const clockOut = async (sessionId, eod) => {
  const { data, error } = await supabase.from('sessions')
    .update({ status: 'offline', logout_time: new Date().toISOString(), eod })
    .eq('id', sessionId).select().single()
  if (error) throw error
  return data
}
export const startBreak = async (sessionId, currentBreaks) => {
  const breaks = [...currentBreaks, { start: new Date().toISOString(), end: null }]
  const { data } = await supabase.from('sessions').update({ status: 'break', breaks }).eq('id', sessionId).select().single()
  return data
}
export const resumeWork = async (sessionId, currentBreaks) => {
  const breaks = currentBreaks.map((b, i) =>
    i === currentBreaks.length - 1 ? { ...b, end: new Date().toISOString() } : b
  )
  const { data } = await supabase.from('sessions').update({ status: 'online', breaks }).eq('id', sessionId).select().single()
  return data
}
export const getActiveSession = async (vaId) => {
  const { data } = await supabase.from('sessions').select('*').eq('va_id', vaId).neq('status', 'offline').maybeSingle()
  return data
}

// ─── ATTENDANCE REPORTS ───────────────────────────────────────
export const getAttendanceDaily = async (vaId, from, to) => {
  let q = supabase.from('attendance_daily').select('*')
  if (vaId) q = q.eq('va_id', vaId)
  if (from) q = q.gte('work_date', from)
  if (to)   q = q.lte('work_date', to)
  const { data } = await q.order('work_date', { ascending: false })
  return data || []
}
export const getAttendanceWeekly = async (vaId, weeksBack = 8) => {
  const from = new Date()
  from.setDate(from.getDate() - weeksBack * 7)
  return getAttendanceDaily(vaId, from.toISOString().split('T')[0], null)
}

// ─── TASKS ────────────────────────────────────────────────────
export const getTasks = async (filters = {}) => {
  let q = supabase.from('tasks').select('*, task_comments(*), task_activity(*)')
  if (filters.vaId)     q = q.eq('va_id', filters.vaId)
  if (filters.clientId) q = q.eq('client_id', filters.clientId)
  if (filters.status)   q = q.eq('status', filters.status)
  const { data } = await q.order('created_at', { ascending: false })
  return data || []
}
export const createTask = async (task) => {
  const { data, error } = await supabase.from('tasks').insert(task).select().single()
  if (error) throw error
  return data
}
export const updateTask = async (id, updates) => {
  const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}
export const addTaskComment = async (taskId, userId, text) => {
  const { data } = await supabase.from('task_comments').insert({ task_id: taskId, user_id: userId, text }).select().single()
  return data
}

// ─── SURVEYS ──────────────────────────────────────────────────
export const getSurveys = async (filters = {}) => {
  let q = supabase.from('surveys').select('*, va:va_id(name), client:client_id(name)')
  if (filters.vaId)     q = q.eq('va_id', filters.vaId)
  if (filters.clientId) q = q.eq('client_id', filters.clientId)
  const { data } = await q.order('week_start', { ascending: false })
  return data || []
}
export const submitSurvey = async (id, ratings) => {
  const { data, error } = await supabase.from('surveys')
    .update({ ...ratings, submitted_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}
export const getPendingSurveys = async (clientId) => {
  const { data } = await supabase.from('surveys').select('*, va:va_id(name)')
    .eq('client_id', clientId).is('submitted_at', null)
  return data || []
}

// ─── LEAVE ────────────────────────────────────────────────────
export const getLeaveTypes = async () => {
  const { data } = await supabase.from('leave_types').select('*')
  return data || []
}
export const getLeaveBalances = async (vaId) => {
  const { data } = await supabase.from('leave_balances')
    .select('*, leave_type:leave_type_id(name,color)')
    .eq('va_id', vaId).eq('year', new Date().getFullYear())
  return data || []
}
export const getLeaveRequests = async (filters = {}) => {
  let q = supabase.from('leave_requests')
    .select('*, va:va_id(name,phone), leave_type:leave_type_id(name,color)')
  if (filters.vaId)   q = q.eq('va_id', filters.vaId)
  if (filters.status) q = q.eq('status', filters.status)
  const { data } = await q.order('created_at', { ascending: false })
  return data || []
}
export const fileLeaveRequest = async (req) => {
  const { data, error } = await supabase.from('leave_requests').insert(req).select().single()
  if (error) throw error
  return data
}
export const reviewLeaveRequest = async (id, status, adminNote, reviewerId) => {
  const { data, error } = await supabase.from('leave_requests')
    .update({ status, admin_note: adminNote, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}
export const getLeaveCalendar = async (month, year) => {
  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const to   = `${year}-${String(month).padStart(2,'0')}-31`
  const { data } = await supabase.from('leave_requests')
    .select('*, va:va_id(name)')
    .eq('status', 'approved')
    .gte('start_date', from).lte('end_date', to)
  return data || []
}

// ─── ANNOUNCEMENTS ────────────────────────────────────────────
export const getAnnouncements = async () => {
  const { data } = await supabase.from('announcements')
    .select('*, author:author_id(name), announcement_reads(user_id)')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  return data || []
}
export const postAnnouncement = async (ann) => {
  const { data, error } = await supabase.from('announcements').insert(ann).select().single()
  if (error) throw error
  return data
}
export const markAnnouncementRead = async (announcementId, userId) => {
  await supabase.from('announcement_reads').upsert({ announcement_id: announcementId, user_id: userId })
}

// ─── LMS ──────────────────────────────────────────────────────
export const getCourses = async () => {
  const { data } = await supabase.from('lms_courses').select('*, lms_modules(count)')
  return data || []
}
export const getCourseWithModules = async (courseId) => {
  const { data } = await supabase.from('lms_courses')
    .select('*, lms_modules(*, lms_quiz_questions(*))')
    .eq('id', courseId).single()
  return data
}
export const createCourse = async (course) => {
  const { data, error } = await supabase.from('lms_courses').insert(course).select().single()
  if (error) throw error
  return data
}
export const createModule = async (mod) => {
  const { data, error } = await supabase.from('lms_modules').insert(mod).select().single()
  if (error) throw error
  return data
}
export const addQuizQuestion = async (q) => {
  const { data, error } = await supabase.from('lms_quiz_questions').insert(q).select().single()
  if (error) throw error
  return data
}
export const getVAProgress = async (vaId) => {
  const { data } = await supabase.from('lms_progress')
    .select('*, course:course_id(title), module:module_id(title)')
    .eq('va_id', vaId)
  return data || []
}
export const markModuleComplete = async (vaId, courseId, moduleId, quizScore = null) => {
  const { data } = await supabase.from('lms_progress').upsert({
    va_id: vaId, course_id: courseId, module_id: moduleId,
    completed: true, quiz_score: quizScore, completed_at: new Date().toISOString()
  }).select().single()
  return data
}
export const getCertificates = async (vaId) => {
  const { data } = await supabase.from('lms_certificates')
    .select('*, course:course_id(title)').eq('va_id', vaId)
  return data || []
}
export const issueCertificate = async (vaId, courseId) => {
  const { data } = await supabase.from('lms_certificates')
    .upsert({ va_id: vaId, course_id: courseId }).select().single()
  return data
}

// ─── COMMS (Group Chat) ───────────────────────────────────────
export const getChatRooms = async (userId) => {
  const { data } = await supabase.from('chat_rooms')
    .select('*, chat_members!inner(user_id)')
    .eq('chat_members.user_id', userId)
  return data || []
}
export const createChatRoom = async (room, memberIds) => {
  const { data: created, error } = await supabase.from('chat_rooms').insert(room).select().single()
  if (error) throw error
  await supabase.from('chat_members').insert(memberIds.map(uid => ({ room_id: created.id, user_id: uid })))
  return created
}
export const getRoomMessages = async (roomId, limit = 50) => {
  const { data } = await supabase.from('messages')
    .select('*, sender:sender_id(name,avatar,role)')
    .eq('room_id', roomId).order('created_at', { ascending: true }).limit(limit)
  return data || []
}
export const sendMessage = async (roomId, senderId, text, type = 'text') => {
  const { data, error } = await supabase.from('messages')
    .insert({ room_id: roomId, sender_id: senderId, text, type }).select().single()
  if (error) throw error
  return data
}
export const subscribeToRoom = (roomId, cb) => {
  return supabase.channel(`room:${roomId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      p => cb(p.new))
    .subscribe()
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
export const getNotifications = async (userId) => {
  const { data } = await supabase.from('notifications').select('*')
    .eq('to_id', userId).order('created_at', { ascending: false }).limit(50)
  return data || []
}
export const pushNotification = async (toId, title, message, type = 'info') => {
  await supabase.from('notifications').insert({ to_id: toId, title, message, type })
}
export const markAllRead = async (userId) => {
  await supabase.from('notifications').update({ read: true }).eq('to_id', userId).eq('read', false)
}
export const subscribeToNotifications = (userId, cb) => {
  return supabase.channel(`notifs:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `to_id=eq.${userId}` },
      p => cb(p.new))
    .subscribe()
}
