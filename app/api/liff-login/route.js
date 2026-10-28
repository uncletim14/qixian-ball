// 📄 檔案路徑：app/api/liff-login/route.js（新檔案，需要建立 liff-login 資料夾）
// 🆕 在 LINE 裡面打開網站時，前端會把 LINE 給的「身份證明（ID Token）」送到這裡。
//    這裡向 LINE 驗證這張證明是真的，確認後發出跟「使用 LINE 登入」一模一樣的登入 cookie，
//    這樣球友就不用再按一次登入按鈕。
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSessionCookieValue, LINE_SESSION_COOKIE_NAME } from '@/lib/lineSession';

const SUPABASE_URL = 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || '');

export async function POST(req) {
  let idToken = '';
  try {
    const body = await req.json();
    idToken = String(body.idToken || '');
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  if (!idToken) return NextResponse.json({ ok: false, error: 'no_token' }, { status: 400 });

  // 請 LINE 驗證這張 ID Token（會檢查簽章、是否過期、是否是發給我們這個頻道的）
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: process.env.LINE_CHANNEL_ID || '' })
  });
  if (!verifyRes.ok) {
    return NextResponse.json({ ok: false, error: 'verify_failed' }, { status: 401 });
  }
  const info = await verifyRes.json();
  const userId = info.sub;
  const displayName = info.name || 'LINE 用戶';
  const pictureUrl = info.picture || null;
  if (!userId) return NextResponse.json({ ok: false, error: 'no_sub' }, { status: 401 });

  await supabaseAdmin
    .from('line_users')
    .upsert({ line_user_id: userId, display_name: displayName, picture_url: pictureUrl }, { onConflict: 'line_user_id' });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(LINE_SESSION_COOKIE_NAME, createSessionCookieValue({ lineUserId: userId, displayName, pictureUrl }), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 180,
    path: '/'
  });
  return res;
}
