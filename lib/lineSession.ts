// 📄 檔案路徑：lib/lineSession.ts（新檔案，請建立 lib 資料夾放這個檔案）
// 🆕 用來產生/驗證登入用的簽章 cookie。
// 不使用資料庫存 session，直接把「LINE 使用者 ID + 顯示名稱」簽章後放進 cookie，
// 伺服器收到 cookie 時重新驗證簽章，確認沒有被竄改過，就能知道是誰登入的。
import crypto from 'crypto';

const SECRET = process.env.LINE_SESSION_SECRET || '';

export type LineSessionPayload = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
};

function sign(value: string): string {
  return crypto.createHmac('sha256', SECRET).update(value).digest('hex');
}

// 把登入資訊包裝成一段簽章過的字串，可以直接存進 cookie
export function createSessionCookieValue(payload: LineSessionPayload): string {
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json, 'utf-8').toString('base64url');
  const signature = sign(base64);
  return `${base64}.${signature}`;
}

// 驗證 cookie 字串，簽章不對或格式錯誤都回傳 null（視為未登入）
export function verifySessionCookieValue(cookieValue: string | undefined | null): LineSessionPayload | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;
  const [base64, signature] = parts;
  const expectedSignature = sign(base64);

  // 用固定時間比較，避免 timing attack
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const json = Buffer.from(base64, 'base64url').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const LINE_SESSION_COOKIE_NAME = 'line_session';
