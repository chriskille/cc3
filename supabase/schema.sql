-- ═══════════════════════════════════════════════════════════════
--  ⚡ COMMAND CENTER v2 — Full Supabase Schema
--  Paste entire file into: Supabase → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ─── PROFILES ─────────────────────────────────────────────────
create table public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  role       text not null check (role in ('admin','va','client')),
  name       text not null,
  email      text not null,
  phone      text,
  avatar     text,
  client_id  uuid references public.profiles(id),
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id,email,name,role)
  values(new.id,new.email,
    coalesce(new.raw_user_meta_data->>'name',new.email),
    coalesce(new.raw_user_meta_data->>'role','client'));
  return new;
end;$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── SESSIONS (Attendance) ────────────────────────────────────
create table public.sessions (
  id           uuid default uuid_generate_v4() primary key,
  va_id        uuid not null references public.profiles(id),
  client_id    uuid references public.profiles(id),
  status       text not null default 'online' check (status in ('online','break','offline')),
  login_time   timestamptz not null default now(),
  logout_time  timestamptz,
  breaks       jsonb default '[]'::jsonb,
  eod          jsonb,
  created_at   timestamptz default now()
);

-- Daily attendance summary view
create or replace view public.attendance_daily as
select
  s.va_id, p.name as va_name, s.client_id,
  date(s.login_time) as work_date,
  min(s.login_time) as first_login,
  max(s.logout_time) as last_logout,
  sum(
    extract(epoch from coalesce(s.logout_time,now()) - s.login_time) -
    coalesce((select sum(
      extract(epoch from coalesce((b->>'end')::timestamptz,now()) - (b->>'start')::timestamptz)
    ) from jsonb_array_elements(s.breaks) b),0)
  ) as work_seconds
from public.sessions s
join public.profiles p on p.id=s.va_id
group by s.va_id,p.name,s.client_id,date(s.login_time);

-- ─── TASKS ────────────────────────────────────────────────────
create table public.tasks (
  id           uuid default uuid_generate_v4() primary key,
  title        text not null,
  description  text,
  status       text not null default 'todo' check (status in ('todo','inprogress','done')),
  priority     text not null default 'medium' check (priority in ('high','medium','low')),
  due_date     date,
  client_id    uuid not null references public.profiles(id),
  va_id        uuid references public.profiles(id),
  created_by   uuid not null references public.profiles(id),
  completed_at timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table public.task_comments (
  id         uuid default uuid_generate_v4() primary key,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id),
  text       text not null,
  created_at timestamptz default now()
);

create table public.task_activity (
  id         uuid default uuid_generate_v4() primary key,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id),
  action     text not null,
  created_at timestamptz default now()
);

create or replace function public.log_task_update()
returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status then
    insert into public.task_activity(task_id,user_id,action)
    values(new.id,auth.uid(),'Status → '||new.status);
    if new.status='done' then new.completed_at=now(); end if;
  end if;
  new.updated_at=now();
  return new;
end;$$;

create trigger on_task_updated before update on public.tasks
  for each row execute procedure public.log_task_update();

-- ─── PERFORMANCE SURVEYS ──────────────────────────────────────
create table public.surveys (
  id                   uuid default uuid_generate_v4() primary key,
  va_id                uuid not null references public.profiles(id),
  client_id            uuid not null references public.profiles(id),
  week_start           date not null,
  overall_rating       int check (overall_rating between 1 and 5),
  quality_rating       int check (quality_rating between 1 and 5),
  communication_rating int check (communication_rating between 1 and 5),
  timeliness_rating    int check (timeliness_rating between 1 and 5),
  initiative_rating    int check (initiative_rating between 1 and 5),
  feedback             text,
  submitted_at         timestamptz,
  created_at           timestamptz default now(),
  unique(va_id,client_id,week_start)
);

-- ─── LEAVE MANAGEMENT ────────────────────────────────────────
create table public.leave_types (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  days_annual int default 0,
  color       text default '#4f8ef7'
);

insert into public.leave_types(name,days_annual,color) values
  ('Vacation',15,'#0fba7a'),
  ('Sick Leave',10,'#f09a2a'),
  ('Emergency',3,'#e8344a'),
  ('Unpaid Leave',0,'#5a6a8a');

create table public.leave_balances (
  id            uuid default uuid_generate_v4() primary key,
  va_id         uuid not null references public.profiles(id),
  leave_type_id uuid not null references public.leave_types(id),
  year          int not null default extract(year from now())::int,
  total_days    int not null default 0,
  used_days     numeric(4,1) default 0,
  created_at    timestamptz default now(),
  unique(va_id,leave_type_id,year)
);

create table public.leave_requests (
  id            uuid default uuid_generate_v4() primary key,
  va_id         uuid not null references public.profiles(id),
  client_id     uuid references public.profiles(id),
  leave_type_id uuid not null references public.leave_types(id),
  start_date    date not null,
  end_date      date not null,
  total_days    numeric(4,1) not null,
  reason        text,
  is_emergency  boolean default false,
  status        text default 'pending' check (status in ('pending','approved','rejected')),
  admin_note    text,
  reviewed_by   uuid references public.profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz default now()
);

create or replace function public.update_leave_balance()
returns trigger language plpgsql as $$
begin
  if new.status='approved' and old.status='pending' then
    insert into public.leave_balances(va_id,leave_type_id,year,total_days,used_days)
    values(new.va_id,new.leave_type_id,extract(year from new.start_date)::int,0,new.total_days)
    on conflict(va_id,leave_type_id,year)
    do update set used_days=public.leave_balances.used_days+new.total_days;
  end if;
  return new;
end;$$;

create trigger on_leave_approved after update on public.leave_requests
  for each row execute procedure public.update_leave_balance();

-- ─── ANNOUNCEMENTS ────────────────────────────────────────────
create table public.announcements (
  id         uuid default uuid_generate_v4() primary key,
  author_id  uuid not null references public.profiles(id),
  title      text not null,
  body       text not null,
  audience   text default 'all' check (audience in ('all','vas','clients')),
  pinned     boolean default false,
  created_at timestamptz default now()
);

create table public.announcement_reads (
  announcement_id uuid references public.announcements(id) on delete cascade,
  user_id         uuid references public.profiles(id),
  read_at         timestamptz default now(),
  primary key(announcement_id,user_id)
);

-- ─── LMS ──────────────────────────────────────────────────────
create table public.lms_courses (
  id          uuid default uuid_generate_v4() primary key,
  title       text not null,
  description text,
  is_required boolean default false,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz default now()
);

create table public.lms_modules (
  id           uuid default uuid_generate_v4() primary key,
  course_id    uuid not null references public.lms_courses(id) on delete cascade,
  title        text not null,
  type         text not null check (type in ('pdf','video','text','quiz')),
  content_url  text,
  content_text text,
  order_index  int default 0,
  created_at   timestamptz default now()
);

create table public.lms_quiz_questions (
  id            uuid default uuid_generate_v4() primary key,
  module_id     uuid not null references public.lms_modules(id) on delete cascade,
  question      text not null,
  options       jsonb not null,
  correct_index int not null,
  order_index   int default 0
);

create table public.lms_progress (
  id           uuid default uuid_generate_v4() primary key,
  va_id        uuid not null references public.profiles(id),
  course_id    uuid not null references public.lms_courses(id),
  module_id    uuid references public.lms_modules(id),
  completed    boolean default false,
  quiz_score   numeric(5,2),
  completed_at timestamptz,
  created_at   timestamptz default now(),
  unique(va_id,module_id)
);

create table public.lms_certificates (
  id        uuid default uuid_generate_v4() primary key,
  va_id     uuid not null references public.profiles(id),
  course_id uuid not null references public.lms_courses(id),
  issued_at timestamptz default now(),
  unique(va_id,course_id)
);

-- ─── COMMS (Group + Direct Chat) ─────────────────────────────
create table public.chat_rooms (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  type        text not null check (type in ('direct','group')),
  description text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now()
);

create table public.chat_members (
  room_id   uuid not null references public.chat_rooms(id) on delete cascade,
  user_id   uuid not null references public.profiles(id),
  joined_at timestamptz default now(),
  primary key(room_id,user_id)
);

create table public.messages (
  id         uuid default uuid_generate_v4() primary key,
  room_id    uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id),
  text       text,
  type       text default 'text' check (type in ('text','file','image','system')),
  file_url   text,
  read_by    uuid[] default '{}',
  created_at timestamptz default now()
);

create index messages_room_idx on public.messages(room_id,created_at desc);

-- ─── NOTIFICATIONS ────────────────────────────────────────────
create table public.notifications (
  id         uuid default uuid_generate_v4() primary key,
  to_id      uuid not null references public.profiles(id),
  title      text not null,
  message    text not null,
  type       text default 'info',
  read       boolean default false,
  created_at timestamptz default now()
);

create index notif_to_idx on public.notifications(to_id,created_at desc);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
alter table public.profiles           enable row level security;
alter table public.sessions           enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_comments      enable row level security;
alter table public.task_activity      enable row level security;
alter table public.surveys            enable row level security;
alter table public.leave_requests     enable row level security;
alter table public.leave_balances     enable row level security;
alter table public.announcements      enable row level security;
alter table public.announcement_reads enable row level security;
alter table public.lms_courses        enable row level security;
alter table public.lms_modules        enable row level security;
alter table public.lms_quiz_questions enable row level security;
alter table public.lms_progress       enable row level security;
alter table public.lms_certificates   enable row level security;
alter table public.chat_rooms         enable row level security;
alter table public.chat_members       enable row level security;
alter table public.messages           enable row level security;
alter table public.notifications      enable row level security;

create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

-- Profiles
create policy "view profiles" on public.profiles for select using (
  auth.uid()=id or is_admin() or client_id=auth.uid() or
  id in (select id from public.profiles where client_id=auth.uid())
);
create policy "update own profile" on public.profiles for update using (auth.uid()=id);
create policy "admin insert" on public.profiles for insert with check (is_admin());

-- Sessions
create policy "session select" on public.sessions for select using (va_id=auth.uid() or client_id=auth.uid() or is_admin());
create policy "va insert session" on public.sessions for insert with check (va_id=auth.uid());
create policy "va update session" on public.sessions for update using (va_id=auth.uid());

-- Tasks
create policy "task select" on public.tasks for select using (va_id=auth.uid() or client_id=auth.uid() or is_admin());
create policy "task insert" on public.tasks for insert with check (client_id=auth.uid() or va_id=auth.uid() or is_admin());
create policy "task update" on public.tasks for update using (va_id=auth.uid() or client_id=auth.uid() or is_admin());

-- Task comments/activity
create policy "comment access" on public.task_comments for all using (
  exists(select 1 from public.tasks t where t.id=task_id and (t.va_id=auth.uid() or t.client_id=auth.uid())) or is_admin()
);
create policy "activity access" on public.task_activity for select using (
  exists(select 1 from public.tasks t where t.id=task_id and (t.va_id=auth.uid() or t.client_id=auth.uid())) or is_admin()
);

-- Surveys
create policy "survey select" on public.surveys for select using (va_id=auth.uid() or client_id=auth.uid() or is_admin());
create policy "client submit survey" on public.surveys for insert with check (client_id=auth.uid());
create policy "client update survey" on public.surveys for update using (client_id=auth.uid());

-- Leave
create policy "leave select" on public.leave_requests for select using (va_id=auth.uid() or client_id=auth.uid() or is_admin());
create policy "va file leave" on public.leave_requests for insert with check (va_id=auth.uid());
create policy "admin review leave" on public.leave_requests for update using (is_admin());
create policy "balance select" on public.leave_balances for select using (va_id=auth.uid() or is_admin());
create policy "balance manage" on public.leave_balances for all using (is_admin());

-- Announcements
create policy "read announcements" on public.announcements for select using (true);
create policy "admin post" on public.announcements for insert with check (is_admin());
create policy "admin edit" on public.announcements for update using (is_admin());
create policy "read receipts" on public.announcement_reads for all using (user_id=auth.uid());

-- LMS
create policy "courses public" on public.lms_courses for select using (true);
create policy "admin courses" on public.lms_courses for all using (is_admin());
create policy "modules public" on public.lms_modules for select using (true);
create policy "admin modules" on public.lms_modules for all using (is_admin());
create policy "quizzes public" on public.lms_quiz_questions for select using (true);
create policy "admin quizzes" on public.lms_quiz_questions for all using (is_admin());
create policy "va progress" on public.lms_progress for all using (va_id=auth.uid() or is_admin());
create policy "certs" on public.lms_certificates for select using (va_id=auth.uid() or is_admin());
create policy "issue certs" on public.lms_certificates for insert with check (is_admin());

-- Comms
create policy "room select" on public.chat_rooms for select using (
  exists(select 1 from public.chat_members where room_id=id and user_id=auth.uid()) or is_admin()
);
create policy "room insert" on public.chat_rooms for insert with check (auth.uid() is not null);
create policy "member select" on public.chat_members for select using (user_id=auth.uid() or is_admin());
create policy "member insert" on public.chat_members for insert with check (is_admin() or user_id=auth.uid());
create policy "message select" on public.messages for select using (
  exists(select 1 from public.chat_members where room_id=messages.room_id and user_id=auth.uid()) or is_admin()
);
create policy "message insert" on public.messages for insert with check (
  sender_id=auth.uid() and
  exists(select 1 from public.chat_members where room_id=messages.room_id and user_id=auth.uid())
);

-- Notifications
create policy "own notifications" on public.notifications for all using (to_id=auth.uid());

-- ─── REALTIME ─────────────────────────────────────────────────
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.leave_requests;
