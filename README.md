# ⚡ Command Center v2 — Full HR + PM + Comms Platform

> Zoho People + Zoho Projects + WhatsApp — built for VA agencies

---

## 🗂 What's Included

| Module | Features |
|---|---|
| 📊 **Attendance** | Clock in/out, breaks, EOD reports, daily/weekly/monthly charts, detailed log |
| 📌 **Tasks** | Kanban board, priorities, due dates, comments, overdue alerts, completed/pending reports |
| ⭐ **Performance Surveys** | Weekly auto-sent to client, 5-category ratings, radar chart, trend line, history |
| 🏖️ **Leave Management** | File requests, approve/reject, leave balances, emergency leave, calendar view, auto-notify client |
| 📢 **Announcements** | Admin broadcasts, audience targeting (all/VAs/clients), pin to top, read receipts, email delivery |
| 🎓 **Learning (LMS)** | Courses, PDF/video/text/quiz modules, progress tracking, certificates, required course flags |
| 💬 **Team Comms** | Group chats, direct messages, real-time with Supabase, message threads |
| 🏠 **Dashboards** | Role-specific home pages for Admin, VA, Client |

---

## 🚀 Quick Start (runs immediately — no config needed)

```bash
cd command-center-v2
npm install
npm run dev
```

Open **http://localhost:3000** — logs in with mock data instantly.

### Demo Accounts

| Role | Email | Password |
|---|---|---|
| 👑 Admin | chris@eostaff.com | admin |
| 🎧 VA | chris@paymentpilot.com | Chris - VA |
| 🏢 Client | chriskillellc@gmail.com | Chris - Client |

---

## 📁 File Structure

```
command-center-v2/
├── src/
│   ├── App.jsx                          ← Main app, auth, nav, clock widget
│   ├── components/UI.jsx                ← Shared design system (Button, Card, Modal…)
│   ├── lib/
│   │   ├── supabase.js                  ← ALL database functions (ready to wire)
│   │   └── notifications.js            ← Twilio SMS + Resend email triggers
│   └── modules/
│       ├── attendance/AttendanceModule.jsx   ← Reports + charts
│       ├── tasks/TasksModule.jsx             ← Kanban + list + reports
│       ├── surveys/SurveysModule.jsx         ← Weekly performance reviews
│       ├── leave/LeaveModule.jsx             ← Leave requests + calendar
│       ├── announcements/AnnouncementsModule.jsx
│       ├── lms/LMSModule.jsx                 ← Courses + quizzes + certs
│       └── comms/CommsModule.jsx             ← Group + direct chat
│
├── server/
│   └── index.js                         ← Express server for Twilio + Resend
│
├── supabase/
│   ├── schema.sql                       ← Full DB schema — paste into Supabase SQL Editor
│   └── edge-functions/weekly-survey.ts  ← Auto-sends surveys every Monday
│
├── .env.example                         ← Copy to .env, fill in keys
└── README.md
```

---

## 🔌 Connecting Services (Claude Code handles this)

### 1. Supabase (Database + Auth + Realtime)

```bash
# 1. Create project at supabase.com
# 2. SQL Editor → paste supabase/schema.sql → Run
# 3. Add to .env:
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then tell Claude Code:
> *"Replace mock data in App.jsx with the Supabase functions from src/lib/supabase.js"*

The app auto-detects when Supabase is configured (checks VITE_SUPABASE_URL) and switches from mock to live.

### 2. Twilio SMS

```bash
# .env
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# Start API server
cd server && npm install && node index.js
```

### 3. Resend Email

```bash
# .env
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@eostaff.com
RESEND_FROM_NAME=EOStaff Command Center
```

### 4. Weekly Survey Automation

```bash
# Deploy the edge function to Supabase
supabase functions deploy weekly-survey

# Set cron in Supabase Dashboard → Edge Functions:
# Schedule: 0 9 * * 1   (every Monday 9am)
```

---

## 🔄 Mock → Production Switch

The app runs in mock mode automatically when Supabase isn't configured.  
When you add `VITE_SUPABASE_URL` to `.env`, it switches to live mode.

**What to swap per module:**

| Module | Mock location | Replace with |
|---|---|---|
| Auth | MOCK_USERS in App.jsx | `signIn()` from supabase.js |
| Sessions | in-memory state | `clockIn/Out/Break/Resume()` |
| Tasks | mock data | `getTasks/createTask/updateTask()` |
| Surveys | mock data | `getSurveys/submitSurvey()` |
| Leave | mock data | `getLeaveRequests/fileLeaveRequest()` |
| Announcements | mock data | `getAnnouncements/postAnnouncement()` |
| LMS | mock data | `getCourses/getVAProgress()` |
| Comms | mock data | `getChatRooms/getRoomMessages()` |
| Notifications | in-memory array | `getNotifications/subscribeToNotifications()` |

---

## 🚢 Deployment

### Frontend → Vercel
```bash
npm run build
# Deploy /dist to Vercel
# Add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in Vercel env vars
```

### API Server → Railway
```bash
# Push server/ to GitHub
# New Railway project → connect repo → set start command: node index.js
# Add TWILIO_* and RESEND_* env vars
# Update vite.config.js proxy to your Railway URL
```

---

## 💬 Claude Code Prompts

Once you open this folder in Claude Code, use these prompts:

- *"Wire up Supabase auth — replace the mock login in App.jsx"*
- *"Connect the attendance module to Supabase using the functions in lib/supabase.js"*
- *"Deploy the weekly-survey edge function to Supabase"*
- *"Add file upload to LMS modules using Supabase Storage"*
- *"Set up Supabase leave_balances for all existing VAs with default allocations"*
- *"Add a WhatsApp Business API integration to the notifications"*
- *"Build an admin analytics dashboard with charts for this month's performance"*
- *"Add email verification on signup"*

---

*Built with React + Vite + Supabase + Twilio + Resend · ⚡ EOStaff Command Center*
