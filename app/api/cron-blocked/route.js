// 📄 檔案路徑：app/api/cron-blocked/route.js（新檔案）
// 每天台灣下午 3 點由 Vercel 排程呼叫：檢查今天晚上場有沒有「被大組卡位」的候補，有就用 LINE 詢問
import { supabaseAdmin, TYPE_ORDER, CUTOFF, todayStr, nowTimeValue, askBlockedWaitlist } from '@/lib/satServer';

export async function GET(req) {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const dateKey = todayStr();
  const { data: st } = await supabaseAdmin.from('event_status').select('is_cancelled').eq('date_key', `${dateKey}_PM`).maybeSingle();
  if (st?.is_cancelled) return Response.json({ ok: true, skipped: 'cancelled' });

  let asked = 0;
  for (const typeId of TYPE_ORDER.filter(t => t.endsWith('_pm'))) {
    if (nowTimeValue() >= CUTOFF[typeId]) continue; // 已截止就不用問了
    if (await askBlockedWaitlist(`${dateKey}_${typeId}`)) asked++;
  }
  return Response.json({ ok: true, asked });
}
