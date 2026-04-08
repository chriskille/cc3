// ⚡ Shared UI components — used across all modules
import { useState } from "react"

export const COLORS = {
  bg: '#07090f', card: '#0d1221', border: '#1a2238',
  accent: '#4f8ef7', purple: '#7c5cf6', green: '#0fba7a',
  orange: '#f09a2a', red: '#e8344a', text: '#dde3f0', muted: '#5a6a8a'
}

// Global CSS injected once
export const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Familjen+Grotesk:wght@600;700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#07090f;color:#dde3f0;font-family:'Outfit',sans-serif;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:#1e2740;border-radius:2px;}
    input,textarea,select{background:#0d1221;border:1px solid #1a2238;border-radius:8px;color:#dde3f0;font-family:inherit;font-size:13px;padding:9px 12px;width:100%;outline:none;transition:border .2s;}
    input:focus,textarea:focus,select:focus{border-color:#4f8ef7;}
    label{font-size:11px;color:#5a6a8a;font-weight:600;margin-bottom:4px;display:block;letter-spacing:.5px;text-transform:uppercase;}
    button{cursor:pointer;font-family:inherit;}
    a{color:#4f8ef7;text-decoration:none;}
  `}</style>
)

export const Btn = ({ children, variant='primary', size='md', onClick, disabled, style={} }) => {
  const base = { cursor:'pointer', border:'none', borderRadius:8, fontFamily:'inherit', fontWeight:600, display:'inline-flex', alignItems:'center', gap:6, transition:'all .18s', whiteSpace:'nowrap', opacity: disabled ? 0.5 : 1 }
  const sizes = { sm: { padding:'5px 12px', fontSize:12 }, md: { padding:'9px 18px', fontSize:13 }, lg: { padding:'12px 24px', fontSize:14 } }
  const variants = {
    primary: { background:'linear-gradient(135deg,#4f8ef7,#7c5cf6)', color:'#fff' },
    ghost: { background:'transparent', border:'1px solid #1a2238', color:'#8a9bc0' },
    danger: { background:'#e8344a', color:'#fff' },
    success: { background:'#0fba7a', color:'#fff' },
    warning: { background:'#f09a2a', color:'#fff' },
    subtle: { background:'#0d1221', border:'1px solid #1a2238', color:'#dde3f0' },
  }
  return <button style={{...base,...sizes[size],...variants[variant],...style}} onClick={onClick} disabled={disabled}>{children}</button>
}

export const Card = ({ children, style={} }) => (
  <div style={{ background:'#0d1221', border:'1px solid #1a2238', borderRadius:14, padding:20, ...style }}>{children}</div>
)

export const Modal = ({ title, onClose, children, width=520 }) => (
  <div style={{ position:'fixed', inset:0, background:'#00000088', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
    <div style={{ background:'#0d1221', border:'1px solid #1a2238', borderRadius:16, width:'100%', maxWidth:width, maxHeight:'90vh', overflow:'auto' }}>
      <div style={{ padding:'18px 24px', borderBottom:'1px solid #1a2238', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontFamily:"'Familjen Grotesk',sans-serif", fontSize:16, fontWeight:700 }}>{title}</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#5a6a8a', fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
      </div>
      <div style={{ padding:24 }}>{children}</div>
    </div>
  </div>
)

export const Avatar = ({ name='?', size=34, color }) => {
  const colors = ['#4f8ef7','#7c5cf6','#0fba7a','#f09a2a','#e8344a','#c084fc']
  const c = color || colors[(name.charCodeAt(0)||0) % colors.length]
  const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)
  return <div style={{ width:size, height:size, borderRadius:'50%', background:c+'33', border:`1.5px solid ${c}66`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.35, fontWeight:700, color:c, flexShrink:0 }}>{initials}</div>
}

export const Badge = ({ children, color='#4f8ef7' }) => (
  <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:100, background:color+'22', color, border:`1px solid ${color}44`, textTransform:'uppercase', letterSpacing:.4 }}>{children}</span>
)

export const StatCard = ({ icon, label, value, sub, color='#4f8ef7' }) => (
  <Card style={{ display:'flex', alignItems:'center', gap:16 }}>
    <div style={{ width:44, height:44, borderRadius:12, background:color+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{icon}</div>
    <div>
      <div style={{ fontSize:24, fontWeight:700, fontFamily:"'Familjen Grotesk',sans-serif", color }}>{value}</div>
      <div style={{ fontSize:12, color:'#5a6a8a', marginTop:1 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'#3a4a6a', marginTop:2 }}>{sub}</div>}
    </div>
  </Card>
)

export const Tabs = ({ tabs, active, onChange }) => (
  <div style={{ display:'flex', gap:4, background:'#07090f', borderRadius:10, padding:4, border:'1px solid #1a2238' }}>
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)} style={{
        flex:1, padding:'7px 12px', borderRadius:8, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .18s',
        background: active===t.id ? 'linear-gradient(135deg,#4f8ef7,#7c5cf6)' : 'transparent',
        color: active===t.id ? '#fff' : '#5a6a8a'
      }}>{t.icon} {t.label}</button>
    ))}
  </div>
)

export const Stars = ({ value, onChange, size=22 }) => (
  <div style={{ display:'flex', gap:4 }}>
    {[1,2,3,4,5].map(n => (
      <span key={n} onClick={() => onChange?.(n)} style={{ fontSize:size, cursor:onChange?'pointer':'default', color: n<=value ? '#f09a2a' : '#1a2238', transition:'color .15s' }}>★</span>
    ))}
  </div>
)

export const Empty = ({ icon, message }) => (
  <div style={{ textAlign:'center', padding:'48px 24px', color:'#3a4a6a' }}>
    <div style={{ fontSize:36, marginBottom:12 }}>{icon}</div>
    <div style={{ fontSize:13 }}>{message}</div>
  </div>
)

export const SectionHeader = ({ title, action }) => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
    <h2 style={{ fontFamily:"'Familjen Grotesk',sans-serif", fontSize:18, fontWeight:700 }}>{title}</h2>
    {action}
  </div>
)

export const FormField = ({ label, children }) => (
  <div style={{ marginBottom:16 }}>
    <label>{label}</label>
    {children}
  </div>
)

export const Grid = ({ cols=2, gap=16, children }) => (
  <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap }}>{children}</div>
)

export const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) : '—'
export const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'
export const fmtDuration = (secs) => {
  if(!secs) return '0h 0m'
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60)
  return `${h}h ${m}m`
}
export const weekStart = (date = new Date()) => {
  const d = new Date(date); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0); return d
}
