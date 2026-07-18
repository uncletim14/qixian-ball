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

function checkIsAfterSat2200() {
  const now = new Date();
  const currentDay = now.getDay(); 
  const currentHours = now.getHours();
  if (currentDay === 6 && currentHours >= 22) return true;
  if (currentDay === 0) return true;
  return false;
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
  
  // 管理員驗證
  const [adminPin, setAdminPin] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // ✨ 自訂控制面板 State (對應 Supabase 資料欄位)
  const [config, setConfig] = useState({
    mon_experience_open: false, mon_experience_limit: 9, mon_normal_open: true, mon_normal_limit: 8,
    fri_experience_open: false, fri_experience_limit: 9, fri_normal_open: true, fri_normal_limit: 8,
    sat_experience_open: false, sat_experience_limit: 9, sat_normal_open: true, sat_normal_limit: 8
  });

  const [isNewRuleActive, setIsNewRuleActive] = useState(false);
  const [form, setForm] = useState({ name: '', count: '1', password: '' });
  const [checkInName, setCheckInName] = useState('');

  // 讀取目前的自訂管理員設定
  const loadSettings = async () => {
    const { data } = await supabase.from('pickleball_settings').select('*').eq('id', 'next_week_config').single();
    if (data) setConfig(data);
  };

  useEffect(() => {
    setIsNewRuleActive(checkIsAfterSat2200());
    loadSettings();
  }, []);

  // 動態判定當下選取的區域是否開放、上限人數是多少
  let isAvailable = false;
  let maxSeatsLimit = 8;

  if (isNewRuleActive) {
    // 🔴 超過週六晚上10點：讀取動態設定
    if (selectedDay === 'mon') {
      if (selectedType === 'experience') { isAvailable = config.mon_experience_open; maxSeatsLimit = config.mon_experience_limit; }
      if (selectedType === 'normal') { isAvailable = config.mon_normal_open; maxSeatsLimit = config.mon_normal_limit; }
    } else if (selectedDay === 'fri') {
      if (selectedType === 'experience') { isAvailable = config.fri_experience_open; maxSeatsLimit = config.fri_experience_limit; }
      if (selectedType === 'normal') { isAvailable = config.fri_normal_open; maxSeatsLimit = config.fri_normal_limit; }
    } else if (selectedDay === 'sat') {
      if (selectedType === 'experience') { isAvailable = config.sat_experience_open; maxSeatsLimit = config.sat_experience_limit; }
      if (selectedType === 'normal') { isAvailable = config.sat_normal_open; maxSeatsLimit = config.sat_normal_limit; }
    }
  } else {
    // 🟢 舊規則硬編碼（保證週六晚上10點前，舊資料不受影響）
    if (selectedDay === 'mon' && selectedType === 'experience') { isAvailable = true; maxSeatsLimit = 9; }
    if (selectedDay === 'fri' && selectedType === 'normal') { isAvailable = true; maxSeatsLimit = 8; }
    if (selectedDay === 'sat') { isAvailable = true; maxSeatsLimit = selectedType === 'experience' ? 9 : 8; }
  }

  // 渲染組別標籤與狀態提示
  const getNote = (typeId) => {
    if (!isNewRuleActive) {
      if (selectedDay === 'mon' && typeId === 'experience') return '開放報名';
      if (selectedDay === 'fri' && typeId === 'normal') return '開放報名';
      if (selectedDay === 'sat') return '開放報名';
      return '本週無開放';
    }
    // 新規則動態文字
    if (selectedDay === 'mon') return typeId === 'experience' ? (config.mon_experience_open ? '開放報名' : '本週無開放') : (config.mon_normal_open ? '開放報名' : '本週無開放');
    if (selectedDay === 'fri') return typeId === 'experience' ? (config.fri_experience_open ? '開放報名' : '本週無開放') : (config.fri_normal_open ? '開放報名' : '本週無開放');
    if (selectedDay === 'sat') return typeId === 'experience' ? (config.sat_experience_open ? '開放報名' : '本週無開放') : (config.sat_normal_open ? '開放報名' : '本週無開放');
    return '本週無開放';
  };

  const TYPES = [
    { id: 'experience', label: '新手體驗', note: getNote('experience') },
    { id: 'normal', label: '新手區', note: getNote('normal') }
  ];

  const activeDayConfig = DAYS.find(d => d.id === selectedDay);
  const activeDate = activeDayConfig ? activeDayConfig.dateStr : '';
  const currentSessionId = `${activeDate}_${selectedType}`;

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

  // 讀取報名清單
  useEffect(() => { 
    if (!currentSessionId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('pickleball_registrations')
        .select('id, name, count, session_id, arrived')
        .eq('session_id', currentSessionId)
        .order('created_at', { ascending: true });
      if (data) setList(data);
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
    if (!currentSessionId) return;
    const { data } = await supabase
      .from('pickleball_registrations')
      .select('id, name, count, session_id, arrived')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: true });
    if (data) setList(data);
  };

  const verifyAdminPin = () => {
    if (adminPin === '8888') {
      setIsAdminAuthenticated(true);
    } else {
      alert('❌ 管理員暗號錯誤！');
      setAdminPin('');
    }
  };

  // ✨ 儲存自訂人數與開關面板到資料庫
  const saveAdminSettings = async () => {
    const { error } = await supabase
      .from('pickleball_settings')
      .update(config)
      .eq('id', 'next_week_config');

    if (error) {
      alert('儲存失敗：' + error.message);
    } else {
      alert('🎉 成功寫入下週排程設定！這套新設定會在星期六晚上 22:00 準時自動生效！');
    }
  };

  // 送出報名
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
      alert('🚫 抱歉！今天的報名已於 18:30 截止囉！');
      return;
    }

    const trimmedName = form.name.trim();
    if (!trimmedName || form.password.length !== 4) { 
      alert('請輸入暱稱與 4 位密碼'); 
      return; 
    }
    if (list.some(item => item.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert(`❌ 暱稱「${trimmedName}」已被使用！`);
      return;
    }

    const { error } = await supabase.from('pickleball_registrations').insert([{
      name: trimmedName, count: parseInt(form.count), password: form.password, session_id: currentSessionId, created_at: new Date().toISOString(), arrived: false
    }]);

    if (error) alert('報名失敗：' + error.message);
    else { alert('登記成功！'); setForm({ name: '', count: '1', password: '' }); refreshData(); }
  };

  // 點名
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
        
        {/* 切換按鈕 */}
        <div className="flex justify-end px-2">
          <button 
            onClick={() => setIsCheckInMode(!isCheckInMode)} 
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black shadow-md transition-all ${
              isCheckInMode ? 'bg-[#ff6d00] text-white' : 'bg-[#0070C0] text-white hover:bg-[#005a9c]'
            }`}
          >
            {isCheckInMode ? '🔄 切換回：網路報名模式' : '📌 進入：管理員點名與後台控制面板'}
          </button>
        </div>

        {/* 大標題 */}
        <div className={`text-center p-6 sm:p-12 rounded-3xl shadow-md border transition-all ${isCheckInMode ? 'bg-[#ffe8cc] border-[#ffd8a8]' : 'bg-[#D9EAD3] border-[#b6d7a8]'}`}>
          <h1 className={`text-3xl sm:text-6xl font-black tracking-wider leading-tight ${isCheckInMode ? 'text-[#d94800]' : 'text-[#0070C0]'}`}>
            七賢國小匹克球
          </h1>
          <p className={`text-lg sm:text-2xl font-black tracking-widest border-t pt-3 mt-4 sm:mt-6 ${isCheckInMode ? 'text-[#d94800] border-[#ffd8a8]' : 'text-[#0070C0] border-[#b6d7a8]'}`}>
            {isCheckInMode ? '📱 管理員後台主控台' : '免費體驗與新手區報名'}
          </p>
        </div>

        {/* 日期選擇 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          {DAYS.map(d => (
            <button 
              key={d.id} 
              onClick={() => setSelectedDay(d.id)} 
              className={`p-3 sm:p-5 rounded-2xl font-black transition-all duration-200 flex flex-col items-center justify-center gap-1 shadow-sm border-2 ${
                selectedDay === d.id ? (isCheckInMode ? 'bg-[#ff6d00] border-[#ff6d00] text-white' : 'bg-[#0070C0] border-[#0070C0] text-white scale-105') : 'bg-white text-[#4a5568] hover:bg-slate-50 border-white'
              }`}
            >
              <span className="text-lg sm:text-2xl">{d.label}</span>
              <span className={`text-xl sm:text-3xl font-black tracking-tighter ${selectedDay === d.id ? 'text-[#ffe082]' : 'text-[#ff6d00]'}`}>{d.dateStr}</span>
            </button>
          ))}
        </div>

        {/* 組別選擇 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {TYPES.map(t => (
            <button 
              key={t.id} 
              onClick={() => setSelectedType(t.id)} 
              className={`p-4 sm:p-5 rounded-2xl font-black transition-all duration-200 border-2 flex flex-col items-center justify-center gap-1 shadow-sm ${
                selectedType === t.id ? 'bg-[#D9EAD3] text-[#0070C0] border-[#0070C0]' : 'bg-white text-[#718096] border-transparent hover:text-[#0070C0]'
              }`}
            >
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

        {/* 核心輸入表單 / 管理員操作面板 */}
        <div className={`p-5 sm:p-8 rounded-3xl shadow-xl border transition-all ${isCheckInMode ? 'bg-[#ffe8cc] border-[#ffd8a8]' : 'bg-[#D9EAD3] border-[#b6d7a8]'}`}>
          {isCheckInMode ? (
            !isAdminAuthenticated ? (
              /* 未登入密碼鎖 */
              <div className="space-y-4 text-center">
                <div className="text-xl sm:text-2xl font-black text-[#d94800]">🔒 請輸入管理員專用暗號</div>
                <input className="w-full p-4 bg-white rounded-2xl border-2 text-center text-2xl tracking-widest" type="password" placeholder="請輸入 4 位暗號" value={adminPin} onChange={e => setAdminPin(e.target.value)} />
                <button className="w-full bg-[#ff6d00] text-white p-4 rounded-2xl text-xl font-black" onClick={verifyAdminPin}>解除鎖定</button>
              </div>
            ) : (
              /* 🔓 管理員解鎖後的複合操作介面 */
              <div className="space-y-8">
                {/* A組：一鍵點名區 */}
                <div className="space-y-3 pb-6 border-b-2 border-dashed border-[#ffd8a8]">
                  <div className="text-xl sm:text-2xl font-black text-[#d94800] text-center">📋 現場快速點名區</div>
                  <select className="w-full p-4 bg-white rounded-2xl text-xl" value={checkInName} onChange={e => setCheckInName(e.target.value)}>
                    <option value="">-- 請選擇到場球友的暱稱 --</option>
                    {list.map(item => (<option key={item.id} value={item.name} disabled={item.arrived}>{item.name} ({item.count}位) {item.arrived ? ' [已報到]' : ''}</option>))}
                  </select>
                  <button className="w-full bg-green-600 text-white p-4 rounded-2xl text-xl font-black hover:bg-green-700" onClick={handleCheckInSubmit}>確認到場（直接點名）</button>
                </div>

                {/* ✨ B組：下週排程與人數自訂面板 */}
                <div className="space-y-4">
                  <div className="text-xl sm:text-2xl font-black text-blue-800 text-center">⚙️ 下週場次人數與區域控制面板</div>
                  <p className="text-sm text-center text-slate-500 font-bold">於此調整下週人數，每週六22:00會自動依照此設定更新</p>
                  
                  <div className="space-y-3 bg-white/70 p-4 rounded-2xl space-y-4">
                    {/* 週一 */}
                    <div className="flex flex-col gap-2 border-b pb-3">
                      <span className="font-bold text-lg text-slate-700">📅 週一場：</span>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <label className="flex items-center gap-1"><input type="checkbox" checked={config.mon_experience_open} onChange={e => setConfig({...config, mon_experience_open: e.target.checked})} /> 新手體驗 (限額:<input type="number" className="w-12 border text-center rounded ml-1" value={config.mon_experience_limit} onChange={e => setConfig({...config, mon_experience_limit: parseInt(e.target.value)||0})} />人)</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={config.mon_normal_open} onChange={e => setConfig({...config, mon_normal_open: e.target.checked})} /> 新手區 (限額:<input type="number" className="w-12 border text-center rounded ml-1" value={config.mon_normal_limit} onChange={e => setConfig({...config, mon_normal_limit: parseInt(e.target.value)||0})} />人)</label>
                      </div>
                    </div>
                    {/* 週五 */}
                    <div className="flex flex-col gap-2 border-b pb-3">
                      <span className="font-bold text-lg text-slate-700">📅 週五場：</span>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <label className="flex items-center gap-1"><input type="checkbox" checked={config.fri_experience_open} onChange={e => setConfig({...config, fri_experience_open: e.target.checked})} /> 新手體驗 (限額:<input type="number" className="w-12 border text-center rounded ml-1" value={config.fri_experience_limit} onChange={e => setConfig({...config, fri_experience_limit: parseInt(e.target.value)||0})} />人)</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={config.fri_normal_open} onChange={e => setConfig({...config, fri_normal_open: e.target.checked})} /> 新手區 (限額:<input type="number" className="w-12 border text-center rounded ml-1" value={config.fri_normal_limit} onChange={e => setConfig({...config, fri_normal_limit: parseInt(e.target.value)||0})} />人)</label>
                      </div>
                    </div>
                    {/* 週六 */}
                    <div className="flex flex-col gap-2">
                      <span className="font-bold text-lg text-slate-700">📅 週六場：</span>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <label className="flex items-center gap-1"><input type="checkbox" checked={config.sat_experience_open} onChange={e => setConfig({...config, sat_experience_open: e.target.checked})} /> 新手體驗 (限額:<input type="number" className="w-12 border text-center rounded ml-1" value={config.sat_experience_limit} onChange={e => setConfig({...config, sat_experience_limit: parseInt(e.target.value)||0})} />人)</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={config.sat_normal_open} onChange={e => setConfig({...config, sat_normal_open: e.target.checked})} /> 新手區 (限額:<input type="number" className="w-12 border text-center rounded ml-1" value={config.sat_normal_limit} onChange={e => setConfig({...config, sat_normal_limit: parseInt(e.target.value)||0})} />人)</label>
                      </div>
                    </div>
                  </div>
                  <button className="w-full bg-blue-700 text-white p-4 rounded-2xl text-xl font-black hover:bg-blue-800" onClick={saveAdminSettings}>儲存下週設定</button>
                </div>
              </div>
            )
          ) : (
            /* 網路報名介面 */
            isAvailable ? (
              <div className="space-y-4">
                <input className="w-full p-4 bg-white rounded-2xl border-2 text-xl" placeholder="輸入暱稱" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                <select className="w-full p-4 bg-white rounded-2xl border-2 text-xl" value={form.count} onChange={e => setForm({...form, count: e.target.value})}>
                  <option value="1">1 位</option> <option value="2">2 位</option>
                  {selectedType === 'experience' && <><option value="3">3 位</option><option value="4">4 位</option></>}
                </select>
                <input className="w-full p-4 bg-white rounded-2xl border-2 text-xl" type="password" placeholder="取消密碼 (4位數字)" maxLength={4} value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                <button className="w-full bg-[#0070C0] text-white p-4 rounded-2xl text-xl font-black" onClick={submit}>確認報名</button>
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