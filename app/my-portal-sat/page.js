'use client';
// 📄 檔案路徑：app/my-portal-sat/page.tsx（星期六網站專案裡的新檔案，獨立後台）
// 用途：幹部登入後，設定每週「新手區密碼」與「散打區密碼」
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc2lhZWVoemhzYXFqeHhpa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njc4NDksImV4cCI6MjA5NjA0Mzg0OX0.UYNrbcm5HaDucdcAj7XMwIBye6dsA6cRaG-bLY34XVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 目前開放報名的那一週（星期六日期，週六 22:00 換週，跟報名網站規則一致）
function getTargetSaturdayDateStr() {
  const now = new Date();
  const currentDay = now.getDay();
  const daysUntilSaturday = (6 - currentDay + 7) % 7;
  const isNextWeek = currentDay === 6 && now.getHours() * 60 + now.getMinutes() >= 22 * 60;
  const t = new Date(now);
  t.setDate(now.getDate() + daysUntilSaturday + (isNextWeek ? 7 : 0));
  return `${t.getFullYear()}/${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getDate()).padStart(2, '0')}`;
}
function getWeekOptions(pastCount, futureCount) {
  const [y, m, d] = getTargetSaturdayDateStr().split('/').map(Number);
  const out = [];
  for (let i = -pastCount; i <= futureCount; i++) {
    const t = new Date(y, m - 1, d + i * 7);
    out.push(`${t.getFullYear()}/${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getDate()).padStart(2, '0')}`);
  }
  return out;
}

export default function SatAdminPasswords() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const currentWeek = getTargetSaturdayDateStr();
  const weekOptions = getWeekOptions(1, 4);
  const [weekKey, setWeekKey] = useState(currentWeek);
  const [pwNewbie, setPwNewbie] = useState('');
  const [pwOpenplay, setPwOpenplay] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    document.title = '星期六網站｜每週密碼設定';
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data?.session);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => setLoggedIn(!!session));
    return () => listener?.subscription?.unsubscribe();
  }, []);

  const loadWeek = async (wk) => {
    setMsg('');
    const { data, error } = await supabase.from('zone_passwords').select('zone_group, password').eq('week_key', wk);
    if (error) { setMsg('讀取失敗：' + error.message); return; }
    setPwNewbie(data?.find(r => r.zone_group === 'newbie')?.password || '');
    setPwOpenplay(data?.find(r => r.zone_group === 'openplay')?.password || '');
  };

  useEffect(() => {
    if (loggedIn) loadWeek(weekKey);
  }, [loggedIn, weekKey]);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { alert('登入失敗：' + error.message); return; }
    setPassword('');
  };

  const handleSave = async () => {
    const rows = [];
    if (pwNewbie.trim()) rows.push({ week_key: weekKey, zone_group: 'newbie', password: pwNewbie.trim() });
    if (pwOpenplay.trim()) rows.push({ week_key: weekKey, zone_group: 'openplay', password: pwOpenplay.trim() });
    if (rows.length === 0) { alert('請至少輸入一組密碼！'); return; }
    const { error } = await supabase.from('zone_passwords').upsert(rows, { onConflict: 'week_key,zone_group' });
    if (error) { alert('儲存失敗：' + error.message); return; }
    setMsg(`✅ 已儲存【${weekKey}】這一週的密碼（週一／四／五／六共用）`);
  };

  if (!authChecked) return <main className="min-h-screen bg-[#eef0f2] p-6 text-center font-bold">載入中…</main>;

  return (
    <main className="min-h-screen bg-[#eef0f2] p-4 sm:p-8 text-[#101010]">
      <div className="max-w-xl mx-auto space-y-5">
        <h1 className="text-2xl sm:text-4xl font-black text-[#17587f] text-center">🔑 每週密碼設定</h1>

        {!loggedIn ? (
          <div className="bg-white border-[3px] border-[#101010] rounded-3xl p-6 space-y-3" style={{ boxShadow: '4px 4px 0 #101010' }}>
            <div className="font-black text-lg">管理員登入</div>
            <input className="w-full p-3 border-2 border-[#101010] rounded-xl" type="email" placeholder="管理員帳號 (Email)" value={email} onChange={e => setEmail(e.target.value)} />
            <input className="w-full p-3 border-2 border-[#101010] rounded-xl" type="password" placeholder="密碼" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} />
            <button onClick={handleLogin} className="w-full bg-[#e8c23a] border-[3px] border-[#101010] rounded-xl p-3 font-black text-lg" style={{ boxShadow: '3px 3px 0 #101010' }}>登入</button>
          </div>
        ) : (
          <div className="bg-white border-[3px] border-[#101010] rounded-3xl p-6 space-y-4" style={{ boxShadow: '4px 4px 0 #101010' }}>
            <div className="flex justify-between items-center">
              <span className="font-black text-lg">選擇週次</span>
              <button onClick={() => supabase.auth.signOut()} className="text-xs font-bold underline text-slate-500">登出</button>
            </div>
            <select value={weekKey} onChange={e => setWeekKey(e.target.value)} className="w-full p-3 border-2 border-[#101010] rounded-xl font-bold">
              {weekOptions.map(w => (
                <option key={w} value={w}>{w} 該週（週六 {w.slice(5)}）{w === currentWeek ? ' - 目前開放中' : ''}</option>
              ))}
            </select>
            <div className="text-xs font-bold text-slate-500">一組密碼對整週有效：週一、週四、週五、週六都用同一組。</div>

            <div className="space-y-1">
              <label className="font-black">🌱 新手區密碼（新手友善場／新手體驗）</label>
              <input className="w-full p-3 border-2 border-[#101010] rounded-xl text-lg font-bold" value={pwNewbie} onChange={e => setPwNewbie(e.target.value)} placeholder="尚未設定" />
            </div>
            <div className="space-y-1">
              <label className="font-black">🔥 散打區密碼（一般散打／2.8-3.3 球敘）</label>
              <input className="w-full p-3 border-2 border-[#101010] rounded-xl text-lg font-bold" value={pwOpenplay} onChange={e => setPwOpenplay(e.target.value)} placeholder="尚未設定" />
            </div>

            <button onClick={handleSave} className="w-full bg-[#17587f] text-white border-[3px] border-[#101010] rounded-xl p-3 font-black text-lg" style={{ boxShadow: '3px 3px 0 #101010' }}>儲存這一週的密碼</button>
            {msg && <div className="text-sm font-black text-[#17587f]">{msg}</div>}
          </div>
        )}
      </div>
    </main>
  );
}
