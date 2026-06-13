'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 連接 Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc2lhZWVoemhzYXFqeHhpa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njc4NDksImV4cCI6MjA5NjA0Mzg0OX0.UYNrbcm5HaDucdcAj7XMwIBye6dsA6cRaG-bLY34XVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── 輔助函式：根據每週六 18:00 自動推算本週或下週的指定星期日期 ───
function getTargetDateStr(targetDayOfWeek) {
  const now = new Date();
  
  // 找出本週六 18:00 的時間點
  const thisSaturday = new Date(now);
  const currentDay = now.getDay(); // 0:日, 1:一, ..., 6:六
  const daysUntilSaturday = 6 - currentDay;
  thisSaturday.setDate(now.getDate() + daysUntilSaturday);
  thisSaturday.setHours(18, 0, 0, 0);

  // 判斷是否已經過了週六 18:00，若是，則基準週要往後推一週
  const baseDate = new Date(now);
  if (now >= thisSaturday) {
    baseDate.setDate(now.getDate() + 7);
  }

  // 根據基準週，計算出該週的星期一、五、六的具體日期
  const baseDay = baseDate.getDay();
  const diff = targetDayOfWeek - baseDay;
  const targetDate = new Date(baseDate);
  targetDate.setDate(baseDate.getDate() + diff);

  // 格式化成 MM/DD
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

const TYPES = [
  { id: 'experience', label: '新手體驗', note: '免費' },
  { id: 'normal', label: '新手區', note: '100元/人' }
];

export default function Home() {
  // 動態生成當前開放報名的日期字串
  const monDate = getTargetDateStr(1); // 星期一
  const friDate = getTargetDateStr(5); // 星期五
  const satDate = getTargetDateStr(6); // 星期六

  const DAYS = [
    { id: 'mon', label: '週一場', dateStr: monDate },
    { id: 'fri', label: '週五場', dateStr: friDate },
    { id: 'sat', label: '週六場', dateStr: satDate }
  ];

  const [selectedDay, setSelectedDay] = useState('mon');
  const [selectedType, setSelectedType] = useState('experience');
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: '', count: '1', password: '' });

  // 抓取當前選中的具體日期數字（例如: "06/15"）
  const activeDate = DAYS.find(d => d.id === selectedDay)?.dateStr || '';
  
  // 組合唯一的識別碼作為資料庫 session_id：例如 "06/15_experience"
  const currentSessionId = `${activeDate}_${selectedType}`;

  // 載入資料
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

  // ─── 核心正備取邏輯計算 ───
  let currentTotal = 0;
  const mainList = [];  // 正取名單
  const waitList = [];  // 備取名單

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

  // 送出報名
  const submit = async () => {
    const trimmedName = form.name.trim();

    if (!trimmedName || form.password.length !== 4) { 
      alert('請輸入暱稱與 4 位密碼'); 
      return; 
    }

    // 檢查同日期同分區是否有重複暱稱
    const isNameDuplicate = list.some(item => item.name.toLowerCase() === trimmedName.toLowerCase());
    if (isNameDuplicate) {
      alert(`❌ 暱稱「${trimmedName}」在此場次的該分區已被使用，請換個名字喔！`);
      return;
    }

    const { error } = await supabase.from('pickleball_registrations').insert([{
      name: trimmedName, 
      count: parseInt(form.count), 
      password: form.password, 
      session_id: currentSessionId, // 存入包含日期的識別碼，如 "06/15_experience"
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
      <div className="max-w-2xl mx-auto space-y-10 py-6">
        
        {/* 1. 頂部大標題 */}
        <div className="text-center bg-slate-900 p-12 rounded-3xl border border-emerald-500/30 shadow-2xl">
          <h1 className="text-7xl font-black mb-4 text-emerald-400 tracking-wider">
            七賢國小匹克球交流團
          </h1>
          <p className="text-3xl text-slate-400 font-bold">
            新手活動線上報名系統
          </p>
        </div>

        {/* 2. 第一層：星期與動態日期選擇 */}
        <div className="grid grid-cols-3 gap-6">
          {DAYS.map(d => (
            <button 
              key={d.id} 
              onClick={() => setSelectedDay(d.id)} 
              className={`p-4 rounded-2xl font-black transition-all duration-200 flex flex-col items-center justify-center gap-1 ${
                selectedDay === d.id 
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 scale-105' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="text-3xl">{d.label}</span>
              <span className={`text-xl font-bold ${selectedDay === d.id ? 'text-black/70' : 'text-slate-400'}`}>
                {d.dateStr}
              </span>
            </button>
          ))}
        </div>

        {/* 3. 第二層：組別類型選擇 */}
        <div className="grid grid-cols-2 gap-6">
          {TYPES.map(t => (
            <button 
              key={t.id} 
              onClick={() => setSelectedType(t.id)} 
              className={`p-5 rounded-2xl font-black transition-all duration-200 border-2 flex flex-col items-center justify-center gap-1 ${
                selectedType === t.id 
                  ? 'bg-transparent text-emerald-400 border-emerald-500 shadow-lg shadow-emerald-500/10 scale-102' 
                  : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:text-slate-300'
              }`}
            >
              <span className="text-3xl">{t.label}</span>
              <span className={`text-lg ${selectedType === t.id ? 'text-emerald-500 font-bold' : 'text-slate-500'}`}>
                ({t.note})
              </span>
            </button>
          ))}
        </div>

        {/* 4. 中間註記：時間與每週更新提示 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
          <div className="text-3xl font-black text-emerald-400 tracking-wide">
            ⏰ 活動時間：19:00 - 21:20
          </div>
          <div className="text-xl text-amber-400/90 font-medium">
            🔄 系統提示：每星期六晚上 18:00 準時更新開放下週報名
          </div>
        </div>

        {/* 5. 填寫報名表單 */}
        <div className="bg-slate-900 p-8 rounded-3xl space-y-6 border border-slate-800 shadow-xl">
          <div className="text-2xl font-bold text-slate-400 mb-2 text-center">
            您正在報名：
            <span className="text-emerald-400 font-black">
              {DAYS.find(d => d.id === selectedDay)?.label} ({activeDate}) - {TYPES.find(t => t.id === selectedType)?.label} 
              （{TYPES.find(t => t.id === selectedType)?.note}）
            </span>
          </div>

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

        {/* 6. 正取名單顯示 */}
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

        {/* 7. 備取名單顯示 */}
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