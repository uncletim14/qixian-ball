// 📄 檔案路徑：app/api/update-registration-count/route.js（更新版：改少人數後，若有備取遞補成正取，發 LINE 通知）
import { supabaseAdmin, PER_SUBMIT_MAX, getSession, fail, getMainIds, getCapacity, notifyPromotions } from '@/lib/satServer';

export async function POST(req) {
  const session = getSession(req);
  if (!session) return fail('🔒 請先使用 LINE 登入！', 401);
  let body;
  try { body = await req.json(); } catch { return fail('資料格式錯誤'); }
  const id = body.id;
  const count = Number.parseInt(body.count, 10);
  if (id === undefined || id === null || id === '') return fail('缺少報名編號');
  if (!Number.isInteger(count) || count < 1 || count > PER_SUBMIT_MAX) return fail(`❌ 人數請輸入 1 到 ${PER_SUBMIT_MAX} 之間的數字！`);

  const { data: reg } = await supabaseAdmin
    .from('pickleball_registrations')
    .select('id, session_id, count')
    .eq('id', id)
    .eq('line_user_id', session.lineUserId)
    .maybeSingle();
  if (!reg) return fail('❌ 修改失敗，找不到您的這筆報名，請重新整理頁面後再試一次！', 404);

  // 🆕 增加人數的限制：不能因為自己加人，把任何一位原本正取的人擠到備取
  //    （名額已滿且有人備取時，正取的人只能減少人數；還有空位時，加到名額內才可以）
  if (count > Number(reg.count)) {
    const dateKey = reg.session_id.slice(0, 10);
    const typeId = reg.session_id.slice(11);
    const max = await getCapacity(dateKey, typeId);
    const { data: rows } = await supabaseAdmin
      .from('pickleball_registrations')
      .select('id, count')
      .eq('session_id', reg.session_id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    const mainSet = (override) => {
      const set = new Set();
      let total = 0, hit = false;
      for (const r of (rows || [])) {
        const seats = String(r.id) === String(id) && override !== null ? override : (Number(r.count) || 0);
        if (!hit && total + seats <= max) { set.add(String(r.id)); total += seats; } else { hit = true; }
      }
      return set;
    };
    const before = mainSet(null);
    const after = mainSet(count);
    for (const k of before) {
      if (!after.has(k)) {
        return fail('❌ 目前名額已滿（或加人後會超過名額），只能減少人數，不能增加。如需增加請另外報名一筆（會排在備取）。', 400);
      }
    }
  }

  const mainBefore = await getMainIds(reg.session_id);

  const { data, error } = await supabaseAdmin
    .from('pickleball_registrations')
    .update({ count })
    .eq('id', id)
    .eq('line_user_id', session.lineUserId)
    .select('id');
  if (error) return fail('系統錯誤：' + error.message, 500);
  if (!data || data.length === 0) return fail('❌ 修改失敗，找不到您的這筆報名，請重新整理頁面後再試一次！', 404);

  await notifyPromotions(reg.session_id, mainBefore);
  return Response.json({ ok: true });
}
