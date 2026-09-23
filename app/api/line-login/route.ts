// 📄 檔案路徑：app/api/line-login/route.ts（新檔案）
// 🆕 點擊「使用 LINE 登入」按鈕時會呼叫這支 API，負責導向 LINE 的授權頁面
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const redirectUri = `${siteUrl}/api/line-callback`;

  // state 用來防止 CSRF（確保等一下 callback 回來的請求，真的是這次我們發起的登入流程）
  const state = crypto.randomBytes(16).toString('hex');

  const authorizeUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', process.env.LINE_CHANNEL_ID || '');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('scope', 'profile openid');

  const res = NextResponse.redirect(authorizeUrl.toString());
  // 把 state 暫存在一個短效 cookie，等 callback 回來時比對
  res.cookies.set('line_login_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 分鐘內要完成登入流程
    path: '/'
  });
  return res;
}
