// 📄 檔案路徑：app/api/line-callback/route.ts（新檔案）
// 🆕 使用者在 LINE 授權頁按下「同意」之後，LINE 會導回這支 API，
//    這裡負責：用授權碼換取 access token → 拿到個人資料 → 記錄到資料庫 → 發登入 cookie → 導回首頁
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSessionCookieValue, LINE_SESSION_COOKIE_NAME } from '@/lib/lineSession';

// 🆕 用 service role 金鑰建立的專用 client，只在伺服器端使用，
//    可以略過 RLS 限制寫入 line_users，這組金鑰絕對不能出現在任何前端程式碼裡
// 這裡的網址就是你星期六網站程式碼最上面的 SUPABASE_URL，跟前端用的是同一個 Supabase 專案，網址本身不是機密資料
const SUPABASE_URL = 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const supabaseAdmin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const savedState = req.cookies.get('line_login_state')?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${siteUrl}/?line_login_error=state`);
  }

  // 用授權碼換取 access token
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${siteUrl}/api/line-callback`,
      client_id: process.env.LINE_CHANNEL_ID || '',
      client_secret: process.env.LINE_CHANNEL_SECRET || ''
    })
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${siteUrl}/?line_login_error=token`);
  }

  const tokenData = await tokenRes.json();

  // 用 access token 換取個人資料（顯示名稱、頭貼、使用者 ID）
  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });

  if (!profileRes.ok) {
    return NextResponse.redirect(`${siteUrl}/?line_login_error=profile`);
  }

  const profile = await profileRes.json();
  const { userId, displayName, pictureUrl } = profile;

  // 記錄／更新這個人的資料到 line_users（用 service role 金鑰寫入，不受前端 RLS 限制）
  await supabaseAdmin
    .from('line_users')
    .upsert({ line_user_id: userId, display_name: displayName, picture_url: pictureUrl || null }, { onConflict: 'line_user_id' });

  const cookieValue = createSessionCookieValue({ lineUserId: userId, displayName, pictureUrl });

  const res = NextResponse.redirect(`${siteUrl}/`);
  res.cookies.set(LINE_SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 180, // 登入狀態維持 180 天
    path: '/'
  });
  res.cookies.delete('line_login_state');
  return res;
}
