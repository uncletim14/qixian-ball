'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 連接 Supabase
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
  const [form, setForm] = useState({ name: '', count: '1', password: '' });

  const load = async () => {
    // 確保這裡對應正確的資料表名稱
    const { data } = await supabase.from('pickleball_registrations').select('*').order('created_at', { ascending: true });
    if (data) setList(data.filter(item => item.session_id === day));
  };

  useEffect(() => { load(); }, [day]);

  const submit = async () => {
    if (!form.name || form.password.length !== 4) { alert('請輸入暱稱與4位密碼'); return; }
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
          <h1 className="text-4xl font-black mb-4">七賢國小匹克球</h1>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {SESSIONS.map(s => (
            <button key={s.id} onClick={() => setDay(s.id)} className={`py-4 rounded-xl font-bold ${day === s.id ? 'bg-emerald-500 text-black' : 'bg-slate-800'}`}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl space-y-4">
          <input className="w-full p-4 bg-black rounded-xl" placeholder="輸入暱稱" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <select className="w-full p-4 bg-black rounded-xl" value={form.count} onChange={e => setForm({...form, count: e.target.value})}>
            <option value="1">1 位</option><option value="2">2 位</option>
          </select>
          <input className="w-full p-4 bg-black rounded-xl" type="password" placeholder="取消密碼 (4位)" maxLength={4} value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          <button className="w-full bg-emerald-500 p-4 rounded-xl font-black text-black" onClick={submit}>確認報名</button>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">目前人數：{list.length} / 9</h2>
          {list.map((item, i) => (
            <div key={item.id} className="bg-slate-900 p-4 rounded-xl flex justify-between items-center">
              <span>{item.name} ({item.count}位)</span>
              <button className="text-rose-400" onClick={() => {
                const p = prompt('取消密碼');
                if(p === item.password) { supabase.from('pickleball_registrations').delete().eq('id', item.id).then(load); }
              }}>取消</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}