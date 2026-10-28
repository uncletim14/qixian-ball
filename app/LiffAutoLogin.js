'use client';
// 📄 檔案路徑：app/LiffAutoLogin.js（新檔案）
// 🆕 球友在 LINE 裡面打開網站時，自動完成登入（不用再按「使用 LINE 登入」）。
//    只在「LINE 內建瀏覽器」生效；在一般瀏覽器完全不動作，原本的登入按鈕照常使用。
import { useEffect } from 'react';

// 👇 把 LINE Developers 建立 LIFF 後拿到的 LIFF ID 貼在這裡（格式像 1234567890-AbcdEfgh）
const LIFF_ID = '2009557870-EMmnipe0';

function loadSdk() {
  return new Promise((resolve, reject) => {
    if (window.liff) return resolve(window.liff);
    const s = document.createElement('script');
    s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    s.onload = () => resolve(window.liff);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function LiffAutoLogin() {
  useEffect(() => {
    if (!LIFF_ID || LIFF_ID.startsWith('PUT_')) return;
    // 只有在 LINE 的瀏覽器裡才需要
    if (!/Line\//i.test(navigator.userAgent)) return;
    let stopped = false;
    (async () => {
      try {
        // 已經登入就不用做
        const me = await fetch('/api/me', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
        if (stopped || (me && me.loggedIn)) return;
        // 避免失敗時無限重新整理：同一個分頁最多自動試一次
        if (sessionStorage.getItem('liffTried') === '1') return;
        sessionStorage.setItem('liffTried', '1');

        const liff = await loadSdk();
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isInClient()) return; // 不是從 LIFF 連結開啟 → 維持原本的登入按鈕
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const idToken = liff.getIDToken();
        if (!idToken) return;
        const res = await fetch('/api/liff-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        if (res.ok && !stopped) window.location.reload();
      } catch (e) {
        // 任何錯誤都不影響原本的登入按鈕
      }
    })();
    return () => { stopped = true; };
  }, []);
  return null;
}
