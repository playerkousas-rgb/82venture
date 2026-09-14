/* ============================================================
   progress.js — 團員進度紀錄（接駁現有系統）
   ============================================================ */

import { load, commit } from '../lib/store.js';
import { esc, icon, modal, toast, qrSvg, copyText, avatar } from '../lib/util.js';
import { memberName, attendanceStats, members } from '../lib/model.js';
import { can, current, ROLES, currentRole } from '../lib/auth.js';

export function title() { return '進度紀錄'; }

export function render() {
  const db = load();
  const url = db.settings.progressUrl || '';
  const name = db.settings.progressName || '團員進度紀錄系統';
  const role = ROLES[currentRole()] || ROLES.exco;

  return `
  <div class="page-head">
    <div>
      <div class="page-title">團員進度紀錄</div>
      <div class="page-sub">獎章、訓練、評核 —— 由現有系統管理，呢度係入口</div>
    </div>
    <div class="row gap-8 no-print">
      ${url && can('progress.config') ? `<button class="btn" data-act="config">${icon('settings', 16)} 設定</button>` : ''}
      ${url ? `<button class="btn btn-primary" data-act="open">${icon('external', 16)} 開啟進度系統</button>` : ''}
    </div>
  </div>

  ${url ? connectedView(url, name, role) : setupView()}

  <div class="grid g-2 mt-16">
    <div class="card">
      <div class="card-head"><div class="card-title">呢度睇到咩</div>
        <div class="card-sub">本系統保留嘅進度相關資料</div></div>
      <div style="padding:6px 0 6px">
        ${members().filter(m => m.status === 'active').slice(0, 6).map(m => {
          const s = attendanceStats(m.id);
          return `<div class="row gap-12" style="padding:10px 16px;border-bottom:1px solid var(--line-2)">
            ${avatar(m.name, 'avatar-sm')}
            <div class="grow"><div class="sm semibold">${esc(m.name)}</div>
              <div class="xs faint">${esc(m.role)}</div></div>
            <div class="right" style="min-width:96px">
              <div class="sm mono" style="color:${s.rate >= 80 ? 'var(--ok)' : s.rate >= 50 ? 'var(--warn)' : 'var(--danger)'}">出席 ${s.rate}%</div>
              <div class="bar mt-4 ${s.rate >= 80 ? '' : s.rate >= 50 ? 'warn' : 'danger'}"><span style="width:${s.rate}%"></span></div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="padding:12px 16px;border-top:1px solid var(--line-2)">
        <p class="xs faint">出席率、團費、會議參與由本系統計算；獎章／訓練進度請到進度系統查閱。</p>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title">存取身份</div></div>
      <div style="padding:16px 18px">
        <dl class="kv">
          <dt>目前身分</dt><dd><span class="badge b-brand">${esc(role.name)}</span></dd>
          <dt>登入帳號</dt><dd class="mono">${esc(current()?.username || '—')}</dd>
          <dt>傳遞身份</dt><dd><b>執委會</b>（executive）</dd>
        </dl>
        <div class="mt-16" style="padding:12px;background:var(--brand-50);border-radius:var(--r);border:1px solid var(--brand-100)">
          <div class="row gap-8"><span style="color:var(--brand-700);display:flex">${icon('shield', 16)}</span>
            <div class="sm" style="color:var(--brand-800)">由呢度連過去時，系統會以「執委會」身份進入，可查閱全團團員進度。</div></div>
        </div>
        <div class="mt-12 hint">接上後端後，呢度可以改用一次性的簽名連結（SSO token），進入時自動帶身份，唔使再登入一次。</div>
      </div>
    </div>
  </div>`;
}

function connectedView(url, name, role) {
  const shareUrl = url;
  return `
  <div class="card">
    <div class="card-head">
      <div class="row gap-10">
        <div class="stat-ic" style="background:var(--ok-bg);color:var(--ok)">${icon('check', 18)}</div>
        <div><div class="card-title">${esc(name)}</div>
          <div class="card-sub mono" style="word-break:break-all">${esc(url)}</div></div>
      </div>
      <span class="badge b-ok"><span class="dot"></span>已接駁</span>
    </div>
    <div style="padding:22px">
      <div class="grid g-2" style="align-items:center">
        <div>
          <p class="semibold mb-8">直接用執委會身份進入</p>
          <p class="sm muted mb-16">喺新分頁開啟進度紀錄系統，可查閱同更新全團團員嘅進度紀錄。</p>
          <div class="row gap-8 wrap">
            <button class="btn btn-primary" data-act="open">${icon('external', 16)} 開啟進度系統</button>
            <button class="btn" data-act="copy">${icon('copy', 16)} 複製連結</button>
            <button class="btn" data-act="qr">${icon('qr', 16)} QR Code</button>
          </div>
        </div>
        <div class="center">
          <div class="qr-box" style="width:150px;margin:0 auto">
            <div id="progQr">${qrSvg(shareUrl, 5, 1)}</div>
          </div>
          <div class="xs faint mt-8">掃描即可開啟進度系統</div>
        </div>
      </div>
      <div class="mt-16 row gap-8 wrap">
        <label class="check"><input type="checkbox" id="embedToggle"> 喺下面內嵌預覽</label>
        <span class="xs faint">（部分網站唔允許內嵌，會顯示空白）</span>
      </div>
      <div id="embedWrap" class="hide mt-12">
        <iframe src="${esc(url)}" style="width:100%;height:460px;border:1px solid var(--line);border-radius:var(--r-lg);background:#fff"></iframe>
      </div>
    </div>
  </div>`;
}

function setupView() {
  return `
  <div class="card">
    <div class="card-head">
      <div><div class="card-title">接駁你現有嘅進度紀錄系統</div>
        <div class="card-sub">填一次網址，之後每個月開呢頁一撳就過去</div></div>
      <span class="badge b-warn"><span class="dot"></span>未設定</span>
    </div>
    <div style="padding:26px 22px">
      <div class="grid g-2" style="align-items:start">
        <div>
          <div class="field">
            <label class="label">進度系統網址 <span class="req">*</span></label>
            <input class="input" id="p-url" placeholder="https://docs.google.com/spreadsheets/d/…">
            <div class="hint mt-4">支援 Google Sheet、Notion、或其他 Web App 網址。</div>
          </div>
          <div class="field mt-12">
            <label class="label">顯示名稱</label>
            <input class="input" id="p-name" value="團員進度紀錄系統">
          </div>
          ${can('progress.config')
            ? `<button class="btn btn-primary mt-16" data-act="save">${icon('save', 16)} 儲存並接駁</button>`
            : `<div class="hint mt-16">只有領袖同超級管理員可以設定呢個網址。</div>`}
        </div>
        <div style="padding:16px;background:var(--bg);border-radius:var(--r-lg);border:1px dashed var(--line)">
          <div class="semibold sm mb-8">接駁後會點？</div>
          <div class="col gap-8">
            ${['執委會喺呢度一撳就開進度系統', '自動以「執委會」身份進入，唔使再登入', '產生 QR Code，方便團員用手機打開', '團員個人頁都會有「開啟進度紀錄」掣']
              .map(t => `<div class="row gap-8"><span style="color:var(--brand-600);display:flex">${icon('check', 15)}</span><span class="sm">${t}</span></div>`).join('')}
          </div>
          <div class="mt-12 xs faint">淨係儲存一個網址，本系統唔會讀取或修改你進度系統入面嘅資料。</div>
        </div>
      </div>
    </div>
  </div>`;
}

export function mount(root) {
  const db = load();
  const url = db.settings.progressUrl;

  const open = () => { if (url) window.open(url, '_blank', 'noopener'); };
  root.querySelectorAll('[data-act="open"]').forEach(b => b.addEventListener('click', open));

  root.querySelectorAll('[data-act="copy"]').forEach(b => b.addEventListener('click', async () => {
    if (await copyText(url)) toast('已複製連結', 'ok');
  }));

  root.querySelectorAll('[data-act="qr"]').forEach(b => b.addEventListener('click', async () => {
    await modal({
      title: '進度系統 QR Code',
      sub: db.settings.progressName,
      body: `<div class="center">
          <div class="qr-box" style="width:260px">${qrSvg(url, 7, 2)}</div>
          <div class="sm muted mt-12" style="word-break:break-all">${esc(url)}</div>
        </div>`,
      actions: [{ label: '關閉', class: 'btn', value: null }]
    });
  }));

  root.querySelectorAll('[data-act="config"]').forEach(b => b.addEventListener('click', async () => {
    const r = await modal({
      title: '設定進度系統',
      body: `<div class="field"><label class="label">網址</label>
          <input class="input" id="q-url" value="${esc(url)}" placeholder="https://…"></div>
        <div class="field mt-12"><label class="label">顯示名稱</label>
          <input class="input" id="q-name" value="${esc(db.settings.progressName || '')}"></div>
        <div class="hint mt-12">留空網址即取消接駁。</div>`,
      actions: [
        { label: can('progress.config') ? '移除接駁' : '取消', class: 'btn', value: 'clear' },
        { label: '儲存', class: 'btn-primary', onClick: el => ({
            url: el.querySelector('#q-url').value.trim(),
            name: el.querySelector('#q-name').value.trim() || '團員進度紀錄系統' })}
      ]
    });
    if (r === 'clear' && can('progress.config')) {
      db.settings.progressUrl = ''; commit(); toast('已移除接駁'); refresh(); return;
    }
    if (r && typeof r === 'object') {
      db.settings.progressUrl = r.url; db.settings.progressName = r.name;
      commit(); toast(r.url ? '已接駁進度系統' : '已移除接駁', 'ok'); refresh();
    }
  }));

  root.querySelectorAll('[data-act="save"]').forEach(b => b.addEventListener('click', () => {
    const u = root.querySelector('#p-url')?.value.trim();
    const n = root.querySelector('#p-name')?.value.trim() || '團員進度紀錄系統';
    if (!u) { toast('請填寫網址', 'err'); return; }
    if (!/^https?:\/\//i.test(u) && !u.startsWith('/')) { toast('網址要以 http:// 或 https:// 開頭', 'err'); return; }
    db.settings.progressUrl = u; db.settings.progressName = n; commit();
    toast('已接駁進度系統', 'ok'); refresh();
  }));

  const embedToggle = root.querySelector('#embedToggle');
  if (embedToggle) embedToggle.addEventListener('change', () => {
    root.querySelector('#embedWrap')?.classList.toggle('hide', !embedToggle.checked);
  });
}

export function refresh() {
  window.dispatchEvent(new CustomEvent('v82:refresh'));
}
