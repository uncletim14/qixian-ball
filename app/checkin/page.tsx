'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 連接 Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc2lhZWVoemhzYXFqeHhpa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njc4NDksImV4cCI6MjA5NjA0Mzg0OX0.UYNrbcm5HaDucdcAj7XMwIBye6dsA6cRaG-bLY34XVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── 輔助函式：自動更新日期推算邏輯 ───
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

export default function CheckInPage() {
  const monDate = getTargetDateStr(1);
  const friDate = getTargetDateStr(5);
  const satDate = getTargetDateStr(6);

  const DAYS = [
    { id: 'mon', label: '週一場', dateStr: monDate },
    { id: 'fri', label: '週五場', dateStr: friDate },
    { id: 'sat', label: '週六場', dateStr: satDate }
  ];

  const [selectedDay, setSelectedDay] = useState('fri'); 
  const [selectedType, setSelectedType] = useState('normal'); 
  const [list, setList] = useState([]);
  
  // 報到表單 State
  const [checkInName, setCheckInName] = useState('');
  const [checkInPwd, setCheckInPwd] = useState('');

  const TYPES = [
    { id: 'experience', label: '新手體驗' },
    { id: 'normal', label: '新手區' }
  ];

  // ✨ 修正點 1：日期防呆
  const activeDayConfig = DAYS.find(d => d.id === selectedDay);
  const activeDate = activeDayConfig ? activeDayConfig.dateStr : '';
  
  // ✨ 修正點 2：組別防呆，避免在 find 時發生 undefined.label 崩潰
  const activeTypeConfig = TYPES.find(t => t.id === selectedType);
  const activeTypeLabel = activeTypeConfig ? activeTypeConfig.label : '';

  const currentSessionId = `${activeDate}_${selectedType}`;
  const maxSeatsLimit = selectedType === 'experience' ? 9 : 8;

  // 當切換日期時，自動導向該天有開放的組別
  useEffect(() => {
    if (selectedDay === 'mon') {
      setSelectedType('experience');
    } else if (selectedDay === 'fri') {
      setSelectedType('normal');
    }
  }, [selectedDay]);

  // 讀取報名名單
  useEffect(() => { 
    if (!currentSessionId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('pickleball_registrations')
        .select('id, name, count, session_id, arrived')
        .eq('session_id', currentSessionId)
        .order('created_at', { ascending: true });
        
      if (error) console.error('讀取失敗:', error.message);
      else if (data) setList(data);
    };

    load(); 
  }, [currentSessionId]);

  // 計算正取名額（用來同步展示狀態）
  let currentTotal = 0;
  const mainList = [];
  list.forEach(item => {
    const seats = Number(item.count) || 0;
    if (currentTotal + seats <= maxSeatsLimit) {
      mainList.push(item);
      currentTotal += seats;
    }
  });

  const refreshData = async () => {
    if (!currentSessionId) return;
    const { data, error } = await supabase
      .from('pickleball_registrations')
      .select('id, name, count, session_id, arrived')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: true });
      if (data) setList(data);
  };

  // 執行報到
  const handleCheckInSubmit = async () => {
    if (!checkInName) {
      alert('請選擇您的暱稱！');
      return;
    }
    if (checkInPwd.length !== 4) {
      alert('請輸入報名時設定的 4 位密碼！');
      return;
    }

    const targetItem = list.find(item => item.name === checkInName);
    if (!targetItem) {
      alert('找不到該報名資料！');
      return;
    }

    const { data, error } = await supabase
      .from('pickleball_registrations')
      .update({ arrived: true })
      .eq('id', targetItem.id)
      .eq('password', checkInPwd)
      .select();

    if (error) {
      alert('系統錯誤：' + error.message);
    } else if (data && data.length === 0) {
      alert('❌ 密碼輸入錯誤，請重新確認喔！');
    } else {
      alert(`🎉 報到成功！歡迎球友【${checkInName}】到場！`);
      setCheckInName('');
      setCheckInPwd('');
      refreshData();
    }
  };

  return (
    <main className="min-h-screen bg-[#f0f4f8] text-[#2d3748] p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-10 py-2 sm:py-6">
        
        {/* 1. 頂部大標題區塊 */}
        <div className="text-center bg-[#ffe8cc] p-6 sm:p-12 rounded-3xl shadow-md border border-[#ffd8a8]">
          <h1 className="text-3xl sm:text-6xl font-black text-[#ff6d00] tracking-wider leading-tight">
            七賢國小匹克球
          </h1>
          <p className="text-lg sm:text-2xl text-[#d94800] font-black tracking-widest border-t border-[#ffd8a8] pt-3 sm:pt-4 mt-4 sm:mt-6">
            📱 歡迎來到球場！請自主完成到場報到
          </p>
        </div>

        {/* 2. 日期選擇 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          {DAYS.map(d => (
            <button 
              key={d.id} 
              onClick={() => { setSelectedDay(d.id); setCheckInName(''); }} 
              className={`p-3 sm:p-5 rounded-2xl font-black transition-all duration-200 flex flex-col items-center justify-center gap-1 sm:gap-2 shadow-sm ${
                selectedDay === d.id 
                  ? 'bg-[#ff6d00] text-white shadow-xl scale-105 border-[#ff6d00]' 
                  : 'bg-white text-[#4a5568] hover:bg-slate-50 border-white'
              } border-2`}
            >
              <span className="text-lg sm:text-2xl">{d.label}</span>
              <span className={`text-xl sm:text-3xl font-black tracking-tighter ${selectedDay === d.id ? 'text-white' : 'text-[#ff6d00]'}`}>
                {d.dateStr}
              </span>
            </button>
          ))}
        </div>

        {/* 3. 組別選擇 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {TYPES.map(t => (
            <button 
              key={t.id} 
              onClick={() => { setSelectedType(t.id); setCheckInName(''); }} 
              className={`p-4 sm:p-5 rounded-2xl font-black transition-all duration-200 border-2 flex flex-col items-center justify-center gap-1 shadow-sm ${
                selectedType === t.id 
                  ? 'bg-[#ffe8cc] text-[#d94800] border-[#ff6d00] scale-102' 
                  : 'bg-white text-[#718096] border-transparent hover:text-[#ff6d00]'
              }`}
            >
              <span className="text-xl sm:text-3xl">{t.label}</span>
            </button>
          ))}
        </div>

        {/* 4. 看板 */}
        <div className="bg-white border border-[#ff6d00]/20 rounded-2xl p-4 sm:p-6 text-center shadow-sm">
          <div className="text-xl sm:text-2xl text-[#d94800] font-bold">
            📢 點選您的暱稱並輸入 4 位密碼即可完成現場報到登錄！
          </div>
        </div>

        {/* 5. 橘色報到表單 */}
        <div className="bg-[#ffe8cc] p-5 sm:p-8 rounded-3xl shadow-xl border border-[#ffd8a8]">
          <div className="space-y-4 sm:space-y-6">
            {/* ✨ 這裡使用了剛剛定義好的安全變數 activeDayConfig 與 activeTypeLabel */}
            <div className="text-xl sm:text-2xl text-center font-black text-[#d94800]">
              📍 現場報到專區 ({activeDayConfig?.label || ''} - {activeTypeLabel})
            </div>
            
            <select 
              className="w-full p-4 sm:p-6 bg-white rounded-2xl border-2 border-transparent focus:border-[#ff6d00] focus:outline-none text-xl sm:text-3xl text-[#1a1a1a]"
              value={checkInName}
              onChange={e => setCheckInName(e.target.value)}
            >
              <option value="">-- 請選擇您的暱稱 --</option>
              {list.map(item => (
                <option key={item.id} value={item.name} disabled={item.arrived}>
                  {item.name} ({item.count}位) {item.arrived ? ' [已完成報到]' : ''}
                </option>
              ))}
            </select>

            <input 
              className="w-full p-4 sm:p-6 bg-white rounded-2xl border-2 border-transparent focus:border-[#ff6d00] focus:outline-none text-xl sm:text-3xl text-[#1a1a1a]" 
              type="password" 
              placeholder="輸入您的 4 位報名密碼" 
              maxLength={4} 
              value={checkInPwd} 
              onChange={e => setCheckInPwd(e.target.value)} 
            />

            <button className="w-full bg-[#ff6d00] text-white p-4 sm:p-6 rounded-2xl text-xl sm:text-3xl font-black hover:bg-[#e65c00] transition-all mt-2 shadow-lg active:scale-95" onClick={handleCheckInSubmit}>
              確認到場報到
            </button>
          </div>
        </div>

        {/* 6. 名單顯示（僅顯示正取） */}
        <div className="space-y-4 sm:space-y-6">
          <h2 className="text-2xl sm:text-4xl font-black tracking-wide text-[#ff6d00] px-2">
            今日預計出席名單
          </h2>
          
          {mainList.length === 0 ? (
            <div className="text-center py-12 text-xl sm:text-2xl text-[#718096] border-2 border-dashed border-[#ff6d00]/20 rounded-2xl bg-white/40">目前暫無報名資料</div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {mainList.map((item) => (
                <div key={item.id} className={`p-4 sm:p-6 rounded-2xl flex justify-between items-center shadow-sm border transition-all ${
                  item.arrived 
                    ? 'bg-green-100 border-green-300 ring-2 ring-green-400/30' 
                    : 'bg-white border-slate-100'
                }`}>
                  <span className="text-xl sm:text-3xl font-bold tracking-wide text-[#2d3748]">
                    {item.arrived && <span className="text-green-600 mr-2 text-lg sm:text-2xl font-black">✓ [已報到]</span>}
                    {item.name} 
                    <span className={`${item.arrived ? 'text-green-700' : 'text-[#ff6d00]'} text-lg sm:text-2xl ml-2 sm:ml-3`}>({item.count}位)</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
