'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc2lhZWVoemhzYXFqeHhpa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njc4NDksImV4cCI6MjA5NjA0Mzg0OX0.UYNrbcm5HaDucdcAj7XMwIBye6dsA6cRaG-bLY34XVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getTargetDateStr(targetDayOfWeek) {
  const now = new Date();
  const thisSaturday = new Date(now);
  const currentDay = now.getDay(); 
  const daysUntilSaturday = 6 - currentDay;
  thisSaturday.setDate(now.getDate() + daysUntilSaturday);
  thisSaturday.setHours(18, 0, 0, 0);

  const baseDate = new Date(now);
  if (now >= thisSaturday) { baseDate.setDate(now.getDate() + 7); }

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

  useEffect(() => { load(); }, [selectedDay, selectedType, currentSessionId]);

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
      name: trimmedName, count: parseInt(form.count), password: form.password, session_id: currentSessionId, created_at: new Date().toISOString()
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
    /* 🎨 主背景更換：溫和的美式運動燕麥白 (#f4f1ea) */
    <main className="min-h-screen bg-[#f4f1ea] text-[#2c3e2e] p-8">
      <div className="max-w-2xl mx-auto space-y-10 py-6">
        
        {/* 1. 頂部大標題區塊 */}
        <div className="text-center bg-white p-12 rounded-3xl shadow-md border border-[#e3ded2]">
          <h1 className="text-6xl font-black mb-6 text-[#1c352d] tracking-wider">
            七賢國小匹克球交流團
          </h1>
          <p className="text-3xl text-[#2c3e2e] font-black tracking-widest">
            新手免費體驗與新手區報名
          </p>
        </div>

        {/* 2. 第一層：日期按鈕 (選中變深墨綠底 #1c352d) */}
        <div className="grid grid-cols-3 gap-6">
          {DAYS.map(d => (
            <button 
              key={d.id} 
              onClick={() => setSelectedDay(d.id)} 
              className={`p-5 rounded-2xl font-black transition-all duration-200 flex flex-col items-center justify-center gap-2 shadow-sm ${
                selectedDay === d.id 
                  ? 'bg-[#1c352d] text-white shadow-xl scale-105' 
                  : 'bg-white text-[#334d40] hover:bg-[#eae6db]'
              }`}
            >
              <span className="text-3xl">{d.label}</span>
              <span className={`text-3xl font-black tracking-tighter ${selectedDay === d.id ? 'text-[#c9b074]' : 'text-[#82714a]'}`}>
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
                  ? 'bg-white text-[#1c352d] border-[#1c352d] scale-102' 
                  : 'bg-white/60 text-[#607368] border-transparent hover:text-[#1c352d]'
              }`}
            >
              <span className="text-3xl">{t.label}</span>
              <span className={`text-xl ${selectedType === t.id ? 'text-[#82714a] font-bold' : 'text-[#9ba8a0]'}`}>
                ({t.note})
              </span>
            </button>
          ))}
        </div>

        {/* 4. 中間看板 */}
        <div className="bg-white border border-[#e3ded2] rounded-2xl p-6 text-center space-y-2 shadow-sm">
          <div className="text-4xl font-black text-[#1c352d] tracking-wide">
            ⏰ 活動時間：19:00 - 21:20
          </div>
          <div className="text-xl text-[#82714a] font-bold">
            🔄 每星期六晚上 18:00 準時更新開放下週報名
          </div>
        </div>

        {/* 5. 報名表單 */}
        <div className="bg-white p-8 rounded-3xl space-y-6 shadow-md border border-[#e3ded2]">
          <div className="text-2xl font-bold text-[#5c6e65] mb-2 text-center">
            您正在報名：
            <span className="text-[#1c352d] font-black">
              {DAYS.find(d => d.id === selectedDay)?.label} ({activeDate}) - {TYPES.find(t => t.id === selectedType)?.label} 
            </span>
          </div>

          <input className="w-full p-6 bg-[#f9f8f6] rounded-2xl border border-[#e3ded2] focus:border-[#1c352d] focus:outline-none text-3xl text-[#1c352d]" placeholder="輸入暱稱" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <select className="w-full p-6 bg-[#f9f8f6] rounded-2xl border border-[#e3ded2] focus:border-[#1c352d] focus:outline-none text-3xl text-[#1c352d]" value={form.count} onChange={e => setForm({...form, count: e.target.value})}>
            <option value="1">1 位</option>
            <option value="2">2 位</option>
          </select>
          <input className="w-full p-6 bg-[#f9f8f6] rounded-2xl border border-[#e3ded2] focus:border-[#1c352d] focus:outline-none text-3xl text-[#1c352d]" type="password" placeholder="取消密碼 (4位數字)" maxLength={4} value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          <button className="w-full bg-[#1c352d] text-white p-6 rounded-2xl text-3xl font-black hover:bg-[#28493e] transition-all mt-4 shadow-md" onClick={submit}>
            確認報名 (滿額自動改備取)
          </button>
        </div>

        {/* 6. 名單顯示 */}
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-4xl font-black tracking-wide text-[#1c352d]">
              正取人數：<span className="text-[#82714a]">{currentTotal}</span> / 8
            </h2>
            {currentTotal >= 8 && <span className="text-xl bg-red-50 text-red-700 font-black px-4 py-2 rounded-xl">正取已滿</span>}
          </div>
          
          {mainList.length === 0 ? (
            <div className="text-center py-12 text-2xl text-[#7e8f85] border-2 border-dashed border-[#e3ded2] rounded-2xl bg-white/40">目前暫無報名球友</div>
          ) : (
            <div className="space-y-4">
              {mainList.map((item) => (
                <div key={item.id} className="bg-white p-6 rounded-2xl flex justify-between items-center shadow-sm border border-[#e3ded2]">
                  <span className="text-3xl font-bold tracking-wide text-[#1c352d]">{item.name} <span className="text-[#82714a] text-2xl ml-3">({item.count}位)</span></span>
                  <button className="text-red-600 hover:text-red-800 text-xl font-black bg-red-50 px-4 py-2 rounded-xl" onClick={() => handleDelete(item)}>取消</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. 備取名單 */}
        {waitList.length > 0 && (
          <div className="space-y-6 pt-6 border-t border-[#e3ded2]">
            <h2 className="text-4xl font-black text-[#a67c1e] px-2">遞補備取：{totalWaitCount} 位</h2>
            <div className="space-y-4">
              {waitList.map((item, index) => (
                <div key={item.id} className="bg-white/80 p-6 rounded-2xl flex justify-between items-center shadow-sm border border-[#ebdcb9]">
                  <span className="text-3xl font-bold text-[#4a544f]"><span className="text-[#a67c1e] mr-2">[備取 {index + 1}]</span>{item.name} <span className="text-[#a67c1e]/80 text-2xl ml-3">({item.count}位)</span></span>
                  <button className="text-red-600 hover:text-red-800 text-xl font-black px-4 py-2" onClick={() => handleDelete(item)}>取消</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}