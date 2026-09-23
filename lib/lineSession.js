import crypto from 'crypto';

const SECRET = process.env.LINE_SESSION_SECRET || '';

function sign(value) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('hex');
}

// 把登入資訊包裝成一段簽章過的字串，可以直接存進 cookie
export function createSessionCookieValue(payload) {
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json, 'utf-8').toString('base64url');
  const signature = sign(base64);
  return `${base64}.${signature}`;
}

// 驗證 cookie 字串，簽章不對或格式錯誤都回傳 null（視為未登入）
export function verifySessionCookieValue(cookieValue) {
  if (!cookieValue) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;
  const [base64, signature] = parts;
  const expectedSignature = sign(base64);

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
