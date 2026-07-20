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
  const [showQrModal, setShowQrModal] = useState(false);
  const [isSelfCheckIn, setIsSelfCheckIn] = useState(false);
  
  const [adminPin, setAdminPin] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const [form, setForm] = useState({ name: '', count: '1', password: '' });
  const [checkInName, setCheckInName] = useState('');
  const [checkInPassword, setCheckInPassword] = useState(''); 
  const [userWarning, setUserWarning] = useState(''); 

  // 檢查是否為掃碼進來的模式 (?mode=checkin)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'checkin') {
        setIsSelfCheckIn(true);
      }
    }
  }, []);

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

  const isAvailable = selectedType === 'normal';
  const maxSeatsLimit = 8;

  const TYPES = [
    { id: 'experience', label: '新手體驗', note: '本週無開放' },
    { id: 'normal', label: '新手區', note: '開放報名' }
  ];

  const activeDayConfig = DAYS.find(d => d.id === selectedDay);
  const activeDate = activeDayConfig ? activeDayConfig.dateStr : '';
  const currentSessionId = `${activeDate}_${selectedType}`;

  useEffect(() => {
    setSelectedType('normal');
  }, [selectedDay]);

  useEffect(() => {
    setAdminPin('');
    setIsAdminAuthenticated(false);
    setCheckInName('');
    setCheckInPassword('');
  }, [isCheckInMode]);

  useEffect(() => {
    const numericCount = parseInt(form.count);
    if (selectedType === 'normal' && numericCount > 2) {
      setForm(prev => ({ ...prev, count: '1' }));
    }
    setCheckInName('');
    setCheckInPassword('');
  }, [selectedType, form.count]);

  // 當球友輸入暱稱時，即時查詢違規紀錄
  useEffect(() => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setUserWarning('');
      return;
    }

    const checkUserViolation = async () => {
      const { data } = await supabase.from('pickleball_blacklists').select('*').eq('name', trimmedName).single();
      if (data && data.no_show_count > 0) {
        setUserWarning(`⚠️ 提醒：暱稱【${trimmedName}】目前已有 ${data.no_show_count} 次未報到紀錄，請報名後務必準時出席喔！`);
      } else {
        setUserWarning('');
      }
    };

    const timer = setTimeout(checkUserViolation, 500);
    return () => clearTimeout(timer);
  }, [form.name]);

  // 讀取報名資料
  useEffect(() => { 
    if (!currentSessionId) return;
    const load = async () => {
      const { data } = await supabase.from('pickleball_registrations').select('id, name, count, password, session_id, arrived').eq('session_id', currentSessionId).order('created_at', { ascending: true });
      if (data) setList(data);
    };
    load(); 
  }, [currentSessionId]);

  // 核心計算：區分正取與遞補
  let currentTotal = 0;
  const mainList = [];
  const waitList = [];

  list.forEach((item, index) => {
    const seats = Number(item.count) || 0;
    if (currentTotal + seats <= maxSeatsLimit) { 
      const isPromoted = index > 0 && (currentTotal > 0 || index >= maxSeatsLimit);
      mainList.push({ ...item, isPromoted }); 
      currentTotal += seats; 
    } else { 
      waitList.push(item); 
    }
  });

  const hasPromotedSeats = mainList.some(item => item.isPromoted);
  const totalWaitCount = waitList.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

  const refreshData = async () => {
    if (!currentSessionId) return;
    const { data } = await supabase.from('pickleball_registrations').select('id, name, count, password, session_id, arrived').eq('session_id', currentSessionId).order('created_at', { ascending: true });
    if (data) setList(data);
  };

  const verifyAdminPin = () => {
    if (adminPin === '8888') { setIsAdminAuthenticated(true); } 
    else { alert('❌ 管理員暗號錯誤！'); setAdminPin(''); }
  };

  // 報名提交
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
    else { 
      alert('登記成功！'); 
      setForm({ name: '', count: '1', password: '' }); 
      setUserWarning('');
      refreshData(); 
    }
  };

  // 報到提交
  const handleCheckInSubmit = async () => {
    if (!checkInName) { alert('請選擇你的暱稱！'); return; }

    if (isSelfCheckIn) {
      const now = new Date();
      const timeVal = now.getHours() * 100 + now.getMinutes();
      if (timeVal < 1830 || timeVal > 2100) {
        alert('🚫 目前非報到時間！現場開放報到時間為 18:30 ~ 21:00。');
        return;
      }

      if (!checkInPassword || checkInPassword.length !== 4) {
        alert('請輸入報名時設定的 4 位數密碼！');
        return;
      }
    }

    const targetItem = list.find(item => item.name === checkInName);
    if (!targetItem) return;

    if (isSelfCheckIn && targetItem.password !== checkInPassword) {
      alert('❌ 密碼錯誤！請輸入報名時設定的 4 位數密碼。');
      setCheckInPassword('');
      return;
    }

    const { error } = await supabase.from('pickleball_registrations').update({ arrived: true }).eq('id', targetItem.id);
    if (error) alert('系統錯誤：' + error.message);
    else { 
      alert(`🎉 密碼驗證成功！已幫【${checkInName}】完成現場報到！`); 
      setCheckInName(''); 
      setCheckInPassword('');
      refreshData(); 
    }
  };

  // 管理員一鍵結算當天未報到者
  const handleSettleNoShow = async () => {
    if (!confirm(`確定要結算【${activeDate}】場次的未報到名單嗎？未報到的正取球友將會被記錄缺席 1 次。`)) return;

    const noShowList = mainList.filter(item => !item.arrived);
    if (noShowList.length === 0) {
      alert('🎉 太棒了！今天所有正取球友皆已完成報到，無人缺席！');
      return;
    }

    for (const item of noShowList) {
      const { data: existing } = await supabase.from('pickleball_blacklists').select('*').eq('name', item.name).single();
      let newCount = (existing?.no_show_count || 0) + 1;

      await supabase.from('pickleball_blacklists').upsert({
        name: item.name,
        no_show_count: newCount
      }, { onConflict: 'name' });
    }

    alert(`✅ 結算完成！已為 ${noShowList.length} 位未報到球友累記缺席次數。`);
  };

  const handleDelete = async (item) => {
    const pwd = prompt('請輸入 4 位取消密碼：');
    if (!pwd) return;
    const { error } = await supabase.from('pickleball_registrations').delete().eq('id', item.id).eq('password', pwd);
    if (error) alert('系統錯誤：' + error.message);
    else { alert('取消成功！'); refreshData(); }
  };

  const currentUrl = typeof window !== 'undefined' ? `${window.location.origin}?mode=checkin` : '';
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentUrl)}`;

  return (
    <main className="min-h-screen bg-[#f0f4f8] text-[#2d3748] p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-10 py-2 sm:py-6">
        
        <div className="h-4"></div>

        {/* 🌟 大標題與活潑視覺排版 🌟 */}
        <div className={`text-center p-6 sm:p-10 rounded-3xl shadow-lg border-2 transition-all ${isSelfCheckIn ? 'bg-[#e6fcf5] border-[#63e6be]' : isCheckInMode ? 'bg-[#ffe8cc] border-[#ffd8a8]' : 'bg-[#D9EAD3] border-[#b6d7a8]'}`}>
          
          <h1 className={`text-3xl sm:text-5xl font-black tracking-wider leading-tight select-none drop-shadow-sm ${isSelfCheckIn ? 'text-[#0ca678]' : isCheckInMode ? 'text-[#d94800]' : 'text-[#0070C0]'}`}>
            七賢國小新手交流<span onClick={handleSecretClick} className="cursor-pointer active:opacity-80">團</span>
          </h1>

          <div className={`border-t-2 border-dashed pt-4 mt-4 sm:mt-6 space-y-3 ${isSelfCheckIn ? 'border-[#63e6be]' : isCheckInMode ? 'border-[#ffd8a8]' : 'border-[#b6d7a8]'}`}>
            {isSelfCheckIn ? (
              <p className="text-[#0ca678] text-base sm:text-xl font-extrabold tracking-wide animate-pulse">
                📱 現場自助報到專區 (限 18:30 - 21:00)
              </p>
            ) : isCheckInMode ? (
              <p className="text-[#d94800] text-base sm:text-xl font-extrabold tracking-wide">
                📱 管理員現場點名主控台
              </p>
            ) : (
              <>
                {/* 活潑標籤區塊 */}
                <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3 text-xs sm:text-base font-extrabold">
                  <span className="bg-white/80 text-[#0070C0] px-3 py-1.5 rounded-full shadow-sm border border-[#0070C0]/20 flex items-center gap-1">
                    🎽 新手單次 $100
                  </span>
                  <span className="bg-white/80 text-[#0070C0] px-3 py-1.5 rounded-full shadow-sm border border-[#0070C0]/20 flex items-center gap-1">
                    🏓 租借球拍 $50
                  </span>
                  <span className="bg-emerald-500 text-white px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1">
                    🎁 新手體驗免費
                  </span>
                </div>

                {/* 🔴 網站更新提示（已修正文字）🔴 */}
                <p className="text-red-600 text-sm sm:text-lg font-black tracking-wider pt-1 flex items-center justify-center gap-1">
                  <span>⏰</span> 網站報名每週六晚上 10 點更新
                </p>
              </>
            )}
          </div>
        </div>

        {/* 日期選擇 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          {DAYS.map(d => (
            <button key={d.id} onClick={() => setSelectedDay(d.id)} className={`p-3 sm:p-5 rounded-2xl font-black transition-all duration-200 flex flex-col items-center justify-center gap-1 shadow-sm border-2 ${selectedDay === d.id ? (isSelfCheckIn ? 'bg-[#0ca678] border-[#0ca678] text-white' : isCheckInMode ? 'bg-[#ff6d00] border-[#ff6d00] text-white' : 'bg-[#0070C0] border-[#0070C0] text-white scale-105') : 'bg-white text-[#4a5568] hover:bg-slate-50 border-white'}`}>
              <span className="text-lg sm:text-2xl">{d.label}</span>
              <span className={`text-xl sm:text-3xl font-black tracking-tighter ${selectedDay === d.id ? 'text-[#ffe082]' : 'text-[#ff6d00]'}`}>{d.dateStr}</span>
            </button>
          ))}
        </div>

        {/* 球友掃碼自助報到區 */}
        {isSelfCheckIn ? (
          <div className="bg-[#e6fcf5] border-2 border-[#63e6be] p-6 rounded-3xl shadow-lg text-center space-y-4">
            <div className="text-2xl font-black text-[#0ca678]">📍 請選擇暱稱並輸入報名密碼</div>
            <p className="text-sm text-slate-500 font-bold">⏰ 報到開放時間：18:30 ~ 21:00</p>
            
            <select className="w-full p-4 bg-white rounded-2xl text-xl font-bold border-2 border-[#63e6be] focus:outline-none" value={checkInName} onChange={e => setCheckInName(e.target.value)}>
              <option value="">-- 請選擇你的暱稱 --</option>
              {mainList.map(item => (
                <option key={item.id} value={item.name} disabled={item.arrived}>
                  {item.name} ({item.count}位) {item.isPromoted ? ' [🎉遞補正取]' : ''} {item.arrived ? ' ✓ [已報到]' : ''}
                </option>
              ))}
            </select>

            <input 
              type="password" 
              maxLength={4} 
              placeholder="請輸入報名時設定的 4 位數密碼" 
              className="w-full p-4 bg-white rounded-2xl text-xl text-center border-2 border-[#63e6be] focus:outline-none tracking-widest"
              value={checkInPassword}
              onChange={e => setCheckInPassword(e.target.value)}
            />

            <button className="w-full bg-[#0ca678] text-white p-4 rounded-2xl text-xl font-black hover:bg-[#099268] shadow-md" onClick={handleCheckInSubmit}>
              驗證密碼並確認報到
            </button>
          </div>
        ) : (
          <>
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
                    <div className="text-xl sm:text-2xl font-black text-[#d94800] text-center">📋 現場點名與管理主控台</div>
                    
                    <button className="w-full bg-[#3b5998] text-white p-3 rounded-2xl font-bold text-lg shadow hover:bg-[#2d4373]" onClick={() => setShowQrModal(true)}>
                      📷 顯示現場報到用 QR Code
                    </button>

                    <button className="w-full bg-red-600 text-white p-3 rounded-2xl font-bold text-lg shadow hover:bg-red-700" onClick={handleSettleNoShow}>
                      ⚠️ 結算今天未報到者（僅紀錄缺席）
                    </button>

                    <select className="w-full p-4 bg-white rounded-2xl text-xl mt-2" value={checkInName} onChange={e => setCheckInName(e.target.value)}>
                      <option value="">-- 請選擇到場球友的暱稱 --</option>
                      {list.map(item => (<option key={item.id} value={item.name} disabled={item.arrived}>{item.name} ({item.count}位) {item.arrived ? ' [已報到]' : ''}</option>))}
                    </select>
                    <button className="w-full bg-green-600 text-white p-4 rounded-2xl text-xl font-black hover:bg-green-700" onClick={handleCheckInSubmit}>確認到場（手動點名）</button>
                  </div>
                )
              ) : (
                isAvailable ? (
                  <div className="space-y-4">
                    <div>
                      <input className="w-full p-4 bg-white rounded-2xl border-2 text-xl focus:outline-none focus:border-[#0070C0]" placeholder="輸入暱稱" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                      {userWarning && (
                        <div className="mt-2 text-sm font-bold text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-sm">
                          {userWarning}
                        </div>
                      )}
                    </div>
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
          </>
        )}

        {/* 正取名單區塊 */}
        <div className="space-y-4">
          <h2 className="text-2xl sm:text-4xl font-black text-[#0070C0] px-2">正取名單 ({currentTotal} / {maxSeatsLimit})</h2>
          
          {hasPromotedSeats && (
            <div className="bg-[#e6fcf5] border-2 border-[#63e6be] p-4 rounded-2xl text-[#0ca678] font-bold text-sm sm:text-base flex items-center gap-2 shadow-sm animate-pulse">
              <span>🎉</span>
              <span><strong>遞補成功通知：</strong>有球友取消報名，備取球友已自動遞補升至正取！請留意您的席位。</span>
            </div>
          )}

          {mainList.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-white rounded-2xl">暫無報名</div>
          ) : (
            <div className="space-y-3">
              {mainList.map((item) => (
                <div key={item.id} className={`p-4 sm:p-6 rounded-2xl flex justify-between items-center shadow-sm border ${item.arrived ? 'bg-green-100 border-green-300' : item.isPromoted ? 'bg-[#e6fcf5] border-[#63e6be]' : 'bg-white border-slate-100'}`}>
                  <span className="text-xl sm:text-3xl font-bold flex items-center flex-wrap gap-2">
                    {item.arrived && <span className="text-green-600">✓ [已報到]</span>}
                    {item.isPromoted && !item.arrived && <span className="bg-[#0ca678] text-white text-xs sm:text-sm px-2.5 py-1 rounded-full font-bold">🎉 遞補成功</span>}
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

      {/* 彈出視窗：顯示報到 QR Code (管理員用) */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 sm:p-8 rounded-3xl max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-2xl font-black text-[#0070C0]">請球友掃描 QR Code 報到</h3>
            <p className="text-slate-500 text-sm">開放時間：18:30 - 21:00</p>
            <div className="flex justify-center p-2 bg-slate-50 rounded-2xl border">
              <img src={qrCodeImageUrl} alt="報到 QR Code" className="w-60 h-60" />
            </div>
            <button className="w-full bg-slate-800 text-white py-3 rounded-2xl font-bold hover:bg-slate-900" onClick={() => setShowQrModal(false)}>
              關閉視窗
            </button>
          </div>
        </div>
      )}
    </main>
  );
}