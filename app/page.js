'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc2lhZWVoemhzYXFqeHhpa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njc4NDksImV4cCI6MjA5NjA0Mzg0OX0.UYNrbcm5HaDucdcAj7XMwIBye6dsA6cRaG-bLY34XVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🆕 現在只剩星期六一個場次（早上 9:00-12:00），每週六晚上 22:00 開放下一個星期六的報名
function getTargetSaturdayDateStr() {
  const now = new Date();
  const currentDay = now.getDay(); // 0=週日 ... 6=週六
  const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
  const rolloverTimeInMinutes = 22 * 60; // 22:00

  const daysUntilSaturday = (6 - currentDay + 7) % 7;
  let isNextWeek = false;

  // 如果今天就是週六，而且已經過了晚上 22:00（本場次已結束、報名已開放下週），就往後推 7 天
  if (currentDay === 6 && currentTimeInMinutes >= rolloverTimeInMinutes) {
    isNextWeek = true;
  }

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysUntilSaturday + (isNextWeek ? 7 : 0));

  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

// 🆕 三個分區設定（人數上限改為可在管理員模式調整，這裡只留單筆報名限制與顯示用文字）
const TYPE_CONFIG = {
  experience: { label: '新手體驗', perSubmitMax: 1 },
  normal: { label: '新手區', perSubmitMax: 2 },
  openplay: { label: '一般散打(2.0以上)', perSubmitMax: 2 }
};
const TYPE_ORDER = ['experience', 'normal', 'openplay'];
const DEFAULT_CAPACITY = { experience: 9, normal: 8, openplay: 10 };

export default function Home() {
  const activeDate = getTargetSaturdayDateStr();

  const [selectedType, setSelectedType] = useState('normal');
  const [list, setList] = useState([]);
  const [isCheckInMode, setIsCheckInMode] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isSelfCheckIn, setIsSelfCheckIn] = useState(false);

  const [adminPin, setAdminPin] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const [form, setForm] = useState({ name: '', count: '1', password: '' });

  // 🆕 防灌爆機制：
  // 1. honeypot：一般人看不到、不會填的隱藏欄位，機器人腳本常會自動把所有欄位都填一遍，
  //    只要這欄有值就直接視為機器人，靜默擋下（不特別告知，避免對方調整腳本繼續嘗試）
  // 2. formLoadedAt：記錄表單載入的時間，如果從載入到送出小於 1.2 秒，
  //    代表極可能是自動化腳本瞬間送出，而非真人手動填寫
  const [honeypot, setHoneypot] = useState('');
  const [formLoadedAt] = useState(() => Date.now());
  const [checkInName, setCheckInName] = useState('');
  const [checkInPassword, setCheckInPassword] = useState('');
  const [userWarning, setUserWarning] = useState('');

  // 🆕 因雨取消狀態（以日期本身為 key，整天生效，不分區域）
  const [isCancelled, setIsCancelled] = useState(false);

  // 🆕 三個分區的人數上限（可在管理員模式調整，依日期各自獨立存放）
  const [capacitySettings, setCapacitySettings] = useState(DEFAULT_CAPACITY);
  const [capacityInputs, setCapacityInputs] = useState(DEFAULT_CAPACITY);

  // 🆕 管理員模式：報名審核清單
  const [pendingList, setPendingList] = useState([]);

  // 🆕 管理員模式：缺席/黑名單管理清單
  const [blacklistEntries, setBlacklistEntries] = useState([]);

  // 🆕 管理員模式：全區名單（同時顯示三個分區的名單，不用切換分頁）
  const [zoneLists, setZoneLists] = useState({ experience: [], normal: [], openplay: [] });
  // 🆕 全區名單管理的分頁篩選（ALL / experience / normal / openplay）
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('ALL');

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

  // 🆕 現在全部場次都在星期六早上，三個分區固定都開放（因雨取消時另外處理）
  const currentTypeConfig = TYPE_CONFIG[selectedType];
  const maxSeatsLimit = capacitySettings[selectedType];
  // 🆕 人數上限設為 0 時，代表幹部把這個分區關閉了，要真的擋下報名，而不是讓它排備取
  const isCurrentTypeClosed = maxSeatsLimit === 0;

  const currentSessionId = `${activeDate}_${selectedType}`;

  useEffect(() => {
    setForm(prev => ({ ...prev, count: '1' }));
  }, [selectedType]);

  useEffect(() => {
    setAdminPin('');
    setIsAdminAuthenticated(false);
    setCheckInName('');
    setCheckInPassword('');
  }, [isCheckInMode]);

  useEffect(() => {
    setCheckInName('');
    setCheckInPassword('');
  }, [selectedType, form.count]);

  // 當球友輸入暱稱時，即時查詢違規/停權紀錄
  useEffect(() => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setUserWarning('');
      return;
    }

    const checkUserViolation = async () => {
      const { data } = await supabase.from('pickleball_blacklists').select('*').eq('name', trimmedName).maybeSingle();
      if (!data) {
        setUserWarning('');
        return;
      }

      // 🆕 若目前處於停權狀態，用更強烈的警示提醒（實際會不會被擋在送出時才真正判斷）
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isCurrentlyBlocked = data.blocked_until && new Date(data.blocked_until) >= today;

      if (isCurrentlyBlocked) {
        setUserWarning(`🚫 提醒：暱稱【${trimmedName}】目前處於停權狀態（至 ${data.blocked_until} 止），將無法完成報名！`);
      } else if (data.no_show_count > 0) {
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
    load();
  }, [currentSessionId]);

  // 🆕 讀取本場次的因雨取消狀態
  useEffect(() => {
    fetchEventStatus();
    fetchCapacitySettings();
  }, [activeDate]);

  const load = async () => {
    const { data } = await supabase.from('pickleball_registrations').select('id, name, count, session_id, arrived, review_status').eq('session_id', currentSessionId).order('created_at', { ascending: true });
    if (data) setList(data);
  };

  const fetchEventStatus = async () => {
    const { data } = await supabase.from('event_status').select('is_cancelled').eq('date_key', activeDate).maybeSingle();
    setIsCancelled(data?.is_cancelled || false);
  };

  // 🆕 讀取本場次三個分區的人數上限設定，沒有設定過就用預設值
  const fetchCapacitySettings = async () => {
    const { data } = await supabase.from('event_settings').select('*').eq('date_key', activeDate).maybeSingle();
    const settings = {
      experience: data?.experience_max ?? DEFAULT_CAPACITY.experience,
      normal: data?.normal_max ?? DEFAULT_CAPACITY.normal,
      openplay: data?.openplay_max ?? DEFAULT_CAPACITY.openplay
    };
    setCapacitySettings(settings);
    setCapacityInputs(settings);
  };

  // 🆕 儲存人數上限設定（管理員用）
  const handleSaveCapacitySettings = async () => {
    const { error } = await supabase.from('event_settings').upsert({
      date_key: activeDate,
      experience_max: parseInt(capacityInputs.experience) || 0,
      normal_max: parseInt(capacityInputs.normal) || 0,
      openplay_max: parseInt(capacityInputs.openplay) || 0
    }, { onConflict: 'date_key' });

    if (error) {
      alert(`儲存失敗：${error.message}`);
      return;
    }

    alert(`🎉 已儲存【${activeDate}】場次的人數設定！`);
    setCapacitySettings({ ...capacityInputs });
  };

  // 🆕 依報名先後順序排隊佔位：pending（審核中）跟 approved（已審核）一起排，
  //    只是顯示標籤不同（審核中 vs 正取/備取），若審核中的人後續被拒絕會自動釋出名額
  let currentTotal = 0;
  let originalSeatsSum = 0;
  const mainList = [];
  const waitList = [];

  list.forEach((item) => {
    const seats = Number(item.count) || 0;

    if (currentTotal + seats <= maxSeatsLimit) {
      const isPromoted = originalSeatsSum >= maxSeatsLimit;
      mainList.push({ ...item, isPromoted });
      currentTotal += seats;
    } else {
      waitList.push(item);
    }

    originalSeatsSum += seats;
  });

  const hasPromotedSeats = mainList.some(item => item.isPromoted && item.review_status !== 'pending');
  const totalWaitCount = waitList.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

  const refreshData = async () => {
    await load();
  };

  const verifyAdminPin = () => {
    if (adminPin === '8888') {
      setIsAdminAuthenticated(true);
      fetchPendingList();
      fetchBlacklistEntries();
      fetchAllZoneLists(); // 🆕
    } else {
      alert('❌ 管理員暗號錯誤！');
      setAdminPin('');
    }
  };

  // 🆕 抓取所有待審核報名（不分場次分區，因為審核是全站通用的名字白名單）
  const fetchPendingList = async () => {
    const { data } = await supabase.from('pickleball_registrations').select('id, name, count, session_id, arrived, review_status, created_at').eq('review_status', 'pending').order('created_at', { ascending: true });
    setPendingList(data || []);
  };

  // 🆕 抓取黑名單/缺席清單（含未到場次數與停權狀態）
  const fetchBlacklistEntries = async () => {
    const { data } = await supabase.from('pickleball_blacklists').select('*').order('no_show_count', { ascending: false });
    setBlacklistEntries(data || []);
  };

  // 🆕 依報名先後順序計算正取/備取（跟畫面上主要清單同一套邏輯，供全區名單使用）
  const splitMainAndWaitList = (items, maxSeats) => {
    let total = 0;
    let seatsSum = 0;
    const main = [];
    const wait = [];
    items.forEach((item) => {
      const seats = Number(item.count) || 0;
      if (total + seats <= maxSeats) {
        main.push({ ...item, isPromoted: seatsSum >= maxSeats });
        total += seats;
      } else {
        wait.push(item);
      }
      seatsSum += seats;
    });
    return { main, wait };
  };

  // 🆕 抓取三個分區的完整名單（管理員模式一次查看，不用切換分頁）
  const fetchAllZoneLists = async () => {
    const sessionIds = TYPE_ORDER.map(typeId => `${activeDate}_${typeId}`);
    const { data } = await supabase
      .from('pickleball_registrations')
      .select('id, name, count, session_id, arrived, review_status')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true });

    const grouped = { experience: [], normal: [], openplay: [] };
    (data || []).forEach(item => {
      const typeId = item.session_id.replace(`${activeDate}_`, '');
      if (grouped[typeId]) grouped[typeId].push(item);
    });
    setZoneLists(grouped);
  };

  // 🆕 切換到場狀態（管理員用）
  const handleToggleArrived = async (item) => {
    const newStatus = !item.arrived;
    const { error } = await supabase.from('pickleball_registrations').update({ arrived: newStatus }).eq('id', item.id);
    if (error) {
      alert(`更新到場狀態失敗：${error.message}`);
      return;
    }
    fetchAllZoneLists();
  };

  // 🆕 幹部權限直接刪除報名（不需要球友的取消密碼）
  const handleAdminDelete = async (item) => {
    if (!confirm(`幹部權限：確定要刪除「${item.name}」的報名？`)) return;
    await supabase.from('pickleball_registrations').delete().eq('id', item.id);
    fetchAllZoneLists();
  };

  // 🆕 核准報名：改為 approved，並加入白名單，之後報名都不用再審
  const handleApprovePending = async (item) => {
    const { error: updateError } = await supabase.from('pickleball_registrations').update({ review_status: 'approved' }).eq('id', item.id);
    if (updateError) {
      alert(`核准失敗：${updateError.message}`);
      return;
    }

    const trimmedName = item.name.trim();
    await supabase.from('approved_names').upsert({ name: trimmedName }, { onConflict: 'name' });

    alert(`✅ 已核准「${trimmedName}」，之後報名將不需再審核！`);
    fetchPendingList();
    refreshData();
    fetchAllZoneLists(); // 🆕
  };

  // 🆕 拒絕報名：直接刪除該筆
  const handleRejectPending = async (item) => {
    if (!confirm(`確定要拒絕「${item.name}」這筆報名嗎？（將直接刪除此筆報名）`)) return;
    await supabase.from('pickleball_registrations').delete().eq('id', item.id);
    alert(`已拒絕並刪除「${item.name}」的報名`);
    fetchPendingList();
    refreshData();
    fetchAllZoneLists(); // 🆕
  };

  // 🆕 手動停權 30 天
  const handleManualBlock = async (name) => {
    if (!confirm(`確定要將「${name}」停權 30 天嗎？`)) return;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const blockedUntilStr = targetDate.toISOString().split('T')[0];

    await supabase.from('pickleball_blacklists').upsert({ name, blocked_until: blockedUntilStr }, { onConflict: 'name' });
    alert(`已將「${name}」停權至 ${blockedUntilStr}！`);
    fetchBlacklistEntries();
  };

  // 🆕 解除停權
  const handleUnblock = async (name) => {
    if (!confirm(`確定要解除「${name}」的停權嗎？`)) return;
    await supabase.from('pickleball_blacklists').update({ blocked_until: null }).eq('name', name);
    alert(`已解除「${name}」的停權！`);
    fetchBlacklistEntries();
  };

  // 🆕 一鍵重置所有人的未到場次數
  const handleResetAllNoShow = async () => {
    if (!confirm('確定要將「所有人」的未到場次數歸零嗎？此操作無法復原。')) return;
    await supabase.from('pickleball_blacklists').update({ no_show_count: 0 }).gte('no_show_count', 0);
    alert('✅ 已重置所有人的未到場次數！');
    fetchBlacklistEntries();
  };

  // 🆕 因雨取消切換
  const handleToggleRainCancellation = async () => {
    const nextStatus = !isCancelled;
    const actionText = nextStatus ? '【因雨取消】' : '【球敘正常】';
    if (!confirm(`確定要將 ${activeDate} 場次設定為 ${actionText} 嗎？`)) return;

    const { error } = await supabase.from('event_status').upsert({ date_key: activeDate, is_cancelled: nextStatus }, { onConflict: 'date_key' });
    if (error) {
      alert(`設定失敗：${error.message}`);
      return;
    }

    setIsCancelled(nextStatus);
    alert(`已將 ${activeDate} 變更為 ${actionText}！`);
  };

  // 報名提交
  const submit = async () => {
    // 🆕 防灌爆檢查 1：honeypot 欄位有值，直接視為機器人，靜默擋下（不顯示任何提示，避免對方察覺並調整腳本）
    if (honeypot.trim() !== '') {
      return;
    }

    // 🆕 防灌爆檢查 2：從表單載入到送出不到 1.2 秒，極可能是自動化腳本，用一般提示婉拒
    if (Date.now() - formLoadedAt < 1200) {
      alert('⚠️ 系統偵測到異常快速的送出行為，請稍後再試一次！');
      return;
    }

    if (isCancelled) {
      alert('⛈️ 本場次因雨取消，暫停報名！');
      return;
    }

    if (isCurrentTypeClosed) {
      alert(`⚠️ 本場次【${currentTypeConfig.label}】暫未開放報名！`);
      return;
    }

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeValue = currentHours * 100 + currentMinutes;
    const todayStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    // 🆕 早上場提前到 8:30 截止新增報名（原本是晚上場的 18:30）
    if (activeDate === todayStr && currentTimeValue >= 830) {
      alert('🚫 抱歉！今天的報名已於 8:30 截止囉！');
      return;
    }

    const numericCount = parseInt(form.count);

    // 🆕 三個分區各自的單筆報名人數上限
    if (numericCount < 1 || numericCount > currentTypeConfig.perSubmitMax) {
      alert(`🚫 ${currentTypeConfig.label} 單筆報名最多 ${currentTypeConfig.perSubmitMax} 位球友喔！`);
      return;
    }

    const trimmedName = form.name.trim();
    if (!trimmedName || form.password.length !== 4) { alert('請輸入暱稱與 4 位密碼'); return; }
    if (list.some(item => item.name.toLowerCase() === trimmedName.toLowerCase())) { alert(`❌ 暱稱「${trimmedName}」已被使用！`); return; }

    // 🆕 停權檢查：真正擋下報名，而不只是顯示警示文字
    const { data: blockRecord } = await supabase.from('pickleball_blacklists').select('blocked_until').eq('name', trimmedName).maybeSingle();
    if (blockRecord?.blocked_until) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(blockRecord.blocked_until) >= today) {
        alert(`🚫 您的帳號目前處於停權狀態（至 ${blockRecord.blocked_until} 止），無法報名！如有疑問請洽幹部。`);
        return;
      }
    }

    // 🆕 查詢是否已在審核通過白名單中，決定 review_status
    const { data: approvedRecord } = await supabase.from('approved_names').select('id').eq('name', trimmedName).maybeSingle();
    const reviewStatus = approvedRecord ? 'approved' : 'pending';

    const { error } = await supabase.from('pickleball_registrations').insert([{
      name: trimmedName,
      count: numericCount,
      password: form.password,
      session_id: currentSessionId,
      created_at: new Date().toISOString(),
      arrived: false,
      review_status: reviewStatus
    }]);

    if (error) {
      alert('報名失敗：' + error.message);
    } else {
      if (reviewStatus === 'pending') {
        alert('✅ 報名已送出！這是您第一次報名，需要管理員審核通過後才會確認正取/備取資格。審核通過後之後報名將不需再審核。');
      } else {
        alert('🎉 登記成功！');
      }
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
      // 🆕 早上場報到時間窗改為 8:30 ~ 12:00
      if (timeVal < 830 || timeVal > 1200) {
        alert('🚫 目前非報到時間！現場開放報到時間為 8:30 ~ 12:00。');
        return;
      }

      if (!checkInPassword || checkInPassword.length !== 4) {
        alert('請輸入報名時設定的 4 位數密碼！');
        return;
      }
    }

    const targetItem = list.find(item => item.name === checkInName);
    if (!targetItem) return;

    // 🆕 密碼驗證改用資料庫查詢條件比對（伺服器端比對，只回傳「有沒有找到符合的那一筆」，
    //    不會把密碼本身傳到瀏覽器），取代原本「把密碼抓到前端再比對」的不安全做法
    if (isSelfCheckIn) {
      const { data: matched, error: matchError } = await supabase
        .from('pickleball_registrations')
        .select('id')
        .eq('id', targetItem.id)
        .eq('password', checkInPassword)
        .maybeSingle();

      if (matchError) {
        alert('系統錯誤：' + matchError.message);
        return;
      }

      if (!matched) {
        alert('❌ 密碼錯誤！請輸入報名時設定的 4 位數密碼。');
        setCheckInPassword('');
        return;
      }
    }

    const { error } = await supabase.from('pickleball_registrations').update({ arrived: true }).eq('id', targetItem.id);
    if (error) alert('系統錯誤：' + error.message);
    else {
      alert(`🎉 密碼驗證成功！已幫【${checkInName}】完成現場報到！`);
      setCheckInName('');
      setCheckInPassword('');
      refreshData();
      fetchAllZoneLists(); // 🆕
    }
  };

  // 管理員一鍵結算當天未報到者
  const handleSettleNoShow = async () => {
    if (!confirm(`確定要結算【${activeDate}】場次的未報到名單嗎？未報到的正取球友將會被記錄缺席 1 次。`)) return;

    // 🆕 因雨取消的場次不應該結算未到場（不是球友的錯）
    if (isCancelled) {
      alert('⛈️ 本場次已因雨取消，不需要（也不應該）結算未到場紀錄。');
      return;
    }

    const noShowList = mainList.filter(item => !item.arrived && item.review_status !== 'pending');
    if (noShowList.length === 0) {
      alert('🎉 太棒了！今天所有正取球友皆已完成報到，無人缺席！');
      return;
    }

    for (const item of noShowList) {
      const { data: existing } = await supabase.from('pickleball_blacklists').select('*').eq('name', item.name).maybeSingle();
      const newCount = (existing?.no_show_count || 0) + 1;

      await supabase.from('pickleball_blacklists').upsert({
        name: item.name,
        no_show_count: newCount
      }, { onConflict: 'name' });
    }

    alert(`✅ 結算完成！已為 ${noShowList.length} 位未報到球友累記缺席次數。`);
    fetchBlacklistEntries();
  };

  const handleDelete = async (item) => {
    const pwd = prompt('請輸入 4 位取消密碼：');
    if (!pwd) return;

    // 🆕 加上 .select()，讓 Supabase 回傳「實際被刪除的那幾筆」；
    //    密碼錯誤時會刪除 0 筆（不是 error），必須額外檢查有沒有真的刪到才能判斷密碼對不對
    const { data, error } = await supabase
      .from('pickleball_registrations')
      .delete()
      .eq('id', item.id)
      .eq('password', pwd)
      .select();

    if (error) {
      alert('系統錯誤：' + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert('❌ 密碼錯誤，取消失敗！');
      return;
    }

    alert('取消成功！');
    refreshData();
    fetchAllZoneLists();
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
            七賢匹克新手交流<span onClick={handleSecretClick} className="cursor-pointer active:opacity-80">團</span>
          </h1>

          <div className={`border-t-2 border-dashed pt-4 mt-4 sm:mt-6 space-y-3 ${isSelfCheckIn ? 'border-[#63e6be]' : isCheckInMode ? 'border-[#ffd8a8]' : 'border-[#b6d7a8]'}`}>
            {isSelfCheckIn ? (
              <p className="text-[#0ca678] text-base sm:text-xl font-extrabold tracking-wide animate-pulse">
                📱 現場自助報到專區 (限 8:30 - 12:00)
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

                {/* 🆕 本場次日期 + 時間資訊 */}
                <p className="text-[#0070C0] text-base sm:text-2xl font-black tracking-wide pt-1">
                  📅 本場次：週六 {activeDate}（9:00 - 12:00）
                </p>

                {/* 🔴 網站更新提示 🔴 */}
                <p className="text-red-600 text-sm sm:text-lg font-black tracking-wider pt-1 flex items-center justify-center gap-1">
                  <span>⏰</span> 網站報名每週六晚上 10 點更新
                </p>
              </>
            )}
          </div>

          {/* 🆕 因雨取消狀態提示（非管理員模式時顯示） */}
          {!isCheckInMode && !isSelfCheckIn && isCancelled && (
            <div className="mt-4 bg-red-500/10 border-2 border-red-400 text-red-600 rounded-2xl px-4 py-3 font-black text-sm sm:text-lg">
              ⛈️ 本場次因雨取消，暫停報名！已報名球友不計缺席
            </div>
          )}
        </div>

        {/* 球友掃碼自助報到區 */}
        {isSelfCheckIn ? (
          <div className="bg-[#e6fcf5] border-2 border-[#63e6be] p-6 rounded-3xl shadow-lg text-center space-y-4">
            <div className="text-2xl font-black text-[#0ca678]">📍 請選擇暱稱並輸入報名密碼</div>
            <p className="text-sm text-slate-500 font-bold">⏰ 報到開放時間：8:30 ~ 12:00</p>

            <select className="w-full p-4 bg-white rounded-2xl text-xl font-bold border-2 border-[#63e6be] focus:outline-none" value={checkInName} onChange={e => setCheckInName(e.target.value)}>
              <option value="">-- 請選擇你的暱稱 --</option>
              {mainList.map(item => (
                <option key={item.id} value={item.name} disabled={item.arrived}>
                  {item.name} ({item.count}位) {item.isPromoted ? ' [🎉備取成功]' : ''} {item.arrived ? ' ✓ [已報到]' : ''}
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
            {/* 🆕 組別選擇：三個分區（新手體驗 / 新手區 / 一般散打） */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {TYPE_ORDER.map(typeId => {
                const cfg = TYPE_CONFIG[typeId];
                return (
                  <button key={typeId} onClick={() => setSelectedType(typeId)} className={`p-3 sm:p-5 rounded-2xl font-black transition-all duration-200 border-2 flex flex-col items-center justify-center gap-1 shadow-sm ${selectedType === typeId ? 'bg-[#D9EAD3] text-[#0070C0] border-[#0070C0]' : 'bg-white text-[#718096] border-transparent hover:text-[#0070C0]'}`}>
                    <span className="text-base sm:text-2xl text-center leading-tight">{cfg.label}</span>
                    {!isCheckInMode && (
                      <span className={`text-xs sm:text-lg font-bold text-center ${capacitySettings[typeId] === 0 ? 'text-red-500' : 'text-[#0070C0]'}`}>
                        {capacitySettings[typeId] === 0 ? '❌ 本區未開放' : `(開放報名(限${capacitySettings[typeId]}位))`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 看板 */}
            <div className="bg-white border border-[#0070C0]/20 rounded-2xl p-4 sm:p-6 text-center space-y-1 shadow-sm">
              <div className="text-2xl sm:text-4xl font-black text-[#0070C0] tracking-wide">⏰ 時間：9:00 - 12:00</div>
              <div className="text-sm sm:text-base text-red-500 font-bold">⚠️ 當天 8:30 後即截止報名</div>
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
                  <div className="space-y-5">
                    <div className="text-xl sm:text-2xl font-black text-[#d94800] text-center">📋 現場點名與管理主控台</div>

                    <button className="w-full bg-[#3b5998] text-white p-3 rounded-2xl font-bold text-lg shadow hover:bg-[#2d4373]" onClick={() => setShowQrModal(true)}>
                      📷 顯示現場報到用 QR Code
                    </button>

                    {/* 🆕 因雨取消切換按鈕 */}
                    <button
                      onClick={handleToggleRainCancellation}
                      className={`w-full p-3 rounded-2xl font-bold text-lg shadow ${isCancelled ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                      {isCancelled ? '⛈️ 因雨取消中（點擊恢復正常）' : '🟢 球敘正常（點擊設為因雨取消）'}
                    </button>

                    {/* 🆕 人數上限設定 */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="text-sm font-black text-slate-600">⚙️ 設定【{activeDate}】三個分區人數上限</div>
                      <div className="grid grid-cols-3 gap-2">
                        {TYPE_ORDER.map(typeId => (
                          <div key={typeId} className="flex flex-col items-center gap-1 bg-slate-50 p-2 rounded-xl">
                            <label className="text-xs font-bold text-slate-500">{TYPE_CONFIG[typeId].label}</label>
                            <input
                              type="number"
                              min={0}
                              value={capacityInputs[typeId]}
                              onChange={e => setCapacityInputs({ ...capacityInputs, [typeId]: e.target.value })}
                              className="w-full bg-white border p-2 rounded-lg font-black text-center text-lg"
                            />
                          </div>
                        ))}
                      </div>
                      <button onClick={handleSaveCapacitySettings} className="w-full bg-sky-600 hover:bg-sky-700 text-white font-black py-2.5 rounded-xl text-sm">
                        儲存人數設定
                      </button>
                    </div>

                    {/* 🆕 全區名單管理：跟主後台一樣的分頁籤 + 攤平列表風格 */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4">
                      {(() => {
                        const typeIcons = { experience: '🏸', normal: '🌱', openplay: '🔥' };

                        // 依三個分區各自的人數上限計算正取/備取，並攤平成單一陣列
                        const categoryConfirmedCounts = {};
                        let combinedList = [];
                        TYPE_ORDER.forEach(typeId => {
                          const maxSeats = capacitySettings[typeId];
                          const { main, wait } = splitMainAndWaitList(zoneLists[typeId] || [], maxSeats);
                          categoryConfirmedCounts[typeId] = main.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
                          main.forEach(item => combinedList.push({ ...item, typeId, isConfirmed: true }));
                          wait.forEach(item => combinedList.push({ ...item, typeId, isConfirmed: false }));
                        });
                        const grandConfirmedCount = TYPE_ORDER.reduce((sum, t) => sum + categoryConfirmedCounts[t], 0);

                        const filteredList = combinedList.filter(item =>
                          adminCategoryFilter === 'ALL' || item.typeId === adminCategoryFilter
                        );

                        return (
                          <>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                              <div className="text-lg font-black text-slate-800">全區名單管理（{activeDate}(週六)）</div>
                              <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
                                <button
                                  onClick={() => setAdminCategoryFilter('ALL')}
                                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${adminCategoryFilter === 'ALL' ? 'bg-[#1a4d4d] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                  全部 ({grandConfirmedCount})
                                </button>
                                {TYPE_ORDER.map(typeId => (
                                  <button
                                    key={typeId}
                                    onClick={() => setAdminCategoryFilter(typeId)}
                                    className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${adminCategoryFilter === typeId ? 'bg-[#1a4d4d] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
                                  >
                                    {typeIcons[typeId]} {TYPE_CONFIG[typeId].label} ({categoryConfirmedCounts[typeId]})
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              {filteredList.map(item => {
                                const isPending = item.review_status === 'pending';
                                return (
                                  <div key={item.id} className="flex flex-col sm:flex-row justify-between items-center p-3 rounded-2xl border border-slate-200 bg-slate-50 gap-2">
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${isPending ? 'bg-amber-200 text-amber-900' : item.isConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                        {isPending ? '⏳ 審核中' : item.isConfirmed ? '正取' : '備取'}
                                      </span>
                                      <span className="font-bold text-base text-slate-800">{item.name}</span>
                                      <span className="text-slate-600 font-bold text-sm">
                                        ({typeIcons[item.typeId]} {TYPE_CONFIG[item.typeId].label} - {item.count}位)
                                      </span>
                                    </div>

                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleToggleArrived(item)}
                                        className={`px-3 py-1.5 rounded-xl font-bold text-xs ${item.arrived ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                                      >
                                        {item.arrived ? '✅ 已到場 (點擊取消)' : '未到場 (點擊註記)'}
                                      </button>
                                      <button
                                        onClick={() => handleAdminDelete(item)}
                                        className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-3 py-1.5 rounded-xl font-bold text-xs"
                                      >
                                        刪除
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              {filteredList.length === 0 && (
                                <div className="text-center py-8 text-slate-400 font-bold text-sm">
                                  目前尚無報名紀錄
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <button className="w-full bg-red-600 text-white p-3 rounded-2xl font-bold text-lg shadow hover:bg-red-700" onClick={handleSettleNoShow}>
                      ⚠️ 結算今天未報到者（僅紀錄缺席）
                    </button>

                    <select className="w-full p-4 bg-white rounded-2xl text-xl mt-2" value={checkInName} onChange={e => setCheckInName(e.target.value)}>
                      <option value="">-- 請選擇到場球友的暱稱 --</option>
                      {list.map(item => (<option key={item.id} value={item.name} disabled={item.arrived}>{item.name} ({item.count}位) {item.arrived ? ' [已報到]' : ''}</option>))}
                    </select>
                    <button className="w-full bg-green-600 text-white p-4 rounded-2xl text-xl font-black hover:bg-green-700" onClick={handleCheckInSubmit}>確認到場（手動點名）</button>

                    {/* 🆕 報名審核區 */}
                    <div className="border-t-2 border-dashed border-[#ffd8a8] pt-4 space-y-3">
                      <div className="text-lg font-black text-[#d94800]">⏳ 報名審核（待審核 {pendingList.length} 筆）</div>
                      {pendingList.length === 0 ? (
                        <div className="text-center py-3 text-slate-400 font-bold text-sm">目前沒有待審核的新面孔報名</div>
                      ) : (
                        <div className="space-y-2">
                          {pendingList.map(item => (
                            <div key={item.id} className="bg-white p-3 rounded-2xl border border-amber-200 flex flex-col sm:flex-row justify-between items-center gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-amber-200 text-amber-900 text-xs font-black px-2 py-1 rounded-lg">首次報名</span>
                                <span className="font-black text-lg">{item.name}</span>
                                <span className="text-slate-500 text-sm font-bold">({item.count}位 - {item.session_id})</span>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleApprovePending(item)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3 py-1.5 rounded-lg">✅ 核准</button>
                                <button onClick={() => handleRejectPending(item)} className="bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-black px-3 py-1.5 rounded-lg">❌ 拒絕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 🆕 缺席 / 黑名單管理區 */}
                    <div className="border-t-2 border-dashed border-[#ffd8a8] pt-4 space-y-3">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="text-lg font-black text-[#d94800]">🚫 缺席 / 黑名單管理</div>
                        <button onClick={handleResetAllNoShow} className="text-xs font-black text-white bg-slate-600 hover:bg-slate-700 px-3 py-1.5 rounded-lg">
                          🔄 一鍵重置全部未到場次數
                        </button>
                      </div>
                      {blacklistEntries.length === 0 ? (
                        <div className="text-center py-3 text-slate-400 font-bold text-sm">目前沒有任何缺席紀錄</div>
                      ) : (
                        <div className="space-y-2">
                          {blacklistEntries.map(entry => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const isBlocked = entry.blocked_until && new Date(entry.blocked_until) >= today;
                            return (
                              <div key={entry.name} className={`p-3 rounded-2xl border flex flex-col sm:flex-row justify-between items-center gap-2 ${isBlocked ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-lg">{entry.name}</span>
                                  <span className="text-sm font-bold text-slate-500">{entry.no_show_count || 0} 次未到場</span>
                                  {isBlocked && <span className="text-xs font-black text-rose-600 bg-rose-100 px-2 py-1 rounded-lg">停權至 {entry.blocked_until}</span>}
                                </div>
                                <div className="flex gap-2">
                                  {isBlocked ? (
                                    <button onClick={() => handleUnblock(entry.name)} className="bg-white border text-slate-600 hover:text-emerald-700 text-xs font-black px-3 py-1.5 rounded-lg">🔓 解除停權</button>
                                  ) : (
                                    <button onClick={() => handleManualBlock(entry.name)} className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-3 py-1.5 rounded-lg">🚫 停權30天</button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : (
                isCancelled ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-2xl font-black text-red-600">⛈️ 本場次因雨取消</p>
                    <p className="text-sm font-bold text-slate-500">本場次已因雨取消，暫停報名，請留意後續開放通知</p>
                  </div>
                ) : isCurrentTypeClosed ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-2xl font-black text-red-600">🚫 本區未開放</p>
                    <p className="text-sm font-bold text-slate-500">幹部已將本場次【{currentTypeConfig.label}】人數設為 0 位，暫不開放報名。</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 🆕 honeypot 防灌爆欄位：一般使用者看不到、不會填，機器人腳本常會自動填滿所有欄位 */}
                    <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
                      <label htmlFor="website">網站</label>
                      <input
                        type="text"
                        id="website"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={e => setHoneypot(e.target.value)}
                      />
                    </div>
                    <div>
                      <input className="w-full p-4 bg-white rounded-2xl border-2 text-xl focus:outline-none focus:border-[#0070C0]" placeholder="輸入暱稱" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                      {userWarning && (
                        <div className="mt-2 text-sm font-bold text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-sm">
                          {userWarning}
                        </div>
                      )}
                    </div>
                    <select className="w-full p-4 bg-white rounded-2xl border-2 text-xl focus:outline-none focus:border-[#0070C0]" value={form.count} onChange={e => setForm({...form, count: e.target.value})}>
                      {Array.from({ length: currentTypeConfig.perSubmitMax }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n} 位</option>
                      ))}
                    </select>
                    <input className="w-full p-4 bg-white rounded-2xl border-2 text-xl focus:outline-none focus:border-[#0070C0]" type="password" placeholder="取消密碼 (4位數字)" maxLength={4} value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                    <button className="w-full bg-[#0070C0] text-white p-4 rounded-2xl text-xl font-black hover:bg-[#005a9c]" onClick={submit}>確認報名</button>
                  </div>
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
              <span><strong>備取成功通知：</strong>有球友取消報名，備取球友已自動遞補升至正取！請留意您的席位。</span>
            </div>
          )}

          {mainList.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-white rounded-2xl">暫無報名</div>
          ) : (
            <div className="space-y-3">
              {mainList.map((item) => {
                // 🆕 審核中的人顯示「⏳審核中」標籤，取代正取/備取/已到場顯示
                const isPending = item.review_status === 'pending';
                return (
                  <div key={item.id} className={`p-4 sm:p-6 rounded-2xl flex justify-between items-center shadow-sm border ${isPending ? 'bg-amber-50 border-amber-300 border-dashed' : item.arrived ? 'bg-green-100 border-green-300' : item.isPromoted ? 'bg-[#e6fcf5] border-[#63e6be]' : 'bg-white border-slate-100'}`}>
                    <span className="text-xl sm:text-3xl font-bold flex items-center flex-wrap gap-2">
                      {isPending ? (
                        <span className="bg-amber-400 text-slate-900 text-xs sm:text-sm px-2.5 py-1 rounded-full font-bold">⏳ 審核中</span>
                      ) : (
                        <>
                          {item.arrived && <span className="text-green-600">✓ [已報到]</span>}
                          {item.isPromoted && !item.arrived && <span className="bg-[#0ca678] text-white text-xs sm:text-sm px-2.5 py-1 rounded-full font-bold">🎉 備取成功</span>}
                        </>
                      )}
                      {item.name} <span className="text-sm font-normal text-slate-400">({item.count}位)</span>
                    </span>
                    <button className="text-red-500 text-sm font-bold bg-red-50 px-3 py-1.5 rounded-xl" onClick={() => handleDelete(item)}>取消</button>
                  </div>
                );
              })}
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
                  <span className="text-xl font-bold text-slate-600">
                    {item.review_status === 'pending' && <span className="bg-amber-400 text-slate-900 text-xs px-2 py-1 rounded-full font-bold mr-2">⏳審核中</span>}
                    <span className="text-[#ff6d00] mr-2">[備取 {index + 1}]</span>{item.name} ({item.count}位)
                  </span>
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
            <p className="text-slate-500 text-sm">開放時間：8:30 - 12:00</p>
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
