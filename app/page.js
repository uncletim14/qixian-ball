'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc2lhZWVoemhzYXFqeHhpa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njc4NDksImV4cCI6MjA5NjA0Mzg0OX0.UYNrbcm5HaDucdcAj7XMwIBye6dsA6cRaG-bLY34XVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🆕 現在只剩星期六一個場次（早上 9:00-12:00），每週六晚上 22:00 開放下一個星期六的報名
// 🆕 日期格式改為 YYYY/MM/DD（含年份），避免跨年後日期混淆或排序錯亂
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

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

// 🆕 會員限定報名：計算「這個星期六場次」對應的解鎖時間點＝該週三晚上 22:00。
//    每週都用同一條規則自動算出來，幹部不用每週手動改時間，密碼也固定不變。
function getWednesdayCutoffForSaturday(satDateStr) {
  const [y, m, d] = satDateStr.split('/').map(Number);
  const cutoff = new Date(y, m - 1, d);
  cutoff.setDate(cutoff.getDate() - 3); // 星期六往前推 3 天 = 星期三
  cutoff.setHours(22, 0, 0, 0);
  return cutoff;
}

// 🆕 產生「過去 pastCount 週 + 未來 futureCount 週」的星期六日期清單，
//    供管理員面板的「選擇單日場次」統一日期選單使用：可以回頭看過去的場次做簽到修正，
//    也能預先設定未來週次，跟即時決定報名開放日(activeDate)的邏輯分開
function getSaturdayDateRange(pastCount, futureCount) {
  const now = new Date();
  const currentDay = now.getDay();
  const daysUntilSaturday = (6 - currentDay + 7) % 7; // 今天就是週六則為0，否則算到本週六還有幾天
  const anchorSaturday = new Date(now);
  anchorSaturday.setDate(now.getDate() + daysUntilSaturday);

  const result = [];
  for (let i = -pastCount; i <= futureCount; i++) {
    const d = new Date(anchorSaturday);
    d.setDate(anchorSaturday.getDate() + i * 7);
    const yyyy2 = d.getFullYear();
    const mm2 = String(d.getMonth() + 1).padStart(2, '0');
    const dd2 = String(d.getDate()).padStart(2, '0');
    result.push(`${yyyy2}/${mm2}/${dd2}`);
  }
  return result;
}

// 🆕 六個分區設定（新增「新手體驗(晚上)」，人數上限可在管理員模式調整，這裡只留單筆報名限制與顯示用文字）
const TYPE_CONFIG = {
  experience: { label: '新手體驗', perSubmitMax: 4 },
  normal: { label: '新手區', perSubmitMax: 4 },
  openplay: { label: '一般散打(2.0以上)', perSubmitMax: 4 },
  experience_pm: { label: '新手體驗(晚上)', perSubmitMax: 4 },
  normal_pm: { label: '新手區(晚上)', perSubmitMax: 4 },
  openplay_pm: { label: '散打(晚上)', perSubmitMax: 4 }
};
const TYPE_ORDER = ['experience', 'normal', 'openplay', 'experience_pm', 'normal_pm', 'openplay_pm'];
// 🆕 各分區每人收費金額（新手體驗免費，其餘皆 $100/人），供自動帶入報名費收入使用
const CATEGORY_PRICE = { experience: 0, normal: 100, openplay: 100, experience_pm: 0, normal_pm: 100, openplay_pm: 100 };
// 🆕 早上/晚上時段各自包含的分區（給報名選單用；後台管理相關功能仍用 TYPE_ORDER 涵蓋全部6個分區）
const SESSION_TYPES = {
  AM: ['experience', 'normal', 'openplay'],
  PM: ['experience_pm', 'normal_pm', 'openplay_pm']
};
const DEFAULT_CAPACITY = { experience: 9, normal: 8, openplay: 10, experience_pm: 9, normal_pm: 9, openplay_pm: 9 };

// 🆕 依分區區分的時段設定：早上三區 9:00-12:00（8:30截止/9:00鎖定），
//    晚上三區 19:00-21:20（18:30截止/19:00鎖定，跟散打區網站一致）
const SESSION_TIMING = {
  experience: { cutoff: 830, lock: 900, boardTime: '9:00 - 12:00', checkinStart: 830, checkinEnd: 1200 },
  normal: { cutoff: 830, lock: 900, boardTime: '9:00 - 12:00', checkinStart: 830, checkinEnd: 1200 },
  openplay: { cutoff: 830, lock: 900, boardTime: '9:00 - 12:00', checkinStart: 830, checkinEnd: 1200 },
  experience_pm: { cutoff: 1830, lock: 1900, boardTime: '19:00 - 21:20', checkinStart: 1830, checkinEnd: 2100 },
  normal_pm: { cutoff: 1830, lock: 1900, boardTime: '19:00 - 21:20', checkinStart: 1830, checkinEnd: 2100 },
  openplay_pm: { cutoff: 1830, lock: 1900, boardTime: '19:00 - 21:20', checkinStart: 1830, checkinEnd: 2100 }
};

// 🆕 把 830 這種數字格式轉成 "8:30" 方便顯示
function formatTimeVal(v) {
  const h = Math.floor(v / 100);
  const m = v % 100;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export default function Home() {
  const activeDate = getTargetSaturdayDateStr();

  const [selectedType, setSelectedType] = useState('normal');
  // 🆕 早上/晚上時段選擇：先選時段，才會顯示該時段的三個分區
  const [selectedSession, setSelectedSession] = useState('AM');
  const [list, setList] = useState([]);
  const [isCheckInMode, setIsCheckInMode] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isSelfCheckIn, setIsSelfCheckIn] = useState(false);

  // 🆕 管理員登入改用真正的 Supabase Auth 帳號密碼（伺服器驗證），
  //    不再是寫死在前端程式碼裡、任何人都能在瀏覽器原始碼找到的暗號
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminAuthChecked, setAdminAuthChecked] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const [form, setForm] = useState({ name: '', count: '1', password: '' });

  // 🆕 LINE 登入狀態：null = 尚未確認，{loggedIn:false} = 確認未登入，{loggedIn:true,...} = 已登入
  const [lineSession, setLineSession] = useState(null);

  useEffect(() => {
    fetch('/api/me')
      .then(res => res.json())
      .then(data => setLineSession(data))
      .catch(() => setLineSession({ loggedIn: false }));
  }, []);

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

  // 🆕 會員限定報名模式：固定規則「每週三晚上 22:00 前」需要會員密碼，22:00 之後自動開放給所有人。
  //    不用每週手動設定開放時間；earlyOpenForDate 只用於「這一週想提前解鎖」的例外情況。
  const [membersPassword, setMembersPassword] = useState(''); // 使用者在表單輸入的密碼
  const [earlyOpenForDate, setEarlyOpenForDate] = useState(null); // 若等於 activeDate，代表幹部手動提前解鎖了本週
  const isMembersOnlyActive = earlyOpenForDate === activeDate ? false : new Date() < getWednesdayCutoffForSaturday(activeDate);

  // 🆕 管理員面板用：(可選)更新密碼
  const [membersOnlyPasswordInput, setMembersOnlyPasswordInput] = useState('');

  // 🆕 因雨取消狀態（以日期本身為 key，整天生效，不分區域）
  const [isCancelled, setIsCancelled] = useState(false);

  // 🆕 六個分區的人數上限（即時生效，跟著 activeDate 走，用於實際報名判斷）
  const [capacitySettings, setCapacitySettings] = useState(DEFAULT_CAPACITY);

  // 🆕 「人數上限設定」面板專用：可瀏覽/編輯未來一個月內任一個星期六，
  //    跟上面「即時生效」的 capacitySettings 分開，避免瀏覽其他週時誤動到目前開放中的場次
  const [settingsDateKey, setSettingsDateKey] = useState(activeDate);
  const [capacityInputs, setCapacityInputs] = useState(DEFAULT_CAPACITY);
  const upcomingSaturdaysForSettings = getSaturdayDateRange(2, 5);

  // 🆕 現場收支記帳（跟人數設定共用 settingsDateKey 這個日期選單）
  const [financialRecords, setFinancialRecords] = useState([]);
  const [finType, setFinType] = useState('income');
  const [finCategory, setFinCategory] = useState('租拍');
  const [finAmount, setFinAmount] = useState('');
  const [finNote, setFinNote] = useState('');

  // 🆕 即時計算的報名費收入（不寫進 financial_records，每次都重新算，永遠準確不會重複計算）
  const [feeSummary, setFeeSummary] = useState({ expected: 0, actual: 0 });

  // 🆕 月份報表篩選：改用「年+月」組合（YYYY/MM）篩選，避免跨年後同月份資料被混在一起
  const currentYearMonthStr = `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedExportMonth, setSelectedExportMonth] = useState(currentYearMonthStr);
  const [availableExportMonths, setAvailableExportMonths] = useState([currentYearMonthStr]);

  // 🆕 管理員模式：報名審核清單
  const [pendingList, setPendingList] = useState([]);

  // 🆕 管理員模式：缺席/黑名單管理清單
  const [blacklistEntries, setBlacklistEntries] = useState([]);

  // 🆕 管理員模式：全區名單（同時顯示三個分區的名單，不用切換分頁）
  const [zoneLists, setZoneLists] = useState({ experience: [], normal: [], openplay: [], experience_pm: [], normal_pm: [], openplay_pm: [] });
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

  // 🆕 掛載時抓取「本週是否被幹部手動提前解鎖」的狀態，注意：絕對不 select 密碼欄位，避免密碼被傳到每個訪客的瀏覽器
  useEffect(() => {
    fetchMembersOnlySettings();
  }, []);

  const fetchMembersOnlySettings = async () => {
    const { data } = await supabase.from('site_settings').select('early_open_for_date').eq('id', 1).maybeSingle();
    setEarlyOpenForDate(data?.early_open_for_date || null);
  };

  // 🆕 管理員儲存會員限定密碼（開放時間已改成固定規則「每週三 22:00」自動生效，不需要每週手動設定）
  const handleSaveMembersOnlySettings = async () => {
    if (membersOnlyPasswordInput.trim() === '') {
      alert('請先輸入要設定的新密碼再儲存！');
      return;
    }
    const { error } = await supabase
      .from('site_settings')
      .upsert({ id: 1, members_only_password: membersOnlyPasswordInput.trim() }, { onConflict: 'id' });
    if (error) {
      alert(`儲存失敗：${error.message}`);
      return;
    }

    alert('🎉 已更新會員密碼！（此密碼固定使用，每週三晚上 22:00 自動開放，不用再重新設定）');
    setMembersOnlyPasswordInput('');
  };

  // 🆕 本週提前解鎖：只解鎖「目前這一場（activeDate）」，下週會自動恢復「週三 22:00 才開放」的正常規則，不用手動改回來
  const handleOpenNow = async () => {
    if (!confirm(`確定要提前解除本週（${activeDate}）的會員限定、馬上開放給所有人報名嗎？\n\n下週會自動恢復正常規則（週三 22:00 開放），不需要再手動設回去。`)) return;
    const { error } = await supabase
      .from('site_settings')
      .upsert({ id: 1, early_open_for_date: activeDate }, { onConflict: 'id' });
    if (error) {
      alert(`操作失敗：${error.message}`);
      return;
    }
    alert('🎉 已提前開放本週給所有人！');
    fetchMembersOnlySettings();
  };

  // 🆕 自助報到模式需要涵蓋全部分區（含晚上散打），所以要抓取全區名單（一律用「目前真正開放中」的 activeDate，不受管理員瀏覽日期影響）
  useEffect(() => {
    if (isSelfCheckIn) {
      fetchAllZoneLists(activeDate);
    }
  }, [isSelfCheckIn, activeDate]);

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

  // 🆕 切換早上/晚上時段時，自動切換到該時段的預設分區（新手區）
  useEffect(() => {
    setSelectedType(selectedSession === 'AM' ? 'normal' : 'normal_pm');
  }, [selectedSession]);

  useEffect(() => {
    setCheckInName('');
    setCheckInPassword('');
  }, [isCheckInMode]);

  useEffect(() => {
    setCheckInName('');
    setCheckInPassword('');
  }, [selectedType, form.count]);

  // 🆕 LINE 登入成功後，即時查詢違規/停權紀錄（改用 line_user_id 比對，取代原本輸入暱稱查詢）
  useEffect(() => {
    if (!lineSession?.loggedIn) {
      setUserWarning('');
      return;
    }
    const myLineUserId = lineSession.lineUserId;
    const trimmedName = lineSession.displayName;

    const checkUserViolation = async () => {
      const { data } = await supabase.from('pickleball_blacklists').select('*').eq('line_user_id', myLineUserId).maybeSingle();
      if (!data) {
        setUserWarning('');
        return;
      }

      // 🆕 若目前處於停權狀態，用更強烈的警示提醒（實際會不會被擋在送出時才真正判斷）
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isCurrentlyBlocked = data.blocked_until && new Date(data.blocked_until) >= today;

      if (isCurrentlyBlocked) {
        setUserWarning(`🚫 提醒：【${trimmedName}】目前處於停權狀態（至 ${data.blocked_until} 止），將無法完成報名！`);
      } else if (data.no_show_count > 0) {
        setUserWarning(`⚠️ 提醒：【${trimmedName}】目前已有 ${data.no_show_count} 次未報到紀錄，請報名後務必準時出席喔！`);
      } else {
        setUserWarning('');
      }
    };

    checkUserViolation();
  }, [lineSession]);

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
    const { data } = await supabase.from('pickleball_registrations').select('id, name, count, session_id, arrived, review_status, line_user_id').eq('session_id', currentSessionId).order('created_at', { ascending: true });
    if (data) setList(data);
  };

  const fetchEventStatus = async () => {
    const { data } = await supabase.from('event_status').select('is_cancelled').eq('date_key', activeDate).maybeSingle();
    setIsCancelled(data?.is_cancelled || false);
  };

  // 🆕 讀取「目前開放報名的這個星期六」六個分區的人數上限，即時生效用，沒有設定過就用預設值
  const fetchCapacitySettings = async () => {
    const settings = await fetchCapacityForDate(activeDate);
    setCapacitySettings(settings);
  };

  // 🆕 讀取「設定面板」目前選擇瀏覽的那個星期六的人數上限，純供編輯顯示用，不影響即時生效的 capacitySettings
  const fetchSettingsPanelCapacity = async (dateKey) => {
    const settings = await fetchCapacityForDate(dateKey);
    setCapacityInputs(settings);
  };

  // 🆕 共用的查詢邏輯
  const fetchCapacityForDate = async (dateKey) => {
    const { data } = await supabase.from('event_settings').select('*').eq('date_key', dateKey).maybeSingle();
    return {
      experience: data?.experience_max ?? DEFAULT_CAPACITY.experience,
      normal: data?.normal_max ?? DEFAULT_CAPACITY.normal,
      openplay: data?.openplay_max ?? DEFAULT_CAPACITY.openplay,
      experience_pm: data?.experience_pm_max ?? DEFAULT_CAPACITY.experience_pm,
      normal_pm: data?.normal_pm_max ?? DEFAULT_CAPACITY.normal_pm,
      openplay_pm: data?.openplay_pm_max ?? DEFAULT_CAPACITY.openplay_pm
    };
  };

  // 🆕 儲存人數上限設定（管理員用）：儲存到「設定面板目前選擇瀏覽」的那個星期六，
  //    如果剛好就是目前正在開放報名的那一週，同步更新即時生效的 capacitySettings
  const handleSaveCapacitySettings = async () => {
    const { error } = await supabase.from('event_settings').upsert({
      date_key: settingsDateKey,
      experience_max: parseInt(capacityInputs.experience) || 0,
      normal_max: parseInt(capacityInputs.normal) || 0,
      openplay_max: parseInt(capacityInputs.openplay) || 0,
      experience_pm_max: parseInt(capacityInputs.experience_pm) || 0,
      normal_pm_max: parseInt(capacityInputs.normal_pm) || 0,
      openplay_pm_max: parseInt(capacityInputs.openplay_pm) || 0
    }, { onConflict: 'date_key' });

    if (error) {
      alert(`儲存失敗：${error.message}`);
      return;
    }

    alert(`🎉 已儲存【${settingsDateKey}】場次的人數設定！`);
    // 🆕 只有編輯的正是「目前開放報名中」的那個星期六，才同步更新即時生效的 capacitySettings；
    //    編輯未來週次的設定，先存進資料庫，等到那一週真正變成 activeDate 時會自動讀取生效
    if (settingsDateKey === activeDate) {
      setCapacitySettings({ ...capacityInputs });
    }
  };

  // 🆕 抓取「設定面板目前選擇的日期」當天的記帳明細
  const fetchFinancialRecords = async (dateKey) => {
    const { data } = await supabase
      .from('financial_records')
      .select('*')
      .eq('date_key', dateKey)
      .order('created_at', { ascending: true });
    setFinancialRecords(data || []);
  };

  // 🆕 新增一筆記帳
  const handleAddFinancialRecord = async () => {
    const amountNum = parseInt(finAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('請輸入有效的金額！');
      return;
    }

    const { error } = await supabase.from('financial_records').insert([{
      date_key: settingsDateKey,
      type: finType,
      category: finCategory,
      amount: amountNum,
      note: finNote.trim()
    }]);

    if (error) {
      alert(`新增失敗：${error.message}`);
      return;
    }

    setFinAmount('');
    setFinNote('');
    fetchFinancialRecords(settingsDateKey);
  };

  // 🆕 刪除一筆記帳
  const handleDeleteFinancialRecord = async (id) => {
    if (!confirm('確定要刪除此筆記帳紀錄？')) return;
    await supabase.from('financial_records').delete().eq('id', id);
    fetchFinancialRecords(settingsDateKey);
  };

  // 🆕 即時計算「預計報名費收入」與「總實收(已簽到)」，不寫進資料庫，每次都重新算，
  //    因此永遠準確反映當下最新的報名/簽到狀況，不用手動觸發、也不會重複計算
  const computeRegistrationFeeSummary = async (dateKey) => {
    const capacity = await fetchCapacityForDate(dateKey);

    const sessionIds = TYPE_ORDER.map(typeId => `${dateKey}_${typeId}`);
    const { data } = await supabase
      .from('pickleball_registrations')
      .select('id, name, count, session_id, arrived, review_status, line_user_id')
      .in('session_id', sessionIds);

    const grouped = { experience: [], normal: [], openplay: [], experience_pm: [], normal_pm: [], openplay_pm: [] };
    (data || []).forEach(item => {
      const typeId = item.session_id.replace(`${dateKey}_`, '');
      if (grouped[typeId]) grouped[typeId].push(item);
    });

    let expected = 0;
    let actual = 0;
    TYPE_ORDER.forEach(typeId => {
      const maxSeats = capacity[typeId];
      const { main } = splitMainAndWaitList(grouped[typeId], maxSeats);
      const confirmedNonPending = main.filter(item => item.review_status !== 'pending');
      const expectedCount = confirmedNonPending.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
      const actualCount = confirmedNonPending.filter(item => item.arrived).reduce((sum, item) => sum + (Number(item.count) || 0), 0);
      expected += expectedCount * CATEGORY_PRICE[typeId];
      actual += actualCount * CATEGORY_PRICE[typeId];
    });

    setFeeSummary({ expected, actual });
  };

  // 🆕 匯出全部記帳紀錄成 CSV（可用 Excel 開啟）
  // 🆕 抓取所有出現過的「年/月」組合（供月份報表下拉選單使用），date_key 格式為 YYYY/MM/DD
  const fetchAvailableExportMonths = async () => {
    const { data: extraRecords } = await supabase.from('financial_records').select('date_key');
    const { data: allRegs } = await supabase.from('pickleball_registrations').select('session_id');
    const regDates = (allRegs || []).map(r => r.session_id.split('_')[0]);
    const finDates = (extraRecords || []).map(r => r.date_key);
    const yearMonths = Array.from(new Set([...regDates, ...finDates].map(d => d.split('/').slice(0, 2).join('/')))).sort();

    if (!yearMonths.includes(currentYearMonthStr)) yearMonths.push(currentYearMonthStr);
    yearMonths.sort();

    setAvailableExportMonths(yearMonths);
  };

  const handleExportFinancialCSV = async () => {
    const { data: extraRecordsAll } = await supabase.from('financial_records').select('*').order('date_key', { ascending: true });

    // 🆕 找出有記帳紀錄、或有報名紀錄的所有日期，只保留選定「年/月」，逐一計算當天的報名費收入
    const { data: allRegs } = await supabase.from('pickleball_registrations').select('session_id');
    const regDateSet = new Set((allRegs || []).map(r => r.session_id.split('_')[0]));
    const finDateSet = new Set((extraRecordsAll || []).map(r => r.date_key));
    const allDates = Array.from(new Set([...regDateSet, ...finDateSet]))
      .filter(d => d.split('/').slice(0, 2).join('/') === selectedExportMonth)
      .sort();

    const extraRecords = (extraRecordsAll || []).filter(r => r.date_key.split('/').slice(0, 2).join('/') === selectedExportMonth);

    if (allDates.length === 0) {
      alert(`【${selectedExportMonth}】目前尚無任何報名或記帳紀錄！`);
      return;
    }

    let csvContent = '\uFEFF'; // BOM，讓 Excel 正確顯示中文
    csvContent += `七賢匹克球團 星期六場次【${selectedExportMonth}】收支記帳報表\n\n`;
    csvContent += '日期,預計報名費收入,實收報名費(已到場),現場其他收入,現場支出,當日純益\n';

    let grandExpected = 0;
    let grandActual = 0;
    let grandExtraIncome = 0;
    let grandExpense = 0;

    for (const dateKey of allDates) {
      const capacity = await fetchCapacityForDate(dateKey);
      const sessionIds = TYPE_ORDER.map(typeId => `${dateKey}_${typeId}`);
      const { data: dayRegs } = await supabase
        .from('pickleball_registrations')
        .select('id, name, count, session_id, arrived, review_status, line_user_id')
        .in('session_id', sessionIds);

      const grouped = { experience: [], normal: [], openplay: [], experience_pm: [], normal_pm: [], openplay_pm: [] };
      (dayRegs || []).forEach(item => {
        const typeId = item.session_id.replace(`${dateKey}_`, '');
        if (grouped[typeId]) grouped[typeId].push(item);
      });

      let expected = 0;
      let actual = 0;
      TYPE_ORDER.forEach(typeId => {
        const maxSeats = capacity[typeId];
        const { main } = splitMainAndWaitList(grouped[typeId], maxSeats);
        const confirmedNonPending = main.filter(item => item.review_status !== 'pending');
        expected += confirmedNonPending.reduce((sum, item) => sum + (Number(item.count) || 0), 0) * CATEGORY_PRICE[typeId];
        actual += confirmedNonPending.filter(item => item.arrived).reduce((sum, item) => sum + (Number(item.count) || 0), 0) * CATEGORY_PRICE[typeId];
      });

      const dayExtra = (extraRecords || []).filter(r => r.date_key === dateKey);
      const dayExtraIncome = dayExtra.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
      const dayExpense = dayExtra.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
      const dayProfit = actual + dayExtraIncome - dayExpense;

      grandExpected += expected;
      grandActual += actual;
      grandExtraIncome += dayExtraIncome;
      grandExpense += dayExpense;

      csvContent += `${dateKey},$${expected},$${actual},$${dayExtraIncome},$${dayExpense},$${dayProfit}\n`;
    }

    csvContent += `\n${selectedExportMonth}加總,,,,,\n`;
    csvContent += `總預計報名費: $${grandExpected},總實收報名費: $${grandActual},總其他收入: $${grandExtraIncome},總支出: $${grandExpense},總純益: $${grandActual + grandExtraIncome - grandExpense}\n\n`;

    csvContent += '【現場其他收支明細】\n';
    csvContent += '日期,類型,類別,金額,備註\n';
    (extraRecords || []).forEach(r => {
      csvContent += `${r.date_key},${r.type === 'income' ? '收入' : '支出'},${r.category},$${r.amount},${r.note || ''}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `七賢匹克球_星期六場_${selectedExportMonth.replace('/', '-')}_記帳報表.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 🆕 依報名先後順序排隊佔位：pending（審核中）跟 approved（已審核）一起排，
  //    只是顯示標籤不同（審核中 vs 正取/備取），若審核中的人後續被拒絕會自動釋出名額
  // 🆕 修正插隊漏洞：一旦有人因為人數不足被擋到備取，後面所有人（即使人數少、剛好塞得進去）
  //    也一律算備取，不能插隊超過排在前面但人數較多的人，維持嚴格先來後到
  let currentTotal = 0;
  let originalSeatsSum = 0;
  let hasHitCapacity = false;
  const mainList = [];
  const waitList = [];

  list.forEach((item) => {
    const seats = Number(item.count) || 0;

    if (!hasHitCapacity && currentTotal + seats <= maxSeatsLimit) {
      const isPromoted = originalSeatsSum >= maxSeatsLimit;
      mainList.push({ ...item, isPromoted });
      currentTotal += seats;
    } else {
      hasHitCapacity = true;
      waitList.push(item);
    }

    originalSeatsSum += seats;
  });

  const hasPromotedSeats = mainList.some(item => item.isPromoted && item.review_status !== 'pending');
  const totalWaitCount = waitList.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

  const refreshData = async () => {
    await load();
  };

  // 🆕 登入成功後要載入的後台資料，整理成一個函式，登入當下跟「重新整理頁面後自動恢復登入」都會用到
  const loadAdminData = () => {
    fetchPendingList();
    fetchBlacklistEntries();
    setSettingsDateKey(activeDate);
    fetchAllZoneLists(activeDate);
    fetchSettingsPanelCapacity(activeDate);
    fetchFinancialRecords(activeDate);
    computeRegistrationFeeSummary(activeDate);
    fetchAvailableExportMonths();
  };

  // 🆕 掛載時檢查是否已經有登入中的管理員 session（例如重新整理頁面），有的話直接恢復登入狀態，
  //    不用每次重新整理都要重新輸入帳密
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setIsAdminAuthenticated(true);
        loadAdminData();
      }
      setAdminAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdminAuthenticated(!!session);
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // 🆕 管理員登入：真正呼叫 Supabase Auth 驗證帳號密碼，驗證在伺服器端進行，
  //    密碼本身不會出現在前端程式碼裡，也不會被瀏覽器看到
  const handleAdminLogin = async () => {
    if (!adminEmail.trim() || !adminPassword) {
      alert('請輸入管理員帳號與密碼！');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: adminEmail.trim(),
      password: adminPassword
    });

    if (error) {
      alert('❌ 登入失敗：帳號或密碼錯誤！');
      setAdminPassword('');
      return;
    }

    setAdminPassword('');
    setIsAdminAuthenticated(true);
    loadAdminData();
  };

  // 🆕 管理員登出
  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    setIsAdminAuthenticated(false);
  };

  // 🆕 抓取所有待審核報名（不分場次分區，因為審核是全站通用的名字白名單）
  const fetchPendingList = async () => {
    const { data } = await supabase.from('pickleball_registrations').select('id, name, count, session_id, arrived, review_status, created_at, line_user_id').eq('review_status', 'pending').order('created_at', { ascending: true });
    setPendingList(data || []);
  };

  // 🆕 抓取黑名單/缺席清單（含未到場次數與停權狀態）
  const fetchBlacklistEntries = async () => {
    const { data } = await supabase.from('pickleball_blacklists').select('*').order('no_show_count', { ascending: false });
    setBlacklistEntries(data || []);
  };

  // 🆕 依報名先後順序計算正取/備取（跟畫面上主要清單同一套邏輯，供全區名單使用）
  // 🆕 同樣修正插隊漏洞：一旦有人被擋到備取，後面所有人一律算備取，不能插隊
  const splitMainAndWaitList = (items, maxSeats) => {
    let total = 0;
    let seatsSum = 0;
    let hitCapacity = false;
    const main = [];
    const wait = [];
    items.forEach((item) => {
      const seats = Number(item.count) || 0;
      if (!hitCapacity && total + seats <= maxSeats) {
        main.push({ ...item, isPromoted: seatsSum >= maxSeats });
        total += seats;
      } else {
        hitCapacity = true;
        wait.push(item);
      }
      seatsSum += seats;
    });
    return { main, wait };
  };

  // 🆕 抓取指定日期六個分區的完整名單（管理員模式一次查看，不用切換分頁）
  //    預設抓「選擇單日場次」目前選的那個日期，可以回頭修正過去場次的簽到狀況
  const fetchAllZoneLists = async (dateKey = settingsDateKey) => {
    const sessionIds = TYPE_ORDER.map(typeId => `${dateKey}_${typeId}`);
    const { data } = await supabase
      .from('pickleball_registrations')
      .select('id, name, count, session_id, arrived, review_status, line_user_id')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true });

    const grouped = { experience: [], normal: [], openplay: [], experience_pm: [], normal_pm: [], openplay_pm: [] };
    (data || []).forEach(item => {
      const typeId = item.session_id.replace(`${dateKey}_`, '');
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
    computeRegistrationFeeSummary(settingsDateKey); // 🆕
  };

  // 🆕 幹部權限直接刪除報名（不需要球友的取消密碼）
  const handleAdminDelete = async (item) => {
    if (!confirm(`幹部權限：確定要刪除「${item.name}」的報名？`)) return;
    await supabase.from('pickleball_registrations').delete().eq('id', item.id);
    fetchAllZoneLists();
    computeRegistrationFeeSummary(settingsDateKey); // 🆕
  };

  // 🆕 核准報名：改為 approved，並加入白名單，之後報名都不用再審
  const handleApprovePending = async (item) => {
    const { error: updateError } = await supabase.from('pickleball_registrations').update({ review_status: 'approved' }).eq('id', item.id);
    if (updateError) {
      alert(`核准失敗：${updateError.message}`);
      return;
    }

    const trimmedName = item.name.trim();
    // 🆕 白名單改用 line_user_id 當唯一依據（沒有 line_user_id 的舊資料則退回用姓名，做向下相容）
    if (item.line_user_id) {
      await supabase.from('approved_names').upsert({ name: trimmedName, line_user_id: item.line_user_id }, { onConflict: 'line_user_id' });
    } else {
      await supabase.from('approved_names').upsert({ name: trimmedName }, { onConflict: 'name' });
    }

    alert(`✅ 已核准「${trimmedName}」，之後報名將不需再審核！`);
    fetchPendingList();
    refreshData();
    fetchAllZoneLists(); // 🆕
    computeRegistrationFeeSummary(settingsDateKey); // 🆕
  };

  // 🆕 拒絕報名：直接刪除該筆
  const handleRejectPending = async (item) => {
    if (!confirm(`確定要拒絕「${item.name}」這筆報名嗎？（將直接刪除此筆報名）`)) return;
    await supabase.from('pickleball_registrations').delete().eq('id', item.id);
    alert(`已拒絕並刪除「${item.name}」的報名`);
    fetchPendingList();
    refreshData();
    fetchAllZoneLists(); // 🆕
    computeRegistrationFeeSummary(settingsDateKey); // 🆕
  };

  // 🆕 手動停權 30 天：改用 line_user_id 當比對依據（換顯示名稱也擋得住），
  //    沒有 line_user_id 的舊資料（LINE 登入上線前留下的）則退回用姓名比對，做向下相容
  const handleManualBlock = async (entry) => {
    const name = entry.name;
    if (!confirm(`確定要將「${name}」停權 30 天嗎？`)) return;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const blockedUntilStr = targetDate.toISOString().split('T')[0];

    if (entry.line_user_id) {
      await supabase.from('pickleball_blacklists').upsert({ name, line_user_id: entry.line_user_id, blocked_until: blockedUntilStr }, { onConflict: 'line_user_id' });
    } else {
      await supabase.from('pickleball_blacklists').upsert({ name, blocked_until: blockedUntilStr }, { onConflict: 'name' });
    }
    alert(`已將「${name}」停權至 ${blockedUntilStr}！`);
    fetchBlacklistEntries();
  };

  // 🆕 解除停權
  const handleUnblock = async (entry) => {
    const name = entry.name;
    if (!confirm(`確定要解除「${name}」的停權嗎？`)) return;
    if (entry.line_user_id) {
      await supabase.from('pickleball_blacklists').update({ blocked_until: null }).eq('line_user_id', entry.line_user_id);
    } else {
      await supabase.from('pickleball_blacklists').update({ blocked_until: null }).eq('name', name);
    }
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

    // 🆕 會員限定模式檢查：開放時間之前，必須輸入正確的會員密碼才能報名
    //    密碼驗證用資料庫查詢條件比對（伺服器端比對），密碼本身不會被抓到前端
    if (isMembersOnlyActive) {
      if (!membersPassword.trim()) {
        alert('🔒 目前為會員限定報名期間，請輸入會員密碼！');
        return;
      }

      const { data: matched, error: pwdError } = await supabase
        .from('site_settings')
        .select('id')
        .eq('id', 1)
        .eq('members_only_password', membersPassword.trim())
        .maybeSingle();

      if (pwdError) {
        alert('系統錯誤：' + pwdError.message);
        return;
      }

      if (!matched) {
        alert('🔒 會員密碼錯誤，請確認後再試一次！');
        return;
      }
    }

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeValue = currentHours * 100 + currentMinutes;
    const todayStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    // 🆕 依分區的截止時間判斷（早上三區 8:30 截止；晚上散打 18:30 截止）
    const timing = SESSION_TIMING[selectedType];
    if (activeDate === todayStr && currentTimeValue >= timing.cutoff) {
      alert(`🚫 抱歉！今天的【${currentTypeConfig.label}】報名已於 ${formatTimeVal(timing.cutoff)} 截止囉！`);
      return;
    }

    const numericCount = parseInt(form.count);

    // 🆕 三個分區各自的單筆報名人數上限
    if (numericCount < 1 || numericCount > currentTypeConfig.perSubmitMax) {
      alert(`🚫 ${currentTypeConfig.label} 單筆報名最多 ${currentTypeConfig.perSubmitMax} 位球友喔！`);
      return;
    }

    // 🆕 身份驗證改用 LINE 登入（黑名單/白名單比對用），但顯示在名單上的名字改用自己打的暱稱，
    //    兩者分開：暱稱只是給別人看的，真正認人是靠 LINE 帳號
    if (!lineSession?.loggedIn) {
      alert('🔒 請先使用 LINE 登入才能報名！');
      return;
    }
    const myLineUserId = lineSession.lineUserId;
    const trimmedName = form.name.trim();
    if (!trimmedName) { alert('請輸入要顯示在名單上的暱稱！'); return; }

    // 🆕 同一個 LINE 帳號在同一場次不能重複報名
    if (list.some(item => item.line_user_id === myLineUserId)) {
      alert(`❌ 您（${trimmedName}）已經報名過本場次囉！`);
      return;
    }

    // 🆕 停權檢查：改用 LINE 使用者 ID 比對，換顯示名稱也擋得住，真正擋下報名
    const { data: blockRecord } = await supabase.from('pickleball_blacklists').select('blocked_until').eq('line_user_id', myLineUserId).maybeSingle();
    if (blockRecord?.blocked_until) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(blockRecord.blocked_until) >= today) {
        alert(`🚫 您的帳號目前處於停權狀態（至 ${blockRecord.blocked_until} 止），無法報名！如有疑問請洽幹部。`);
        return;
      }
    }

    // 🆕 查詢是否已在審核通過白名單中（用 LINE 使用者 ID 比對），決定 review_status
    const { data: approvedRecord } = await supabase.from('approved_names').select('id').eq('line_user_id', myLineUserId).maybeSingle();
    const reviewStatus = approvedRecord ? 'approved' : 'pending';

    const { error } = await supabase.from('pickleball_registrations').insert([{
      name: trimmedName,
      count: numericCount,
      line_user_id: myLineUserId,
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
      setMembersPassword('');
      setUserWarning('');
      refreshData();
    }
  };

  // 報到提交
  const handleCheckInSubmit = async () => {
    if (!checkInName) { alert('請選擇你的暱稱！'); return; }

    // 🆕 自助報到現在要涵蓋全部分區（含晚上散打），從 zoneLists 找出符合姓名的那一筆，
    //    並記錄它屬於哪個分區，才能套用該分區各自的報到時間窗
    let targetItem = null;
    if (isSelfCheckIn) {
      for (const typeId of TYPE_ORDER) {
        const found = (zoneLists[typeId] || []).find(item => item.name === checkInName);
        if (found) { targetItem = { ...found, typeId }; break; }
      }
    } else {
      targetItem = list.find(item => item.name === checkInName);
    }
    if (!targetItem) return;

    if (isSelfCheckIn) {
      const timing = SESSION_TIMING[targetItem.typeId] || SESSION_TIMING.normal;
      const now = new Date();
      const timeVal = now.getHours() * 100 + now.getMinutes();
      if (timeVal < timing.checkinStart || timeVal > timing.checkinEnd) {
        alert(`🚫 目前非報到時間！【${TYPE_CONFIG[targetItem.typeId].label}】開放報到時間為 ${formatTimeVal(timing.checkinStart)} ~ ${formatTimeVal(timing.checkinEnd)}。`);
        return;
      }

      if (!checkInPassword || checkInPassword.length !== 4) {
        alert('請輸入報名時設定的 4 位數密碼！');
        return;
      }
    }

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
      fetchAllZoneLists(activeDate); // 🆕
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
      // 🆕 改用 line_user_id 累計缺席次數（換顯示名稱也還是算同一個人），
      //    沒有 line_user_id 的舊報名資料則退回用姓名比對，做向下相容
      if (item.line_user_id) {
        const { data: existing } = await supabase.from('pickleball_blacklists').select('*').eq('line_user_id', item.line_user_id).maybeSingle();
        const newCount = (existing?.no_show_count || 0) + 1;
        await supabase.from('pickleball_blacklists').upsert({
          name: item.name,
          line_user_id: item.line_user_id,
          no_show_count: newCount
        }, { onConflict: 'line_user_id' });
      } else {
        const { data: existing } = await supabase.from('pickleball_blacklists').select('*').eq('name', item.name).maybeSingle();
        const newCount = (existing?.no_show_count || 0) + 1;
        await supabase.from('pickleball_blacklists').upsert({
          name: item.name,
          no_show_count: newCount
        }, { onConflict: 'name' });
      }
    }

    alert(`✅ 結算完成！已為 ${noShowList.length} 位未報到球友累記缺席次數。`);
    fetchBlacklistEntries();
  };

  // 🆕 取消報名改用 LINE 登入身份驗證，不用再輸入密碼。
  //    只有自己（line_user_id 相符）的報名，畫面上才會顯示「取消」按鈕，這裡再驗證一次避免被繞過。
  const handleDelete = async (item) => {
    if (!lineSession?.loggedIn || item.line_user_id !== lineSession.lineUserId) {
      alert('🔒 只能取消您自己（LINE 帳號）建立的報名！');
      return;
    }

    if (!confirm(`確定要取消【${item.name}】的報名嗎？`)) return;

    const { data, error } = await supabase
      .from('pickleball_registrations')
      .delete()
      .eq('id', item.id)
      .eq('line_user_id', lineSession.lineUserId)
      .select();

    if (error) {
      alert('系統錯誤：' + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert('❌ 取消失敗，請重新整理頁面後再試一次！');
      return;
    }

    alert('取消成功！');
    refreshData();
    fetchAllZoneLists(activeDate);
  };

  const currentUrl = typeof window !== 'undefined' ? `${window.location.origin}?mode=checkin` : '';
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentUrl)}`;

  return (
    <main className="min-h-screen bg-[#f0f4f8] text-[#2d3748] p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-10 py-2 sm:py-6">

        <div className="h-4"></div>

        {/* 🌟 大標題與活潑視覺排版 🌟 */}
        <div
          className={`text-center p-6 sm:p-8 rounded-3xl transition-all ${isSelfCheckIn ? 'shadow-lg border-2 bg-[#e6fcf5] border-[#63e6be]' : isCheckInMode ? 'shadow-lg border-2 bg-[#ffe8cc] border-[#ffd8a8]' : 'border-[3px] bg-[#fdf3d4] border-[#101010]'}`}
          style={(!isSelfCheckIn && !isCheckInMode) ? { boxShadow: '4px 4px 0 #101010' } : undefined}
        >

          {!isSelfCheckIn && !isCheckInMode && (
            <img src="/七賢匹克球LOGO.png" alt="七賢匹克 LOGO" className="w-16 h-16 sm:w-20 sm:h-20 object-contain mx-auto mb-2" />
          )}

          <h1 className={`text-3xl sm:text-5xl font-black tracking-wider leading-tight select-none drop-shadow-sm ${isSelfCheckIn ? 'text-[#0ca678]' : isCheckInMode ? 'text-[#d94800]' : 'text-[#17587f]'}`}>
            七賢匹克周末球敘<span onClick={handleSecretClick} className="cursor-pointer active:opacity-80">團</span>
          </h1>

          <div className={`border-t-2 border-dashed pt-4 mt-4 sm:mt-6 space-y-3 ${isSelfCheckIn ? 'border-[#63e6be]' : isCheckInMode ? 'border-[#ffd8a8]' : 'border-[#e8c23a]'}`}>
            {isSelfCheckIn ? (
              <p className="text-[#0ca678] text-base sm:text-xl font-extrabold tracking-wide animate-pulse">
                📱 現場自助報到專區 (早上場 8:30-12:00 / 晚上散打 18:30-21:00)
              </p>
            ) : isCheckInMode ? (
              <p className="text-[#d94800] text-base sm:text-xl font-extrabold tracking-wide">
                📱 管理員現場點名主控台
              </p>
            ) : (
              <>
                {/* 活潑標籤區塊 */}
                <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3 text-base sm:text-xl font-extrabold">
                  <span className="bg-white/80 text-[#17587f] px-4 py-2 rounded-full shadow-sm border border-[#17587f]/20 flex items-center gap-1.5">
                    🎽 1人 $100
                  </span>
                  <span className="bg-white/80 text-[#17587f] px-4 py-2 rounded-full shadow-sm border border-[#17587f]/20 flex items-center gap-1.5">
                    🏓 租借球拍 $50
                  </span>
                  <span className="bg-[#e8c23a] text-[#101010] px-4 py-2 rounded-full shadow-sm border-2 border-[#101010] flex items-center gap-1.5">
                    🎁 新手體驗免費
                  </span>
                </div>

                {/* 🆕 本場次日期（時間已在下方時段區塊顯示，這裡不重複） */}
                <p className="text-[#17587f] text-lg sm:text-2xl font-black tracking-wide pt-1">
                  📅 本場次：週六 {activeDate}
                </p>

                {/* 🔴 網站更新提示 🔴 */}
                <p className="text-red-600 text-sm sm:text-lg font-black tracking-wider flex items-center justify-center gap-1">
                  <span>⏰</span> 網站報名每週六晚上 10 點更新
                </p>
              </>
            )}
          </div>

          {/* 🆕 會員限定期間提示（非管理員模式時顯示） */}
          {!isCheckInMode && !isSelfCheckIn && isMembersOnlyActive && (
            <div className="mt-4 bg-amber-500/10 border-2 border-amber-400 text-amber-700 rounded-2xl px-4 py-3 font-black text-sm sm:text-lg">
              🔒 目前為會員限定報名期間，需輸入會員密碼才能報名，開放時間到後將自動開放給所有人
            </div>
          )}

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
            <p className="text-sm text-slate-500 font-bold">⏰ 早上三區報到 8:30~12:00；晚上散打報到 18:30~21:00</p>

            <select className="w-full p-4 bg-white rounded-2xl text-xl font-bold border-2 border-[#63e6be] focus:outline-none" value={checkInName} onChange={e => setCheckInName(e.target.value)}>
              <option value="">-- 請選擇你的暱稱 --</option>
              {(() => {
                // 🆕 自助報到選單改為涵蓋全部分區（含晚上散打）的正取名單
                let combined = [];
                TYPE_ORDER.forEach(typeId => {
                  const maxSeats = capacitySettings[typeId] ?? DEFAULT_CAPACITY[typeId];
                  const { main } = splitMainAndWaitList(zoneLists[typeId] || [], maxSeats);
                  main.forEach(item => combined.push({ ...item, typeId }));
                });
                return combined.map(item => (
                  <option key={item.id} value={item.name} disabled={item.arrived}>
                    {item.name}（{TYPE_CONFIG[item.typeId].label} - {item.count}位）{item.isPromoted ? ' [🎉備取成功]' : ''} {item.arrived ? ' ✓ [已報到]' : ''}
                  </option>
                ));
              })()}
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
            {/* 🆕 先選早上／晚上時段入口 */}
            {!isCheckInMode && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedSession('AM')}
                  className={`p-4 sm:p-5 rounded-2xl font-black text-lg sm:text-2xl transition-all border-[3px] flex items-center justify-center gap-2 ${selectedSession === 'AM' ? 'bg-[#17587f] text-white border-[#101010]' : 'bg-white text-[#101010] border-[#101010]'}`}
                  style={{ boxShadow: '3px 3px 0 #101010' }}
                >
                  🌅 早上場 (9:00-12:00)
                </button>
                <button
                  onClick={() => setSelectedSession('PM')}
                  className={`p-4 sm:p-5 rounded-2xl font-black text-lg sm:text-2xl transition-all border-[3px] flex items-center justify-center gap-2 ${selectedSession === 'PM' ? 'bg-[#17587f] text-white border-[#101010]' : 'bg-white text-[#101010] border-[#101010]'}`}
                  style={{ boxShadow: '3px 3px 0 #101010' }}
                >
                  🌙 晚上場 (19:00-21:20)
                </button>
              </div>
            )}

            {/* 🆕 組別選擇：該時段的三個分區（新手體驗／新手區／散打） */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {(isCheckInMode ? TYPE_ORDER : SESSION_TYPES[selectedSession]).map(typeId => {
                const cfg = TYPE_CONFIG[typeId];
                return (
                  <button
                    key={typeId}
                    onClick={() => setSelectedType(typeId)}
                    className={`p-3 sm:p-5 rounded-2xl font-black transition-all duration-200 border-[3px] flex flex-col items-center justify-center gap-1 ${selectedType === typeId ? 'bg-[#e8c23a] text-[#101010] border-[#101010]' : 'bg-white text-[#101010] border-[#101010]'}`}
                    style={{ boxShadow: '2px 2px 0 #101010' }}
                  >
                    <span className="text-base sm:text-2xl text-center leading-tight">{cfg.label}</span>
                    {!isCheckInMode && (
                      <span className={`text-xs sm:text-lg font-bold text-center ${capacitySettings[typeId] === 0 ? 'text-red-500' : 'text-[#17587f]'}`}>
                        {capacitySettings[typeId] === 0 ? '❌ 本區未開放' : `(開放報名(限${capacitySettings[typeId]}位))`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 看板 */}
            <div className="bg-white border-[3px] border-[#101010] rounded-2xl p-4 sm:p-6 text-center space-y-1" style={{ boxShadow: '3px 3px 0 #101010' }}>
              <div className="text-2xl sm:text-4xl font-black text-[#17587f] tracking-wide">⏰ 時間：{SESSION_TIMING[selectedType].boardTime}</div>
              <div className="text-sm sm:text-base text-red-500 font-bold">⚠️ 當天 {formatTimeVal(SESSION_TIMING[selectedType].cutoff)} 後即截止報名</div>
            </div>

            {/* 表單 / 點名區 */}
            <div
              className={`p-5 sm:p-8 rounded-3xl transition-all ${isCheckInMode ? 'shadow-xl border bg-[#ffe8cc] border-[#ffd8a8]' : 'border-[3px] bg-[#17587f] border-[#101010]'}`}
              style={!isCheckInMode ? { boxShadow: '4px 4px 0 #101010' } : undefined}
            >
              {isCheckInMode ? (
                !isAdminAuthenticated ? (
                  <div className="space-y-4 text-center">
                    <div className="text-xl sm:text-2xl font-black text-[#d94800]">🔒 管理員登入</div>
                    <input
                      className="w-full p-4 bg-white rounded-2xl border-2 text-lg focus:outline-none focus:border-[#ff6d00]"
                      type="email"
                      placeholder="管理員帳號 (Email)"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                    />
                    <input
                      className="w-full p-4 bg-white rounded-2xl border-2 text-center text-lg tracking-widest focus:outline-none focus:border-[#ff6d00]"
                      type="password"
                      placeholder="密碼"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAdminLogin(); }}
                    />
                    <button className="w-full bg-[#ff6d00] text-white p-4 rounded-2xl text-xl font-black" onClick={handleAdminLogin}>登入</button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="text-xl sm:text-2xl font-black text-[#d94800]">📋 現場點名與管理主控台</div>
                      <button onClick={handleAdminLogout} className="text-xs font-bold text-slate-400 hover:text-slate-600 underline">登出</button>
                    </div>

                    {/* 🆕 選擇單日場次：統一控制人數設定/記帳/全區名單管理，可以往前選過去的場次做簽到修正 */}
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-500">📅 選擇單日場次：</span>
                      <select
                        value={settingsDateKey}
                        onChange={e => {
                          const newDate = e.target.value;
                          setSettingsDateKey(newDate);
                          fetchAllZoneLists(newDate);
                          fetchSettingsPanelCapacity(newDate);
                          fetchFinancialRecords(newDate);
                          computeRegistrationFeeSummary(newDate);
                        }}
                        className="bg-slate-50 border p-2 rounded-lg font-bold text-sm flex-1 min-w-[180px]"
                      >
                        {upcomingSaturdaysForSettings.map(dateStr => (
                          <option key={dateStr} value={dateStr}>
                            {dateStr}（週六）{dateStr === activeDate ? ' - 目前開放中' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

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

                    {/* 🆕 會員限定報名設定：固定規則，每週三晚上 22:00 自動開放，密碼固定不用每週改 */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="text-sm font-black text-slate-600">
                        🔒 會員限定報名設定
                        {isMembersOnlyActive ? (
                          <span className="ml-2 text-xs font-bold text-amber-600">目前生效中（需要密碼）</span>
                        ) : (
                          <span className="ml-2 text-xs font-bold text-emerald-600">目前未限制（公開報名中）</span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-slate-500 bg-slate-50 p-2 rounded-lg">
                        固定規則：每週三晚上 22:00 自動開放給所有人報名，之後自動每週重複，不用手動設定。
                        <br />
                        本場次（{activeDate}）解鎖時間：{getWednesdayCutoffForSaturday(activeDate).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">會員密碼（固定使用，留空 = 不變更密碼）</label>
                        <input
                          type="text"
                          placeholder="設定/更新會員限定密碼"
                          value={membersOnlyPasswordInput}
                          onChange={e => setMembersOnlyPasswordInput(e.target.value)}
                          className="w-full bg-slate-50 border p-2 rounded-lg font-bold text-sm"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button onClick={handleSaveMembersOnlySettings} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-black py-2.5 rounded-xl text-sm">
                          儲存密碼
                        </button>
                        <button onClick={handleOpenNow} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-sm">
                          本週提前開放
                        </button>
                      </div>
                    </div>

                    {/* 🆕 人數上限設定（日期由上方「選擇單日場次」統一控制） */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-black text-slate-600">⚙️ 設定【{settingsDateKey}】六個分區人數上限</div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                        儲存【{settingsDateKey}】的人數設定
                      </button>
                    </div>

                    {/* 🆕 現場收支記帳與結算（跟人數設定共用同一個日期選單），樣式比照主後台 */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-black text-slate-600">🧾 現場收支記帳與結算（{settingsDateKey}）</div>
                        <div className="flex items-center gap-2 bg-emerald-50 p-1.5 rounded-xl border border-emerald-200">
                          <span className="text-emerald-900 font-bold text-xs pl-1">月份報表：</span>
                          <select
                            value={selectedExportMonth}
                            onChange={e => setSelectedExportMonth(e.target.value)}
                            className="bg-white border p-1.5 rounded-lg font-bold text-emerald-900 text-xs focus:outline-none"
                          >
                            {availableExportMonths.map(m => {
                              const [y, mo] = m.split('/');
                              return <option key={m} value={m}>{y}年{mo}月</option>;
                            })}
                          </select>
                          <button onClick={handleExportFinancialCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs">
                            📊 匯出月記帳報表
                          </button>
                        </div>
                      </div>

                      {/* 🆕 4 張總覽卡片：報名費收入即時計算，不用手動觸發 */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">預計報名費收入</div>
                          <div className="text-lg font-black text-slate-800">${feeSummary.expected}</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">總實收(已到場+其他)</div>
                          <div className="text-lg font-black text-emerald-600">
                            ${feeSummary.actual + financialRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">總支出(場租+其他)</div>
                          <div className="text-lg font-black text-rose-600">
                            ${financialRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)}
                          </div>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-xl border-2 border-emerald-300 text-center">
                          <div className="text-[10px] font-bold text-emerald-700 uppercase">當日純益</div>
                          <div className="text-lg font-black text-emerald-700">
                            $
                            {feeSummary.actual +
                              financialRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0) -
                              financialRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <select
                          value={finType}
                          onChange={e => {
                            const t = e.target.value;
                            setFinType(t);
                            setFinCategory(t === 'income' ? '租拍' : '場地費');
                          }}
                          className="p-2 border rounded-lg font-bold bg-white text-sm"
                        >
                          <option value="income">➕ 增加收入</option>
                          <option value="expense">➖ 增加支出</option>
                        </select>

                        <select
                          value={finCategory}
                          onChange={e => setFinCategory(e.target.value)}
                          className="p-2 border rounded-lg font-bold bg-white text-sm"
                        >
                          {finType === 'income' ? (
                            <>
                              <option value="租拍">🏸 租拍</option>
                              <option value="配件收入">🛍️ 配件收入</option>
                              <option value="現場報名費">🎟️ 現場報名費(手動補登)</option>
                            </>
                          ) : (
                            <>
                              <option value="場地費">🏟️ 場地費</option>
                              <option value="其他支出">📦 其他支出</option>
                            </>
                          )}
                        </select>

                        <div className="flex items-center gap-1 bg-white border p-2 rounded-lg">
                          <span className="font-bold text-slate-400 text-sm">$</span>
                          <input
                            type="number"
                            placeholder="金額"
                            value={finAmount}
                            onChange={e => setFinAmount(e.target.value)}
                            className="w-20 font-bold text-sm outline-none"
                          />
                        </div>

                        <input
                          type="text"
                          placeholder="備註(例如：小明租拍、賣球拍/握把布)"
                          value={finNote}
                          onChange={e => setFinNote(e.target.value)}
                          className="flex-1 min-w-[100px] bg-white border p-2 rounded-lg font-bold text-sm outline-none"
                        />

                        <button onClick={handleAddFinancialRecord} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-sm">
                          新增記帳
                        </button>
                      </div>

                      {financialRecords.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-slate-400 uppercase">當日現場附加明細：</span>
                          {financialRecords.map(r => (
                            <div key={r.id} className="bg-slate-50 p-2.5 rounded-lg border flex justify-between items-center">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${r.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                  {r.category}
                                </span>
                                <span className="font-bold text-sm">${r.amount}</span>
                                {r.note && <span className="text-xs text-slate-500">({r.note})</span>}
                              </div>
                              <button onClick={() => handleDeleteFinancialRecord(r.id)} className="text-xs font-bold text-slate-400 hover:text-rose-600 underline">
                                刪除
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 🆕 全區名單管理：跟主後台一樣的分頁籤 + 攤平列表風格 */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4">
                      {(() => {
                        const typeIcons = { experience: '🏸', normal: '🌱', openplay: '🔥', experience_pm: '🌟', normal_pm: '🌛', openplay_pm: '🌙' };

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
                              <div className="flex items-center gap-2">
                                <div className="text-lg font-black text-slate-800">全區名單管理（{settingsDateKey}(週六)）</div>
                                <button
                                  onClick={() => fetchAllZoneLists()}
                                  className="text-xs font-bold text-sky-600 hover:text-sky-800 underline shrink-0"
                                >
                                  🔄 重新整理
                                </button>
                              </div>
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
                                    <button onClick={() => handleUnblock(entry)} className="bg-white border text-slate-600 hover:text-emerald-700 text-xs font-black px-3 py-1.5 rounded-lg">🔓 解除停權</button>
                                  ) : (
                                    <button onClick={() => handleManualBlock(entry)} className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-3 py-1.5 rounded-lg">🚫 停權30天</button>
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
                    {/* 🆕 會員限定模式提示與密碼輸入欄位 */}
                    {isMembersOnlyActive && (
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-2">
                        <p className="text-amber-800 font-black text-sm">
                          🔒 目前為會員限定報名期間，請輸入會員密碼才能送出報名
                        </p>
                        <input
                          className="w-full p-4 bg-white rounded-2xl border-2 border-amber-300 text-xl focus:outline-none focus:border-amber-500 text-center tracking-widest"
                          type="password"
                          placeholder="請輸入會員密碼"
                          value={membersPassword}
                          onChange={e => setMembersPassword(e.target.value)}
                        />
                      </div>
                    )}
                    {/* 🆕 身份改用 LINE 登入驗證，取代自己輸入姓名 */}
                    {!lineSession?.loggedIn ? (
                      <div className="text-center space-y-3 py-2">
                        <p className="text-white font-bold text-sm sm:text-base">🔒 請先使用 LINE 登入才能報名（防止黑名單被繞過）</p>
                        <a href="/api/line-login" className="inline-block w-full bg-[#06C755] hover:bg-[#05b34c] text-white p-4 rounded-2xl text-xl font-black border-[3px] border-[#101010]" style={{ boxShadow: '3px 3px 0 #101010' }}>
                          使用 LINE 登入
                        </a>
                        <p className="text-white/80 font-bold text-xs">🔐 LINE 僅用於登入驗證身份（防止換名字逃避停權），不會取得您的電話、Email 等敏感資料，也不會公開您的 LINE 個人資料</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between bg-[#e8c23a] rounded-2xl border-[3px] border-[#101010] p-3">
                          <span className="font-black text-[#101010] text-lg">✅ 已用 LINE 登入</span>
                          <a href="/api/logout" className="text-sm font-black text-[#101010] bg-white px-3 py-1.5 rounded-lg border-2 border-[#101010]">登出</a>
                        </div>
                        {userWarning && (
                          <div className="mt-2 text-sm font-bold text-amber-900 bg-amber-50 p-3 rounded-xl border-2 border-[#101010]">
                            {userWarning}
                          </div>
                        )}
                        {/* 🆕 顯示暱稱跟登入身份分開：LINE 帳號只用來做身份驗證（黑名單/白名單），
                            這裡讓你自己打一個別人會看到的暱稱，不用是你的 LINE 真實名稱 */}
                        <input
                          className="w-full p-4 bg-white rounded-2xl border-[3px] border-[#101010] text-xl focus:outline-none focus:border-[#e8c23a]"
                          placeholder="輸入暱稱或代號"
                          value={form.name}
                          onChange={e => setForm({...form, name: e.target.value})}
                        />
                        <select className="w-full p-4 bg-white rounded-2xl border-[3px] border-[#101010] text-xl focus:outline-none focus:border-[#e8c23a]" value={form.count} onChange={e => setForm({...form, count: e.target.value})}>
                          {Array.from({ length: currentTypeConfig.perSubmitMax }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n} 位</option>
                          ))}
                        </select>
                        <button className="w-full bg-[#e8c23a] text-[#101010] p-4 rounded-2xl text-xl font-black border-[3px] border-[#101010]" style={{ boxShadow: '3px 3px 0 #101010' }} onClick={submit}>確認報名</button>
                      </>
                    )}
                  </div>
                )
              )}
            </div>
          </>
        )}

        {/* 正取名單區塊 */}
        <div className="space-y-4">
          <h2 className="text-2xl sm:text-4xl font-black text-[#17587f] px-2">正取名單 ({currentTotal} / {maxSeatsLimit})</h2>

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
                  <div
                    className={`p-4 sm:p-6 rounded-2xl flex justify-between items-center ${isPending ? 'shadow-sm border bg-amber-50 border-amber-300 border-dashed' : item.arrived ? 'shadow-sm border bg-green-100 border-green-300' : item.isPromoted ? 'shadow-sm border bg-[#e6fcf5] border-[#63e6be]' : 'border-[3px] bg-white border-[#101010]'}`}
                    style={(!isPending && !item.arrived && !item.isPromoted) ? { boxShadow: '3px 3px 0 #101010' } : undefined}
                  >
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
                    {lineSession?.loggedIn && item.line_user_id === lineSession.lineUserId && (
                      <button className="text-white text-sm font-bold bg-[#c0392b] px-3 py-1.5 rounded-xl border-2 border-[#101010]" onClick={() => handleDelete(item)}>取消</button>
                    )}
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
                  {lineSession?.loggedIn && item.line_user_id === lineSession.lineUserId && (
                    <button className="text-red-500 text-sm bg-red-50 px-3 py-1.5 rounded-xl" onClick={() => handleDelete(item)}>取消</button>
                  )}
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
            <h3 className="text-2xl font-black text-[#17587f]">請球友掃描 QR Code 報到</h3>
            <p className="text-slate-500 text-sm">開放時間：早上場 8:30-12:00 / 晚上散打 18:30-21:00</p>
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
