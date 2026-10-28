'use client';
// 📄 檔案路徑：app/share/page.js（新檔案，需要建立 share 資料夾）
// 🆕 分享報名卡片到 LINE 好友 / 群組（用幹部自己的 LINE 名義發出）。
//    請用這個連結開啟：https://liff.line.me/2009557870-EMmnipe0/share
import { useEffect, useState } from 'react';

const LIFF_ID = '2009557870-EMmnipe0';
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;

// 算出「目前這一週」的週一、週四、週五、週六日期（週六 22:00 後換成下一週）
function weekDates() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  if ((dow === 6 && now.getHours() >= 22) || dow === 0) mon.setDate(mon.getDate() + 7);
  const at = (n) => { const x = new Date(mon); x.setDate(mon.getDate() + n); return `${x.getMonth() + 1}/${x.getDate()}`; };
  return { mon: at(0), thu: at(3), fri: at(4), sat: at(5) };
}

function buildRows() {
  const w = weekDates();
  return [
    { day: '(一)', date: w.mon, time: '19:00–21:20' },
    { day: '(四)', date: w.thu, time: '19:00–21:20' },
    { day: '(五)', date: w.fri, time: '19:00–21:20' },
    { day: '(六)', date: w.sat, time: '早上 9:00–12:00' },
    { day: '(六)', date: w.sat, time: '晚上 19:00–21:20' }
  ];
}

function buildFlex(origin) {
  const rows = buildRows();
  return {
    type: 'flex',
    altText: '七賢匹克球敘團｜本週報名',
    contents: {
      type: 'bubble',
      hero: { type: 'image', url: `${origin}/og.jpg`, size: 'full', aspectRatio: '1200:630', aspectMode: 'cover' },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'text', text: '七賢國小 匹克球', weight: 'bold', size: 'lg' },
          { type: 'text', text: '本週場次', size: 'sm', color: '#888888' },
          { type: 'separator', margin: 'md' },
          ...rows.map(r => ({
            type: 'box', layout: 'horizontal', margin: 'sm',
            contents: [
              { type: 'text', text: `${r.day} ${r.date}`, size: 'md', weight: 'bold', flex: 4 },
              { type: 'text', text: r.time, size: 'md', color: '#555555', align: 'end', flex: 5 }
            ]
          })),
          { type: 'text', text: '報名需輸入本週分區密碼', size: 'xs', color: '#b45309', margin: 'lg', wrap: true }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'button', style: 'primary', color: '#0b8f4d', action: { type: 'uri', label: '前往報名', uri: LIFF_URL } }
        ]
      }
    }
  };
}

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

export default function SharePage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState('正在準備…');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    setRows(buildRows());
    (async () => {
      try {
        const liff = await loadSdk();
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login({ redirectUri: window.location.href }); return; }
        if (!liff.isApiAvailable('shareTargetPicker')) {
          setMsg('這個環境無法使用分享功能，請在手機 LINE 裡開啟：' + LIFF_URL + '/share');
          return;
        }
        setReady(true);
        setMsg('');
      } catch (e) {
        setMsg('LINE 初始化失敗，請重新整理，或改用手機 LINE 開啟：' + LIFF_URL + '/share');
      }
    })();
  }, []);

  const share = async () => {
    try {
      const res = await window.liff.shareTargetPicker([buildFlex(window.location.origin)], { isMultiple: true });
      setMsg(res ? '✅ 已分享！' : '已取消分享');
    } catch (e) {
      setMsg('分享失敗：' + (e && e.message ? e.message : '請稍後再試'));
    }
  };

  return (
    <main className="min-h-screen bg-[#f0f4f8] text-[#101010] p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-md space-y-5">
        <h1 className="text-2xl sm:text-3xl font-black text-[#17587f] text-center">分享報名卡片</h1>
        <p className="text-center font-bold text-slate-600 text-sm">按下按鈕後選擇好友或群組，卡片會用你的名義發出。</p>
        <div className="bg-white border-[3px] border-[#101010] rounded-3xl p-5 space-y-2" style={{ boxShadow: '4px 4px 0 #101010' }}>
          <div className="font-black text-lg">七賢國小 匹克球・本週場次</div>
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between font-bold border-t border-slate-200 pt-2">
              <span>{r.day} {r.date}</span><span className="text-slate-600">{r.time}</span>
            </div>
          ))}
          <div className="text-xs font-bold text-amber-700 pt-2">報名需輸入本週分區密碼</div>
          <div className="bg-[#06C755] text-white text-center font-black rounded-xl py-2 mt-2">前往報名</div>
        </div>
        <button
          onClick={share}
          disabled={!ready}
          className={`w-full p-4 rounded-2xl text-xl font-black border-[3px] border-[#101010] ${ready ? 'bg-[#e8c23a]' : 'bg-slate-200 text-slate-400'}`}
          style={{ boxShadow: '3px 3px 0 #101010' }}
        >
          📤 分享到 LINE 群組 / 好友
        </button>
        {msg && <p className="text-center font-bold text-sm text-[#17587f] break-all">{msg}</p>}
      </div>
    </main>
  );
}
