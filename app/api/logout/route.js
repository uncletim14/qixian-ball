import { NextResponse } from 'next/server';
import { LINE_SESSION_COOKIE_NAME } from '@/lib/lineSession';

export async function GET(req) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const res = NextResponse.redirect(`${siteUrl}/`);
  res.cookies.delete(LINE_SESSION_COOKIE_NAME);
  return res;
}
