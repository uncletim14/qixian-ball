'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc2lhZWVoemhzYXFqeHhpa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njc4NDksImV4cCI6MjA5NjA0Mzg0OX0.UYNrbcm5HaDucdcAj7XMwIBye6dsA6cRaG-bLY34XVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getTargetDateStr(targetDayOfWeek) {
  const now = new Date();
  const currentDay = now.getDay(); 
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  
  const currentTimeInMinutes = currentHours * 60 + currentMinutes;
  const targetTimeInMinutes = 22 * 60; // 22:00

  let isNextWeekMode = false;
  if (currentDay === 6 && currentTimeInMinutes >= targetTimeInMinutes) {
    isNextWeekMode = true; 
  } else if (currentDay === 0) {
    isNextWeekMode = true; 
  }

  const baseDate = new Date(now);
  const dayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  baseDate.setDate(now.getDate() + dayOffset); 

  if (isNextWeekMode) {
    baseDate.setDate(baseDate.getDate() + 7);
  }

  const resultDate = new Date(baseDate);
  if (targetDayOfWeek === 1) resultDate.setDate(baseDate.getDate() + 0); 
  if (targetDayOfWeek === 5) resultDate.setDate(baseDate.getDate() + 4); 
  if (targetDayOfWeek === 6) resultDate.setDate(baseDate.getDate() + 5); 

  const mm = String(resultDate.getMonth() + 1).padStart(2, '0');
  const dd = String(resultDate.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

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
  const [selectedType, setSelectedType] = useState('normal'); 
  const [list, setList] = useState([]);
  const [isCheckInMode, setIsCheckInMode] = useState(false);
  
  const [adminPin, setAdminPin] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const [form, setForm] = useState({ name: '', count: '1', password: '' });
  const [checkInName, setCheckInName] = useState('');

  // 神祕入口（點擊「球」字 3 下）
  const handleSecretClick = () => {
    const newCount = clickCount + 1;
    if (newCount >= 3) {
      setIsCheckInMode(!isCheckInMode);
      setClickCount(0);
    } else {
      setClickCount(newCount);
      setTimeout(() => setClickCount(0), 1500);
    }
  };

  // ✨ 核心開放邏輯：只有 selectedType 為 'normal' (新手區) 才開放，體驗區一律不開放
  const isAvailable = selectedType === 'normal';
  const maxSeatsLimit = 8;

  const TYPES = [
    { id: 'experience', label: '新手體驗', note: '本週無開放' },
    { id: 'normal', label: '新手區', note: '開放報名' }
  ];

  const activeDayConfig = DAYS.find(d => d.id === selectedDay);
  const activeDate = activeDayConfig ? activeDayConfig.dateStr : '';
  const currentSessionId = `${activeDate}_${selectedType}`;

  // 強制切換日期時指到「新手區」
  useEffect(() => {
    setSelectedType('normal');
  }, [selectedDay]);

  useEffect(() => {
    setAdminPin('');
    setIsAdminAuthenticated(false);
    setCheckInName('');
  }, [isCheckInMode]);

  useEffect(() => {
    const numericCount = parseInt(form.count);
    if (selectedType === 'normal' && numericCount > 2) {
      setForm(prev => ({ ...prev, count: '1' }));
    }
    setCheckInName('');
  }, [selectedType]);

  // 讀取報名資料
  useEffect(() => { 
    if (!currentSessionId) return;
    const load = async () => {
      const { data } = await supabase.from('pickleball_registrations').select('id, name, count, session_id, arrived').eq('session_id', currentSessionId).order('created_at', { ascending: true });
      if (data) setList(data);
    };
    load(); 
  }, [currentSessionId]);

  let currentTotal = 0;
  const mainList = [];
  const waitList = [];
  list.forEach(item => {
    const seats = Number(item.count) || 0;
    if (currentTotal + seats <= maxSeatsLimit) { mainList.push(item); currentTotal += seats; }
    else { waitList.push(item); }
  });

  const totalWaitCount = waitList.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

  const refreshData = async () => {
    if (!currentSessionId) return;
    const { data } = await supabase.from('pickleball_registrations').select('id, name, count, session_id, arrived').eq('session_id', currentSessionId).order('created_at', { ascending: true });
    if (data) setList(data);
  };

  const verifyAdminPin = () => {
    if (adminPin === '8888') { setIsAdminAuthenticated(true); } 
    else { alert('❌ 管理員暗號錯誤！'); setAdminPin(''); }
  };

  const submit = async () => {
    if (!isAvailable) { alert('本分區本週無開放報名喔！'); return; }
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeValue = currentHours * 100 + currentMinutes; 
    const todayStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    if (activeDate === todayStr && currentTimeValue >= 1830) { alert('🚫 抱歉！今天的報名已於 18:30 截止囉！'); return; }
    
    const numericCount = parseInt(form.count);
    if (numericCount < 1 || numericCount > 2) { alert('🚫 新手區單筆報名最多 2 位球友喔！'); return; }

    const trimmedName = form.name.trim();
    if (!trimmedName || form.password.length !== 4) { alert('請輸入暱稱與 4 位密碼'); return; }
    if (list.some(item => item.name.toLowerCase() === trimmedName.toLowerCase())) { alert(`❌ 暱稱「${trimmedName}」已被使用！`); return; }

    const { error } = await supabase.from('pickleball_registrations').insert([{ name: trimmedName, count: numericCount, password: form.password, session_id: currentSessionId, created_at: new Date().toISOString(), arrived: false }]);
    if (error) alert('報名失敗：' + error.message);
    else { alert('登記成功！'); setForm({ name: '', count: '1', password: '' }); refreshData(); }
  };

  const handleCheckInSubmit = async () => {
    if (!checkInName) { alert('請選擇球友暱稱！'); return; }
    const targetItem = list.find(item => item.name === checkInName);
    if (!targetItem) return;
    const { error } = await supabase.from('pickleball_registrations').update({ arrived: true }).eq('id', targetItem.id);
    if (error) alert('系統錯誤：' + error.message);
    else { alert(`🎉 成功幫【${checkInName}】點名！`); setCheckInName(''); refreshData(); }
  };

  const handleDelete = async (item) => {
    const pwd = prompt('請輸入 4 位取消密碼：');
    if (!pwd) return;
    const { error } = await supabase.from('pickleball_registrations').delete().eq('id', item.id).eq('password', pwd);
    if (error) alert('系統錯誤：' + error.message);
    else { alert('取消成功！'); refreshData(); }
  };

  return (
    <main className="min-h-screen bg-[#f0f4f8] text-[#2d3748] p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-10 py-2 sm:py-6">
        
        <div className="h-4"></div>

        {/* 大標題 */}
        <div className={`text-center p-6 sm:p-12 rounded-3xl shadow-md border transition-all ${isCheckInMode ? 'bg-[#ffe8cc] border-[#ffd8a8]' : 'bg-[#D9EAD3] border-[#b6d7a8]'}`}>
          <h1 className={`text-3xl sm:text-6xl font-black tracking-wider leading-tight select-none ${isCheckInMode ? 'text-[#d94800]' : 'text-[#0070C0]'}`}>
            七賢國小匹克
            <span onClick={handleSecretClick} className="cursor-pointer active:opacity-80">球</span>
          </h1>
          <p className={`text-lg sm:text-2xl font-black tracking-widest border-t pt-3 mt-4 sm:mt-6 ${isCheckInMode ? 'text-[#d94800] border-[#ffd8a8]' : 'text-[#0070C0] border-[#b6d7a8]'}`}>
            {isCheckInMode ? '📱 管理員現場點名主控台 (按「球」字可退出)' : '新手區限額報名（體驗暫停）'}
          </p>
        </div>

        {/* 日期選擇 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          {DAYS.map(d => (
            <button key={d.id} onClick={() => setSelectedDay(d.id)} className={`p-3 sm:p-5 rounded-2xl font-black transition-all duration-200 flex flex-col items-center justify-center gap-1 shadow-sm border-2 ${selectedDay === d.id ? (isCheckInMode ? 'bg-[#ff6d00] border-[#ff6d00] text-white' : 'bg-[#0070C0] border-[#0070C0] text-white scale-105') : 'bg-white text-[#4a5568] hover:bg-slate-50 border-white'}`}>
              <span className="text-lg sm:text-2xl">{d.label}</span>
              <span className={`text-xl sm:text-3xl font-black tracking-tighter ${selectedDay === d.id ? 'text-[#ffe082]' : 'text-[#ff6d00]'}`}>{d.dateStr}</span>
            </button>
          ))}
        </div>

        {/* 組別選擇 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setSelectedType(t.id)} className={`p-4 sm:p-5 rounded-2xl font-black transition-all duration-200 border-2 flex flex-col items-center justify-center gap-1 shadow-sm ${selectedType === t.id ? 'bg-[#D9EAD3] text-[#0070C0] border-[#0070C0]' : 'bg-white text-[#718096] border-transparent hover:text-[#0070C0]'}`}>
              <span className="text-xl sm:text-3xl">{t.label}</span>
              {!isCheckInMode && <span className={`text-base sm:text-xl ${t.note === '本週無開放' ? 'text-red-500 font-bold' : 'text-[#0070C0]'}`}>({t.note})</span>}
            </button>
          ))}
        </div>

        {/* 看板 */}
        <div className="bg-white border border-[#0070C0]/20 rounded-2xl p-4 sm:p-6 text-center space-y-1 shadow-sm">
          <div className="text-2xl sm:text-4xl font-black text-[#0070C0] tracking-wide">⏰ 時間：19:00 - 21:20</div>
          <div className="text-sm sm:text-base text-red-500 font-bold">⚠️ 當天 18:30 後即截止報名</div>
        </div>

        {/* 表單 / 點名區 */}
        <div className={`p-5 sm:p-8 rounded-3xl shadow-xl border transition-all ${isCheckInMode ? 'bg-[#ffe8cc] border-[#ffd8a8]' : 'bg-[#D9EAD3] border-[#b6d7a8]'}`}>
          {isCheckInMode ? (
            !isAdminAuthenticated ? (
              <div className="space-y-4 text-center">
                <div className="text-xl sm:text-2xl font-black text-[#d94800]">🔒 請輸入管理員專用暗號</div>
                <input className="w-full p-4 bg-white rounded-2xl border-2 text-center text-2xl tracking-widest focus:outline-none focus:border-[#ff6d00]" type="password" placeholder="請輸入 4 位暗號" value={adminPin} onChange={e => setAdminPin(e.target.value)} />
                <button className="w-full bg-[#ff6d00] text-white p-4 rounded-2xl text-xl font-black" onClick={verifyAdminPin}>解除鎖定</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-xl sm:text-2xl font-black text-[#d94800] text-center">📋 現場快速點名區</div>
                <select className="w-full p-4 bg-white rounded-2xl text-xl" value={checkInName} onChange={e => setCheckInName(e.target.value)}>
                  <option value="">-- 請選擇到場球友的暱稱 --</option>
                  {list.map(item => (<option key={item.id} value={item.name} disabled={item.arrived}>{item.name} ({item.count}位) {item.arrived ? ' [已報到]' : ''}</option>))}
                </select>
                <button className="w-full bg-green-600 text-white p-4 rounded-2xl text-xl font-black hover:bg-green-700" onClick={handleCheckInSubmit}>確認到場（直接點名）</button>
              </div>
            )
          ) : (
            isAvailable ? (
              <div className="space-y-4">
                <input className="w-full p-4 bg-white rounded-2xl border-2 text-xl focus:outline-none focus:border-[#0070C0]" placeholder="輸入暱稱" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                <select className="w-full p-4 bg-white rounded-2xl border-2 text-xl focus:outline-none focus:border-[#0070C0]" value={form.count} onChange={e => setForm({...form, count: e.target.value})}>
                  <option value="1">1 位</option> <option value="2">2 位</option>
                </select>
                <input className="w-full p-4 bg-white rounded-2xl border-2 text-xl focus:outline-none focus:border-[#0070C0]" type="password" placeholder="取消密碼 (4位數字)" maxLength={4} value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                <button className="w-full bg-[#0070C0] text-white p-4 rounded-2xl text-xl font-black hover:bg-[#005a9c]" onClick={submit}>確認報名</button>
              </div>
            ) : (
              <div className="text-center py-6 font-bold text-red-600">本分區本週暫無開放報名喔！</div>
            )
          )}
        </div>

        {/* 正取名單 */}
        <div className="space-y-4">
          <h2 className="text-2xl sm:text-4xl font-black text-[#0070C0] px-2">正取名單 ({currentTotal} / {maxSeatsLimit})</h2>
          {mainList.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-white rounded-2xl">暫無報名</div>
          ) : (
            <div className="space-y-3">
              {mainList.map((item) => (
                <div key={item.id} className={`p-4 sm:p-6 rounded-2xl flex justify-between items-center shadow-sm border ${item.arrived ? 'bg-green-100 border-green-300' : 'bg-white border-slate-100'}`}>
                  <span className="text-xl sm:text-3xl font-bold">
                    {item.arrived && <span className="text-green-600 mr-2">✓ [已報到]</span>}
                    {item.name} <span className="text-sm font-normal text-slate-400">({item.count}位)</span>
                  </span>
                  <button className="text-red-500 text-sm font-bold bg-red-50 px-3 py-1.5 rounded-xl" onClick={() => handleDelete(item)}>取消</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 備取名單 */}
        {!isCheckInMode && waitList.length > 0 && (
          <div className="space-y-4 pt-6 border-t-2 border-dashed border-slate-200">
            <h2 className="text-2xl font-black text-[#ff6d00] px-2">遞補備取：{totalWaitCount} 位</h2>
            <div className="space-y-3">
              {waitList.map((item, index) => (
                <div key={item.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-100">
                  <span className="text-xl font-bold text-slate-600"><span className="text-[#ff6d00] mr-2">[備取 {index + 1}]</span>{item.name} ({item.count}位)</span>
                  <button className="text-red-500 text-sm bg-red-50 px-3 py-1.5 rounded-xl" onClick={() => handleDelete(item)}>取消</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}