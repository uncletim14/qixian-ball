'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 連接 Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc2lhZWVoemhzYXFqeHhpa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njc4NDksImV4cCI6MjA5NjA0Mzg0OX0.UYNrbcm5HaDucdcAj7XMwIBye6dsA6cRaG-bLY34XVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSIONS = [
  { id: 'mon', label: '週一場', time: '19:00-21:20' },
  { id: 'fri', label: '週五場', time: '19:00-21:20' },
  { id: 'sat', label: '週六場', time: '19:00-21:20' }
];

export default function Home() {
  const [day, setDay] = useState('mon');
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: '', count: '1', password: '' });

  // 載入資料
  const load = async () => {
    const { data, error } = await supabase
      .from('pickleball_registrations')
      .select('id, name, count, session_id')
      .eq('session_id', day)
      .order('created_at', { ascending: true });
      
    if (error) console.error('讀取失敗:', error.message);
    else if (data) setList(data);
  };

  useEffect(() => { load(); }, [day]);

  // ─── 核心備取邏輯計算 ───
  let currentTotal = 0;
  const mainList = [];  // 正取名單
  const waitList = [];  // 備取名單

  list.forEach(item => {
    const seats = Number(item.count) || 0;
    // 如果目前人數 + 這組人數 小於等於 8，就是正取
    if (currentTotal + seats <= 8) {
      mainList.push(item);
      currentTotal += seats;
    } else {
      // 只要有一點點爆掉（例如 7 + 2 = 9），整組直接丟進備取
      waitList.push(item);
    }
  });

  // 備取總人數計算
  const totalWaitCount = waitList.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

  // 送出報名（移除人數上限限制，改為無限開放登記）
  const submit = async () => {
    if (!form.name.trim() || form.password.length !== 4) { 
      alert('請輸入暱稱與 4 位密碼'); 
      return; 
    }

    const { error } = await supabase.from('pickleball_registrations').insert([{
      name: form.name.trim(), 
      count: parseInt(form.count), 
      password: form.password, 
      session_id: day, 
      created_at: new Date().toISOString()
    }]);

    if (error) {
      alert('報名失敗：' + error.message);
    } else { 
      alert('登記成功！'); 
      setForm({ name: '', count: '1', password: '' }); 
      load(); 
    }
  };

  // 取消報名
  const handleDelete = async (item) => {
    const pwd = prompt('請輸入您的 4 位取消密碼：');
    if (!pwd) return;

    const { error } = await supabase
      .from('pickleball_registrations')
      .delete()
      .eq('id', item.id)
      .eq('password', pwd);

    if (error) {
      alert('系統錯誤：' + error.message);
    } else {
      alert('取消成功！');
      load();
    }
  };

  return (
    <main className="min-h-screen bg-[#090d16] text-white p-8">
      <div className="max-w-2xl mx-auto space-y-12 py-10">
        
        {/* 標題與註記 */}
        <div className="text-center bg-slate-900 p-12 rounded-3xl border border-emerald-500/30 shadow-2xl">
          <h1 className="text-7xl font-black mb-6 text-emerald-400 tracking-wider">
            七賢國小匹克球交流團
          </h1>
          <p className="text-3xl text-slate-400 font-bold">
            新手免費體驗與新手區報名
          </p>
        </div>

        {/* 場次選擇 */}
        <div className="grid grid-cols-3 gap-6">
          {SESSIONS.map(s => (
            <button 
              key={s.id} 
              onClick={() => setDay(s.id)} 
              className={`p-6 rounded-2xl font-black transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                day === s.id 
                  ? 'bg-emerald-500 text-black shadow-xl shadow-emerald-500/20 scale-105' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="text-3xl">{s.label}</span>
              <span className={`text-base font-bold ${day === s.id ? 'text-black/80' : 'text-slate-400'}`}>
                {s.time}
              </span>
            </button>
          ))}
        </div>

        {/* 填寫表單 */}
        <div className="bg-slate-900 p-8 rounded-3xl space-y-6 border border-slate-800 shadow-xl">
          <input 
            className="w-full p-6 bg-black rounded-2xl border-2 border-slate-800 focus:border-emerald-500 focus:outline-none text-3xl" 
            placeholder="輸入暱稱" 
            value={form.name} 
            onChange={e => setForm({...form, name: e.target.value})} 
          />
          
          <select 
            className="w-full p-6 bg-black rounded-2xl border-2 border-slate-800 focus:border-emerald-500 focus:outline-none text-3xl text-white" 
            value={form.count} 
            onChange={e => setForm({...form, count: e.target.value})}
          >
            <option value="1">1 位</option>
            <option value="2">2 位</option>
          </select>
          
          <input 
            className="w-full p-6 bg-black rounded-2xl border-2 border-slate-800 focus:border-emerald-500 focus:outline-none text-3xl" 
            type="password" 
            placeholder="取消密碼 (4位數字)" 
            maxLength={4} 
            value={form.password} 
            onChange={e => setForm({...form, password: e.target.value})} 
          />
          
          <button 
            className="w-full bg-emerald-500 p-6 rounded-2xl text-3xl font-black text-black hover:bg-emerald-400 active:scale-[0.99] transition-all mt-4" 
            onClick={submit}
          >
            確認報名 (滿額自動改備取)
          </button>
        </div>

        {/* ─── 區塊一：正取名單 ─── */}
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-3xl font-black tracking-wide">
              正取人數：<span className="text-emerald-400">{currentTotal}</span> / 8
            </h2>
            {currentTotal >= 8 && (
              <span className="text-xl bg-amber-500/20 text-amber-400 font-black px-4 py-2 rounded-xl">
                正取已滿
              </span>
            )}
          </div>
          
          {mainList.length === 0 ? (
            <div className="text-center py-12 text-2xl text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
              目前暫無正取球友，快來搶位！
            </div>
          ) : (
            <div className="space-y-4">
              {mainList.map((item) => (
                <div key={item.id} className="bg-slate-900 p-6 rounded-2xl flex justify-between items-center border border-slate-800 shadow-md">
                  <span className="text-2xl font-bold tracking-wide">
                    {item.name} <span className="text-emerald-400 text-xl ml-3">({item.count}位)</span>
                  </span>
                  <button 
                    className="text-rose-400 hover:text-rose-300 text-xl font-black transition-colors bg-rose-500/10 hover:bg-rose-500/20 px-4 py-2 rounded-xl" 
                    onClick={() => handleDelete(item)}
                  >
                    取消
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── 區塊二：備取名單（有資料才會顯示） ─── */}
        {waitList.length > 0 && (
          <div className="space-y-6 pt-6 border-t-2 border-dashed border-slate-800">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-3xl font-black tracking-wide text-amber-400">
                遞補備取：<span>{totalWaitCount}</span> 位
              </h2>
            </div>
            
            <div className="space-y-4">
              {waitList.map((item, index) => (
                <div key={item.id} className="bg-slate-950 p-6 rounded-2xl flex justify-between items-center border border-amber-500/20 shadow-md opacity-80">
                  <span className="text-2xl font-bold tracking-wide text-slate-300">
                    <span className="text-amber-400 mr-2">[備取 {index + 1}]</span>
                    {item.name} <span className="text-amber-500/80 text-xl ml-3">({item.count}位)</span>
                  </span>
                  <button 
                    className="text-rose-400 hover:text-rose-300 text-xl font-black transition-colors bg-rose-500/10 hover:bg-rose-500/20 px-4 py-2 rounded-xl" 
                    onClick={() => handleDelete(item)}
                  >
                    取消
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}