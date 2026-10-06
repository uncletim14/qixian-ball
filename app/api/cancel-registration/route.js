// 📄 檔案路徑：app/api/cancel-registration/route.js（新檔案）
// 🆕 取消報名：伺服器確認這筆報名是「目前登入的這個 LINE 帳號」建立的，才會刪除
import { supabaseAdmin, getSession, fail } from '@/lib/satServer';

export async function POST(req) {
  const session = getSession(req);
  if (!session) return fail('🔒 請先使用 LINE 登入！', 401);
  let body;
  try { body = await req.json(); } catch { return fail('資料格式錯誤'); }
  const id = body.id;
  if (id === undefined || id === null || id === '') return fail('缺少報名編號');

  const { data, error } = await supabaseAdmin
    .from('pickleball_registrations')
    .delete()
    .eq('id', id)
    .eq('line_user_id', session.lineUserId)
    .select('id');
  if (error) return fail('系統錯誤：' + error.message, 500);
  if (!data || data.length === 0) return fail('❌ 取消失敗，找不到您的這筆報名，請重新整理頁面後再試一次！', 404);
  return Response.json({ ok: true });
}
