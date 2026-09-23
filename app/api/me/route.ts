// 📄 檔案路徑：app/api/me/route.ts（新檔案）
// 🆕 前端頁面載入時會呼叫這支 API，問「我現在是不是登入狀態、登入的人是誰」
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, LINE_SESSION_COOKIE_NAME } from '@/lib/lineSession';

export async function GET(req: NextRequest) {
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
