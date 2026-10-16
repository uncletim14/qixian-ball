// 📄 檔案路徑：app/api/admin-notify/route.js（新檔案）
// 後台幹部在「刪除報名／改人數／調整人數上限」前後呼叫：
//   mode: 'snapshot' → 回傳目前各場次的正取名單 id（變動前先記下來）
//   mode: 'notify'   → 比對變動後的正取名單，新增的正取（備取遞補成功）就發 LINE 通知
import { supabaseAdmin, fail, getMainIds, pushLineText, describeSession } from '@/lib/satServer';

const SESSION_ID_RE = /^\d{4}\/\d{2}\/\d{2}_[a-z_]+$/;

export async function POST(req) {
  // 只有登入後台的幹部（Supabase Auth）可以呼叫
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return fail('未登入', 401);
  const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !u?.user) return fail('未登入', 401);

  let body;
  try { body = await req.json(); } catch { return fail('資料格式錯誤'); }

  if (body.mode === 'snapshot') {
    const ids = Array.isArray(body.sessionIds) ? body.sessionIds.filter(s => typeof s === 'string' && SESSION_ID_RE.test(s)).slice(0, 8) : [];
    const snapshots = [];
    for (const sessionId of ids) {
      const main = await getMainIds(sessionId);
      snapshots.push({ sessionId, mainIds: main.map(r => r.id) });
    }
    return Response.json({ ok: true, snapshots });
  }

  if (body.mode === 'notify') {
    const snaps = Array.isArray(body.snapshots) ? body.snapshots.slice(0, 8) : [];
    let promoted = 0, sent = 0;
    const unreachable = [];
    for (const s of snaps) {
      if (!s || typeof s.sessionId !== 'string' || !SESSION_ID_RE.test(s.sessionId)) continue;
      const before = new Set((Array.isArray(s.mainIds) ? s.mainIds : []).map(String));
      const mainAfter = await getMainIds(s.sessionId);
      const newlyMain = mainAfter.filter(r => !before.has(String(r.id)) && r.review_status !== 'pending');
      for (const r of newlyMain) {
        promoted++;
        let ok = false;
        if (r.line_user_id) {
          ok = await pushLineText(
            r.line_user_id,
            `🎉 備取成功！\n你報名的【${describeSession(s.sessionId)}】已遞補為正取（${r.count} 位），請準時出席！\n如果無法出席，請記得上網站取消，讓其他球友有機會。`
          );
        }
        if (ok) sent++; else unreachable.push(r.name);
      }
    }
    return Response.json({ ok: true, promoted, sent, unreachable });
  }

  return fail('不支援的操作');
}
