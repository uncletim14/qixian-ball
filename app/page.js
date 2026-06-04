'use client';
import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';

// 改用 process.env 確保它會讀取 Vercel 設定的環境變數
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc2lhZWVoemhzYXFqeHhpa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njc4NDksImV4cCI6MjA5NjA0Mzg0OX0.UYNrbcm5HaDucdcAj7XMwIBye6dsA6cRaG-bLY34XVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSIONS = [
  { id: 'mon', label: '週一場' },
  { id: 'fri', label: '週五場' },
  { id: 'sat', label: '週六場' }
];

export default function Home() {
  const [day, setDay] = useState('mon');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', count: '1', password: '' });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('pickleball_registrations').select('*').order('created_at', { ascending: true });
    if (data) setList(data.filter(item => item.session_id === day));
    setLoading(false);
  };

  useEffect(() => { load(); }, [day]);

  const submit = async () => {
    if (!form.name || form.password.length !== 4) { alert('請輸入 LINE 暱稱與 4 位數密碼'); return; }
    const { error } = await supabase.from('pickleball_registrations').insert([{
      name: form.name, count: parseInt(form.count), password: form.password, session_id: day, created_at: new Date().toISOString()
    }]);
    if (error) alert('報名失敗：' + error.message);
    else { alert('報名成功！'); setForm({ name: '', count: '1', password: '' }); load(); }
  };

  return (
    <main className="min-h-screen bg-[#090d16] text-white p-8">
      <div className="max-w-md mx-auto space-y-10">
        <div className="text-center bg-slate-900 p-8 rounded-2xl border border-emerald-500/30">
          <h1 className="text-5xl font-black mb-4">七賢國小匹克球</h1>
          <p className="text-3xl text-emerald-400 font-bold">新手體驗 免費</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {SESSIONS.map(s => (
            <button key={s.id} onClick={() => setDay(s.id)} className={`py-6 rounded-2xl text-2xl font-bold ${day === s.id ? 'bg-emerald-500 text-black' : 'bg-slate-800'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* 報名表單 */}
        <div className="bg-slate-900 p-8 rounded-3xl space-y-6 border border-slate-800">
          <input className="w-full p-6 bg-black rounded-2xl text-2xl" placeholder="輸入 LINE 暱稱" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <select className="w-full p-6 bg-black rounded-2xl text-2xl" value={form.count} onChange={e => setForm({...form, count: e.target.value})}>
            <option value="1">1 位</option><option value="2">2 位</option>
          </select>
          <input className="w-full p-6 bg-black rounded-2xl text-2xl" type="password" placeholder="取消密碼 (4位數字)" maxLength={4} value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          <button className="w-full bg-emerald-500 p-6 rounded-2xl font-black text-black text-3xl" onClick={submit}>確認報名</button>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl font-bold">報名清單 (正取 {list.length} / 9)</h2>
          {loading ? <p className="text-2xl text-slate-500">載入中...</p> : list.map((item, i) => (
            <div key={item.id} className="bg-slate-900 p-6 rounded-2xl flex justify-between items-center border border-slate-800">
              <div className="text-2xl">
                <span className={`px-4 py-2 rounded-xl font-bold mr-4 text-xl ${i < 9 ? 'bg-emerald-500 text-black' : 'bg-slate-700'}`}>
                  {i < 9 ? '正取' : '候補'}
                </span>
                <span className="font-bold">{item.name}</span>
              </div>
              <button className="text-rose-400 text-xl font-bold" onClick={() => {
                const p = prompt('請輸入密碼取消');
                if(p === item.password) { supabase.from('pickleball_registrations').delete().eq('id', item.id).then(load); }
              }}>取消</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}