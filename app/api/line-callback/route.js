import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSessionCookieValue, LINE_SESSION_COOKIE_NAME } from '@/lib/lineSession';

// 🆕 用 service role 金鑰建立的專用 client，只在伺服器端使用，
//    可以略過 RLS 限制寫入 line_users，這組金鑰絕對不能出現在任何前端程式碼裡
const SUPABASE_URL = 'https://zasiaeehzhsaqjxxiklu.supabase.co';
const supabaseAdmin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(req) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const savedState = req.cookies.get('line_login_state')?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${siteUrl}/?line_login_error=state`);
  }

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

  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });

  if (!profileRes.ok) {
    return NextResponse.redirect(`${siteUrl}/?line_login_error=profile`);
  }

  const profile = await profileRes.json();
  const { userId, displayName, pictureUrl } = profile;

  await supabaseAdmin
    .from('line_users')
    .upsert({ line_user_id: userId, display_name: displayName, picture_url: pictureUrl || null }, { onConflict: 'line_user_id' });

  const cookieValue = createSessionCookieValue({ lineUserId: userId, displayName, pictureUrl });

  const res = NextResponse.redirect(`${siteUrl}/`);
  res.cookies.set(LINE_SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 180,
    path: '/'
  });
  res.cookies.delete('line_login_state');
  return res;
}
