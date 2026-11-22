// 📄 檔案路徑：app/api/waitlist-reply/route.js（新檔案）
// 球友在 LINE 候補詢問卡片上按「放棄候補／繼續等待」會來到這裡（用簽名連結驗證，不用登入）
import { supabaseAdmin, signRegId, getMainIds, notifyPromotions, describeSession, describeSessionEn } from '@/lib/satServer';
import { timingSafeEqual } from 'crypto';

const page = (title, msg, form) => new Response(
  `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:-apple-system,"Noto Sans TC",sans-serif;background:#f4f4f0;margin:0;padding:24px;display:flex;justify-content:center}
.c{max-width:420px;width:100%;background:#fff;border:2px solid #101010;border-radius:16px;padding:24px;text-align:center}
h1{font-size:20px;margin:0 0 12px}p{color:#444;line-height:1.6}
button{font-size:16px;font-weight:bold;padding:12px 20px;border-radius:12px;border:2px solid #101010;background:#d9534f;color:#fff;width:100%}
a{display:block;margin-top:16px;color:#101010}</style></head><body><div class="c"><h1>${title}</h1><p>${msg}</p>${form || ''}<a href="/">回到報名首頁 Back to registration</a></div></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
);

function valid(id, sig) {
  if (!id || !sig || !(process.env.CRON_SECRET || '').trim()) return false;
  const good = Buffer.from(signRegId(id));
  const got = Buffer.from(String(sig));
  return good.length === got.length && timingSafeEqual(good, got);
}

async function findReg(id) {
  const { data } = await supabaseAdmin.from('pickleball_registrations').select('id, session_id, name, count').eq('id', id).maybeSingle();
  return data;
}

export async function GET(req) {
  const u = new URL(req.url);
  const id = u.searchParams.get('id');
  const sig = u.searchParams.get('sig');
  const a = u.searchParams.get('a');
  if (!valid(id, sig)) return page('連結無效 Invalid link', '這個連結不正確或已失效，請回到網站查看。<br>This link is invalid or expired. Please go back to the website.');
  const reg = await findReg(id);
  if (!reg) return page('已不在名單上 Not on the list', '你的這筆報名已經取消或不存在了，不需要再做任何動作。<br>Your registration was already cancelled or no longer exists. Nothing more to do.');
  if (a === 'wait') return page('✅ 已收到 Got it', `好的，你報名的【${describeSession(reg.session_id)}】會繼續候補。有名額時會再通知你！<br>You'll stay on the waitlist for [${describeSessionEn(reg.session_id)}]. We'll notify you if a spot opens up!`);
  if (a === 'giveup') {
    return page('確定要放棄候補嗎？ Give up your spot?', `你報名的【${describeSession(reg.session_id)}】（${reg.count} 位）會被取消，名額讓給後面的球友。<br>Your registration for [${describeSessionEn(reg.session_id)}] will be cancelled and the spot goes to the next player.`,
      `<form method="POST"><input type="hidden" name="id" value="${String(id).replace(/[^\w-]/g, '')}"><input type="hidden" name="sig" value="${String(sig).replace(/[^\w-]/g, '')}"><button type="submit">確定放棄候補 Confirm give up</button></form>`);
  }
  return page('連結無效 Invalid link', '這個連結不正確，請回到網站查看。<br>Invalid link. Please go back to the website.');
}

export async function POST(req) {
  const form = await req.formData();
  const id = String(form.get('id') || '');
  const sig = String(form.get('sig') || '');
  if (!valid(id, sig)) return page('連結無效 Invalid link', '這個連結不正確或已失效，請回到網站查看。<br>This link is invalid or expired. Please go back to the website.');
  const reg = await findReg(id);
  if (!reg) return page('已不在名單上 Not on the list', '你的這筆報名已經取消或不存在了，不需要再做任何動作。<br>Your registration was already cancelled or no longer exists. Nothing more to do.');
  const mainBefore = await getMainIds(reg.session_id);
  const { error } = await supabaseAdmin.from('pickleball_registrations').delete().eq('id', id);
  if (error) return page('失敗 Failed', '取消時發生錯誤，請到網站「我的報名」自行取消。<br>Something went wrong. Please cancel from "My registrations" on the website.');
  await notifyPromotions(reg.session_id, mainBefore);
  return page('✅ 已放棄候補 Spot released', `你報名的【${describeSession(reg.session_id)}】已取消，謝謝你的體諒！<br>Your registration for [${describeSessionEn(reg.session_id)}] is cancelled. Thanks for understanding!`);
}
