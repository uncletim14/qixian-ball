import { NextResponse } from 'next/server';
import { verifySessionCookieValue, LINE_SESSION_COOKIE_NAME } from '@/lib/lineSession';

export async function GET(req) {
  const cookieValue = req.cookies.get(LINE_SESSION_COOKIE_NAME)?.value;
  const session = verifySessionCookieValue(cookieValue);

  if (!session) {
    return NextResponse.json({ loggedIn: false });
  }

  return NextResponse.json({
    loggedIn: true,
    lineUserId: session.lineUserId,
    displayName: session.displayName,
    pictureUrl: session.pictureUrl || null
  });
}
