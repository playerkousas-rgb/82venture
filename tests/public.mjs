/* ============================================================
   tests/public.mjs — 團章公開頁（constitution.html + assets/js/public.js）
   用 jsdom 開公開頁，驗證：免登入讀到團章、中英對照、語言切換、搜尋。
   用法：node tests/public.mjs
   ============================================================ */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const t0 = Date.now();

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
const errors = [];
console.error = (...a) => { errors.push(a.map(String).join(' ')); };

/* ---------- fetch shim：直接由 repo 讀檔 ---------- */
globalThis.fetch = async (url) => {
  const clean = String(url).split('?')[0].replace(/^\.?\//, '');
  const file = path.join(ROOT, clean);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
    return { ok: false, status: 404, json: async () => { throw new Error('404 ' + clean); } };
  }
  const text = fs.readFileSync(file, 'utf8');
  return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
};

/* ---------- 用真實嘅 constitution.html 做底 ---------- */
const html = fs.readFileSync(path.join(ROOT, 'constitution.html'), 'utf8');
const url = 'http://localhost:8080/constitution.html?u=0082';
const dom = new JSDOM(html, { url, pretendToBeVisual: true, runScripts: 'dangerously' });
const { window } = dom;
window.scrollTo = () => {};
for (const k of ['window', 'document', 'navigator', 'localStorage', 'location', 'HTMLElement',
  'CustomEvent', 'Event', 'Node', 'getComputedStyle', 'URL', 'URLSearchParams', 'Blob']) {
  if (window[k] === undefined) continue;
  try { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); }
  catch (e) { /* 唯讀 → 略過 */ }
}
globalThis.window = window;

const doc = window.document;
const paper = () => doc.getElementById('paper')?.textContent || '';
const paperHtml = () => doc.getElementById('paper')?.innerHTML || '';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

console.log('\n▌團章公開頁（免登入）');
await import('../assets/js/public.js');
await wait(400);

ok('頁面有渲染', paper().length > 500, String(paper().length));
ok('標題是團章', /團章/.test(doc.title), doc.title);
ok('顯示旅團名', paper().includes('第八十二旅深資童軍團'));
ok('顯示主辦機構', paper().includes('康山') || paper().includes('香港小童群益會'));
ok('有 19 章 + 附件（section 數目）', doc.querySelectorAll('#paper section').length >= 20,
  String(doc.querySelectorAll('#paper section').length));
ok('預設中英對照（同頁見到中文條文）', paper().includes('本團名稱為'));
ok('預設中英對照（同頁見到英文條文）', /The title of the Unit shall be/.test(paper()));
ok('有頁尾版本資料', /版本 v/.test(paper()));
ok('有中文／English／對照 三個語言掣', doc.querySelectorAll('[data-lang]').length === 3);
ok('有 PDF / Word / Markdown 匯出掣',
  ['print', 'word', 'md'].every(a => !!doc.querySelector(`[data-act="${a}"]`)));

/* ---------- 語言切換 ---------- */
console.log('\n▌語言切換');
doc.querySelector('[data-lang="en"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(60);
ok('English：只剩英文條文', /The title of the Unit shall be/.test(paper()) && !paper().includes('本團名稱為'));
ok('English：記入 localStorage', window.localStorage.getItem('venture82.pub.lang') === 'en');

doc.querySelector('[data-lang="zh"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(60);
ok('中文：只剩中文條文', paper().includes('本團名稱為') && !/The title of the Unit shall be/.test(paper()));

doc.querySelector('[data-lang="both"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(60);
ok('對照：中英都有', paper().includes('本團名稱為') && /The title of the Unit shall be/.test(paper()));

/* ---------- 搜尋 ---------- */
console.log('\n▌條文搜尋');
const box = doc.getElementById('pubSearch');
box.value = '團費';
box.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(420);
ok('搜尋「團費」只剩相關章節', paper().includes('團費') && !paper().includes('本團名稱為'));
box.value = '';
box.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(420);
ok('清空搜尋後回復全文', paper().includes('本團名稱為'));

/* ---------- 主題色（要求：棗紅） ---------- */
console.log('\n▌主題');
const css = fs.readFileSync(path.join(ROOT, 'assets/css/main.css'), 'utf8');
ok('公開頁字體色用棗紅 var(--brand-700)', paperHtml().includes('var(--brand-700)'));
ok('CSS 主色 700 = #7B2233', /--brand-700:\s*#7B2233/i.test(css));
ok('CSS 冇殘留舊綠色 (#2e7d32 等)', !/#(2e7d32|388e3c|1b5e20|43a047|4caf50)/i.test(css));

/* ============================================================
   通告公開頁（notice.html + assets/js/public-notice.js）
   免登入：睇通告 → 填報名 → 送出
   ============================================================ */
console.log('\n▌通告公開頁（免登入・分享・報名）');

let noticeCase = 0;
function bootNotice(search) {
  const html = fs.readFileSync(path.join(ROOT, 'notice.html'), 'utf8');
  const dom2 = new JSDOM(html, {
    url: 'http://localhost:8080/notice.html' + search,
    pretendToBeVisual: true, runScripts: 'dangerously'
  });
  const w = dom2.window;
  w.scrollTo = () => {};
  for (const k of ['window', 'document', 'navigator', 'localStorage', 'location', 'HTMLElement',
    'CustomEvent', 'Event', 'Node', 'getComputedStyle', 'URL', 'URLSearchParams', 'Blob']) {
    if (w[k] === undefined) continue;
    try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); }
    catch (e) { /* 唯讀 → 略過 */ }
  }
  globalThis.window = w;
  return w;
}

// ① 一般通告（唔需要報名）
{
  const w = bootNotice('?u=0082&n=nt-2026-annfee');
  await import('../assets/js/public-notice.js?case=' + ++noticeCase);
  await wait(400);
  const d = w.document;
  const txt = () => d.getElementById('app')?.textContent || '';
  ok('通告公開頁有渲染（免登入）', txt().length > 200, String(txt().length));
  ok('顯示通告標題', txt().includes('團費'), txt().slice(0, 60));
  ok('顯示旅團名', txt().includes('第八十二') || txt().includes('82'), txt().slice(0, 80));
  ok('顯示通告內容（團費 $360）', txt().includes('360'));
  ok('有截止日期標示', txt().includes('截止') || txt().includes('2026-09-30'));
  ok('唔需要報名時冇報名表', !d.getElementById('signup-form'));
  ok('頁尾有 82venture 字樣', txt().includes('82venture'));
  ok('document.title 用通告標題', /團費/.test(d.title), d.title);
}

// ② 需要報名嘅通告
{
  const w = bootNotice('?u=0082&n=nt-2026-pioneer');
  await import('../assets/js/public-notice.js?case=' + ++noticeCase);
  await wait(400);
  const d = w.document;
  const txt = () => d.getElementById('app')?.textContent || '';
  const form = d.getElementById('signup-form');
  ok('需要報名嘅通告有報名表', !!form);
  ok('有「可報名」標示', txt().includes('可報名'));
  ok('報名欄目由通告定義（姓名／電話／本人係）',
    !!d.querySelector('[data-fk="name"]') && !!d.querySelector('[data-fk="contact"]') && !!d.querySelector('[data-fk="member"]'));
  ok('必填欄有 required', d.querySelector('[data-fk="name"]')?.hasAttribute('required') === true);
  ok('有剔選欄（飲食禁忌）', d.querySelectorAll('[data-fk="diet"]').length >= 3);
  ok('地點／費用／名額都有顯示', txt().includes('香港仔郊野公園') && txt().includes('$120') && txt().includes('24'));

  // 未填必填 → 有錯誤提示
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await wait(120);
  ok('未填必填欄會提示（唔會送出）', (d.getElementById('signup-err')?.textContent || '').includes('未填'));
  ok('未送出時本機冇紀錄', !w.localStorage.getItem('venture82.pub.signup.0082.nt-2026-pioneer'));

  // 填好 → 送出
  d.querySelector('[data-fk="name"]').value = '測試團員';
  d.querySelector('[data-fk="contact"]').value = '91234567';
  d.querySelector('[data-fk="member"]').value = '現役團員';
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await wait(300);
  const saved = JSON.parse(w.localStorage.getItem('venture82.pub.signup.0082.nt-2026-pioneer') || '[]');
  ok('填好之後送出成功（本機有紀錄）', saved.length === 1, JSON.stringify(saved));
  ok('紀錄有姓名同通告編號', saved[0]?.values?.name === '測試團員' && saved[0]?.noticeId === 'nt-2026-pioneer', JSON.stringify(saved[0]?.values));
  ok('送出後有成功訊息', txt().includes('已收到'));
}

// ③ 搵唔到通告／連結失效
{
  const w = bootNotice('?u=0082&n=no-such-notice');
  await import('../assets/js/public-notice.js?case=' + ++noticeCase);
  await wait(400);
  const txt = w.document.getElementById('app')?.textContent || '';
  ok('搵唔到通告有友善提示（唔會白畫面）', txt.includes('讀唔到通告') || txt.includes('暫時'), txt.slice(0, 80));
}

/* ============================================================
   手機記一筆（entry.html + assets/js/public-entry.js）
   成員免登入：影相 → 揀欄目 → 送出
   ============================================================ */
console.log('\n▌手機記一筆（免登入・影相＋揀欄目）');

function bootEntry(search) {
  const html = fs.readFileSync(path.join(ROOT, 'entry.html'), 'utf8');
  const dom3 = new JSDOM(html, {
    url: 'http://localhost:8080/entry.html' + search,
    pretendToBeVisual: true, runScripts: 'dangerously'
  });
  const w = dom3.window;
  w.scrollTo = () => {};
  for (const k of ['window', 'document', 'navigator', 'localStorage', 'location', 'HTMLElement',
    'CustomEvent', 'Event', 'Node', 'getComputedStyle', 'URL', 'URLSearchParams', 'Blob']) {
    if (w[k] === undefined) continue;
    try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); }
    catch (e) { /* 唯讀 → 略過 */ }
  }
  globalThis.window = w;
  return w;
}

{
  const w = bootEntry('?u=0082');
  await import('../assets/js/public-entry.js?case=' + ++noticeCase);
  await wait(420);
  const d = w.document;
  const txt = () => d.getElementById('app')?.textContent || '';
  ok('手機記一筆頁有渲染（免登入）', txt().length > 200, String(txt().length));
  ok('顯示旅團名', txt().includes('第八十二') || txt().includes('82'), txt().slice(0, 60));
  ok('有相機輸入（直接影相）', !!d.querySelector('[data-photo-field="pe-photos"] input[type="file"][capture]'));
  ok('有揀相片（相簿）', !!d.querySelector('[data-photo-field="pe-photos"] input[type="file"]:not([capture])'));
  ok('有欄目下拉（支出分類）', !!d.querySelector('#pe-cat') && d.querySelector('#pe-cat').options.length > 5,
    String(d.querySelector('#pe-cat')?.options.length));
  ok('支出欄目包括「活動」同「交通」', txt().includes('活動'), txt().slice(0, 200));
  ok('有金額／項目／姓名欄', !!d.querySelector('#pe-amount') && !!d.querySelector('#pe-item') && !!d.querySelector('#pe-name'));
  ok('有收入／支出切換掣', d.querySelectorAll('[data-type]').length === 2);
  ok('預設係支出', d.querySelector('[data-type="expense"]')?.getAttribute('aria-pressed') === 'true');

  // 切去收入 → 欄目變團費
  d.querySelector('[data-type="income"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await wait(60);
  ok('切去「收入」之後欄目變團費／活動收費',
    Array.from(d.querySelectorAll('#pe-cat option')).some(o => o.textContent.includes('團費')),
    Array.from(d.querySelectorAll('#pe-cat option')).map(o => o.textContent).join('|').slice(0, 80));

  // 空表送出 → 提示
  d.getElementById('pe-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await wait(120);
  ok('空表送出會提示（唔會入到）', (d.getElementById('pe-err')?.textContent || '').includes('未填好'));
  ok('未送出時本機冇紀錄', !w.localStorage.getItem('venture82.entry.0082'));

  // 填好送出
  d.querySelector('#pe-cat').value = '團費';
  d.querySelector('#pe-cat').dispatchEvent(new w.Event('change', { bubbles: true }));
  d.querySelector('#pe-amount').value = '360';
  d.querySelector('#pe-amount').dispatchEvent(new w.Event('input', { bubbles: true }));
  d.querySelector('#pe-item').value = '9 月團費';
  d.querySelector('#pe-item').dispatchEvent(new w.Event('input', { bubbles: true }));
  d.querySelector('#pe-name').value = '測試團員';
  d.querySelector('#pe-name').dispatchEvent(new w.Event('input', { bubbles: true }));
  d.getElementById('pe-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await wait(300);

  const rows = JSON.parse(w.localStorage.getItem('venture82.entry.0082') || '[]');
  ok('填好之後送出成功（本機有紀錄）', rows.length === 1, String(rows.length));
  ok('紀錄內容正確（收入 360 團費）',
    rows[0]?.payload?.amount === 360 && rows[0]?.payload?.category === '團費' && rows[0]?.payload?.type === 'income',
    JSON.stringify(rows[0]?.payload));
  ok('紀錄有姓名同送出時間', rows[0]?.payload?.byName === '測試團員' && !!rows[0]?.payload?.submittedAt);
  ok('送出後有成功畫面', txt().includes('已記錄'));
  ok('成功畫面可以再記一筆', !!d.querySelector('[data-pe="again"]'));
  ok('成功畫面有「複製內容」傳送畀司庫', !!d.querySelector('[data-pe="copy"]'));
}

/* ---------- 錯誤 ---------- */
if (errors.length) {
  console.log(`\n捕捉到 ${errors.length} 個 console.error：`);
  errors.slice(0, 6).forEach(e => console.log('  • ' + e.slice(0, 200)));
}
const ms = Date.now() - t0;
console.log(`\n──────── 公開頁測試結果：${pass} 通過 / ${fail} 失敗（${ms} ms）────────`);
process.exit(fail ? 1 : 0);
