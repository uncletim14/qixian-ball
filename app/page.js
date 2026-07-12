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

export default function Home() {
  const monDate = getTargetDateStr(1);
  const friDate = getTargetDateStr(5);
  const satDate = getTargetDateStr(6);

  const DAYS = [
    { id: 'mon', label: '週一場', dateStr: monDate, dayNum: 1 },
    { id: 'fri', label: '週五場', dateStr: friDate, dayNum: 5 },
    { id: 'sat', label: '週六場', dateStr: satDate, dayNum: 6 }
  ];

  const [selectedDay, setSelectedDay] = useState('fri'); 
  const [selectedType, setSelectedType] = useState('normal'); 
  const [list, setList] = useState([]);
  
  // 報名表單 State
  const [form, setForm] = useState({ name: '', count: '1', password: '' });
  
  // ✨ 新增：報到表單 State
  const [checkInName, setCheckInName] = useState('');
  const [checkInPwd, setCheckInPwd] = useState('');
  const [isCheckInMode, setIsCheckInMode] = useState(false);

  // ✨ 自動偵測網址是否帶有 ?mode=checkin，如果是，自動切換到現場報到模式
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'checkin') {
        setIsCheckInMode(true);
      }
    }
  }, []);

  const isAvailable = false;
  if (selectedDay === 'mon' && selectedType === 'experience') isAvailable = true;
  if (selectedDay === 'fri' && selectedType === 'normal') isAvailable = true;
  if (selectedDay === 'sat') isAvailable = true; 

  const TYPES = [
    { 
      id: 'experience', 
      label: '新手體驗', 
      note: (selectedDay === 'mon' || selectedDay === 'sat') ? '開放報名' : '本週無開放' 
    },
    { 
      id: 'normal', 
      label: '新手區', 
      note: (selectedDay === 'fri' || selectedDay === 'sat') ? '開放報名' : '本週無開放' 
    }
  ];

  const activeDate = DAYS.find(d => d.id === selectedDay)?.dateStr || '';
  const currentSessionId = `${activeDate}_${selectedType}`;

  const maxSeatsLimit = selectedType === 'experience' ? 9 : 8;

  useEffect(() => {
    const numericCount = parseInt(form.count);
    if (selectedType === 'normal' && numericCount > 2) {
      setForm(prev => ({ ...prev, count: '1' }));
    }
  }, [selectedType]);

  useEffect(() => {
    if (selectedDay === 'mon') {
      setSelectedType('experience');
    } else if (selectedDay === 'fri') {
      setSelectedType('normal');
    }
  }, [selectedDay]);

  useEffect(() => { 
    const load = async () => {
      const { data, error } = await supabase
        .from('pickleball_registrations')
        .select('id, name, count, session_id, arrived') // ✨ 讀取 arrived 狀態
        .eq('session_id', currentSessionId)
        .order('created_at', { ascending: true });
        
      if (error) console.error('讀取失敗:', error.message);
      else if (data) setList(data);
    };

    load(); 
  }, [currentSessionId]);

  let currentTotal = 0;
  const mainList = [];
  const waitList = [];

  list.forEach(item => {
    const seats = Number(item.count) || 0;
    if (currentTotal + seats <= maxSeatsLimit) {
      mainList.push(item);
      currentTotal += seats;
    } else {
      waitList.push(item);
    }
  });

  const totalWaitCount = waitList.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

  const refreshData = async () => {
    const { data, error } = await supabase
      .from('pickleball_registrations')
      .select('id, name, count, session_id, arrived')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: true });
      
    if (error) console.error('讀取失敗:', error.message);
    else if (data) setList(data);
  };

  const submit = async () => {
    if (!isAvailable) {
      alert('本分區本週無開放報名喔！');
      return;
    }

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeValue = currentHours * 100 + currentMinutes; 

    const todayMM = String(now.getMonth() + 1).padStart(2, '0');
    const todayDD = String(now.getDate()).padStart(2, '0');
    const todayStr = `${todayMM}/${todayDD}`;

    if (activeDate === todayStr && currentTimeValue >= 1830) {
      const selectedDayConfig = DAYS.find(d => d.id === selectedDay);
      alert(`🚫 抱歉！今天 ${selectedDayConfig?.label || ''} 的報名已於 18:30 截止囉！`);
      return;
    }

    const numericCount = parseInt(form.count);
    if (selectedType === 'experience' && (numericCount < 1 || numericCount > 4)) {
      alert('🚫 新手體驗單筆報名最多 4 位球友喔！');
      return;
    }
    if (selectedType === 'normal' && (numericCount < 1 || numericCount > 2)) {
      alert('🚫 新手區單筆報名最多 2 位球友喔！');
      return;
    }

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
      count: numericCount, 
      password: form.password, 
      session_id: currentSessionId, 
      created_at: new Date().toISOString(),
      arrived: false // 預設未報到
    }]);

    if (error) alert('報名失敗：' + error.message);
    else { 
      alert('登記成功！'); 
      setForm({ name: '', count: '1', password: '' }); 
      refreshData(); 
    }
  };

  // ✨ 新增：球友現場自主報到函式
  const handleCheckInSubmit = async () => {
    if (!checkInName) {
      alert('請選擇您的暱稱！');
      return;
    }
    if (checkInPwd.length !== 4) {
      alert('請輸入報名時設定的 4 位密碼！');
      return;
    }

    // 先驗證密碼是否正確
    const targetItem = list.find(item => item.name === checkInName);
    if (!targetItem) {
      alert('找不到該報名資料！');
      return;
    }

    // 直接在資料庫更新 arrived 欄位，同時比對密碼安全防護
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

  const handleDelete = async (item) => {
    const pwd = prompt('請輸入您的 4 位取消密碼：');
    if (!pwd) return;
    const { error } = await supabase.from('pickleball_registrations').delete().eq('id', item.id).eq('password', pwd);
    if (error) alert('系統錯誤：' + error.message);
    else { alert('取消成功！'); refreshData(); }
  };

  return (
    <main className="min-h-screen bg-[#f0f4f8] text-[#2d3748] p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-10 py-2 sm:py-6">
        
        {/* ✨ 頂部模式切換器（貼心提供手動切換按鈕，方便主辦人調試） */}
        <div className="flex justify-end px-2">
          <button 
            onClick={() => setIsCheckInMode(!isCheckInMode)} 
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all ${
              isCheckInMode ? 'bg-[#ff6d00] text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            {isCheckInMode ? '🔄 切換回：網路報名模式' : '📌 切換至：現場報到模式'}
          </button>
        </div>

        {/* 1. 頂部大標題區塊 */}
        <div className="text-center bg-[#D9EAD3] p-6 sm:p-12 rounded-3xl shadow-md border border-[#b6d7a8]">
          <h1 className="text-3xl sm:text-6xl font-black text-[#0070C0] tracking-wider leading-tight">
            七賢國小匹克球
          </h1>
          <h1 className="text-3xl sm:text-6xl font-black text-[#0070C0] tracking-wider mt-1 sm:mt-2">
            交流團
          </h1>
          <p className="text-lg sm:text-2xl text-[#0070C0] font-black tracking-widest border-t border-[#b6d7a8] pt-3 sm:pt-4 mt-4 sm:mt-6">
            {isCheckInMode ? '📱 歡迎來到球場！請自主完成到場報到' : '新手免費體驗與新手區報名'}
          </p>
        </div>

        {/* 2. 第一層：日期按鈕 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          {DAYS.map(d => (
            <button 
              key={d.id} 
              onClick={() => setSelectedDay(d.id)} 
              className={`p-3 sm:p-5 rounded-2xl font-black transition-all duration-200 flex flex-col items-center justify-center gap-1 sm:gap-2 shadow-sm relative ${
                selectedDay === d.id 
                  ? 'bg-[#0070C0] text-white shadow-xl scale-105 border-[#0070C0]' 
                  : 'bg-white text-[#4a5568] hover:bg-slate-50 border-white'
              } border-2`}
            >
              <span className="text-lg sm:text-2xl mt-2 sm:mt-0">{d.label}</span>
              <span className={`text-xl sm:text-3xl font-black tracking-tighter ${selectedDay === d.id ? 'text-[#ffe082]' : 'text-[#ff6d00]'}`}>
                {d.dateStr}
              </span>
            </button>
          ))}
        </div>

        {/* 3. 第二層：組別選擇 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {TYPES.map(t => (
            <button 
              key={t.id} 
              onClick={() => setSelectedType(t.id)} 
              className={`p-4 sm:p-5 rounded-2xl font-black transition-all duration-200 border-2 flex flex-col items-center justify-center gap-1 shadow-sm ${
                selectedType === t.id 
                  ? 'bg-[#D9EAD3] text-[#0070C0] border-[#0070C0] scale-102' 
                  : 'bg-white text-[#718096] border-transparent hover:text-[#0070C0]'
              }`}
            >
              <span className="text-xl sm:text-3xl">{t.label}</span>
              <span className={`text-base sm:text-xl ${t.note === '本週無開放' ? 'text-red-500 font-bold' : (selectedType === t.id ? 'text-[#0070C0] font-bold' : 'text-slate-400')}`}>
                ({t.note})
              </span>
            </button>
          ))}
        </div>

        {/* 4. 中間看板 */}
        <div className="bg-white border border-[#0070C0]/20 rounded-2xl p-4 sm:p-6 text-center space-y-1 sm:space-y-2 shadow-sm">
          <div className="text-2xl sm:text-4xl font-black text-[#0070C0] tracking-wide">
            ⏰ 活動時間：19:00 - 21:20
          </div>
          {isCheckInMode ? (
            <div className="text-base sm:text-xl text-[#ff6d00] font-bold">
              📢 點選您的暱稱並輸入 4 位密碼即可完成現場報到登錄！
            </div>
          ) : (
            <div className="text-base sm:text-xl text-[#ff6d00] font-bold">
              🔄 每星期六晚上 22:00 準時更新開放下週報名
            </div>
          )}
        </div>

        {/* 5. 報名表單 / 報到表單（動態切換顯示） */}
        <div className="bg-[#D9EAD3] p-5 sm:p-8 rounded-3xl shadow-xl border border-[#b6d7a8]">
          {isCheckInMode ? (
            /* ─── ✨ 現場報到表單介面 ─── */
            <div className="space-y-4 sm:space-y-6">
              <div className="text-xl sm:text-2xl text-center font-black text-[#ff6d00]">
                📍 現場報到專區 ({DAYS.find(d => d.id === selectedDay)?.label} - {TYPES.find(t => t.id === selectedType)?.label})
              </div>
              
              <select 
                className="w-full p-4 sm:p-6 bg-white rounded-2xl border-2 border-transparent focus:border-[#0070C0] focus:outline-none text-xl sm:text-3xl text-[#1a1a1a]"
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
                className="w-full p-4 sm:p-6 bg-white rounded-2xl border-2 border-transparent focus:border-[#0070C0] focus:outline-none text-xl sm:text-3xl text-[#1a1a1a]" 
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
          ) : (
            /* ─── 網路報名表單介面 ─── */
            isAvailable ? (
              <div className="space-y-4 sm:space-y-6">
                <div className="text-xl sm:text-2xl text-center">
                  <span className="text-[#0070C0] font-black underline underline-offset-8 decoration-2">
                    {DAYS.find(d => d.id === selectedDay)?.label} ({activeDate}) - {TYPES.find(t => t.id === selectedType)?.label} 
                  </span>
                </div>

                <input 
                  className="w-full p-4 sm:p-6 bg-white rounded-2xl border-2 border-transparent focus:border-[#0070C0] focus:outline-none text-xl sm:text-3xl text-[#1a1a1a]" 
                  placeholder="輸入暱稱" 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                />
                
                <select 
                  className="w-full p-4 sm:p-6 bg-white rounded-2xl border-2 border-transparent focus:border-[#0070C0] focus:outline-none text-xl sm:text-3xl text-[#1a1a1a]" 
                  value={form.count} 
                  onChange={e => setForm({...form, count: e.target.value})}
                >
                  <option value="1">1 位</option>
                  <option value="2">2 位</option>
                  {selectedType === 'experience' && (
                    <>
                      <option value="3">3 位</option>
                      <option value="4">4 位</option>
                    </>
                  )}
                </select>

                <input 
                  className="w-full p-4 sm:p-6 bg-white rounded-2xl border-2 border-transparent focus:border-[#0070C0] focus:outline-none text-xl sm:text-3xl text-[#1a1a1a]" 
                  type="password" 
                  placeholder="取消密碼 (4位數字)" 
                  maxLength={4} 
                  value={form.password} 
                  onChange={e => setForm({...form, password: e.target.value})} 
                />
                <button className="w-full bg-[#0070C0] text-white p-4 sm:p-6 rounded-2xl text-xl sm:text-3xl font-black hover:bg-[#005a9c] transition-all mt-2 shadow-lg active:scale-95" onClick={submit}>
                  確認報名 (滿額自動改備取)
                </button>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className="text-5xl">🚫</div>
                <div className="text-2xl sm:text-3xl font-black text-red-600">本週此分區無開放</div>
                <div className="text-lg sm:text-xl text-[#4a5443] font-bold">
                  請點選上方切換至 <span className="text-[#0070C0]">{selectedDay === 'mon' ? '新手體驗' : '新手區'}</span> 進行報名喔！
                </div>
              </div>
            )
          )}
        </div>

        {/* 6. 名單顯示 */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-2xl sm:text-4xl font-black tracking-wide text-[#0070C0]">
              正取人數：<span className="text-[#ff6d00]">{currentTotal}</span> / {maxSeatsLimit}
            </h2>
            {currentTotal >= maxSeatsLimit && <span className="text-base sm:text-xl bg-[#ffebee] text-[#c62828] font-black px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-[#ef9a9a]">正取已滿</span>}
          </div>
          
          {mainList.length === 0 ? (
            <div className="text-center py-12 text-xl sm:text-2xl text-[#718096] border-2 border-dashed border-[#0070C0]/20 rounded-2xl bg-white/40">目前暫無報名球友</div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {mainList.map((item) => (
                /* ✨ 智慧顯示：已到場球友會變成柔和的綠色背景，並附帶 [已到場] 標籤 */
                <div key={item.id} className={`p-4 sm:p-6 rounded-2xl flex justify-between items-center shadow-sm border transition-all ${
                  item.arrived 
                    ? 'bg-green-100 border-green-300 ring-2 ring-green-400/30' 
                    : 'bg-white border-slate-100'
                }`}>
                  <span className="text-xl sm:text-3xl font-bold tracking-wide text-[#2d3748]">
                    {item.arrived && <span className="text-green-600 mr-2 text-lg sm:text-2xl font-black">✓ [已報到]</span>}
                    {item.name} 
                    <span className={`${item.arrived ? 'text-green-700' : 'text-[#0070C0]'} text-lg sm:text-2xl ml-2 sm:ml-3`}>({item.count}位)</span>
                  </span>
                  <button className="text-[#c62828] hover:text-[#b71c1c] text-base sm:text-xl font-black bg-red-50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-colors" onClick={() => handleDelete(item)}>取消</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. 備取名單 */}
        {waitList.length > 0 && (
          <div className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 border-t-2 border-dashed border-[#0070C0]/20">
            <h2 className="text-2xl sm:text-4xl font-black text-[#ff6d00] px-2">遞補備取：{totalWaitCount} 位</h2>
            <div className="space-y-3 sm:space-y-4">
              {waitList.map((item, index) => (
                <div key={item.id} className="bg-[#D9EAD3] p-4 sm:p-6 rounded-2xl flex justify-between items-center border border-[#b6d7a8] shadow-sm">
                  <span className="text-xl sm:text-3xl font-bold text-[#2d3748]"><span className="text-[#ff6d00] mr-1 sm:mr-2">[備取 {index + 1}]</span>{item.name} <span className="text-[#ff6d00]/80 text-lg sm:text-2xl ml-2 sm:ml-3">({item.count}位)</span></span>
                  <button className="text-[#c62828] hover:text-[#b71c1c] text-base sm:text-xl font-black px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-colors" onClick={() => handleDelete(item)}>取消</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}