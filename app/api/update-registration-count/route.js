// 📄 檔案路徑：app/api/update-registration-count/route.js（更新版：改少人數後，若有備取遞補成正取，發 LINE 通知）
import { supabaseAdmin, PER_SUBMIT_MAX, getSession, fail, getMainIds, notifyPromotions } from '@/lib/satServer';

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
    .select('id, session_id')
    .eq('id', id)
    .eq('line_user_id', session.lineUserId)
    .maybeSingle();
  if (!reg) return fail('❌ 修改失敗，找不到您的這筆報名，請重新整理頁面後再試一次！', 404);

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
