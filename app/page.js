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

  // 載入資料（安全版：不選取 password 欄位）
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

  // 計算總人數（加總每個人的 count）
  const totalCount = list.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

  // 送出報名
  const submit = async () => {
    if (!form.name.trim() || form.password.length !== 4) { 
      alert('請輸入暱稱與 4 位密碼'); 
      return; 
    }
    
    // 名額上限改為 8 位防呆
    if (totalCount + parseInt(form.count) > 8) {
      alert('報名人數已超過 8 位上限！');
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
      alert('報名成功！'); 
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
      {/* 最大寬度調寬（max-w-2xl），更適合兩倍大的字體呈現 */}
      <div className="max-w-2xl mx-auto space-y-12 py-10">
        
        {/* 標題與註記更新（字體放大 2 倍） */}
        <div className="text-center bg-slate-900 p-12 rounded-3xl border border-emerald-500/30 shadow-2xl">
          <h1 className="text-7xl font-black mb-6 text-emerald-400 tracking-wider">七賢國小交流團</h1>
          <p className="text-3xl text-slate-400 font-bold">新手體驗與新手區報名</p>
        </div>

        {/* 場次選擇按鈕（加上 19:00-21:20 註記，字體放大） */}
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

        {/* 填寫表單（輸入框、下拉選單、按鈕高度與字體全面放大） */}
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
            確認報名
          </button>
        </div>

        {/* 報名名單列表（名額上限改為 8 位，字體放大） */}
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-3xl font-black tracking-wide">
              目前人數：<span className="text-emerald-400">{totalCount}</span> / 8
            </h2>
            {totalCount >= 8 && (
              <span className="text-xl bg-rose-500/20 text-rose-400 font-black px-4 py-2 rounded-xl animate-pulse">
                已額滿
              </span>
            )}
          </div>
          
          {list.length === 0 ? (
            <div className="text-center py-12 text-2xl text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
              目前暫無人報名，快來搶頭香！
            </div>
          ) : (
            <div className="space-y-4">
              {list.map((item) => (
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

      </div>
    </main>
  );
}