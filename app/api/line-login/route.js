import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req) {
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
  res.cookies.set('line_login_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/'
  });
  return res;
}
