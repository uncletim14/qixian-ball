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

// ───── 人數上限 ─────
export async function getCapacity(dateKey, typeId) {
  const { data: settings } = await supabaseAdmin.from('event_settings').select('*').eq('date_key', dateKey).maybeSingle();
  return Number(settings?.[`${typeId}_max`] ?? defaultCapacity(dateKey)[typeId]);
}

// ───── 備取遞補通知 ─────
// 取得某個場次「目前正取的報名編號集合」（嚴格先來後到：一旦有人被擋到備取，後面的人一律備取）
export async function getMainIds(sessionId) {
  const dateKey = sessionId.slice(0, 10);
  const typeId = sessionId.slice(11);
  const max = await getCapacity(dateKey, typeId);
  const { data } = await supabaseAdmin
    .from('pickleball_registrations')
    .select('id, name, count, line_user_id, review_status, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  const main = [];
  let total = 0;
  let hitCapacity = false;
  for (const item of (data || [])) {
    const seats = Number(item.count) || 0;
    if (!hitCapacity && total + seats <= max) { main.push(item); total += seats; }
    else hitCapacity = true;
  }
  return main;
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
function describeSession(sessionId) {
  const dateKey = sessionId.slice(0, 10);
  const typeId = sessionId.slice(11);
  const label = (TYPE_LABEL[typeId] || typeId).replace('(晚上)', '');
  const period = dowOfDateStr(dateKey) === 6 ? (typeId.endsWith('_pm') ? '晚上場' : '早上場') : '';
  return `${dateKey.slice(5)}（週${WEEKDAY[dowOfDateStr(dateKey)]}）${period}${label}`;
}

// 發送一則 LINE 文字訊息給某位球友；對方沒加官方帳號好友就會失敗，這裡安靜略過，不影響主要功能
export async function pushLineText(lineUserId, text) {
  const token = process.env.LINE_MESSAGING_ACCESS_TOKEN;
  if (!token || !lineUserId) {
    console.log('[LINE push] skipped: token?', !!token, 'userId?', !!lineUserId);
    return false;
  }
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text }] })
    });
    if (!res.ok) console.log('[LINE push] failed', res.status, await res.text());
    else console.log('[LINE push] ok');
    return res.ok;
  } catch (e) {
    console.log('[LINE push] error', String(e));
    return false;
  }
}

// 比較「變動前」和「變動後」的正取名單：之前是備取、現在變正取的人（且已通過審核）→ 發 LINE 通知
export async function notifyPromotions(sessionId, mainBefore) {
  try {
    const mainAfter = await getMainIds(sessionId);
    const beforeIds = new Set((mainBefore || []).map(r => r.id));
    const promoted = mainAfter.filter(r => !beforeIds.has(r.id) && r.review_status !== 'pending' && r.line_user_id);
    console.log('[LINE push] session', sessionId, 'before', (mainBefore || []).length, 'after', mainAfter.length, 'promoted', promoted.length);
    for (const r of promoted) {
      await pushLineText(
        r.line_user_id,
        `🎉 備取成功！\n你報名的【${describeSession(sessionId)}】已遞補為正取（${r.count} 位），請準時出席！\n如果無法出席，請記得上網站取消，讓其他球友有機會。`
      );
    }
  } catch (e) {
    console.log('[LINE push] notifyPromotions error', String(e));
    // 通知失敗不影響取消／改人數本身
  }
}
