// 📄 檔案路徑：app/api/register/route.js（新檔案）
// 🆕 報名：由伺服器檢查「LINE 登入、每週密碼、停權、截止時間、人數上限」之後才寫入資料庫
import {
  supabaseAdmin, TYPE_ORDER, TYPE_LABEL, PER_SUBMIT_MAX, CUTOFF, groupOfType,
  todayStr, nowTimeValue, dowOfDateStr, isOpenDate, isFreeWindow, currentSaturdayStr,
  defaultCapacity, getSession, fail
} from '@/lib/satServer';

export async function POST(req) {
  const session = getSession(req);
  if (!session) return fail('🔒 請先使用 LINE 登入才能報名！', 401);

  let body;
  try { body = await req.json(); } catch { return fail('資料格式錯誤'); }
  const dateKey = String(body.dateKey || '');
  const typeId = String(body.typeId || '');
  const name = String(body.name || '').trim();
  const count = Number.parseInt(body.count, 10);
  const zonePassword = String(body.zonePassword || '');

  if (!TYPE_ORDER.includes(typeId)) return fail('場次類型錯誤');
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateKey)) return fail('日期格式錯誤');
  if (!name) return fail('請輸入要顯示在名單上的暱稱！');
  if (name.length > 30) return fail('暱稱太長了（最多 30 個字）');
  if (!Number.isInteger(count) || count < 1 || count > PER_SUBMIT_MAX) {
    return fail(`🚫 ${TYPE_LABEL[typeId]} 單筆報名最多 ${PER_SUBMIT_MAX} 位球友喔！`);
  }

  // 場次日期必須是目前開放的；週一/四/五只有晚上場
  if (!isOpenDate(dateKey)) return fail('🚫 這個日期目前不開放報名！');
  const dow = dowOfDateStr(dateKey);
  if (dow !== 6 && !typeId.endsWith('_pm')) return fail('場次類型錯誤');
  if (dateKey < todayStr()) return fail('🚫 本場次已結束，無法報名！');

  // 截止時間
  if (dateKey === todayStr() && nowTimeValue() >= CUTOFF[typeId]) {
    const c = CUTOFF[typeId];
    return fail(`🚫 抱歉！今天的【${TYPE_LABEL[typeId]}】報名已於 ${Math.floor(c / 100)}:${String(c % 100).padStart(2, '0')} 截止囉！`);
  }

  // 因雨取消
  const sessionKey = typeId.endsWith('_pm') ? 'PM' : 'AM';
  const { data: statusRow } = await supabaseAdmin.from('event_status').select('is_cancelled').eq('date_key', `${dateKey}_${sessionKey}`).maybeSingle();
  if (statusRow?.is_cancelled) return fail(`⛈️ 本場次（${sessionKey === 'AM' ? '早上場' : '晚上場'}）因雨取消或其他原因取消，暫停報名！`);

  // 人數上限 = 0 代表未開放
  const { data: settings } = await supabaseAdmin.from('event_settings').select('*').eq('date_key', dateKey).maybeSingle();
  const cap = settings?.[`${typeId}_max`] ?? defaultCapacity(dateKey)[typeId];
  if (Number(cap) === 0) return fail(`⚠️ 本場次【${TYPE_LABEL[typeId]}】暫未開放報名！`);

  // 每週分區密碼（週六週三 22:00 起免密碼）
  if (!isFreeWindow(dateKey)) {
    const weekKey = currentSaturdayStr();
    const { data: pwOk, error: pwErr } = await supabaseAdmin.rpc('check_zone_password', {
      p_week: weekKey, p_group: groupOfType(typeId), p_password: zonePassword
    });
    if (pwErr || !pwOk) return fail('🔒 本週分區密碼驗證失敗，請回到上一頁重新輸入密碼！', 403);
  }

  // 停權
  const { data: block } = await supabaseAdmin.from('pickleball_blacklists').select('blocked_until').eq('line_user_id', session.lineUserId).maybeSingle();
  if (block?.blocked_until) {
    const until = String(block.blocked_until).slice(0, 10).replace(/-/g, '/');
    if (until >= todayStr()) return fail(`🚫 您的帳號目前處於停權狀態（至 ${block.blocked_until} 止），無法報名！如有疑問請洽幹部。`, 403);
  }

  // 重複報名
  const sessionId = `${dateKey}_${typeId}`;
  const { data: dup } = await supabaseAdmin.from('pickleball_registrations').select('id').eq('session_id', sessionId).eq('line_user_id', session.lineUserId).limit(1);
  if (dup && dup.length > 0) return fail(`❌ 您（${name}）已經報名過本場次囉！`);

  // 是否已通過首次審核
  let approved = false;
  const { data: byLine } = await supabaseAdmin.from('approved_names').select('name').eq('line_user_id', session.lineUserId).limit(1);
  if (byLine && byLine.length > 0) approved = true;
  else {
    const { data: byName } = await supabaseAdmin.from('approved_names').select('name').eq('name', name).limit(1);
    approved = !!(byName && byName.length > 0);
  }
  const reviewStatus = approved ? 'approved' : 'pending';

  const { error } = await supabaseAdmin.from('pickleball_registrations').insert([{
    name, count, line_user_id: session.lineUserId, session_id: sessionId,
    created_at: new Date().toISOString(), arrived: false, review_status: reviewStatus
  }]);
  if (error) return fail('報名失敗：' + error.message, 500);

  return Response.json({ ok: true, reviewStatus });
}
