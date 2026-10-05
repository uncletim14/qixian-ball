'use client';
// 📄 檔案路徑：app/my-portal-sat/page.js（星期六網站專案，獨立幹部後台）
// 功能與另一個後台（my-portal-9567）一致：場次人數/場地費設定、收支記帳、報名審核、缺席名單、停權黑名單、
// 月報表匯出、全區名單與到場註記；另外多一個「每週分區密碼」設定區。資料連接星期六網站自己的資料庫。
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc2lhZWVoemhzYXFqeHhpa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Njc4NDksImV4cCI6MjA5NjA0Mzg0OX0.UYNrbcm5HaDucdcAj7XMwIBye6dsA6cRaG-bLY34XVM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ───────────────── 基本設定 ─────────────────
// 四個分區（早上場／晚上場各一組，晚上場的 typeId 會加 _pm）
const BASES = ['normal', 'experience', 'openplay', 'advanced'];
const BASE_LABEL = { normal: '新手友善場', experience: '新手體驗', openplay: '一般散打', advanced: '3.0以上 球敘' };
const BASE_ICON = { normal: '🌱', experience: '🏸', openplay: '🔥', advanced: '🎯' };
const BASE_GROUP = { normal: '新手區', experience: '新手區', openplay: '散打區', advanced: '散打區' };
const PRICE = { normal: 100, experience: 0, openplay: 100, advanced: 100 };
const ALL_TYPE_IDS = BASES.flatMap(b => [b, b + '_pm']);
const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
// 場地費預設值：新網站啟用日（含）之後的場次預設 600，之前的歷史場次不套用（避免改變過去報表）
const DEFAULT_VENUE_FEE_START = '2026/10/05';

const pad = n => String(n).padStart(2, '0');
const fmtDate = d => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
const parseDate = s => { const [y, m, d] = s.split('/').map(Number); return new Date(y, m - 1, d); };
const dowOf = s => parseDate(s).getDay();
// 該日期所屬那一週的星期六（每週密碼用它當代號）
const weekKeyOf = s => { const d = parseDate(s); d.setDate(d.getDate() + (6 - d.getDay())); return fmtDate(d); };
const typeIdFor = (base, session) => (session === 'PM' ? base + '_pm' : base);
const defaultVenueFee = dateStr => (dateStr >= DEFAULT_VENUE_FEE_START ? 600 : 0);

// 各場次人數預設值（沒在後台設定過時用）
function getDefaultCapacityFor(dateStr, session) {
  if (dowOf(dateStr) === 6) {
    return session === 'AM'
      ? { experience: 9, normal: 8, openplay: 10, advanced: 10 }
      : { experience: 9, normal: 9, openplay: 9, advanced: 10 };
  }
  // 週一/四/五（晚上場）：新手體驗0、新手友善9、一般散打18、3.0以上 球敘10
  return { experience: 0, normal: 9, openplay: 18, advanced: 10 };
}
function capacityMap(row, dateStr) {
  const out = {};
  ['AM', 'PM'].forEach(sess => {
    const def = getDefaultCapacityFor(dateStr, sess);
    BASES.forEach(b => {
      const typeId = typeIdFor(b, sess);
      const v = row ? row[typeId + '_max'] : null;
      out[typeId] = (v !== undefined && v !== null) ? v : def[b];
    });
  });
  return out;
}

// 依報名先後排隊算正取/備取（跟前台同一套：一旦有人被擋到備取，後面全部備取）
function splitStrict(items, max) {
  let total = 0;
  let hit = false;
  const main = [];
  const wait = [];
  items.forEach(it => {
    const seats = Number(it.count) || 0;
    if (!hit && total + seats <= max) { main.push(it); total += seats; } else { hit = true; wait.push(it); }
  });
  return { main, wait };
}

// 分頁抓取（Supabase 一次最多回 1000 筆）
async function fetchAllRows(buildQuery) {
  const all = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await buildQuery().range(page * 1000, page * 1000 + 999);
    if (error || !data) break;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

// 場次下拉選單：過去7天 ~ 未來21天（週六拆早上/晚上、週二是球隊練習日）
function generateDateOptions() {
  const list = [];
  const base = new Date();
  for (let i = -7; i <= 21; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const dow = d.getDay();
    const ds = fmtDate(d);
    if (dow === 6) {
      list.push({ key: `${ds}|AM`, date: ds, session: 'AM', label: `🌅 ${ds} (週六早上9-12)` });
      list.push({ key: `${ds}|PM`, date: ds, session: 'PM', label: `🌙 ${ds} (週六晚上)` });
    } else if (dow === 1 || dow === 4 || dow === 5) {
      list.push({ key: `${ds}|PM`, date: ds, session: 'PM', label: `${ds} (週${DAY_NAMES[dow]})` });
    } else if (dow === 2) {
      list.push({ key: `${ds}|TEAM`, date: ds, session: 'TEAM', label: `🏐 ${ds} (週二-球隊練習)` });
    }
  }
  return list;
}

// 缺席日期顯示：2026/09/21 → 9/21；早上場加註(早上)
function formatAbsenceDate(dk) {
  const [datePart, sessionPart] = dk.split('_');
  const parts = datePart.split('/');
  const label = parts.length === 3 ? `${parseInt(parts[1])}/${parseInt(parts[2])}` : datePart;
  return sessionPart === 'AM' ? `${label}(早上)` : label;
}

export default function SatAdminPortal() {
  // ───────── 登入 ─────────
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // ───────── 場次選擇 ─────────
  const [dateOptions, setDateOptions] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const selectedOpt = dateOptions.find(o => o.key === selectedKey);
  const selectedDate = selectedOpt ? selectedOpt.date : '';
  const selectedSession = selectedOpt ? selectedOpt.session : 'PM';
  const isTeamPracticeDay = selectedSession === 'TEAM';
  const selectedDateLabel = selectedOpt ? selectedOpt.label : selectedKey;
  const weekKey = selectedDate ? weekKeyOf(selectedDate) : '';
  const selectedDateRef = useRef('');
  selectedDateRef.current = selectedDate;

  // ───────── 當日資料 ─────────
  const [dayRegs, setDayRegs] = useState([]);
  const [capacities, setCapacities] = useState({});
  const [capInputs, setCapInputs] = useState({ normal: 0, experience: 0, openplay: 0, advanced: 0 });
  const [venueFeeInput, setVenueFeeInput] = useState(600);
  const [showVenueFeeInput, setShowVenueFeeInput] = useState(false);
  const [cancelled, setCancelled] = useState({ AM: false, PM: false });
  const [financialRecords, setFinancialRecords] = useState([]);
  const [finType, setFinType] = useState('income');
  const [finCategory, setFinCategory] = useState('租拍');
  const [finAmount, setFinAmount] = useState('');
  const [finNote, setFinNote] = useState('');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('ALL');

  // ───────── 每週密碼 ─────────
  const [pwNewbie, setPwNewbie] = useState('');
  const [pwOpenplay, setPwOpenplay] = useState('');

  // ───────── 審核 / 缺席 / 黑名單 ─────────
  const [pendingList, setPendingList] = useState([]);
  const [absenceSummary, setAbsenceSummary] = useState([]);
  const [expandedAbsenceDates, setExpandedAbsenceDates] = useState(new Set());
  const [expandedAbsenceCategory, setExpandedAbsenceCategory] = useState(null);
  const [blacklists, setBlacklists] = useState([]);
  const [blockNameInput, setBlockNameInput] = useState('');

  // ───────── 月報表 / QR ─────────
  const [selectedMonth, setSelectedMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [originUrl, setOriginUrl] = useState('');

  // ───────── 初始化 ─────────
  useEffect(() => {
    document.title = '七賢匹克球｜星期六網站後台';
    const opts = generateDateOptions();
    setDateOptions(opts);
    const todayStr = fmtDate(new Date());
    const first = opts.find(o => o.date >= todayStr) || opts[opts.length - 1];
    if (first) setSelectedKey(first.key);
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}/${pad(now.getMonth() + 1)}`);
    if (typeof window !== 'undefined') setOriginUrl(window.location.origin);

    supabase.auth.getSession().then(({ data }) => {
      setIsAdmin(!!data?.session);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => setIsAdmin(!!session));
    return () => listener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchAvailableMonths();
      fetchBlacklists();
      fetchPending();
      fetchAbsenceSummary();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && selectedDate) {
      loadDay();
      loadWeekPasswords();
      setShowVenueFeeInput(false);
    }
  }, [isAdmin, selectedKey]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
    if (error) { alert('登入失敗：' + error.message); return; }
    setLoginPassword('');
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ───────── 讀取當日資料 ─────────
  const loadDay = async () => {
    const date = selectedDate;
    if (!date) return;
    const sessionIds = ALL_TYPE_IDS.map(t => `${date}_${t}`);
    const { data: regs } = await supabase
      .from('pickleball_registrations')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    const { data: setRow } = await supabase.from('event_settings').select('*').eq('date_key', date).maybeSingle();
    const { data: statusRows } = await supabase.from('event_status').select('date_key, is_cancelled').in('date_key', [`${date}_AM`, `${date}_PM`]);
    const { data: fin } = await supabase.from('financial_records').select('*').eq('date_key', date).order('created_at', { ascending: true });

    if (date !== selectedDateRef.current) return; // 場次已切換，丟棄過期回應

    const capMap = capacityMap(setRow, date);
    setDayRegs(regs || []);
    setCapacities(capMap);
    const sess = selectedSession === 'AM' ? 'AM' : 'PM';
    const inputs = {};
    BASES.forEach(b => { inputs[b] = capMap[typeIdFor(b, sess)]; });
    setCapInputs(inputs);
    setVenueFeeInput(setRow && setRow.venue_fee !== undefined && setRow.venue_fee !== null ? setRow.venue_fee : defaultVenueFee(date));
    setCancelled({
      AM: !!statusRows?.find(r => r.date_key === `${date}_AM`)?.is_cancelled,
      PM: !!statusRows?.find(r => r.date_key === `${date}_PM`)?.is_cancelled
    });
    setFinancialRecords(fin || []);
  };

  // ───────── 每週密碼 ─────────
  const loadWeekPasswords = async () => {
    if (!weekKey) return;
    const { data } = await supabase.from('zone_passwords').select('zone_group, password').eq('week_key', weekKey);
    setPwNewbie(data?.find(r => r.zone_group === 'newbie')?.password || '');
    setPwOpenplay(data?.find(r => r.zone_group === 'openplay')?.password || '');
  };
  const handleSavePasswords = async () => {
    const rows = [];
    if (pwNewbie.trim()) rows.push({ week_key: weekKey, zone_group: 'newbie', password: pwNewbie.trim() });
    if (pwOpenplay.trim()) rows.push({ week_key: weekKey, zone_group: 'openplay', password: pwOpenplay.trim() });
    if (rows.length === 0) { alert('請至少輸入一組密碼！'); return; }
    const { error } = await supabase.from('zone_passwords').upsert(rows, { onConflict: 'week_key,zone_group' });
    if (error) { alert('儲存失敗：' + error.message); return; }
    alert(`✅ 已儲存【${weekKey} 這一週】的密碼（週一／四／五／六共用）`);
  };

  // ───────── 人數與場地費設定 ─────────
  const handleOpenVenueFee = () => {
    const pwd = prompt('請輸入幹部密碼以解鎖檢視/修改場地費金額：');
    if (pwd === '8888') setShowVenueFeeInput(true);
    else if (pwd !== null) alert('密碼錯誤！無法查看場地費金額。');
  };
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const payload = { date_key: selectedDate, venue_fee: venueFeeInput };
    if (!isTeamPracticeDay) {
      BASES.forEach(b => { payload[typeIdFor(b, selectedSession) + '_max'] = parseInt(capInputs[b]) || 0; });
    }
    const { error } = await supabase.from('event_settings').upsert(payload, { onConflict: 'date_key' });
    if (error) { alert(`儲存失敗：${error.message}`); return; }
    alert(`🎉 成功儲存【${selectedDateLabel}】人數與場地費設定！`);
    setShowVenueFeeInput(false);
    loadDay();
  };
  const handleToggleCancel = async () => {
    const sess = selectedSession;
    if (sess !== 'AM' && sess !== 'PM') return;
    const next = !cancelled[sess];
    const sessLabel = sess === 'AM' ? '早上場' : '晚上場';
    if (!confirm(`確定要將 ${selectedDate} ${sessLabel} 設定為【${next ? '因雨取消或其他原因取消' : '球敘正常'}】嗎？`)) return;
    const { error } = await supabase.from('event_status').upsert({ date_key: `${selectedDate}_${sess}`, is_cancelled: next }, { onConflict: 'date_key' });
    if (error) { alert(`設定失敗：${error.message}`); return; }
    setCancelled(prev => ({ ...prev, [sess]: next }));
    fetchAbsenceSummary();
  };

  // ───────── 記帳 ─────────
  const handleAddFinancialRecord = async (e) => {
    e.preventDefault();
    const amountNum = parseInt(finAmount);
    if (isNaN(amountNum) || amountNum <= 0) { alert('請輸入有效的金額！'); return; }
    const { error } = await supabase.from('financial_records').insert([{
      date_key: selectedDate, type: finType, category: finCategory, amount: amountNum, note: finNote.trim()
    }]);
    if (error) { alert(`新增失敗：${error.message}`); return; }
    setFinAmount('');
    setFinNote('');
    loadDay();
  };
  const handleDeleteFinancialRecord = async (id) => {
    if (!confirm('確定要刪除此筆記帳紀錄？')) return;
    await supabase.from('financial_records').delete().eq('id', id);
    loadDay();
  };

  // ───────── 月份清單 ─────────
  const fetchAvailableMonths = async () => {
    const regRows = await fetchAllRows(() => supabase.from('pickleball_registrations').select('id, session_id').order('id'));
    const { data: finRows } = await supabase.from('financial_records').select('date_key');
    const dates = [...regRows.map(r => (r.session_id || '').split('_')[0]), ...(finRows || []).map(r => r.date_key)];
    const months = Array.from(new Set(dates.filter(Boolean).map(d => d.split('/').slice(0, 2).join('/'))));
    const now = new Date();
    const cur = `${now.getFullYear()}/${pad(now.getMonth() + 1)}`;
    if (!months.includes(cur)) months.push(cur);
    months.sort();
    setAvailableMonths(months);
  };

  // ───────── 報名審核 ─────────
  const fetchPending = async () => {
    const { data } = await supabase.from('pickleball_registrations').select('*').eq('review_status', 'pending').order('created_at', { ascending: true });
    setPendingList(data || []);
  };
  const handleApproveParticipant = async (p) => {
    const { error: updateError } = await supabase.from('pickleball_registrations').update({ review_status: 'approved' }).eq('id', p.id);
    if (updateError) { alert(`核准失敗：${updateError.message}`); return; }
    const trimmedName = (p.name || '').trim();
    let nameError = null;
    if (p.line_user_id) {
      const r = await supabase.from('approved_names').upsert({ name: trimmedName, line_user_id: p.line_user_id }, { onConflict: 'line_user_id' });
      nameError = r.error;
    } else {
      const r = await supabase.from('approved_names').upsert({ name: trimmedName }, { onConflict: 'name' });
      nameError = r.error;
    }
    if (nameError) alert(`⚠️ 報名已核准，但寫入免審名單時發生問題：${nameError.message}`);
    else alert(`✅ 已核准「${trimmedName}」，之後報名將不需再審核！`);
    fetchPending();
    loadDay();
  };
  const handleRejectParticipant = async (p) => {
    if (!confirm(`確定要拒絕「${p.name}」這筆報名嗎？（將直接刪除此筆報名）`)) return;
    const { error } = await supabase.from('pickleball_registrations').delete().eq('id', p.id);
    if (error) { alert(`拒絕失敗：${error.message}`); return; }
    alert(`已拒絕並刪除「${p.name}」的報名`);
    fetchPending();
    loadDay();
  };

  // ───────── 缺席名單（由報名紀錄自動統計，跟另一個後台同一套算法）─────────
  // 規則：只統計「已過場次時間」「沒因雨取消」「真正排進正取」「已審核」「沒到場」的紀錄；
  //       每個人的起算時間 = max(30天前, 全域重置時間, 該人的豁免(解除停權)時間)
  const fetchAbsenceSummary = async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let baseline = thirtyDaysAgo;

    const { data: gr } = await supabase.from('absence_global_reset').select('reset_at').eq('id', 1).maybeSingle();
    if (gr?.reset_at && new Date(gr.reset_at) > baseline) baseline = new Date(gr.reset_at);

    const { data: ovr } = await supabase.from('absence_overrides').select('*');
    const ovrMap = new Map();
    (ovr || []).forEach(o => { if (o.overridden_at) ovrMap.set(o.override_key, new Date(o.overridden_at)); });

    // 排名需要同場次「所有人」，所以多往前抓 14 天，個人起算時間再另外過濾
    const fetchFrom = new Date(thirtyDaysAgo);
    fetchFrom.setDate(fetchFrom.getDate() - 14);
    const regs = await fetchAllRows(() =>
      supabase.from('pickleball_registrations')
        .select('id, name, count, session_id, arrived, created_at, line_user_id, review_status')
        .gte('created_at', fetchFrom.toISOString())
        .order('id')
    );

    const { data: settingRows } = await supabase.from('event_settings').select('*');
    const settingByDate = {};
    (settingRows || []).forEach(r => { settingByDate[r.date_key] = r; });
    const { data: cancelledRows } = await supabase.from('event_status').select('date_key').eq('is_cancelled', true);
    const cancelledSet = new Set((cancelledRows || []).map(c => c.date_key));

    const bySession = new Map();
    regs.forEach(r => {
      if (!bySession.has(r.session_id)) bySession.set(r.session_id, []);
      bySession.get(r.session_id).push(r);
    });

    const countMap = new Map();
    const infoMap = new Map();
    bySession.forEach((items, sid) => {
      const idx = sid.indexOf('_');
      if (idx < 0) return;
      const date = sid.slice(0, idx);
      const typeId = sid.slice(idx + 1);
      if (!ALL_TYPE_IDS.includes(typeId)) return;
      const session = typeId.endsWith('_pm') ? 'PM' : 'AM';
      const base = typeId.replace('_pm', '');

      const start = parseDate(date);
      start.setHours(session === 'AM' ? 9 : 19, 0, 0, 0);
      if (now.getTime() <= start.getTime()) return; // 還沒開打
      if (cancelledSet.has(`${date}_${session}`)) return; // 因雨/其他原因取消

      const cap = capacityMap(settingByDate[date], date)[typeId];
      const sorted = items.slice().sort((a, b) => (new Date(a.created_at) - new Date(b.created_at)) || (a.id - b.id));
      const { main } = splitStrict(sorted, cap);

      main.forEach(p => {
        if (p.review_status === 'pending' || p.arrived) return;
        const personKey = p.line_user_id || ('name:' + p.name);
        let personStart = baseline;
        const o = ovrMap.get(personKey);
        if (o && o > personStart) personStart = o;
        if (new Date(p.created_at) < personStart) return;

        countMap.set(personKey, (countMap.get(personKey) || 0) + 1);
        if (!infoMap.has(personKey)) infoMap.set(personKey, { name: p.name, line_user_id: p.line_user_id || null, categories: new Set(), dates: [] });
        const info = infoMap.get(personKey);
        info.categories.add(BASE_LABEL[base]);
        info.dates.push(date + (session === 'AM' ? '_AM' : ''));
      });
    });

    const entries = Array.from(countMap.entries()).map(([key, count]) => {
      const info = infoMap.get(key);
      const cats = Array.from(info.categories);
      const firstBase = BASES.find(b => BASE_LABEL[b] === cats[0]);
      return {
        key, name: info.name, line_user_id: info.line_user_id,
        siteLabel: firstBase ? BASE_GROUP[firstBase] : '',
        absentCount: count, categories: cats, dates: info.dates.sort()
      };
    }).sort((a, b) => b.absentCount - a.absentCount);
    setAbsenceSummary(entries);

    // 同步把次數寫回 pickleball_blacklists.no_show_count，讓前台登入時的「未報到提醒」跟後台統計一致
    try {
      const { data: bl } = await supabase.from('pickleball_blacklists').select('id, line_user_id, no_show_count');
      const existingByLine = new Map();
      (bl || []).forEach(r => { if (r.line_user_id) existingByLine.set(r.line_user_id, r); });
      const computedLineIds = new Set();
      for (const e of entries) {
        if (!e.line_user_id) continue;
        computedLineIds.add(e.line_user_id);
        const ex = existingByLine.get(e.line_user_id);
        if (!ex || (ex.no_show_count || 0) !== e.absentCount) {
          await supabase.from('pickleball_blacklists').upsert({ name: e.name, line_user_id: e.line_user_id, no_show_count: e.absentCount }, { onConflict: 'line_user_id' });
        }
      }
      for (const r of (bl || [])) {
        if (r.line_user_id && !computedLineIds.has(r.line_user_id) && (r.no_show_count || 0) > 0) {
          await supabase.from('pickleball_blacklists').update({ no_show_count: 0 }).eq('id', r.id);
        }
      }
    } catch (err) {}
  };

  const handleGlobalAbsenceReset = async () => {
    const today = new Date().toLocaleDateString('zh-TW');
    if (!confirm(`確定要一鍵重置「所有人」的未到場次數嗎？\n\n重置後，${today} 之前的未到場紀錄將不會再被計算，所有人等同從今天重新歸零計算。此操作無法復原。`)) return;
    const { error } = await supabase.from('absence_global_reset').upsert({ id: 1, reset_at: new Date().toISOString() });
    if (error) { alert(`重置失敗：${error.message}`); return; }
    alert('✅ 已重置全部人的未到場次數！');
    fetchAbsenceSummary();
  };

  // ───────── 停權黑名單 ─────────
  const fetchBlacklists = async () => {
    const { data } = await supabase.from('pickleball_blacklists').select('*').not('blocked_until', 'is', null).order('blocked_until', { ascending: false });
    setBlacklists(data || []);
  };
  const blockUntilStr = () => {
    const t = new Date();
    t.setDate(t.getDate() + 30);
    return t.toISOString().split('T')[0];
  };
  const writeBlock = async (name, lineUserId) => {
    const until = blockUntilStr();
    let res;
    if (lineUserId) {
      res = await supabase.from('pickleball_blacklists').upsert({ name, line_user_id: lineUserId, blocked_until: until }, { onConflict: 'line_user_id' });
    } else {
      res = await supabase.from('pickleball_blacklists').upsert({ name, blocked_until: until }, { onConflict: 'name' });
    }
    return { until, error: res.error };
  };
  const handleAddBlacklist = async (e) => {
    e.preventDefault();
    const nameToBlock = blockNameInput.trim();
    if (!nameToBlock) return;
    // 前台是用 LINE 帳號擋人，所以要先用這個名字找出對應的 LINE 帳號
    const { data: found } = await supabase
      .from('pickleball_registrations')
      .select('line_user_id')
      .eq('name', nameToBlock)
      .not('line_user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    const lineUserId = found && found[0] ? found[0].line_user_id : null;
    if (!lineUserId) {
      alert(`找不到「${nameToBlock}」對應的 LINE 帳號（需要曾經用這個暱稱報名過），無法停權。請確認暱稱是否打對。`);
      return;
    }
    const { until, error } = await writeBlock(nameToBlock, lineUserId);
    if (error) { alert(`停權失敗：${error.message}`); return; }
    alert(`已將「${nameToBlock}」列入停權名單（至 ${until} 止）！`);
    setBlockNameInput('');
    fetchBlacklists();
  };
  const handleManualBlockFromAbsence = async (a) => {
    if (!confirm(`確定要將「${a.name}」（已累積 ${a.absentCount} 次未到場）立即停權 30 天嗎？`)) return;
    const { until, error } = await writeBlock(a.name, a.line_user_id);
    if (error) { alert(`停權失敗：${error.message}`); return; }
    alert(`已將「${a.name}」立即停權（至 ${until} 止）！`);
    fetchBlacklists();
    fetchAbsenceSummary();
  };
  const handleRemoveBlacklist = async (b) => {
    if (!confirm(`確定要解除「${b.name}」的停權？`)) return;
    const { error } = await supabase.from('pickleball_blacklists').update({ blocked_until: null }).eq('id', b.id);
    if (error) { alert(`解除失敗：${error.message}`); return; }
    // 寫入豁免時間：從這個時間點開始重新計算未到場次數
    const overrideKey = b.line_user_id || ('name:' + (b.name || '').trim());
    await supabase.from('absence_overrides').upsert(
      { override_key: overrideKey, name: (b.name || '').trim(), overridden_at: new Date().toISOString() },
      { onConflict: 'override_key' }
    );
    fetchBlacklists();
    fetchAbsenceSummary();
  };

  // ───────── 名單操作 ─────────
  const togglePresence = async (p) => {
    const next = !p.arrived;
    setDayRegs(prev => prev.map(r => (r.id === p.id ? { ...r, arrived: next } : r)));
    const { error } = await supabase.from('pickleball_registrations').update({ arrived: next }).eq('id', p.id);
    if (error) { alert(`更新到場狀態失敗：${error.message}`); loadDay(); } else { fetchAbsenceSummary(); }
  };
  const deleteParticipant = async (p) => {
    if (!confirm(`幹部權限：確定要刪除「${p.name}」的報名？`)) return;
    await supabase.from('pickleball_registrations').delete().eq('id', p.id);
    loadDay();
    fetchAbsenceSummary();
  };

  // ───────── 名單 / 財務計算 ─────────
  const rosterSession = isTeamPracticeDay ? null : selectedSession;
  const zoneData = BASES.map(base => {
    const typeId = typeIdFor(base, rosterSession);
    const items = dayRegs.filter(r => r.session_id === `${selectedDate}_${typeId}`);
    const { main } = splitStrict(items, capacities[typeId] ?? 0);
    const withStatus = items.map(it => ({ ...it, isConfirmed: main.includes(it), base, typeId }));
    const confirmedCount = main.reduce((s, it) => s + (Number(it.count) || 0), 0);
    return { base, typeId, withStatus, confirmedCount };
  });
  const allStatus = zoneData.flatMap(z => z.withStatus);
  const grandConfirmedCount = zoneData.reduce((s, z) => s + z.confirmedCount, 0);
  const filteredParticipants = allStatus.filter(p => adminCategoryFilter === 'ALL' || p.base === adminCategoryFilter);

  // 整天（早上+晚上）的報名費收入；因雨取消的場次不計
  let totalExpectedIncome = 0;
  let totalActualRegistrationIncome = 0;
  ALL_TYPE_IDS.forEach(typeId => {
    const base = typeId.replace('_pm', '');
    const sess = typeId.endsWith('_pm') ? 'PM' : 'AM';
    if (cancelled[sess]) return;
    const items = dayRegs.filter(r => r.session_id === `${selectedDate}_${typeId}`);
    const { main } = splitStrict(items, capacities[typeId] ?? 0);
    const ok = main.filter(it => it.review_status !== 'pending');
    totalExpectedIncome += ok.reduce((s, it) => s + (Number(it.count) || 0), 0) * PRICE[base];
    totalActualRegistrationIncome += ok.filter(it => it.arrived).reduce((s, it) => s + (Number(it.count) || 0), 0) * PRICE[base];
  });
  const extraIncomeTotal = financialRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const extraExpenseTotal = financialRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const totalActualIncome = totalActualRegistrationIncome + extraIncomeTotal;
  // 場地費整天共用一筆：當天所有場次都取消才歸零
  const daySessions = isTeamPracticeDay ? [] : (selectedDate && dowOf(selectedDate) === 6 ? ['AM', 'PM'] : ['PM']);
  const allCancelledToday = daySessions.length > 0 && daySessions.every(s => cancelled[s]);
  const effectiveVenueFee = allCancelledToday ? 0 : venueFeeInput;
  const totalDayExpense = effectiveVenueFee + extraExpenseTotal;
  const netProfit = totalActualIncome - totalDayExpense;
  const isCurrentSessionCancelled = (selectedSession === 'AM' || selectedSession === 'PM') && cancelled[selectedSession];

  const copyLineFormat = () => {
    const statusLabel = (p) => (p.review_status === 'pending' ? '⏳審核中' : p.isConfirmed ? '正取' : '備取');
    let text = `🏸 【七賢匹克球全區名單 - ${selectedDateLabel}】\n`;
    zoneData.forEach(z => {
      text += `\n▶ ${BASE_LABEL[z.base]} (上限 ${capacities[z.typeId] ?? 0}人)：\n`;
      z.withStatus.forEach((p, idx) => {
        text += `${idx + 1}. ${p.name} (${p.count}位) - ${statusLabel(p)} ${p.arrived ? '✅已到' : ''}\n`;
      });
    });
    navigator.clipboard.writeText(text.trim());
    alert('已複製全區 LINE 名單（不含金額）至剪貼簿！');
  };

  const checkInUrl = `${originUrl}/?mode=checkin`;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(checkInUrl)}`;

  // ───────── 月報表匯出 ─────────
  const handleExportMonthlyReport = async () => {
    if (!selectedMonth) return;
    const regs = await fetchAllRows(() =>
      supabase.from('pickleball_registrations')
        .select('id, name, count, session_id, arrived, review_status, created_at')
        .like('session_id', `${selectedMonth}/%`)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
    );
    const { data: finAll } = await supabase.from('financial_records').select('*').like('date_key', `${selectedMonth}/%`);
    const { data: settingRows } = await supabase.from('event_settings').select('*').like('date_key', `${selectedMonth}/%`);
    const { data: cancelledRows } = await supabase.from('event_status').select('date_key').eq('is_cancelled', true);
    const cancelledSet = new Set((cancelledRows || []).map(c => c.date_key));
    const settingByDate = {};
    (settingRows || []).forEach(r => { settingByDate[r.date_key] = r; });

    const allDates = Array.from(new Set([
      ...regs.map(r => r.session_id.split('_')[0]),
      ...(finAll || []).map(r => r.date_key)
    ])).sort();
    if (allDates.length === 0) { alert(`【${selectedMonth}】月份目前尚無任何活動與財務紀錄！`); return; }

    const label = (d) => `${d}(${DAY_NAMES[dowOf(d)]})`;
    const venueOf = (d) => {
      const row = settingByDate[d];
      return row && row.venue_fee !== undefined && row.venue_fee !== null ? row.venue_fee : defaultVenueFee(d);
    };
    const regDates = allDates.filter(d => dowOf(d) !== 2);
    const teamDates = allDates.filter(d => dowOf(d) === 2);

    let csv = '﻿';
    csv += `七賢匹克球【${selectedMonth}月】財務統計記帳報表\n\n`;

    let gReg = 0, gExtraIn = 0, gVenue = 0, gExtraOut = 0, gNet = 0;
    if (regDates.length > 0) {
      csv += '【打球日報名記帳】\n';
      csv += '日期,新手友善場正取(到場),新手體驗正取(到場),一般散打正取(到場),3.0以上球敘正取(到場),報名費實收,現場附加收入,場地費支出,現場附加支出,當日純益\n';
      regDates.forEach(d => {
        const cap = capacityMap(settingByDate[d], d);
        let regIncome = 0;
        const cells = [];
        BASES.forEach(base => {
          let confirmed = 0, present = 0;
          ['AM', 'PM'].forEach(sess => {
            const typeId = typeIdFor(base, sess);
            const items = regs.filter(r => r.session_id === `${d}_${typeId}`);
            const { main } = splitStrict(items, cap[typeId]);
            const ok = main.filter(it => it.review_status !== 'pending');
            const c = ok.reduce((s, it) => s + (Number(it.count) || 0), 0);
            const p = ok.filter(it => it.arrived).reduce((s, it) => s + (Number(it.count) || 0), 0);
            confirmed += c;
            present += p;
            if (!cancelledSet.has(`${d}_${sess}`)) regIncome += p * PRICE[base];
          });
          cells.push(`${confirmed}人(到場${present}人)`);
        });
        const dayFin = (finAll || []).filter(r => r.date_key === d);
        const extraIn = dayFin.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
        const extraOut = dayFin.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
        const sessionsOfDay = dowOf(d) === 6 ? ['AM', 'PM'] : ['PM'];
        const allCancelled = sessionsOfDay.every(s => cancelledSet.has(`${d}_${s}`));
        const venue = allCancelled ? 0 : venueOf(d);
        const profit = (regIncome + extraIn) - (venue + extraOut);
        gReg += regIncome; gExtraIn += extraIn; gVenue += venue; gExtraOut += extraOut; gNet += profit;
        csv += `${label(d)},${cells.join(',')},$${regIncome},$${extraIn},$${venue},$${extraOut},$${profit}\n`;
      });
      csv += '打球日小計,,,,,,,,,\n';
      csv += `總報名費實收: $${gReg},總附加收入: $${gExtraIn},總場地費支出: $${gVenue},總附加支出: $${gExtraOut},報名場次淨利: $${gNet}\n\n`;
    }

    if (teamDates.length > 0) {
      let tIn = 0, tVenue = 0, tOut = 0, tNet = 0;
      csv += '【球隊經費（週二練習，獨立記帳）】\n';
      csv += '日期,現場收入,場地費支出,其他支出,當日純益\n';
      teamDates.forEach(d => {
        const dayFin = (finAll || []).filter(r => r.date_key === d);
        const income = dayFin.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
        const out = dayFin.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
        const venue = venueOf(d);
        const profit = income - (venue + out);
        tIn += income; tVenue += venue; tOut += out; tNet += profit;
        csv += `${label(d)},$${income},$${venue},$${out},$${profit}\n`;
      });
      csv += '球隊經費小計,,,,\n';
      csv += `總收入: $${tIn},總場地費支出: $${tVenue},總其他支出: $${tOut},球隊淨利: $${tNet}\n\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `七賢匹克球_${selectedMonth.replace('/', '-')}_記帳報表.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ───────── 畫面 ─────────
  if (!authChecked) {
    return <main className="min-h-screen bg-slate-100 p-6 text-center font-bold">載入中…</main>;
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#83c5c5] flex items-center justify-center p-6 font-sans">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full space-y-4">
          <h1 className="text-2xl font-black text-[#1a4d4d] text-center">👑 七賢匹克球幹部控制台</h1>
          <input
            type="email"
            placeholder="管理員帳號 (Email)"
            value={loginEmail}
            onChange={e => setLoginEmail(e.target.value)}
            className="w-full bg-[#83c5c5]/20 p-4 rounded-xl border border-[#83c5c5]/50 font-bold text-center text-lg focus:outline-none focus:ring-2 focus:ring-[#1a4d4d]/30"
          />
          <input
            type="password"
            placeholder="密碼"
            value={loginPassword}
            onChange={e => setLoginPassword(e.target.value)}
            className="w-full bg-[#83c5c5]/20 p-4 rounded-xl border border-[#83c5c5]/50 font-bold text-center text-lg focus:outline-none focus:ring-2 focus:ring-[#1a4d4d]/30"
          />
          <button className="w-full bg-[#1a4d4d] text-white py-3 rounded-xl font-bold text-lg hover:bg-[#123838]">登入控制台</button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-slate-800" style={{ zoom: 1.4 }}>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* 頂部控制區 */}
        <div className="bg-white p-6 rounded-3xl shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#1a4d4d]">👑 七賢匹克球幹部控制台</h1>

            <div className="flex flex-wrap items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold text-sm">選擇單日場次：</span>
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="bg-slate-100 border p-2 rounded-xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d4d]"
                >
                  {dateOptions.map(d => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* 📊 月份選擇與匯出報表 */}
              <div className="flex items-center gap-2 bg-emerald-50 p-1.5 rounded-xl border border-emerald-200">
                <span className="text-emerald-900 font-bold text-xs pl-1">月份報表：</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-white border p-1.5 rounded-lg font-bold text-emerald-900 text-xs focus:outline-none"
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m} 月</option>
                  ))}
                </select>
                <button
                  onClick={handleExportMonthlyReport}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors"
                >
                  📊 匯出月記帳報表
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowQRModal(true)}
              className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm flex items-center gap-2"
            >
              📱 現場報到 QR Code
            </button>
            <button onClick={copyLineFormat} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm">
              📋 複製全區 LINE 名單
            </button>
            <button onClick={handleLogout} className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-4 py-2.5 rounded-xl font-bold transition-colors">
              登出
            </button>
          </div>
        </div>

        {/* 🔑 每週分區密碼 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4 border-2 border-indigo-100">
          <h2 className="text-xl font-black text-indigo-900 flex items-center gap-2">
            🔑 每週分區密碼（{weekKey} 這一週）
          </h2>
          <div className="text-xs font-bold text-slate-500">一組密碼對整週有效：週一、週四、週五、週六都用同一組。切換上方的場次日期就能設定其他週。</div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">🌱 新手區密碼（新手友善場／新手體驗）</label>
              <input
                value={pwNewbie}
                onChange={e => setPwNewbie(e.target.value)}
                placeholder="尚未設定"
                className="w-full bg-slate-50 border p-3 rounded-xl font-black text-lg outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">🔥 散打區密碼（一般散打／3.0以上 球敘）</label>
              <input
                value={pwOpenplay}
                onChange={e => setPwOpenplay(e.target.value)}
                placeholder="尚未設定"
                className="w-full bg-slate-50 border p-3 rounded-xl font-black text-lg outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>
          <button onClick={handleSavePasswords} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-2xl text-base transition-colors shadow-md">
            儲存這一週的密碼
          </button>
        </div>

        {/* ⏳ 報名審核區（首次報名的新面孔） */}
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4 border-2 border-amber-200">
          <h2 className="text-xl font-black text-amber-900 flex items-center gap-2">
            ⏳ 報名審核 (待審核 {pendingList.length} 筆)
          </h2>

          {pendingList.length === 0 ? (
            <div className="text-center py-6 text-slate-400 font-bold text-sm">
              目前沒有待審核的新面孔報名
            </div>
          ) : (
            <div className="space-y-3">
              {pendingList.map((p) => {
                const idx = (p.session_id || '').indexOf('_');
                const pDate = idx >= 0 ? p.session_id.slice(0, idx) : p.session_id;
                const pType = idx >= 0 ? p.session_id.slice(idx + 1) : '';
                const pBase = pType.replace('_pm', '');
                return (
                  <div
                    key={`pending-${p.id}`}
                    className="flex flex-col sm:flex-row justify-between items-center p-4 rounded-2xl border border-amber-200 bg-amber-50 gap-3"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="px-3 py-1 rounded-lg text-sm font-bold bg-amber-200 text-amber-900">首次報名</span>
                      <span className="font-bold text-xl text-slate-800">{p.name}</span>
                      <span className="text-slate-600 font-bold text-sm">
                        ({BASE_ICON[pBase] || ''} {BASE_LABEL[pBase] || pType}{pType.endsWith('_pm') ? '(晚上)' : ''} - {p.count}位 - {pDate} 週{pDate ? DAY_NAMES[dowOf(pDate)] : ''})
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveParticipant(p)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm"
                      >
                        ✅ 核准
                      </button>
                      <button
                        onClick={() => handleRejectParticipant(p)}
                        className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-4 py-2 rounded-xl font-bold text-sm"
                      >
                        ❌ 拒絕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ⚙️ 人數設置與場地費區（週二球隊練習日簡化顯示） */}
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4 border-2 border-sky-100">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-xl font-black text-sky-900 flex items-center gap-2">
              {isTeamPracticeDay
                ? `🏐 【${selectedDateLabel}】球隊練習場地費設定`
                : `⚙️ 設定 【${selectedDateLabel}】 各區人數設置`}
            </h2>
            {!isTeamPracticeDay && (
              <button
                type="button"
                onClick={handleToggleCancel}
                className={`px-4 py-2 rounded-xl text-sm font-black border ${isCurrentSessionCancelled ? 'bg-red-600 text-white border-red-700' : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'}`}
              >
                {isCurrentSessionCancelled ? '⛈️ 本場次取消中（點擊恢復正常）' : '🟢 本場次正常（點擊設為因雨/其他原因取消）'}
              </button>
            )}
          </div>

          {/* 因雨取消狀態提示 */}
          {(cancelled.AM || cancelled.PM) && (
            <div className="flex flex-wrap gap-2">
              {cancelled.AM && (
                <span className="bg-red-100 text-red-700 border border-red-300 px-3 py-1.5 rounded-xl text-xs font-black">
                  ⛈️ 早上場已取消（報名費收入不計入）
                </span>
              )}
              {cancelled.PM && (
                <span className="bg-red-100 text-red-700 border border-red-300 px-3 py-1.5 rounded-xl text-xs font-black">
                  ⛈️ 晚上場已取消（報名費收入不計入）
                </span>
              )}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="flex flex-wrap items-center gap-4">
            {!isTeamPracticeDay && BASES.map(b => (
              <div key={b} className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="text-sm font-bold text-slate-700">{BASE_ICON[b]} {BASE_LABEL[b]}：</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={capInputs[b]}
                  onChange={e => setCapInputs({ ...capInputs, [b]: parseInt(e.target.value) || 0 })}
                  className="bg-white border p-2 rounded-xl font-black text-slate-800 w-16 text-center text-lg"
                />
                <span className="text-sm font-bold text-slate-500">人</span>
              </div>
            ))}

            {/* 🔒 密碼防護場地費設定 */}
            {showVenueFeeInput ? (
              <div className="flex items-center gap-2 bg-rose-50 p-3 rounded-2xl border border-rose-200">
                <label className="text-sm font-bold text-rose-800">🏟️ 場地費：</label>
                <span className="text-slate-500 font-bold">$</span>
                <input
                  type="number"
                  min={0}
                  value={venueFeeInput}
                  onChange={e => setVenueFeeInput(parseInt(e.target.value) || 0)}
                  className="bg-white border p-2 rounded-xl font-black text-rose-700 w-24 text-center text-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowVenueFeeInput(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 underline ml-1"
                >
                  隱藏
                </button>
                {allCancelledToday && (
                  <span className="text-[10px] font-bold text-red-500 ml-1">
                    ⛈️ 因雨取消中，實際計算已歸零（此數字為取消後自動恢復用的原始值）
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleOpenVenueFee}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-3 rounded-2xl text-sm transition-colors border border-slate-300"
              >
                🔒 解鎖修改場地費金額
              </button>
            )}

            <button className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-6 py-3 rounded-2xl text-base transition-colors shadow-md shrink-0 ml-auto">
              儲存此場次設定
            </button>
          </form>
        </div>

        {/* 💵 現場收支記帳與結算區 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-6 border-2 border-emerald-100">
          <h2 className="text-xl font-black text-emerald-900 flex items-center gap-2">
            🧾 {isTeamPracticeDay ? '球隊練習' : '現場'}收支記帳與結算 ({selectedDate}{!isTeamPracticeDay && selectedDate && dowOf(selectedDate) === 6 ? '，早上＋晚上合計' : ''})
          </h2>

          <form onSubmit={handleAddFinancialRecord} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap gap-3 items-center">
            <select
              value={finType}
              onChange={e => {
                const t = e.target.value;
                setFinType(t);
                setFinCategory(t === 'income' ? '租拍' : '其他支出');
              }}
              className="p-3 border rounded-xl font-bold bg-white"
            >
              <option value="income">➕ 增加收入</option>
              <option value="expense">➖ 增加支出</option>
            </select>

            <select
              value={finCategory}
              onChange={e => setFinCategory(e.target.value)}
              className="p-3 border rounded-xl font-bold bg-white"
            >
              {finType === 'income' ? (
                <>
                  <option value="租拍">🏸 租拍</option>
                  <option value="配件收入">🛍️ 配件收入</option>
                  <option value="報名費">🎟️ 報名費(現場)</option>
                </>
              ) : (
                <>
                  <option value="其他支出">📦 其他支出</option>
                  <option value="場地費">🏟️ 加租場地費</option>
                </>
              )}
            </select>

            <div className="flex items-center gap-1 bg-white border p-2 rounded-xl">
              <span className="font-bold text-slate-400">$</span>
              <input
                type="number"
                placeholder="金額"
                required
                value={finAmount}
                onChange={e => setFinAmount(e.target.value)}
                className="w-24 font-bold text-lg outline-none"
              />
            </div>

            <input
              type="text"
              placeholder="備註 (例如：小明租拍、賣球拍/握把布)"
              value={finNote}
              onChange={e => setFinNote(e.target.value)}
              className="flex-1 min-w-[180px] bg-white border p-3 rounded-xl font-bold text-sm outline-none"
            />

            <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-xl text-sm transition-colors shadow-sm">
              新增記帳
            </button>
          </form>

          {financialRecords.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <span className="text-xs font-bold text-slate-400 uppercase">當日現場附加明細：</span>
              <div className="grid md:grid-cols-2 gap-3">
                {financialRecords.map((r) => (
                  <div key={r.id} className="bg-white p-3 rounded-xl border flex justify-between items-center shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${r.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {r.category}
                      </span>
                      <span className="font-bold text-slate-800">${r.amount}</span>
                      {r.note && <span className="text-xs text-slate-500 font-medium">({r.note})</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteFinancialRecord(r.id)}
                      className="text-xs font-bold text-slate-400 hover:text-rose-600 underline"
                    >
                      刪除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 💰 費用結算 */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 text-center">
            <span className="text-xs font-bold text-slate-400 uppercase">預計報名費收入</span>
            <div className="text-3xl font-black text-[#1a4d4d] mt-1">${totalExpectedIncome}</div>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 text-center">
            <span className="text-xs font-bold text-slate-400 uppercase">總實收 (已到場+租賣)</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">${totalActualIncome}</div>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 text-center">
            <span className="text-xs font-bold text-slate-400 uppercase">總支出 (場租+其他)</span>
            <div className="text-3xl font-black text-rose-600 mt-1">${totalDayExpense}</div>
            {allCancelledToday && (
              <div className="text-[10px] font-bold text-red-500 mt-1">⛈️ 因雨取消，場地費已歸零</div>
            )}
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-emerald-300 text-center bg-emerald-50/30">
            <span className="text-xs font-bold text-emerald-800 uppercase">當日純益</span>
            <div className={`text-3xl font-black mt-1 ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              ${netProfit}
            </div>
          </div>
        </div>

        {/* 📋 缺席名單（未到場次數統計）— 依分類點擊展開 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4 border-2 border-amber-100">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-xl font-black text-amber-900 flex items-center gap-2">
              📋 缺席名單（近 30 天未到場次數統計）
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400">累積達 2 次僅列為關注名單，需幹部手動點擊才會停權</span>
              <button
                onClick={handleGlobalAbsenceReset}
                className="text-xs font-bold text-white bg-slate-600 hover:bg-slate-700 px-3 py-1.5 rounded-lg"
              >
                🔄 一鍵重置全部未到場紀錄
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {BASES.map((base) => {
              const categoryName = BASE_LABEL[base];
              const entriesInCategory = absenceSummary.filter(a => a.categories.includes(categoryName));
              const isExpanded = expandedAbsenceCategory === categoryName;
              const flaggedCount = entriesInCategory.filter(a => a.absentCount >= 2).length;

              return (
                <div key={categoryName} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setExpandedAbsenceCategory(isExpanded ? null : categoryName)}
                    className="w-full flex justify-between items-center px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <span className="font-black text-lg text-slate-800 flex items-center gap-2">
                      {BASE_ICON[base]}
                      {categoryName}
                      <span className="text-sm font-bold text-slate-400">（{entriesInCategory.length} 人有紀錄{flaggedCount > 0 ? `，${flaggedCount} 人已達門檻` : ''}）</span>
                    </span>
                    <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-white space-y-3">
                      {entriesInCategory.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 font-bold text-sm">
                          目前沒有人有未到場紀錄
                        </div>
                      ) : (
                        <div className="grid md:grid-cols-2 gap-3">
                          {entriesInCategory.map((a) => {
                            const remaining = Math.max(0, 2 - a.absentCount);
                            // 比對 blocked_until，過期的停權不顯示「已停權中」
                            const todayStart = new Date();
                            todayStart.setHours(0, 0, 0, 0);
                            const alreadyBlocked = blacklists.some(b => {
                              const same = a.line_user_id ? b.line_user_id === a.line_user_id : (b.name || '').trim() === a.name;
                              if (!same) return false;
                              if (!b.blocked_until) return true;
                              return new Date(b.blocked_until) >= todayStart;
                            });
                            const dateKey = `${categoryName}-${a.key}`;
                            const isDatesShown = expandedAbsenceDates.has(dateKey);
                            const toggleDates = () => {
                              setExpandedAbsenceDates(prev => {
                                const next = new Set(prev);
                                if (next.has(dateKey)) next.delete(dateKey);
                                else next.add(dateKey);
                                return next;
                              });
                            };
                            return (
                              <div
                                key={dateKey}
                                className={`p-4 rounded-2xl border flex justify-between items-center gap-3 ${
                                  a.absentCount >= 2 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
                                }`}
                              >
                                <div className="flex items-center gap-3 flex-wrap cursor-pointer" onClick={toggleDates}>
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-200 text-slate-700">
                                    {a.siteLabel}
                                  </span>
                                  <div>
                                    <span className="font-black text-lg text-slate-800">{a.name}</span>
                                    <span className="text-xs font-bold text-slate-400 ml-1">{isDatesShown ? '▲ 收合日期' : '▼ 查看日期'}</span>
                                    {isDatesShown && (
                                      <div className="text-xs font-bold text-slate-400 mt-0.5">
                                        {a.dates.map(formatAbsenceDate).join('、')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className={`font-black text-xl ${a.absentCount >= 2 ? 'text-rose-600' : 'text-amber-700'}`}>
                                      {a.absentCount} 次未到場
                                    </div>
                                    <div className="text-xs font-bold text-slate-400">
                                      {a.absentCount >= 2 ? '已達關注門檻，可手動停權' : `再 ${remaining} 次將達關注門檻`}
                                    </div>
                                  </div>
                                  {a.absentCount >= 2 && (
                                    alreadyBlocked ? (
                                      <span className="text-xs font-bold text-rose-500 bg-rose-100 px-3 py-1.5 rounded-lg shrink-0">
                                        已停權中
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => handleManualBlockFromAbsence(a)}
                                        className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg shrink-0"
                                      >
                                        🚫 立即停權
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ⛔ 停權黑名單管理區 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4 border-2 border-rose-100">
          <h2 className="text-xl font-black text-rose-900 flex items-center gap-2">
            ⛔ 停權黑名單管理
          </h2>

          <form onSubmit={handleAddBlacklist} className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="輸入要停權的球友暱稱 (需曾報名過)"
              value={blockNameInput}
              onChange={e => setBlockNameInput(e.target.value)}
              className="bg-slate-50 border p-3 rounded-xl font-bold text-slate-800 flex-1 max-w-sm outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-3 rounded-xl text-sm transition-colors shadow-sm">
              停權 30 天
            </button>
          </form>

          {blacklists.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <span className="text-xs font-bold text-slate-400 uppercase">停權名單（含已到期紀錄）：</span>
              <div className="grid md:grid-cols-2 gap-3">
                {blacklists.map((b) => {
                  const todayStart = new Date();
                  todayStart.setHours(0, 0, 0, 0);
                  const isExpired = b.blocked_until && new Date(b.blocked_until) < todayStart;
                  return (
                    <div key={b.id} className={`p-3 rounded-xl border flex justify-between items-center ${isExpired ? 'bg-slate-50/50 border-slate-200 opacity-60' : 'bg-slate-50 border-rose-200'}`}>
                      <div>
                        <span className="font-black text-slate-800 mr-2">{b.name}</span>
                        <span className={`text-xs font-bold ${isExpired ? 'text-slate-400' : 'text-rose-600'}`}>
                          {isExpired ? `已到期（原停權至 ${b.blocked_until}，球友已可報名）` : `停權至 ${b.blocked_until}`}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveBlacklist(b)}
                        className="text-xs font-bold bg-white text-slate-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg border shadow-xs"
                      >
                        {isExpired ? '🗑️ 清除紀錄' : '🔓 解除停權'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 📱 QR Code Modal 視窗 */}
        {showQRModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-5">
              <h2 className="text-2xl font-black text-[#1a4d4d]">📱 現場掃描報到</h2>
              <p className="text-slate-500 font-bold text-sm">球友掃描後，會進入自助報到頁（自動帶入今天的場次）</p>

              <div className="flex justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <img src={qrCodeImageUrl} alt="報到 QR Code" className="w-56 h-56" />
              </div>

              <p className="text-xs text-slate-400 font-medium">請球友拿出手機相機或 LINE 掃描 QR Code 進行驗證報到</p>

              <button
                onClick={() => setShowQRModal(false)}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl"
              >
                關閉視窗
              </button>
            </div>
          </div>
        )}

        {/* 📋 全區名單管理（4 頁籤，按鈕顯示正取人數）— 週二球隊練習日不顯示 */}
        {!isTeamPracticeDay && (
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <h2 className="text-2xl font-black text-[#1a4d4d]">全區名單管理 ({selectedDateLabel})</h2>

            {/* 分區篩選頁籤 */}
            <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
              <button
                onClick={() => setAdminCategoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl font-black text-xs sm:text-sm transition-all ${
                  adminCategoryFilter === 'ALL' ? 'bg-[#1a4d4d] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                全部 ({grandConfirmedCount})
              </button>
              {zoneData.map(z => (
                <button
                  key={z.base}
                  onClick={() => setAdminCategoryFilter(z.base)}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs sm:text-sm transition-all ${
                    adminCategoryFilter === z.base ? 'bg-[#1a4d4d] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {BASE_ICON[z.base]} {BASE_LABEL[z.base]} ({z.confirmedCount})
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredParticipants.map((p) => (
              <div
                key={`reg-${p.id}`}
                className={`flex flex-col sm:flex-row justify-between items-center p-4 rounded-2xl border gap-3 ${
                  p.review_status === 'pending'
                    ? 'bg-amber-50/60 border-amber-200 border-dashed'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                    p.review_status === 'pending'
                      ? 'bg-amber-200 text-amber-900'
                      : p.isConfirmed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {p.review_status === 'pending' ? '⏳ 審核中' : p.isConfirmed ? '正取' : '備取'}
                  </span>
                  <span className="font-bold text-xl text-slate-800">{p.name}</span>
                  <span className="text-slate-600 font-bold">
                    ({BASE_ICON[p.base]} {BASE_LABEL[p.base]} - {p.count}位)
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => togglePresence(p)}
                    className={`px-4 py-2 rounded-xl font-bold text-sm ${p.arrived ? 'bg-emerald-600 text-[#ffffff] font-extrabold shadow-sm' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {p.arrived ? '✅ 已到場 (點擊取消)' : '未到場 (點擊註記)'}
                  </button>
                  <button
                    onClick={() => deleteParticipant(p)}
                    className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-4 py-2 rounded-xl font-bold text-sm"
                  >
                    刪除
                  </button>
                </div>
              </div>
            ))}

            {filteredParticipants.length === 0 && (
              <div className="text-center py-12 text-slate-400 font-bold">
                {selectedDateLabel} 目前尚無該區域報名紀錄
              </div>
            )}
          </div>
        </div>
        )}

      </div>
    </main>
  );
}
