// 📄 檔案路徑：lib/satServer.js（新檔案，放在 lib 資料夾，跟 lineSession.ts 同一個資料夾）
// 🆕 報名／取消／改人數的「伺服器端」共用規則。伺服器在 UTC 時區，所以所有日期時間一律換算成台灣時間（UTC+8）。
import { createClient } from '@supabase/supabase-js';
import { verifySessionCookieValue, LINE_SESSION_COOKIE_NAME } from '@/lib/lineSession';

const SUPABASE_URL = 'https://zasiaeehzhsaqjxxiklu.supabase.co';
// 只在伺服器使用的 service role 金鑰，可以略過資料庫權限限制，絕對不能出現在前端
export const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || '');

export const TYPE_ORDER = ['experience', 'normal', 'openplay', 'advanced', 'experience_pm', 'normal_pm', 'openplay_pm', 'advanced_pm'];
export const TYPE_LABEL = {
  experience: '新手體驗', normal: '新手友善場', openplay: '一般散打', advanced: '3.0以上 球敘',
  experience_pm: '新手體驗(晚上)', normal_pm: '新手友善場(晚上)', openplay_pm: '一般散打(晚上)', advanced_pm: '3.0以上 球敘(晚上)'
};
export const PER_SUBMIT_MAX = 4;
// 各分區報名截止時間（HHMM）
export const CUTOFF = { experience: 830, normal: 830, openplay: 830, advanced: 830, experience_pm: 1830, normal_pm: 1830, openplay_pm: 1830, advanced_pm: 1830 };

const DEFAULT_CAPACITY = { experience: 9, normal: 8, openplay: 10, advanced: 10, experience_pm: 9, normal_pm: 9, openplay_pm: 9, advanced_pm: 10 };
const WEEKDAY_PM_DEFAULT_CAPACITY = { experience_pm: 0, normal_pm: 9, openplay_pm: 18, advanced_pm: 10 };

export function groupOfType(typeId) {
  const base = String(typeId).replace('_pm', '');
  return (base === 'normal' || base === 'experience') ? 'newbie' : 'openplay';
}

// ───── 台灣時間 ─────
// 回傳「台灣現在時間」的各欄位（用 UTC 取值，因為已經先加了 8 小時）
export function taipeiNow() {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay(), hh: t.getUTCHours(), mm: t.getUTCMinutes() };
}
const pad = n => String(n).padStart(2, '0');
function fmt(date) { return `${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}`; }
export function todayStr() { const n = taipeiNow(); return `${n.y}/${pad(n.m)}/${pad(n.d)}`; }
export function nowTimeValue() { const n = taipeiNow(); return n.hh * 100 + n.mm; }

// 目前開放報名的那個星期六（每週六 22:00 換週）
export function currentSaturdayStr() {
  const n = taipeiNow();
  const daysUntil = (6 - n.dow + 7) % 7;
  const isNext = n.dow === 6 && (n.hh * 60 + n.mm) >= 22 * 60;
  const base = new Date(Date.UTC(n.y, n.m - 1, n.d + daysUntil + (isNext ? 7 : 0)));
  return fmt(base);
}
// 週一(1)/四(4)/五(5) 當週的日期（週六 22:00 後或週日 → 下一週）
export function cycleDateStr(dow) {
  const n = taipeiNow();
  const isNext = (n.dow === 6 && n.hh >= 22) || n.dow === 0;
  const diffToMon = n.dow === 0 ? 6 : n.dow - 1;
  const base = new Date(Date.UTC(n.y, n.m - 1, n.d - diffToMon + (isNext ? 7 : 0) + (dow - 1)));
  return fmt(base);
}
export function dowOfDateStr(dateStr) {
  const [y, m, d] = String(dateStr).split('/').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
// 這個日期是不是目前開放報名的場次日期
export function isOpenDate(dateStr) {
  const dow = dowOfDateStr(dateStr);
  if (dow === 6) return dateStr === currentSaturdayStr();
  if (dow === 1 || dow === 4 || dow === 5) return dateStr === cycleDateStr(dow);
  return false;
}
// 週六場次：週三 22:00 起免密碼
export function isFreeWindow(dateStr) {
  if (dowOfDateStr(dateStr) !== 6) return false;
  const [y, m, d] = dateStr.split('/').map(Number);
  const n = taipeiNow();
  const nowMin = Date.UTC(n.y, n.m - 1, n.d, n.hh, n.mm) / 60000;
  const openMin = Date.UTC(y, m - 1, d - 3, 22, 0) / 60000;
  return nowMin >= openMin;
}

export function defaultCapacity(dateStr) {
  return dowOfDateStr(dateStr) === 6 ? DEFAULT_CAPACITY : { ...DEFAULT_CAPACITY, ...WEEKDAY_PM_DEFAULT_CAPACITY };
}

// ───── 登入身份 ─────
export function getSession(req) {
  return verifySessionCookieValue(req.cookies.get(LINE_SESSION_COOKIE_NAME)?.value);
}

export function fail(message, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}
