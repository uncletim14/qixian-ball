'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 連接 Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc2lhZWVoemhzYXFqeHhpa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njc4NDksImV4cCI6MjA5NjA0Mzg0OX0.UYNrbcm5HaDucdcAj7XMwIBye6dsA6cRaG-bLY34XVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── 輔助函式：自動推算日期 ───
function getTargetDateStr(targetDayOfWeek) {
  const now = new Date();
  const thisSaturday = new Date(now);
  const currentDay = now.getDay(); 
  const daysUntilSaturday = 6 - currentDay;
  thisSaturday.setDate(now.getDate() + daysUntilSaturday);
  thisSaturday.setHours(18, 0, 0, 0);

  const baseDate = new Date(now);
  if (now >= thisSaturday) {
    baseDate.setDate(now.getDate() + 7);
  }

  const baseDay = baseDate.getDay();
  const diff = targetDayOfWeek - baseDay;
  const targetDate = new Date(baseDate);
  targetDate.setDate(baseDate.getDate() + diff);

  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

const TYPES = [
  { id: 'experience', label: '新手體驗', note: '免費' },
  { id: 'normal', label: '新手區', note: '100元/人' }
];

export default function Home() {
  const monDate = getTargetDateStr(1);
  const friDate = getTargetDateStr(5);
  const satDate = getTargetDateStr(6);

  const DAYS = [
    { id: 'mon', label: '週一場', dateStr: monDate },
    { id: 'fri', label: '週五場', dateStr: friDate },
    { id: 'sat', label: '週六場', dateStr: satDate }
  ];

  const [selectedDay, setSelectedDay] = useState('mon');
  const [selectedType, setSelectedType] = useState('experience');
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: '', count: '1', password: '' });

  const activeDate = DAYS.find(d => d.id === selectedDay)?.dateStr || '';
  const currentSessionId = `${activeDate}_${selectedType}`;

  const load = async () => {
    const { data, error } = await supabase
      .from('pickleball_registrations')
      .select('id, name, count, session_id')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: true });
      
    if (error) console.error('讀取失敗:', error.message);
    else if (data) setList(data);
  };

  useEffect(() => { 
    load(); 
  }, [selectedDay, selectedType, currentSessionId]);

  let currentTotal = 0;
  const mainList = [];
  const waitList = [];

  list.forEach(item => {
    const seats = Number(item.count) || 0;
    if (currentTotal + seats <= 8) {
      mainList.push(item);
      currentTotal += seats;
    } else {
      waitList.push(item);
    }
  });

  const totalWaitCount = waitList.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

  const submit = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName || form.password.length !== 4) { 
      alert('請輸入暱稱與 4 位密碼'); 
      return; 
    }
    const isNameDuplicate = list.some(item => item.name.toLowerCase() === trimmedName.toLowerCase());
    if (isNameDuplicate) {
      alert(`❌ 暱稱「${trimmedName}」在此分區已被使用，請換個名字喔！`);
      return;
    }

    const { error } = await supabase.from('pickleball_registrations').insert([{
      name: trimmedName, 
      count: parseInt(form.count), 
      password: form.password, 
      session_id: currentSessionId, 
      created_at: new Date().toISOString()
    }]);

    if (error) alert('報名失敗：' + error.message);
    else { 
      alert('登記成功！'); 
      setForm({ name: '', count: '1', password: '' }); 
      load(); 
    }
  };

  const handleDelete = async (item) => {
    const pwd = prompt('請輸入您的 4 位取消密碼：');
    if (!pwd) return;
    const { error } = await supabase.from('pickleball_registrations').delete().eq('id', item.id).eq('password', pwd);
    if (error) alert('系統錯誤：' + error.message);
    else { alert('取消成功！'); load(); }
  };

  return (
    /* 主背景維持高質感淺綠色 (#e2ebd5) */
    <main className="min-h-screen bg-[#e2ebd5] text-[#232b21] p-8">
      <div className="max-w-2xl mx-auto space-y-10 py-6">
        
        {/* 1. 頂部大標題區塊（白底圓角，更新為三行文字排列） */}
        <div className="text-center bg-white p-12 rounded-3xl shadow-md border border-[#c9d4b8]">
          {/* 第一行：七賢國小匹克球 */}
          <h1 className="text-6xl font-black text-[#1e291b] tracking-wider">
            七賢國小匹克球
          </h1>
          {/* 第二行：交流團 */}
          <h1 className="text-6xl font-black mt-3 text-[#1e291b] tracking-wider">
            交流團
          </h1>
          {/* ✨ 第三行：新手免費體驗與新手區報名 */}
          <p className="text-2xl text-[#5b6a57] font-bold tracking-widest border-t border-slate-100 pt-4 mt-6">
            新手免費體驗與新手區報名
          </p>
        </div>

        {/* 2. 第一層：日期按鈕 */}
        <div className="grid grid-cols-3 gap-6">
          {DAYS.map(d => (
            <button 
              key={d.id} 
              onClick={() => setSelectedDay(d.id)} 
              className={`p-5 rounded-2xl font-black transition-all duration-200 flex flex-col items-center justify-center gap-2 shadow-sm ${
                selectedDay === d.id 
                  ? 'bg-[#1e291b] text-white shadow-xl scale-105' 
                  : 'bg-white text-[#475443] hover:bg-slate-50'
              }`}
            >
              <span className="text-2xl">{d.label}</span>
              <span className={`text-2xl font-black tracking-tighter ${selectedDay === d.id ? 'text-[#b0c495]' : 'text-[#6e8550]'}`}>
                {d.dateStr}
              </span>
            </button>
          ))}
        </div>

        {/* 3. 第二層：組別選擇 */}
        <div className="grid grid-cols-2 gap-6">
          {TYPES.map(t => (
            <button 
              key={t.id} 
              onClick={() => setSelectedType(t.id)} 
              className={`p-5 rounded-2xl font-black transition-all duration-200 border-2 flex flex-col items-center justify-center gap-1 shadow-sm ${
                selectedType === t.id 
                  ? 'bg-white text-[#1e291b] border-[#1e291b] scale-102' 
                  : 'bg-white/60 text-[#5a6b55] border-transparent hover:text-[#1e291b]'
              }`}
            >
              <span className="text-2xl">{t.label}</span>
              <span className={`text-lg ${selectedType === t.id ? 'text-[#6e8550] font-bold' : 'text-[#9caaa4]'}`}>
                ({t.note})
              </span>
            </button>
          ))}
        </div>

        {/* 4. 中間看板 */}
        <div className="bg-white/80 border border-white rounded-2xl p-6 text-center space-y-2 shadow-sm">
          <div className="text-3xl font-black text-[#1e291b] tracking-wide">
            ⏰ 活動時間：19:00 - 21:20
          </div>
          <div className="text-lg text-