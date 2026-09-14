/* ============================================================
   notices.js — 通告 / 通函
   開一張通告 → 分享連結／QR Code 畀人睇 → 可以報名
   報名：① 上載公開頁（免登入）自己填；② 有設 GAS 網址就直接送去總表
   ============================================================ */

import { collection, add, update, remove, commit, load, find } from '../lib/store.js';
import { esc, icon, modal, confirmDlg, toast, uid, fmtDate, todayISO, nowStamp, copyText, qrSvg, photoViewer } from '../lib/util.js';
import { toWord, printDoc, toCSV, toMarkdown, download as dlFile, stamp } from '../lib/exporter.js';
import { go, parse, setQuery } from '../lib/router.js';
import { can, current } from '../lib/auth.js';
import { profile, settings, members } from '../lib/model.js';
import { pageHead, tabs, stat, empty, noteBox, photoPicker, photoStrip, bindPhotoPicker } from './ui.js';
import { compressImage, formatBytes } from '../lib/files.js';

let tab = 'list';
let filter = 'open';
let draft = null;          // 編輯中嘅通告
let draftPhotos = { photos: [] };
let draftFields = [];

const TYPES = [
  ['event', '活動通告'],
  ['meeting', '會議通告'],
  ['recruit', '招募 / 報名'],
  ['notice', '一般通告'],
  ['agm', '團員大會 / AGM']
];

const FIELD_TYPES = [
  ['text', '短答（文字）'],
  ['number', '數字'],
  ['tel', '電話'],
  ['email', '電郵'],
  ['date', '日期'],
  ['select', '選擇（下拉）'],
  ['radio', '選擇（單選）'],
  ['check', '剔選（可多選）'],
  ['textarea', '長答']
];

/* ---------- 預設報名表欄位 ---------- */
const DEFAULT_FIELDS = [
  { key: 'name', label: '姓名', type: 'text', required: true },
  { key: 'contact', label: '聯絡電話', type: 'tel', required: true },
  { key: 'member', label: '本人係', type: 'select', required: false, options: ['現役團員', '家長', '導師 / 領袖', '其他'] },
  { key: 'remark', label: '備註（飲食禁忌 / 特別需要）', type: 'textarea', required: false }
];

export function title() { return '通告'; }

function notices() {
  return collection('notices').slice().sort((a, b) =>
    String(b.publishAt || b.createdAt || '').localeCompare(String(a.publishAt || a.createdAt || '')));
}
function published(n) { return n.status === 'published'; }
function signupsOf(n) { return Array.isArray(n.signups) ? n.signups : []; }

export function render(params) {
  if (params.id === 'new') return editor(null);
  if (params.id === 'edit') return editor(find('notices', params.action));
  if (params.id && ['list', 'signups', 'settings'].includes(params.id)) tab = params.id;
  else if (!params.id) tab = ['list', 'signups', 'settings'].includes(params.query?.tab) ? params.query.tab : 'list';
  else if (params.id) return detail(params.id, params.query);

  const all = notices();
  const open = all.filter(n => n.status === 'published');
  const totalSignups = open.reduce((s, n) => s + signupsOf(n).length, 0);

  return `
  ${pageHead({
    title: '通告',
    sub: `${all.length} 張 · 已發布 ${open.length} 張 · 收到報名 ${totalSignups} 份`,
    actions: `
      <button class="btn btn-sm" data-act="preview-public">${icon('eye', 15)} 公開頁預覽</button>
      ${can('notice.create') ? `<button class="btn btn-sm btn-primary" data-act="new">${icon('plus', 15)} 開新通告</button>` : ''}`
  })}
  ${tabs([['list', '通告列表', all.length], ['signups', '報名紀錄', totalSignups], ['settings', '分享設定']], tab)}
  ${tab === 'signups' ? signupsView() : tab === 'settings' ? settingsView() : listView()}`;
}

/* ============================================================
   列表
   ============================================================ */
function listView() {
  const all = notices().filter(n => filter === 'all' ? true : filter === 'open' ? published(n) : !published(n));
  return `
  <div class="row-between wrap gap-12 mb-16 no-print">
    <div class="chipbar">
      ${[['open', '已發布'], ['draft', '草稿'], ['all', '全部']].map(([id, l]) =>
        `<button class="chip" data-nf="${id}" aria-pressed="${filter === id}">${l} <span class="faint">${id === 'all' ? notices().length : notices().filter(n => id === 'open' ? published(n) : !published(n)).length}</span></button>`).join('')}
    </div>
    ${can('notice.create') ? `<button class="btn btn-sm" data-act="new">${icon('plus', 15)} 開新通告</button>` : ''}
  </div>

  ${all.length ? `<div class="col gap-12">${all.map(n => noticeCard(n)).join('')}</div>`
    : empty('megaphone', '未有通告', '按「開新通告」開第一張，例如活動報名 / 會議通知')}`;
}

function noticeCard(n) {
  const s = signupsOf(n);
  const t = n.title || {};
  return `<div class="notice-card ${published(n) ? 'unread' : ''}">
    <div class="row-between wrap gap-10">
      <div class="grow">
        <div class="row gap-8 wrap">
          <span class="notice-chip">${esc(typeLabel(n.type))}</span>
          ${published(n) ? '<span class="badge b-ok"><span class="dot"></span>已發布</span>' : '<span class="badge b-warn"><span class="dot"></span>草稿</span>'}
          ${n.needSignup ? `<span class="badge b-info">報名 ${s.length}${n.quota ? ` / ${n.quota}` : ''}</span>` : ''}
          ${n.eventDate ? `<span class="badge b-grey">${esc(n.eventDate)}</span>` : ''}
        </div>
        <div class="notice-title mt-8">${esc(t.zh || '(無標題)')}</div>
        ${t.en ? `<div class="xs faint">${esc(t.en)}</div>` : ''}
        <div class="notice-meta">
          ${n.deadline ? `<span>截止 ${esc(n.deadline)}</span>` : ''}
          ${n.venue ? `<span>${esc(n.venue)}</span>` : ''}
          ${n.fee ? `<span>費用 ${esc(String(n.fee))}</span>` : ''}
          ${(n.attachments || []).length ? `<span>${(n.attachments || []).length} 張圖</span>` : ''}
        </div>
      </div>
      <div class="row gap-6 wrap no-print">
        <button class="btn btn-xs" data-open="${n.id}">詳情</button>
        ${can('notice.edit') ? `<button class="btn btn-xs" data-editn="${n.id}">${icon('edit', 13)}</button>` : ''}
        <button class="btn btn-xs" data-share="${n.id}">${icon('share', 13)} 分享</button>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   詳情
   ============================================================ */
function detail(id, query) {
  const n = find('notices', id);
  if (!n) return empty('megaphone', '搵唔到通告', '', `<button class="btn mt-12" data-go="#/notices">返回列表</button>`);
  const s = signupsOf(n);
  const url = publicUrl(n);
  return `
  ${pageHead({
    title: n.title?.zh || '通告',
    sub: `${typeLabel(n.type)} · ${published(n) ? '已發布 ' + (n.publishAt || '') : '草稿'} · 報名 ${s.length} 份`,
    actions: `<button class="btn btn-sm" data-go="#/notices">${icon('chevronL', 15)} 返回</button>
      ${published(n) ? `<button class="btn btn-sm" data-share="${n.id}">${icon('share', 15)} 分享 / QR</button>` : ''}
      ${can('notice.edit') ? `<button class="btn btn-sm" data-editn="${n.id}">${icon('edit', 15)} 編輯</button>` : ''}`
  })}

  <div class="grid g-2-1">
    <div class="col gap-16">
      <div class="card"><div style="padding:20px 22px">
        <div class="row gap-8 wrap mb-12">
          <span class="notice-chip">${esc(typeLabel(n.type))}</span>
          ${n.eventDate ? `<span class="badge b-grey">活動 ${esc(n.eventDate)}</span>` : ''}
          ${n.deadline ? `<span class="badge b-warn">截止 ${esc(n.deadline)}</span>` : ''}
          ${n.venue ? `<span class="badge b-grey">${esc(n.venue)}</span>` : ''}
        </div>
        <div class="notice-title" style="font-size:19px">${esc(n.title?.zh || '')}</div>
        ${n.title?.en ? `<div class="sm muted">${esc(n.title.en)}</div>` : ''}
        <div class="notice-body mt-12">${esc(n.body?.zh || '')}</div>
        ${n.body?.en ? `<div class="notice-body mt-12 muted" style="font-size:13.5px">${esc(n.body.en)}</div>` : ''}
        ${(n.attachments || []).length ? `<div class="mt-16"><div class="sm semibold mb-8">附件 / 相片</div>
          ${photoStrip(n.attachments, { prefix: 'notice' })}</div>` : ''}
        <div class="xs faint mt-16">發出：${esc(n.publishAt || n.createdAt || '')} · 由 ${esc(n.createdByName || current()?.name || '')}</div>
      </div></div>

      ${n.needSignup ? `<div class="card">
        <div class="card-head"><div><div class="card-title">報名紀錄（${s.length}${n.quota ? ` / ${n.quota}` : ''}）</div>
          <div class="card-sub">公開頁收到嘅報名會顯示喺呢度（同一部裝置）</div></div>
          <div class="row gap-6">
            <button class="btn btn-sm" data-act="export-signups">${icon('download', 15)} CSV</button>
            ${can('notice.edit') ? `<button class="btn btn-sm" data-act="add-signup">${icon('plus', 15)} 幫人報名</button>` : ''}
          </div></div>
        ${s.length ? `<div style="padding:14px 18px">
          ${s.map((r, i) => `<div class="signup-item">
            <div><div class="semibold sm">${esc(r.name || r.values?.name || '（無名）')}</div>
              <div class="xs faint">${esc(summaryOf(r))}</div></div>
            <div class="row gap-6">
              <span class="xs faint">${esc(String(r.at || '').slice(0, 16).replace('T', ' '))}</span>
              ${can('notice.edit') ? `<button class="btn btn-xs btn-ghost" data-delsignup="${r.id}">${icon('trash', 12)}</button>` : ''}
            </div></div>`).join('')}
        </div>` : empty('users', '未有人報名', published(n) ? '分享條連結出去就會開始收到報名' : '發布之後先可以報名')}
      </div>` : ''}
    </div>

    <div class="col gap-16">
      <div class="card"><div class="card-head"><div class="card-title">分享</div></div>
        <div style="padding:16px 18px">
          ${published(n) ? `
            <div class="qr-box" style="width:170px;margin:0 auto 12px"><div id="noticeQr">${qrSvg(url, 4, 1)}</div></div>
            <div class="xs mono" style="word-break:break-all;text-align:center">${esc(url)}</div>
            <div class="col gap-6 mt-12">
              <button class="btn btn-sm btn-block" data-act="copy-link">${icon('copy', 15)} 複製連結</button>
              <button class="btn btn-sm btn-block" data-act="share-text">${icon('send', 15)} 複製 WhatsApp 文字</button>
              <button class="btn btn-sm btn-block" data-act="qr-svg">${icon('download', 15)} 下載 QR Code</button>
            </div>` : `
            <div class="sm muted mb-12">發布之後先有分享連結。</div>
            ${can('notice.publish') ? `<button class="btn btn-primary btn-block" data-act="publish" data-id="${n.id}">${icon('megaphone', 16)} 立即發布</button>` : ''}`}
        </div>
      </div>

      ${n.needSignup ? `<div class="card"><div class="card-head"><div class="card-title">報名表欄位</div></div>
        <div style="padding:14px 18px" class="sm muted">
          ${(n.fields || []).map(f => `<div class="row-between" style="padding:4px 0"><span>${esc(f.label)}</span><span class="xs faint">${esc(fieldTypeLabel(f.type))}${f.required ? ' · 必填' : ''}</span></div>`).join('')}
        </div></div>` : ''}

      ${can('notice.edit') ? `<div class="card"><div style="padding:14px 16px" class="col gap-8">
        <button class="btn btn-sm btn-block" data-act="toggle-publish" data-id="${n.id}">${icon('eye', 15)} ${published(n) ? '改回草稿' : '發布'}</button>
        <button class="btn btn-sm btn-block" data-act="export-word" data-id="${n.id}">${icon('download', 15)} 輸出 Word</button>
        <button class="btn btn-sm btn-block" data-act="export-pdf" data-id="${n.id}">${icon('print', 15)} PDF / 列印</button>
        <button class="btn btn-sm btn-block" data-act="duplicate" data-id="${n.id}">${icon('copy', 15)} 複製成新通告</button>
        <button class="btn btn-sm btn-block btn-ghost" data-act="del" data-id="${n.id}">${icon('trash', 15)} 刪除</button>
      </div></div>` : ''}
    </div>
  </div>`;
}

function summaryOf(r) {
  const vals = r.values || {};
  const parts = [];
  Object.entries(vals).forEach(([k, v]) => {
    if (k === 'name' || v === '' || v === undefined || v === null) return;
    const f = (r.fields || []).find(x => x.key === k);
    parts.push(`${f?.label || k}: ${Array.isArray(v) ? v.join('、') : v}`);
  });
  return parts.join(' · ') || (r.contact ? `電話 ${r.contact}` : '');
}

/* ============================================================
   所有報名（跨通告）
   ============================================================ */
function signupsView() {
  const rows = [];
  notices().forEach(n => signupsOf(n).forEach(r => rows.push({ n, r })));
  rows.sort((a, b) => String(b.r.at || '').localeCompare(String(a.r.at || '')));
  return `
  <div class="row-between wrap gap-12 mb-16">
    <div class="toolbar">
      <button class="btn btn-sm" data-act="export-all-signups">${icon('download', 15)} 全部報名 CSV</button>
      <button class="btn btn-sm" data-act="export-all-word">${icon('download', 15)} 全部報名 Word</button>
    </div>
    <div class="sm muted">共 ${rows.length} 份</div>
  </div>
  <div class="card">
    ${rows.length ? `<div class="scroll-x"><table class="table">
      <thead><tr><th>時間</th><th>通告</th><th>姓名</th><th>聯絡</th><th>其他</th><th></th></tr></thead>
      <tbody>${rows.map(({ n, r }) => `<tr>
        <td class="mono xs">${esc(String(r.at || '').slice(0, 16).replace('T', ' '))}</td>
        <td class="sm"><a href="#/notices/${n.id}">${esc(n.title?.zh || '')}</a></td>
        <td class="semibold sm">${esc(r.name || r.values?.name || '')}</td>
        <td class="sm">${esc(r.values?.contact || r.contact || '')}</td>
        <td class="sm">${esc(summaryOf({ ...r, values: omit(r.values, ['name', 'contact']) }))}</td>
        <td class="right">${can('notice.edit') ? `<button class="btn btn-xs btn-ghost" data-delsignup="${r.id}" data-notice="${n.id}">${icon('trash', 12)}</button>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>` : empty('users', '未有報名紀錄')}
  </div>`;
}
function omit(obj, keys) {
  const o = { ...(obj || {}) };
  keys.forEach(k => delete o[k]);
  return o;
}

/* ============================================================
   分享設定
   ============================================================ */
function settingsView() {
  const s = settings().notice || {};
  return `
  <div class="grid g-2">
    <div class="card"><div class="card-head"><div><div class="card-title">公開頁網址</div>
      <div class="card-sub">通告會用嘅網址（QR Code / 分享連結用呢個）</div></div></div>
      <div style="padding:16px 18px">
        <div class="field"><label class="label">公開頁基礎網址</label>
          <input class="input" id="n-base" value="${esc(s.publicBaseUrl || '')}" placeholder="例：https://你的網址/notice.html">
          <div class="hint">留空就用 <code>notice.html?u=${esc(load().unitCode)}&n=&lt;通告編號&gt;</code>（同團章公開頁一樣，可上載去任何靜態主機）。</div></div>
        <div class="field mt-12"><label class="label">預設報名表</label>
          <div class="sm muted">新通告預設會用：${DEFAULT_FIELDS.map(f => esc(f.label)).join('、')}</div></div>
        ${can('notice.edit') ? `<button class="btn btn-primary mt-12" data-act="save-settings">${icon('save', 15)} 儲存</button>` : ''}
      </div>
    </div>

    <div class="card"><div class="card-head"><div><div class="card-title">報名送去邊？</div>
      <div class="card-sub">跨裝置收集報名（要一個 Google Apps Script 網址）</div></div></div>
      <div style="padding:16px 18px">
        <div class="field"><label class="label">報名收集網址（Apps Script / 任何表單端點）</label>
          <input class="input" id="n-submit" value="${esc(s.submitUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec">
          <div class="hint">設定咗：公開頁嘅報名會直接 POST 去你嘅總表（Google Sheet）。
            未設定：報名會存喺填表人自己嗰部裝置，領袖可以喺該裝置輸出 CSV。
            Apps Script 範本可以喺「表格與同步」頁下載。</div></div>
        ${can('notice.edit') ? `<button class="btn btn-primary mt-12" data-act="save-settings">${icon('save', 15)} 儲存</button>` : ''}
      </div>
    </div>

    <div class="card"><div class="card-head"><div class="card-title">可以公開分享嘅頁面</div></div>
      <div style="padding:16px 18px" class="sm">
        <div class="row-between" style="padding:6px 0"><span><b>通告公開頁</b>（免登入、可報名）</span><code class="xs">notice.html?u=${esc(load().unitCode)}&amp;n=&lt;編號&gt;</code></div>
        <div class="row-between" style="padding:6px 0"><span><b>團章公開頁</b></span><code class="xs">constitution.html?u=${esc(load().unitCode)}</code></div>
        <div class="hint mt-8">兩個頁面都係獨立檔案，可以連 <code>data/units/&lt;編號&gt;/</code> 一齊上載去 GitHub Pages／Netlify／學校網頁空間。</div>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   編輯器
   ============================================================ */
function editor(n) {
  if (draft?.id !== (n?.id || 'new')) {
    draft = n ? JSON.parse(JSON.stringify(n)) : {
      id: 'new', type: 'event', status: 'draft',
      title: { zh: '', en: '' }, body: { zh: '', en: '' },
      needSignup: true, quota: 0, fields: JSON.parse(JSON.stringify(DEFAULT_FIELDS)),
      attachments: [], publishAt: '', eventDate: '', deadline: '', venue: '', fee: ''
    };
    draftPhotos = { photos: draft.attachments || [] };
    draftFields = draft.fields || [];
  }
  const d = draft;
  const isNew = d.id === 'new';

  return `
  ${pageHead({
    title: isNew ? '開新通告' : '編輯通告',
    sub: '填好之後可以發布 → 分享連結／QR Code 出去 → 收報名',
    actions: `<button class="btn btn-sm" data-act="cancel">${icon('chevronL', 15)} 返回</button>`
  })}

  <div class="grid g-2-1">
    <div class="col gap-16">
      <div class="card"><div style="padding:18px 20px">
        <div class="grid g-2" style="gap:12px">
          <div class="field"><label class="label">通告類型</label>
            <select class="select" id="n-type">${TYPES.map(([v, l]) => `<option value="${v}" ${d.type === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
          <div class="field"><label class="label">活動日期</label>
            <input class="input" id="n-event" type="date" value="${esc(d.eventDate || '')}"></div>
          <div class="field" style="grid-column:1/-1"><label class="label">標題（中文） <span class="req">*</span></label>
            <input class="input" id="n-title" value="${esc(d.title?.zh || '')}" placeholder="例：2026 秋季露營 — 報名及須知"></div>
          <div class="field" style="grid-column:1/-1"><label class="label">Title (English)</label>
            <input class="input" id="n-title-en" value="${esc(d.title?.en || '')}" placeholder="Optional"></div>
          <div class="field" style="grid-column:1/-1"><label class="label">內容（中文）</label>
            <textarea class="textarea" id="n-body" style="min-height:190px" placeholder="可以直接打，支援換行。&#10;例：&#10;日期：2026-10-17 至 10-18&#10;集合：上午 8:30 康山花園地下&#10;費用：$380（團費津貼 30%，上限 $70）&#10;帶備：睡袋、雨衣、個人藥物">${esc(d.body?.zh || '')}</textarea></div>
          <div class="field" style="grid-column:1/-1"><label class="label">Body (English)</label>
            <textarea class="textarea" id="n-body-en" style="min-height:90px">${esc(d.body?.en || '')}</textarea></div>
          <div class="field"><label class="label">截止日期</label>
            <input class="input" id="n-deadline" type="date" value="${esc(d.deadline || '')}"></div>
          <div class="field"><label class="label">地點</label>
            <input class="input" id="n-venue" value="${esc(d.venue || '')}" placeholder="例：西貢創興水上活動中心"></div>
          <div class="field"><label class="label">費用</label>
            <input class="input" id="n-fee" value="${esc(String(d.fee || ''))}" placeholder="例：$380（會員）/ $420（非會員）"></div>
          <div class="field"><label class="label">名額</label>
            <input class="input" id="n-quota" type="number" min="0" value="${Number(d.quota) || 0}" placeholder="0 = 不限"></div>
        </div>
        ${photoPicker('n-photos', { label: '附件 / 相片（可以影海報、通告紙本、位置圖）', hint: '相片會自動壓縮；手機可以直接影相。' })}
        <div id="n-photo-note" class="hint"></div>
      </div></div>

      <div class="card">
        <div class="card-head"><div><div class="card-title">報名表</div>
          <div class="card-sub">可以自己改名／加欄位（同 Google Form 一樣）</div></div>
          <label class="check"><input type="checkbox" id="n-need" ${d.needSignup ? 'checked' : ''}> 需要報名</label></div>
        <div id="n-fields-wrap" style="padding:14px 18px"></div>
        <div style="padding:0 18px 16px" class="row gap-8 wrap">
          <button class="btn btn-sm" data-act="add-field">${icon('plus', 15)} 加欄位</button>
          <button class="btn btn-sm" data-act="reset-fields">${icon('refresh', 15)} 用預設欄位</button>
        </div>
      </div>
    </div>

    <div class="col gap-16">
      <div class="card"><div class="card-head"><div class="card-title">狀態</div></div>
        <div style="padding:14px 16px" class="col gap-8">
          <div>${d.status === 'published' ? '<span class="badge b-ok"><span class="dot"></span>已發布</span>' : '<span class="badge b-warn"><span class="dot"></span>草稿（未發布）</span>'}</div>
          <button class="btn btn-primary btn-block" data-act="save" data-publish="${d.status === 'published' ? '1' : ''}">${icon('save', 16)} 儲存${d.status === 'published' ? '' : '草稿'}</button>
          <button class="btn btn-block" data-act="save-publish">${icon('megaphone', 16)} 儲存並發布</button>
          ${!isNew ? `<button class="btn btn-block btn-ghost" data-act="del" data-id="${d.id}">${icon('trash', 15)} 刪除</button>` : ''}
        </div>
      </div>

      <div class="card"><div class="card-head"><div class="card-title">提示</div></div>
        <div style="padding:14px 18px" class="sm muted">
          <ul style="padding-left:18px;line-height:1.85">
            <li>發布後會出現 <b>分享連結 + QR Code</b>，貼落 WhatsApp 群就得</li>
            <li>公開頁<b>免登入</b>，團員／家長用手機開就見到通告</li>
            <li>要收報名：喺「分享設定」填 Apps Script 網址（就會自動寫入總表）；<br>未填都收得，只係存在填表人嗰部機</li>
            <li>通告唔會包含任何私人資料</li>
          </ul>
        </div>
      </div>
    </div>
  </div>`;
}

function fieldsHtml() {
  return `
    ${draftFields.length ? draftFields.map((f, i) => `
      <div class="schema-row" data-f="${i}">
        <input class="input" data-k="label" value="${esc(f.label || '')}" placeholder="欄位名稱" style="padding:7px 10px">
        <select class="select" data-k="type" style="padding:7px 10px">
          ${FIELD_TYPES.map(([v, l]) => `<option value="${v}" ${f.type === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select>
        <div class="row gap-6">
          <input class="input" data-k="options" value="${esc((f.options || []).join('、'))}" placeholder="選項（用、分隔）"
            style="padding:7px 10px;${['select', 'radio', 'check'].includes(f.type) ? '' : 'display:none'}">
          <label class="check xs"><input type="checkbox" data-k="required" ${f.required ? 'checked' : ''}> 必填</label>
        </div>
        <div class="row gap-4">
          <button class="btn btn-xs btn-ghost" data-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn btn-xs btn-ghost" data-down="${i}" ${i === draftFields.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn btn-xs btn-ghost" data-delf="${i}">${icon('trash', 12)}</button>
        </div>
      </div>`).join('') : '<div class="sm faint">未有欄位（可以唔加，純粹發布通告）</div>'}`;
}

/* ============================================================
   公開網址
   ============================================================ */
export function publicUrl(n) {
  const s = settings().notice || {};
  const file = s.publicBaseUrl || 'notice.html';
  const sep = file.includes('?') ? '&' : '?';
  return `${file}${sep}u=${encodeURIComponent(load().unitCode)}&n=${encodeURIComponent(n.id)}`;
}
function typeLabel(t) { return (TYPES.find(x => x[0] === t) || ['', '通告'])[1]; }
function fieldTypeLabel(t) { return (FIELD_TYPES.find(x => x[0] === t) || ['', t])[1]; }

/* ============================================================
   mount
   ============================================================ */
export function mount(root, params) {
  root.querySelectorAll('[data-nf]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.nf; refresh(); }));
  root.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => go('#/notices/' + b.dataset.open)));
  root.querySelectorAll('[data-editn]').forEach(b => b.addEventListener('click', () => go('#/notices/edit/' + b.dataset.editn)));
  root.querySelectorAll('[data-share]').forEach(b => b.addEventListener('click', () => shareDialog(find('notices', b.dataset.share))));
  root.querySelectorAll('[data-delsignup]').forEach(b => b.addEventListener('click', async () => {
    const noticeId = b.dataset.notice || params.id;
    if (!(await confirmDlg({ title: '刪除報名', danger: true, okText: '確定刪除', message: '確定刪除呢份報名紀錄？' }))) return;
    const n = find('notices', noticeId);
    if (!n) return;
    update('notices', n.id, { signups: signupsOf(n).filter(x => x.id !== b.dataset.delsignup) });
    toast('已刪除報名', 'ok'); refresh();
  }));

  // 相片檢視
  root.querySelectorAll('[data-photo]').forEach(el => el.addEventListener('click', () => {
    const n = find('notices', params.id);
    photoViewer(n?.attachments || [], Number(el.dataset.i));
  }));

  // 編輯器
  if (draft && (params.id === 'new' || params.id === 'edit')) {
    bindPhotoPicker(root, 'n-photos', draftPhotos, { max: 8 });
    const wrap = root.querySelector('#n-fields-wrap');
    const paintFields = () => { if (wrap) wrap.innerHTML = fieldsHtml(); bindFieldRows(wrap); };
    paintFields();

    root.querySelector('#n-need')?.addEventListener('change', e => { draft.needSignup = e.target.checked; refresh(); });

    root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'cancel') { draft = null; return go('#/notices'); }
      if (act === 'add-field') {
        syncFields(root);
        draftFields.push({ key: 'f' + (draftFields.length + 1) + '_' + Math.random().toString(36).slice(2, 5), label: '', type: 'text', required: false });
        paintFields(); return;
      }
      if (act === 'reset-fields') {
        draftFields = JSON.parse(JSON.stringify(DEFAULT_FIELDS)); paintFields(); return;
      }
      if (act === 'save' || act === 'save-publish') {
        const title = root.querySelector('#n-title').value.trim();
        if (!title) { toast('請填標題', 'err'); return; }
        syncFields(root);
        const patch = {
          type: root.querySelector('#n-type').value,
          title: { zh: title, en: root.querySelector('#n-title-en').value.trim() },
          body: { zh: root.querySelector('#n-body').value, en: root.querySelector('#n-body-en').value.trim() },
          eventDate: root.querySelector('#n-event').value,
          deadline: root.querySelector('#n-deadline').value,
          venue: root.querySelector('#n-venue').value.trim(),
          fee: root.querySelector('#n-fee').value.trim(),
          quota: Number(root.querySelector('#n-quota').value) || 0,
          needSignup: root.querySelector('#n-need').checked,
          fields: draftFields,
          attachments: draftPhotos.photos
        };
        if (act === 'save-publish' || b.dataset.publish === '1') {
          patch.status = 'published';
          if (!draft.publishAt) patch.publishAt = todayISO();
        } else patch.status = 'draft';
        let id = draft.id;
        const payload = {
          ...patch,
          createdByName: current()?.name || '',
          updatedAt: nowStamp(),
          signups: draft.signups || []
        };
        if (id === 'new') {
          const created = add('notices', { id: uid('nt'), createdAt: nowStamp(), ...payload });
          id = created?.id;
        } else {
          update('notices', id, payload);
        }
        draft = null;
        toast(patch.status === 'published' ? '已發布通告' : '已儲存草稿', 'ok');
        go('#/notices/' + id);
      }
      if (act === 'del') {
        confirmDlg({ title: '刪除通告', danger: true, okText: '確定刪除', message: '刪除後無法復原（包括報名紀錄）。' })
          .then(ok => { if (!ok) return; remove('notices', b.dataset.id); draft = null; toast('已刪除', 'ok'); go('#/notices'); });
      }
    }));
  }

  // 詳情頁動作
  root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', async () => {
    const act = b.dataset.act;
    const n = find('notices', params.id);
    if (act === 'publish') { update('notices', n.id, { status: 'published', publishAt: n.publishAt || todayISO() }); toast('已發布', 'ok'); refresh(); }
    if (act === 'toggle-publish') { update('notices', n.id, { status: published(n) ? 'draft' : 'published', publishAt: n.publishAt || todayISO() }); refresh(); }
    if (act === 'copy-link') {
      if (await copyText(publicUrl(n))) toast('已複製通告連結', 'ok'); else toast('複製失敗', 'err');
    }
    if (act === 'share-text') {
      const url = publicUrl(n);
      const txt = `【${profile().name || ''}】${n.title?.zh || '通告'}\n`
        + (n.eventDate ? `日期：${n.eventDate}\n` : '')
        + (n.deadline ? `報名截止：${n.deadline}\n` : '')
        + (n.venue ? `地點：${n.venue}\n` : '')
        + (n.fee ? `費用：${n.fee}\n` : '')
        + (n.needSignup ? `\n報名／詳情：${url}` : `\n詳情：${url}`);
      if (await copyText(txt)) toast('已複製 WhatsApp 文字', 'ok'); else toast('複製失敗', 'err');
    }
    if (act === 'qr-svg') {
      const svg = qrSvg(publicUrl(n), 8, 3);
      dlFile(`通告QR_${n.id}.svg`, '<?xml version="1.0" encoding="UTF-8"?>' + svg, 'image/svg+xml;charset=utf-8');
    }
    if (act === 'export-word') exportNoticeWord(n);
    if (act === 'export-pdf') printNotice(n);
    if (act === 'export-signups') exportSignupsCsv([{ n, rows: signupsOf(n) }], `通告報名_${n.id}`);
    if (act === 'export-all-signups') {
      const groups = notices().map(x => ({ n: x, rows: signupsOf(x) })).filter(g => g.rows.length);
      exportSignupsCsv(groups, '通告報名_全部');
    }
    if (act === 'export-all-word') exportAllSignupsWord();
    if (act === 'duplicate') {
      const copy = JSON.parse(JSON.stringify(n));
      delete copy.id;
      copy.status = 'draft'; copy.signups = []; copy.publishAt = '';
      copy.title = { zh: (n.title?.zh || '') + '（複本）', en: n.title?.en || '' };
      const created = add('notices', { id: uid('nt'), createdAt: nowStamp(), ...copy, createdByName: current()?.name || '' });
      toast('已複製通告', 'ok'); go('#/notices/edit/' + created.id);
    }
    if (act === 'del') {
      if (!(await confirmDlg({ title: '刪除通告', danger: true, okText: '確定刪除', message: '刪除後無法復原。' }))) return;
      remove('notices', n.id); toast('已刪除', 'ok'); go('#/notices');
    }
    if (act === 'add-signup') {
      const r = await modal({
        title: '幫人報名', sub: n.title?.zh || '',
        body: `<div class="col gap-10">
          ${(n.fields || []).map(f => `<div class="field"><label class="label">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>
            ${fieldInput(f, '')}</div>`).join('')}
        </div>`,
        actions: [{ label: '取消', class: 'btn', value: null },
          { label: '加入', class: 'btn-primary', onClick: el => collectFields(el, n.fields) }]
      });
      if (!r) return;
      const cur = find('notices', n.id);
      add_signup(cur || n, r);
      toast('已加入報名', 'ok'); refresh();
    }
    if (act === 'save-settings') {
      const db = load();
      db.settings = { ...db.settings, notice: {
        ...(db.settings.notice || {}),
        publicBaseUrl: root.querySelector('#n-base').value.trim(),
        submitUrl: root.querySelector('#n-submit').value.trim()
      } };
      commit(); toast('已儲存分享設定', 'ok');
    }
    if (act === 'preview-public') {
      const first = notices().find(published) || notices()[0];
      if (!first) { toast('未有通告', 'err'); return; }
      window.open(publicUrl(first), '_blank');
    }
  }));
}

function bindFieldRows(wrap) {
  if (!wrap) return;
  wrap.querySelectorAll('[data-k]').forEach(el => el.addEventListener('change', () => {
    const row = el.closest('[data-f]');
    const i = Number(row.dataset.f);
    const k = el.dataset.k;
    draftFields[i][k] = k === 'required' ? el.checked : el.value;
    if (k === 'options') draftFields[i].options = String(el.value).split(/[、,，]/).map(x => x.trim()).filter(Boolean);
    if (k === 'type') refresh();
    if (k === 'label' && !draftFields[i].key) draftFields[i].key = 'f' + (i + 1);
  }));
  wrap.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', () => {
    const i = Number(b.dataset.up);
    [draftFields[i - 1], draftFields[i]] = [draftFields[i], draftFields[i - 1]];
    refresh();
  }));
  wrap.querySelectorAll('[data-down]').forEach(b => b.addEventListener('click', () => {
    const i = Number(b.dataset.down);
    [draftFields[i + 1], draftFields[i]] = [draftFields[i], draftFields[i + 1]];
    refresh();
  }));
  wrap.querySelectorAll('[data-delf]').forEach(b => b.addEventListener('click', () => {
    draftFields.splice(Number(b.dataset.delf), 1); refresh();
  }));
}

function syncFields(root) {
  root.querySelectorAll('#n-fields-wrap [data-f]').forEach(row => {
    const i = Number(row.dataset.f);
    if (!draftFields[i]) return;
    draftFields[i].label = row.querySelector('[data-k="label"]').value.trim();
    draftFields[i].type = row.querySelector('[data-k="type"]').value;
    draftFields[i].required = row.querySelector('[data-k="required"]').checked;
    draftFields[i].options = row.querySelector('[data-k="options"]').value.split(/[、,，]/).map(x => x.trim()).filter(Boolean);
  });
  draft.fields = draftFields;
}

/* ---------- 欄位輸入（公開頁同內部都用） ---------- */
export function fieldInput(f, value) {
  const v = value === undefined || value === null ? '' : value;
  const req = f.required ? 'required' : '';
  if (f.type === 'textarea') return `<textarea class="textarea" data-fk="${esc(f.key)}" ${req} rows="3">${esc(v)}</textarea>`;
  if (f.type === 'select') return `<select class="select" data-fk="${esc(f.key)}" ${req}>
    <option value="">— 請選擇 —</option>
    ${(f.options || []).map(o => `<option ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  if (f.type === 'radio') return `<div class="col gap-6">${(f.options || []).map((o, i) => `
    <label class="check"><input type="radio" name="${esc(f.key)}" data-fk="${esc(f.key)}" value="${esc(o)}" ${v === o ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div>`;
  if (f.type === 'check') return `<div class="col gap-6">${(f.options || []).map(o => `
    <label class="check"><input type="checkbox" data-fk="${esc(f.key)}" value="${esc(o)}" ${Array.isArray(v) && v.includes(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div>`;
  const type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'text';
  return `<input class="input" type="${type}" data-fk="${esc(f.key)}" ${req} value="${esc(v)}" ${f.type === 'number' ? 'step="0.01"' : ''}>`;
}
export function collectFields(container, fields) {
  const out = {};
  (fields || []).forEach(f => {
    const els = container.querySelectorAll(`[data-fk="${f.key}"]`);
    if (!els.length) return;
    if (f.type === 'check') {
      out[f.key] = Array.from(els).filter(e => e.checked).map(e => e.value);
    } else if (f.type === 'radio') {
      const c = Array.from(els).find(e => e.checked);
      out[f.key] = c ? c.value : '';
    } else {
      out[f.key] = els[0].value.trim();
    }
  });
  return out;
}
/** 加入一份報名（內部用） */
export function add_signup(n, values) {
  const list = signupsOf(n);
  const row = {
    id: uid('sg'), at: new Date().toISOString(), values,
    name: values.name || values['姓名'] || '', fields: n.fields || []
  };
  update('notices', n.id, { signups: [...list, row] });
  return row;
}

/* ============================================================
   分享對話框
   ============================================================ */
async function shareDialog(n) {
  if (!n) return;
  if (!published(n)) {
    const ok = await confirmDlg({ title: '未發布', okText: '發布並分享', message: '呢張通告仲係草稿，發布之後先分享得。要現在發布嗎？' });
    if (!ok) return;
    update('notices', n.id, { status: 'published', publishAt: n.publishAt || todayISO() });
    refresh();
    n = find('notices', n.id);
  }
  const url = publicUrl(n);
  await modal({
    title: '分享通告', sub: n.title?.zh || '', wide: true,
    body: `
      <div class="grid g-2" style="gap:14px">
        <div class="center"><div class="qr-box" style="width:200px;margin:0 auto">${qrSvg(url, 5, 2)}</div>
          <div class="xs faint mt-8">團員／家長掃 QR 就開到通告同報名表</div></div>
        <div class="col gap-10">
          <div class="field"><label class="label">公開連結</label>
            <input class="input" id="sh-url" value="${esc(url)}" readonly></div>
          <button class="btn btn-primary btn-block" data-sh="copy">${icon('copy', 15)} 複製連結</button>
          <button class="btn btn-block" data-sh="wa">${icon('send', 15)} 複製 WhatsApp 文字</button>
          <button class="btn btn-block" data-sh="svg">${icon('download', 15)} 下載 QR Code（SVG）</button>
          <div class="hint">貼落 WhatsApp 群／發通告紙本都得。公開頁免登入，只顯示通告內容。</div>
        </div>
      </div>`,
    actions: [{ label: '關閉', class: 'btn', value: null }],
    onMount: el => {
      el.querySelectorAll('[data-sh]').forEach(b => b.addEventListener('click', async () => {
        const a = b.dataset.sh;
        if (a === 'copy') { if (await copyText(url)) toast('已複製', 'ok'); }
        if (a === 'svg') dlFile(`通告QR_${n.id}.svg`, '<?xml version="1.0" encoding="UTF-8"?>' + qrSvg(url, 8, 3), 'image/svg+xml;charset=utf-8');
        if (a === 'wa') {
          const txt = `【${profile().name || ''}】${n.title?.zh || '通告'}\n${n.eventDate ? `日期：${n.eventDate}\n` : ''}${n.deadline ? `截止：${n.deadline}\n` : ''}${n.needSignup ? `報名：${url}` : `詳情：${url}`}`;
          if (await copyText(txt)) toast('已複製 WhatsApp 文字', 'ok');
        }
      }));
    }
  });
  if (typeof refresh === 'function') refresh();
}

/* ============================================================
   輸出
   ============================================================ */
function noticeBodyHtml(n) {
  const L = [];
  L.push(`<div class="doc-head"><div class="doc-org">${esc(profile().name || '')}</div>
    <div class="doc-title">${esc(n.title?.zh || '通告')}</div>
    ${n.title?.en ? `<div class="doc-sub">${esc(n.title.en)}</div>` : ''}</div>`);
  L.push(`<div class="doc-meta"><span>${esc(typeLabel(n.type))}</span><span>發出：${esc(n.publishAt || n.createdAt || '')}</span>${n.deadline ? `<span>截止：${esc(n.deadline)}</span>` : ''}</div>`);
  const kv = [
    ['活動日期', n.eventDate], ['地點', n.venue], ['費用', n.fee],
    ['名額', n.quota ? `${n.quota} 人` : ''],
    ['報名截止', n.deadline]
  ].filter(([, v]) => v);
  if (kv.length) L.push(`<p>${kv.map(([k, v]) => `<b>${esc(k)}：</b>${esc(String(v))}`).join('　　')}</p>`);
  L.push(`<p style="white-space:pre-wrap;line-height:1.85">${esc(n.body?.zh || '')}</p>`);
  if (n.body?.en) L.push(`<p class="en-block" style="white-space:pre-wrap">${esc(n.body.en)}</p>`);
  L.push(`<p class="foot">報名／詳情：${esc(publicUrl(n))}</p>`);
  return L.join('');
}
export function exportNoticeWord(n) {
  toWord({
    filename: `通告_${(n.title?.zh || 'untitled').slice(0, 20)}_${stamp()}.doc`,
    title: n.title?.zh || '通告', org: profile().name, bodyHtml: noticeBodyHtml(n)
  });
}
export function printNotice(n) {
  printDoc({ title: n.title?.zh || '通告', org: profile().name, bodyHtml: noticeBodyHtml(n) });
}
export function exportSignupsCsv(groups, filename) {
  const rows = [];
  groups.forEach(({ n, rows: list }) => list.forEach(r => {
    const base = [n.title?.zh || '', n.id, String(r.at || '').slice(0, 16).replace('T', ' '), r.values?.name || r.name || ''];
    const rest = (n.fields || []).filter(f => f.key !== 'name').map(f => {
      const v = r.values?.[f.key];
      return Array.isArray(v) ? v.join('、') : (v === undefined ? '' : v);
    });
    rows.push([...base, ...rest]);
  }));
  const headers = ['通告', '通告編號', '報名時間', '姓名'];
  const extra = [...new Set(groups.flatMap(g => (g.n.fields || []).filter(f => f.key !== 'name').map(f => f.label)))];
  toCSV({ filename: `${filename}_${stamp()}.csv`, headers: [...headers, ...extra], rows });
  toast('已匯出報名 CSV', 'ok');
}
export function exportAllSignupsWord() {
  const groups = notices().map(n => ({ n, rows: signupsOf(n) })).filter(g => g.rows.length);
  const body = groups.map(({ n, rows }) => `
    <h2>${esc(n.title?.zh || '')}</h2>
    <p class="en-block">${esc(n.eventDate || '')} ${esc(n.venue ? '· ' + n.venue : '')}</p>
    <table><thead><tr><th>#</th><th>姓名</th>${(n.fields || []).filter(f => f.key !== 'name').map(f => `<th>${esc(f.label)}</th>`).join('')}<th>時間</th></tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.values?.name || r.name || '')}</td>
      ${(n.fields || []).filter(f => f.key !== 'name').map(f => {
        const v = r.values?.[f.key];
        return `<td>${esc(Array.isArray(v) ? v.join('、') : (v || ''))}</td>`;
      }).join('')}
      <td>${esc(String(r.at || '').slice(0, 16).replace('T', ' '))}</td></tr>`).join('')}</tbody></table>`).join('');
  toWord({
    filename: `通告報名總表_${stamp()}.doc`, title: '通告報名總表', org: profile().name,
    bodyHtml: `<div class="doc-head"><div class="doc-title">通告報名總表</div>
      <div class="doc-sub">${esc(profile().name || '')} · ${esc(todayISO())}</div></div>${body || '<p>（未有報名）</p>'}`
  });
  toast('已輸出 Word', 'ok');
}

export function refresh() { window.dispatchEvent(new CustomEvent('v82:refresh')); }
