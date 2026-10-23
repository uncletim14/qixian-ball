'use client';
// 📄 檔案路徑：app/LangSwitch.js（新檔案）
// 🌐 一鍵切換 中文 / English：右上角小按鈕。
//    做法：不改動原本的程式邏輯，只在畫面上把「看得到的中文」換成英文（沒收錄的字會維持中文）。
//    選擇會記在瀏覽器裡，下次進來自動沿用。
import { useEffect, useState } from 'react';

// ───────── 名稱對照（分區 / 場次 / 星期）─────────
const LABELS = {
  '新手友善場': 'Beginner-Friendly',
  '新手體驗': 'Beginner Intro',
  '新手區': 'Beginner Zone',
  '散打區': 'Open Play Zone',
  '一般散打': 'Open Play',
  '3.0以上 球敘': '3.0+ Social Play',
  '早上場': 'Morning session',
  '晚上場': 'Evening session',
  '(晚上)': ' (Evening)',
  '週一': 'Mon', '週二': 'Tue', '週三': 'Wed', '週四': 'Thu', '週五': 'Fri', '週六': 'Sat', '週日': 'Sun'
};
const LABEL_KEYS = Object.keys(LABELS).sort((a, b) => b.length - a.length);
function tl(s) {
  let out = String(s);
  for (const k of LABEL_KEYS) out = out.split(k).join(LABELS[k]);
  return out;
}

// ───────── 完整句子對照 ─────────
const EXACT = {
  ...LABELS,
  '新手體驗(晚上)': 'Beginner Intro (Evening)',
  '新手友善場(晚上)': 'Beginner-Friendly (Evening)',
  '一般散打(晚上)': 'Open Play (Evening)',
  '3.0以上 球敘(晚上)': '3.0+ Social Play (Evening)',
  '七賢匹克球敘團': 'Qixian Pickleball Club',
  '七賢匹克 LOGO': 'Qixian Pickleball logo',

  // 首頁
  '🎽 1人 $100': '🎽 $100 / person',
  '🏓 租借球拍 $50': '🏓 Paddle rental $50',
  '🎁 新手體驗免費': '🎁 Beginner Intro is free',
  '📅 請選擇場次日期': '📅 Please choose a date',
  '網站報名每週六晚上 10 點更新下週報名': 'Online registration for the next week updates every Saturday at 10 PM',
  '非會員星期三晚上 10 點後開放報名星期六球敘': 'Non-members can register for Saturday sessions after Wednesday 10 PM',
  '加入官方帳號好友': 'Add our LINE Official Account',
  '加入後，備取遞補成功會即時 LINE 通知你': 'Once added, you will get an instant LINE message when you move up from the waitlist',
  '🔒 目前為會員限定報名期間，需輸入會員密碼才能報名，開放時間到後將自動開放給所有人': '🔒 Members-only registration period: a member password is required. It opens to everyone automatically when the time comes.',
  '⛈️ 本場次（': '⛈️ This session (',
  '）因雨取消或其他原因取消，暫停報名！已報名球友不計缺席': ') is cancelled due to rain or other reasons. Registration is paused. Registered players will not be marked absent.',
  '請選擇要報名的日子': 'Choose the day you want to join',
  '（已結束）': ' (Ended)',
  '（未開放）': ' (Not open)',
  '早上 9:00-12:00': 'Morning 9:00-12:00',
  '晚上 19:00-21:20': 'Evening 19:00-21:20',
  '⛈️ 早上場因雨取消': '⛈️ Morning cancelled (rain)',
  '⛈️ 晚上場因雨取消': '⛈️ Evening cancelled (rain)',
  '⛈️ 因雨取消': '⛈️ Cancelled (rain)',
  '← 返回選日期': '← Back to dates',
  '🌅 早上場 (9:00-12:00)': '🌅 Morning (9:00-12:00)',
  '🌙 晚上場 (19:00-21:20)': '🌙 Evening (19:00-21:20)',
  '📋 目前報名名單': '📋 Current sign-ups',
  '名單載入中…': 'Loading list…',
  '❌ 本區未開放': '❌ Not open',
  '暫無報名': 'No sign-ups yet',
  '⏳審核中': '⏳ Under review',
  '⏳ 審核中': '⏳ Under review',
  '位': ' ppl',
  '位)': ' ppl)',
  '位）': ' ppl)',
  '[備取': '[Waitlist',
  '← 返回': '← Back',
  '報名驗證': ' Registration Verification',
  '週六全場本時段免密碼，請用 LINE 登入後報名': 'No password needed for this Saturday slot. Log in with LINE to register.',
  '請輸入本週密碼': 'Enter this week\'s password',
  '確認密碼': 'Confirm password',
  '✅ 本時段週六全場免密碼': '✅ No password needed for this Saturday slot',
  '✅ 本週密碼已通過': '✅ Password accepted',
  '確認登入狀態中…': 'Checking login status…',
  '使用 LINE 登入': 'Log in with LINE',
  '🔐 LINE 僅用於登入驗證身份（防止換名字逃避停權），不會取得您的電話、Email 等敏感資料': '🔐 LINE is only used to verify your identity (to prevent dodging a suspension by changing names). We do not receive your phone number, email or other sensitive data.',
  '🔐 LINE 僅用於登入驗證身份（防止換名字逃避停權），': '🔐 LINE is only used to verify your identity (to prevent dodging a suspension by changing names).',
  '不會取得您的電話、Email 等敏感資料，': 'We do not receive your phone number, email or other sensitive data,',
  '也不會公開您的 LINE 個人資料': 'and your LINE profile is never made public.',
  '← 返回選分區': '← Back to zones',
  '（早上場）': ' (Morning)',
  '（晚上場）': ' (Evening)',
  '⏰ 時間：': '⏰ Time: ',
  '⚠️ 當天': '⚠️ Registration closes today at',
  '後即截止報名': '',

  // 報名表單
  '🚫 本場次已結束': '🚫 This session has ended',
  '請返回選擇其他日期': 'Please go back and choose another date',
  '⛈️ 本場次因雨取消或其他原因取消': '⛈️ This session is cancelled (rain or other reasons)',
  '已取消，暫停報名，請留意後續開放通知': ' is cancelled and registration is paused. Please watch for further announcements.',
  '🚫 本區未開放': '🚫 This zone is not open',
  '幹部已將本場次【': 'The organizers set the capacity of [',
  '】人數設為 0 位，暫不開放報名。': '] to 0, so registration is closed for now.',
  '🔒 目前為會員限定報名期間，請輸入會員密碼才能送出報名': '🔒 Members-only period: enter the member password to register',
  '請輸入會員密碼': 'Enter member password',
  '🔒 請先使用 LINE 登入才能報名（防止黑名單被繞過）': '🔒 Please log in with LINE to register (prevents bypassing the blacklist)',
  '✅ 已用 LINE 登入': '✅ Logged in with LINE',
  '登出': 'Log out',
  '輸入暱稱或代號': 'Enter a nickname',
  '送出中，請稍候…': 'Submitting, please wait…',
  '確認報名': 'Confirm registration',

  // 名單
  '正取名單 (': 'Confirmed list (',
  '備取成功通知：': 'Waitlist promotion: ',
  '有球友取消報名，備取球友已自動遞補升至正取！請留意您的席位。': 'A player cancelled, and waitlisted players have been moved up automatically. Please check your spot!',
  '✓ [已報到]': '✓ [Checked in]',
  '[已報到]': '[Checked in]',
  '🎉 備取成功': '🎉 Moved up from waitlist',
  '🎉備取成功': '🎉 Moved up from waitlist',
  '改人數': 'Edit headcount',
  '取消': 'Cancel',
  '遞補備取：': 'Waitlist: ',

  // 自助報到
  '📱 現場自助報到專區 (早上場 8:30-12:00 / 晚上散打 18:30-21:00)': '📱 On-site self check-in (Morning 8:30-12:00 / Evening open play 18:30-21:00)',
  '📍 請選擇暱稱並輸入報名密碼': '📍 Choose your nickname and enter your password',
  '⏰ 早上三區報到 8:30~12:00；晚上散打報到 18:30~21:00': '⏰ Morning check-in 8:30-12:00; evening open-play check-in 18:30-21:00',
  '-- 請選擇你的暱稱 --': '-- Choose your nickname --',
  '請輸入報名時設定的 4 位數密碼': 'Enter the 4-digit password you set when registering',
  '驗證密碼並確認報到': 'Verify password & check in',

  // 提示 / 錯誤（alert 與伺服器回傳）
  '⚠️ 系統偵測到異常快速的送出行為，請稍後再試一次！': '⚠️ Unusually rapid submissions detected. Please try again in a moment.',
  '🚫 本場次已結束，無法報名！': '🚫 This session has ended. Registration is closed.',
  '🔒 請先使用 LINE 登入才能報名！': '🔒 Please log in with LINE to register!',
  '請輸入要顯示在名單上的暱稱！': 'Please enter the nickname to show on the list!',
  '網路錯誤，請稍後再試一次！': 'Network error. Please try again shortly.',
  '報名失敗，請稍後再試！': 'Registration failed. Please try again later.',
  '✅ 報名已送出！這是您第一次報名，需要管理員審核通過後才會確認正取/備取資格。審核通過後之後報名將不需再審核。': '✅ Registration submitted! Because this is your first time, an admin must approve it before your confirmed/waitlist spot is final. After approval, future registrations will not need review.',
  '🎉 登記成功！': '🎉 Registered successfully!',
  '請選擇你的暱稱！': 'Please choose your nickname!',
  '請輸入報名時設定的 4 位數密碼！': 'Please enter the 4-digit password you set when registering!',
  '❌ 密碼錯誤！請輸入報名時設定的 4 位數密碼。': '❌ Wrong password! Please enter the 4-digit password you set when registering.',
  '🔒 只能取消您自己（LINE 帳號）建立的報名！': '🔒 You can only cancel registrations made with your own LINE account!',
  '取消失敗，請重新整理頁面後再試一次！': 'Cancellation failed. Please refresh the page and try again.',
  '取消成功！': 'Cancelled successfully!',
  '🔒 只能修改您自己（LINE 帳號）建立的報名！': '🔒 You can only edit registrations made with your own LINE account!',
  '修改失敗，請重新整理頁面後再試一次！': 'Update failed. Please refresh the page and try again.',
  '請輸入本週密碼！': 'Please enter this week\'s password!',
  '🔒 密碼錯誤，或本週密碼尚未設定，請洽幹部！': '🔒 Wrong password, or this week\'s password has not been set. Please ask an organizer.',

  // 伺服器端錯誤
  '資料格式錯誤': 'Invalid data format',
  '場次類型錯誤': 'Invalid session type',
  '日期格式錯誤': 'Invalid date format',
  '暱稱太長了（最多 30 個字）': 'Nickname is too long (max 30 characters)',
  '🚫 這個日期目前不開放報名！': '🚫 This date is not open for registration yet!',
  '🔒 本週分區密碼驗證失敗，請回到上一頁重新輸入密碼！': '🔒 Zone password check failed. Please go back and enter the password again.',
  '🔒 請先使用 LINE 登入！': '🔒 Please log in with LINE first!',
  '缺少報名編號': 'Missing registration ID',
  '❌ 取消失敗，找不到您的這筆報名，請重新整理頁面後再試一次！': '❌ Cancellation failed: we could not find your registration. Please refresh and try again.',
  '❌ 修改失敗，找不到您的這筆報名，請重新整理頁面後再試一次！': '❌ Update failed: we could not find your registration. Please refresh and try again.',
  '❌ 目前名額已滿（或加人後會超過名額），只能減少人數，不能增加。如需增加請另外報名一筆（會排在備取）。': '❌ The zone is full (or adding people would exceed capacity), so you can only reduce your headcount. To add people, please register again separately (you will be placed on the waitlist).'
};
const EXACT_NORM = {};
Object.keys(EXACT).forEach(k => { EXACT_NORM[k.replace(/\s+/g, ' ').trim()] = EXACT[k]; });

// ───────── 含變數的句子 ─────────
const PATTERNS = [
  [/^📅 本場次：(\S+) (\S+)$/, (m) => `📅 Session: ${tl(m[1])} ${m[2]}`],
  [/^正取 (\d+) \/ (\d+)$/, (m) => `Confirmed ${m[1]} / ${m[2]}`],
  [/^\(開放報名\(限(\d+)位\)\)$/, (m) => `(Open · limit ${m[1]})`],
  [/^\(開放報名\(限(\d+)位\)\)$/, (m) => `(Open · limit ${m[1]})`],
  [/^需要先輸入本週的(.+)密碼，再用 LINE 登入才能報名$/, (m) => `Enter this week's ${tl(m[1])} password first, then log in with LINE to register.`],
  [/^(\d+) 位$/, (m) => `${m[1]} ppl`],
  [/^\[備取 (\d+)\]$/, (m) => `[Waitlist ${m[1]}]`],
  [/^🚫 (.+) 單筆報名最多 (\d+) 位球友喔！$/, (m) => `🚫 ${tl(m[1])}: max ${m[2]} players per registration!`],
  [/^⛈️ 本場次（(.+)）因雨取消或其他原因取消，暫停報名！$/, (m) => `⛈️ This session (${tl(m[1])}) is cancelled due to rain or other reasons. Registration is paused.`],
  [/^⚠️ 本場次【(.+)】暫未開放報名！$/, (m) => `⚠️ [${tl(m[1])}] is not open for registration yet!`],
  [/^🚫 抱歉！今天的【(.+)】報名已於 (\d+):(\d+) 截止囉！$/, (m) => `🚫 Sorry! Registration for today's [${tl(m[1])}] closed at ${m[2]}:${m[3]}.`],
  [/^🚫 您的帳號目前處於停權狀態（至 (.+) 止），無法報名！如有疑問請洽幹部。$/, (m) => `🚫 Your account is suspended until ${m[1]} and cannot register. Please contact an organizer if you have questions.`],
  [/^❌ 您（(.+)）已經報名過本場次囉！$/, (m) => `❌ You (${m[1]}) have already registered for this session!`],
  [/^報名失敗：(.*)$/, (m) => `Registration failed: ${m[1]}`],
  [/^系統錯誤：(.*)$/, (m) => `System error: ${m[1]}`],
  [/^🚫 提醒：【(.+)】目前處於停權狀態（至 (.+) 止），將無法完成報名！$/, (m) => `🚫 Notice: [${m[1]}] is currently suspended (until ${m[2]}) and will not be able to register.`],
  [/^⚠️ 提醒：【(.+)】目前已有 (\d+) 次未報到紀錄，請報名後務必準時出席喔！$/, (m) => `⚠️ Notice: [${m[1]}] has ${m[2]} no-show record(s). Please be sure to attend on time after registering.`],
  [/^🚫 目前非報到時間！【(.+)】開放報到時間為 (.+) ~ (.+)。$/, (m) => `🚫 It is not check-in time yet! [${tl(m[1])}] check-in is open ${m[2]} ~ ${m[3]}.`],
  [/^🎉 密碼驗證成功！已幫【(.+)】完成現場報到！$/, (m) => `🎉 Password verified! [${m[1]}] is now checked in.`],
  [/^確定要取消【(.+)】的報名嗎？$/, (m) => `Are you sure you want to cancel the registration for [${m[1]}]?`],
  [/^【(.+)】目前報名 (\d+) 位，請輸入新的人數（1~(\d+)）：$/, (m) => `[${m[1]}] is currently registered for ${m[2]}. Enter the new headcount (1~${m[3]}):`],
  [/^❌ 人數請輸入 1 到 (\d+) 之間的數字！$/, (m) => `❌ Please enter a number between 1 and ${m[1]}!`],
  [/^✅ 已將人數修改為 (\d+) 位！（若名額不足，可能會自動轉為備取）$/, (m) => `✅ Headcount changed to ${m[1]}! (If spots are short, you may be moved to the waitlist automatically.)`],
  [/^(.+)已取消，暫停報名，請留意後續開放通知$/, (m) => `${tl(m[1])} is cancelled and registration is paused. Please watch for further announcements.`]
];

function translateCore(core) {
  if (!core || !/[一-鿿]/.test(core)) return undefined;
  const norm = core.replace(/\s+/g, ' ');
  if (Object.prototype.hasOwnProperty.call(EXACT_NORM, norm)) return EXACT_NORM[norm];
  if (norm.indexOf(' / ') > 0) {
    const parts = norm.split(' / ');
    const outs = parts.map(x => (Object.prototype.hasOwnProperty.call(EXACT_NORM, x) ? EXACT_NORM[x] : undefined));
    if (outs.every(x => x !== undefined)) return outs.join(' / ');
  }
  for (const [re, fn] of PATTERNS) {
    const m = norm.match(re);
    if (m) return fn(m);
  }
  return undefined;
}
// 對外：給 alert / confirm / prompt 用（整段字串）
function translateMessage(s) {
  const str = String(s);
  const r = translateCore(str.trim());
  return r === undefined ? str : r;
}

const ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
const textRec = new WeakMap(); // 文字節點 → { src, out }
const attrRec = new WeakMap(); // 元素 → { attr: { src, out } }

function doText(node, en) {
  const rec = textRec.get(node);
  if (!en) {
    if (rec && node.data === rec.out) node.data = rec.src;
    textRec.delete(node);
    return;
  }
  if (rec && node.data === rec.out) return; // 已經翻過
  const raw = node.data;
  const lead = (raw.match(/^\s*/) || [''])[0];
  const trail = raw.length > lead.length ? (raw.match(/\s*$/) || [''])[0] : '';
  const core = raw.slice(lead.length, raw.length - trail.length);
  const out = translateCore(core);
  if (out === undefined) { textRec.delete(node); return; }
  const full = lead + out + trail;
  textRec.set(node, { src: raw, out: full });
  node.data = full;
}
function doAttrs(el, en) {
  if (!el.getAttribute) return;
  let recs = attrRec.get(el);
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (cur == null) continue;
    const rec = recs && recs[a];
    if (!en) {
      if (rec && cur === rec.out) el.setAttribute(a, rec.src);
      if (recs) delete recs[a];
      continue;
    }
    if (rec && cur === rec.out) continue;
    const out = translateCore(cur.trim());
    if (out === undefined) { if (recs) delete recs[a]; continue; }
    if (!recs) { recs = {}; attrRec.set(el, recs); }
    recs[a] = { src: cur, out };
    el.setAttribute(a, out);
  }
}
function walk(root, en) {
  if (!root) return;
  if (root.nodeType === 3) { doText(root, en); return; }
  if (root.nodeType !== 1) return;
  if (root.closest && root.closest('[data-no-i18n]')) return;
  doAttrs(root, en);
  const tw = document.createTreeWalker(root, 1 | 4); // 元素 + 文字
  let n = tw.nextNode();
  while (n) {
    if (n.nodeType === 3) doText(n, en);
    else doAttrs(n, en);
    n = tw.nextNode();
  }
}

export default function LangSwitch() {
  const [lang, setLang] = useState('zh');

  // 讀取記住的語言
  useEffect(() => {
    try {
      const saved = localStorage.getItem('qx_lang');
      if (saved === 'en' || saved === 'zh') setLang(saved);
    } catch (e) {}
  }, []);

  useEffect(() => {
    const en = lang === 'en';
    try { localStorage.setItem('qx_lang', lang); } catch (e) {}
    document.documentElement.setAttribute('data-lang', en ? 'en' : 'zh');
    document.documentElement.lang = en ? 'en' : 'zh-Hant';

    const origAlert = window.__qxAlert || window.alert.bind(window);
    const origConfirm = window.__qxConfirm || window.confirm.bind(window);
    const origPrompt = window.__qxPrompt || window.prompt.bind(window);
    window.__qxAlert = origAlert; window.__qxConfirm = origConfirm; window.__qxPrompt = origPrompt;
    if (en) {
      window.alert = (m) => origAlert(translateMessage(m));
      window.confirm = (m) => origConfirm(translateMessage(m));
      window.prompt = (m, d) => origPrompt(translateMessage(m), d);
    } else {
      window.alert = origAlert; window.confirm = origConfirm; window.prompt = origPrompt;
    }

    walk(document.body, en);
    if (!en) return;

    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') doText(m.target, true);
        else if (m.type === 'attributes') doAttrs(m.target, true);
        else m.addedNodes.forEach(n => walk(n, true));
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    return () => obs.disconnect();
  }, [lang]);

  const base = { border: '2px solid #101010', padding: '4px 10px', fontWeight: 900, fontSize: 13, cursor: 'pointer', lineHeight: 1.2 };
  return (
    <>
      <style>{`
        .qx-en-title{display:none}
        html[data-lang="en"] h1 > span:not(.qx-en-title){display:none}
        html[data-lang="en"] .qx-zone-label{font-size:2rem !important;line-height:1.1;text-align:center}
        html[data-lang="en"] .qx-zone-subs{font-size:1.05rem !important}
        html[data-lang="en"] h1 > .qx-en-title{display:block;text-align:center;font-size:.6em;letter-spacing:0}
      `}</style>
      <div data-no-i18n="1" style={{ position: 'fixed', top: 10, right: 10, zIndex: 60, display: 'flex', borderRadius: 999, overflow: 'hidden', boxShadow: '2px 2px 0 #101010' }}>
        <button onClick={() => setLang('zh')} aria-label="中文" style={{ ...base, background: lang === 'zh' ? '#e8c23a' : '#fff', color: '#101010', borderRight: 'none', borderRadius: '999px 0 0 999px' }}>中文</button>
        <button onClick={() => setLang('en')} aria-label="English" style={{ ...base, background: lang === 'en' ? '#e8c23a' : '#fff', color: '#101010', borderRadius: '0 999px 999px 0' }}>EN</button>
      </div>
    </>
  );
}
