/* ============================================================
   main.js — App Shell / 登入 / 路由 / 旅團選擇 / 示範模式橫額
   ============================================================ */

import {
  init, load, isMock, currentUnit, seedInfo, enterMock, exitMock,
  switchUnit, clearMockData
} from './lib/store.js';
import { loadRegistry, unitList, unitEntry, defaultUnitCode } from './lib/units.js';
import { applyTheme, MAROON } from './lib/theme.js';
import {
  login, logout, current, currentRole, ROLES, displayName, displaySub,
  loginAsMock, accounts, isSuper, can
} from './lib/auth.js';
import { pendingMeetings, overdueFees, pendingClaims, pendingLoans, profile, notices } from './lib/model.js';
import { esc, icon, toast, modal, confirmDlg } from './lib/util.js';
import { parse, go } from './lib/router.js';

import * as dashboard from './views/dashboard.js';
import * as meetings from './views/meetings.js';
import * as finance from './views/finance.js';
import * as members from './views/members.js';
import * as inventory from './views/inventory.js';
import * as progress from './views/progress.js';
import * as constitution from './views/constitution.js';
import * as accountsView from './views/accounts.js';
import * as docs from './views/docs.js';
import * as noticesView from './views/notices.js';
import * as tables from './views/tables.js';

const VIEWS = {
  dashboard, meetings, finance, members, inventory, progress,
  constitution, notices: noticesView, tables, admin: accountsView, docs
};

const NAV = [
  { id: 'dashboard', label: '儀表板', icon: 'home' },
  { id: 'meetings', label: '會議', icon: 'calendar', badge: () => pendingMeetings().length },
  { id: 'finance', label: '財務', icon: 'wallet', badge: () => overdueFees().length + pendingClaims().length },
  { id: 'members', label: '團員', icon: 'users' },
  { id: 'inventory', label: '物資', icon: 'grid', badge: () => pendingLoans().length },
  { id: 'progress', label: '進度', icon: 'chart' },
  { id: 'notices', label: '通告', icon: 'megaphone', badge: () => (load()?.notices || []).filter(n => n.status === 'published').length },
  { id: 'constitution', label: '團章', icon: 'book' },
  { id: 'tables', label: '表格', icon: 'table' },
  { id: 'docs', label: '教學', icon: 'note' },
  { id: 'admin', label: '帳號與系統', icon: 'shield' }
];
const MOBILE_MAIN = ['dashboard', 'meetings', 'finance', 'inventory'];

const app = document.getElementById('app');
let bootError = null;

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  app.innerHTML = loadingScreen();
  try {
    await loadRegistry();
    await init();
    applyTheme(load()?.unit?.theme);
  } catch (e) {
    console.error(e);
    bootError = e;
    return renderFatal(e);
  }
  window.addEventListener('hashchange', render);
  window.addEventListener('v82:refresh', render);

  if (isMock() && !current()) loginAsMock('leader');
  if (!current()) renderLogin();
  else render();
}

function loadingScreen() {
  return `<div style="display:grid;place-items:center;min-height:100vh;color:#9A868C;font-size:14px">載入中…</div>`;
}

function renderFatal(e) {
  app.innerHTML = `
  <div style="max-width:640px;margin:60px auto;padding:26px" class="card">
    <div class="row gap-10 mb-12"><span class="stat-ic" style="background:var(--danger-bg);color:var(--danger)">${icon('alert', 18)}</span>
      <div><div class="page-title" style="font-size:19px">讀唔到資料檔案</div>
      <div class="sm muted">系統需要由 HTTP 伺服器開啟（唔可以直接雙擊 HTML 檔）</div></div></div>
    <div class="note-box danger"><div>
      <b>點解決：</b><br>
      1. 喺專案資料夾開一個 HTTP 伺服器，例如 <code>python3 -m http.server 8000</code><br>
      2. 瀏覽器打開 <code>http://localhost:8000</code><br>
      3. 或者部署上 GitHub Pages / Vercel（詳見 README）</div></div>
    <div class="mt-16 xs faint mono">${esc(e?.message || String(e))}</div>
    <button class="btn btn-primary mt-16" onclick="location.reload()">${icon('refresh', 16)} 再試一次</button>
  </div>`;
}

/* ============================================================
   登入
   ============================================================ */
let selectedRole = 'exco';
let pickedUnit = null;

function renderLogin() {
  document.body.classList.add('login-body');
  const units = unitList();
  const code = currentUnit() || defaultUnitCode();
  const u = unitEntry(code) || {};
  const showDefaultHint = accounts().some(a => a.defaultPw);

  app.innerHTML = `
  <div class="login-wrap">
    <aside class="login-hero">
      <div class="brandmark">
        <div class="logo">${esc((u.short || '82').slice(0, 3))}</div>
        <div>
          <div style="font-weight:800;font-size:16px;letter-spacing:-.01em">${esc(u.short || '82venture')}</div>
          <div class="xs" style="color:#F0D3D9">深資童軍 · 自務自治</div>
        </div>
      </div>
      <div>
        <h1 class="hero-title">${esc(u.name || '深資童軍團')}<br>執委會管理平台</h1>
        <p class="hero-sub">會議、財務、團員、物資、團章 —— 一個地方搞掂。財務仲可以出「兩條數」（AGM 旅年度 ＋ 童軍年度）。</p>
        <div class="hero-list">
          ${[['團章內建，可改可輸出 Word / PDF / QR', 'book'],
             ['財務雙財政年度報告（AGM ＋ 4/1–3/31）', 'wallet'],
             ['物資借用自動加減庫存', 'grid'],
             ['生日前 7 日自動提示', 'sparkle']]
            .map(([t, i]) => `<div class="hero-item"><span class="tick">${icon(i, 11)}</span><span>${t}</span></div>`).join('')}
        </div>
      </div>
      <div class="xs" style="color:#D3A9B2">© ${new Date().getFullYear()} ${esc(u.short || '82venture')} · 內部使用</div>
    </aside>

    <main class="login-panel">
      <div class="login-card">
        ${units.length > 1 ? `
        <div class="field mb-16">
          <label class="label">旅團</label>
          <select class="select" id="loginUnit">
            ${units.map(x => `<option value="${esc(x.code)}" ${x.code === code ? 'selected' : ''}>${esc(x.code)} · ${esc(x.name || '')}${x.local ? '（本地）' : ''}</option>`).join('')}
          </select>
        </div>` : ''}

        <h1>登入</h1>
        <p class="sub">請揀你嘅身份，再輸入帳號同密碼</p>

        <div class="role-grid" id="roleGrid">
          ${['leader', 'exco'].map(r => {
            const R = ROLES[r];
            return `<button class="role-card" data-role="${r}" aria-pressed="${selectedRole === r}">
              <span class="role-ic">${r === 'leader' ? icon('flag', 19) : icon('users', 19)}</span>
              <span class="grow">
                <span class="role-name" style="display:block">${R.name}</span>
                <span class="role-desc" style="display:block">${R.desc}</span>
              </span>
              ${selectedRole === r ? icon('check', 17) : ''}
            </button>`;
          }).join('')}
        </div>

        <form id="loginForm" autocomplete="off">
          <div class="field mt-16">
            <label class="label">登入帳號</label>
            <input class="input" id="liUser" autocomplete="username" placeholder="輸入你嘅帳號">
          </div>
          <div class="field mt-12">
            <label class="label">密碼</label>
            <input class="input" id="liPass" type="password" placeholder="輸入密碼" autocomplete="current-password">
          </div>
          <div id="liErr" class="err mt-8"></div>
          <button type="submit" class="btn btn-primary btn-lg btn-block mt-16">${icon('key', 17)} 進入系統</button>
        </form>

        <div class="mt-16">
          <button class="btn btn-block" id="btnMock">${icon('eye', 16)} 試用示範（MOCK）</button>
          <div class="hint mt-8">示範模式用假資料，同真實資料完全分開，隨便試都唔會影響真數據。</div>
        </div>

        ${showDefaultHint ? `
        <div class="demo-hint mt-16">
          <b>首次使用（預設帳戶）</b><br>
          領袖：<code>leader</code> / <code>8202</code>　執委：<code>exco</code> / <code>8203</code><br>
          <span class="xs">登入後請到「帳號與系統 → 帳戶」改密碼，並為每位執委開自己嘅帳戶。改完之後呢個提示會自動消失。</span>
        </div>` : ''}
      </div>
    </main>
  </div>`;

  const grid = app.querySelector('#roleGrid');
  const userInput = app.querySelector('#liUser');
  const passInput = app.querySelector('#liPass');
  const err = app.querySelector('#liErr');

  grid.querySelectorAll('[data-role]').forEach(btn => btn.addEventListener('click', () => {
    selectedRole = btn.dataset.role;
    renderLogin();
    app.querySelector('#liPass')?.focus();
  }));

  app.querySelector('#loginUnit')?.addEventListener('change', e => {
    pickedUnit = e.target.value;
    const url = new URL(location.href);
    url.searchParams.set('u', pickedUnit);
    location.href = url.toString();
  });

  app.querySelector('#btnMock')?.addEventListener('click', () => enterMock());

  app.querySelector('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    err.style.display = 'none';
    const btn = app.querySelector('#loginForm button[type=submit]');
    btn.disabled = true;
    const res = await login(selectedRole, userInput.value, passInput.value);
    btn.disabled = false;
    if (!res.ok) {
      err.textContent = res.msg;
      err.style.display = 'block';
      passInput.value = '';
      passInput.focus();
      return;
    }
    document.body.classList.remove('login-body');
    applyTheme(load()?.unit?.theme);
    location.hash = '#/dashboard';
    render();
  });
}

/* ============================================================
   SHELL
   ============================================================ */
function render() {
  if (bootError) return renderFatal(bootError);
  if (!current()) return renderLogin();
  const r = parse();
  const view = VIEWS[r.section] || VIEWS.dashboard;
  const u = profile();
  const mock = isMock();
  const info = seedInfo();

  app.innerHTML = `
  ${mock ? mockBar() : ''}
  ${info.failed && !mock ? `<div class="banner warn no-print" style="border-radius:0">
      ${icon('alert', 16)} 讀唔到 <code>data/units/${esc(currentUnit())}/</code> 嘅資料檔案，系統用空白資料庫啟動。請用 HTTP 伺服器開啟或部署上網。
    </div>` : ''}
  <div class="shell">
    <nav class="sidebar">
      <div class="sb-brand">
        <div class="logo">${esc((u.short || '82').slice(0, 3))}</div>
        <div>
          <div class="t truncate">${esc(u.short || '82venture')}</div>
          <div class="s truncate">${esc(u.name || '')}</div>
        </div>
      </div>

      <div style="padding:10px 10px 0">
        <button class="unit-chip" id="unitSwitch" style="width:100%;justify-content:space-between">
          <span>${icon('flag', 13)} ${esc(currentUnit())}</span>
          <span class="xs" style="opacity:.8">切換 ${icon('chevronD', 12)}</span>
        </button>
      </div>

      <div class="sb-nav">
        ${NAV.map(n => sidebarItem(n, r.section)).join('')}
      </div>
      <div class="sb-foot">
        <div class="sb-user">
          <span class="avatar avatar-sm" style="background:${mock ? MAROON.accent : ROLES[currentRole()]?.color || MAROON.brand700}">
            ${icon(currentRole() === 'super' ? 'shield' : currentRole() === 'leader' ? 'flag' : 'users', 14)}</span>
          <div class="grow" style="min-width:0">
            <div class="n truncate">${esc(displayName())}</div>
            <div class="r truncate">${esc(displaySub())}</div>
          </div>
          <button class="btn btn-ghost btn-xs btn-icon" id="btnLogout" title="登出" style="color:#D3A9B2">${icon('logout', 15)}</button>
        </div>
      </div>
    </nav>

    <div class="main">
      <header class="topbar">
        <div style="min-width:0">
          <div class="tb-title truncate">${esc(view.title ? view.title() : '')}</div>
          <div class="tb-sub truncate">${esc(u.name || '')} ${mock ? '· 示範模式' : ''}</div>
        </div>
        <div class="row gap-8">
          ${notices().length ? `<span class="badge b-warn no-print"><span class="dot"></span>${notices().length} 項提示</span>` : ''}
          <button class="btn btn-ghost btn-sm hide-desktop" id="btnLogout2" title="登出">${icon('logout', 16)}</button>
        </div>
      </header>
      <div class="content" id="view">${view.render(r)}</div>
    </div>

    <nav class="tabbar">
      ${MOBILE_MAIN.map(id => {
        const n = NAV.find(x => x.id === id);
        return `<button data-nav="${id}" aria-current="${r.section === id ? 'page' : 'false'}">
          <span class="ic">${icon(n.icon, 20)}</span><span>${n.label}</span></button>`;
      }).join('')}
      <button data-nav="more" aria-current="${!MOBILE_MAIN.includes(r.section) ? 'page' : 'false'}">
        <span class="ic">${icon('grid', 20)}</span><span>更多</span></button>
    </nav>
  </div>`;

  // 綁定
  app.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => {
    const id = el.dataset.nav;
    if (id === 'more') return moreSheet();
    go('#/' + id);
  }));
  app.querySelectorAll('#btnLogout, #btnLogout2').forEach(el => el.addEventListener('click', async () => {
    if (isMock()) {
      exitMock();
      return;
    }
    if (await modal({
      title: '登出', body: '<p class="sm">確定登出系統？</p>',
      actions: [{ label: '取消', class: 'btn', value: false }, { label: '登出', class: 'btn-primary', value: true }]
    })) { logout(); document.body.classList.add('login-body'); renderLogin(); }
  }));
  app.querySelector('#unitSwitch')?.addEventListener('click', unitPicker);

  const root = app.querySelector('#view');
  try { view.mount(root, r); } catch (e) { console.error('mount error', e); }
  window.scrollTo({ top: 0 });
}

function mockBar() {
  const role = currentRole();
  return `
  <div class="mock-bar">
    <span class="tag">MOCK 示範模式</span>
    <span>你而家睇嘅係假資料（${esc(currentUnit())}），所有改動只會寫入示範空間，唔會影響真實資料。</span>
    <div class="btns">
      <select id="mockRole" class="select" style="height:30px;font-size:12.5px;padding:0 8px">
        ${['leader', 'exco', 'super'].map(r => `<option value="${r}" ${role === r ? 'selected' : ''}>以 ${ROLES[r].name} 身份預覽</option>`).join('')}
      </select>
      <button id="mockReset">重設示範</button>
      <button id="mockExit">離開示範</button>
    </div>
  </div>`;
}

function sidebarItem(n, active) {
  let b = 0;
  try { b = n.badge ? n.badge() : 0; } catch { b = 0; }
  return `<button class="sb-item" data-nav="${n.id}" aria-current="${active === n.id ? 'page' : 'false'}">
    ${icon(n.icon, 18)}<span>${n.label}</span>
    ${b ? `<span class="cnt">${b}</span>` : ''}
  </button>`;
}

function moreSheet() {
  const items = NAV.filter(n => !MOBILE_MAIN.includes(n.id));
  modal({
    title: '更多',
    body: `<div class="grid g-2" style="gap:10px">
      ${items.map(n => `<button class="role-card" data-more="${n.id}" style="flex-direction:column;align-items:flex-start;gap:6px">
        <span class="role-ic">${icon(n.icon, 18)}</span><span class="role-name">${n.label}</span></button>`).join('')}
      <button class="role-card" data-more="logout" style="flex-direction:column;align-items:flex-start;gap:6px">
        <span class="role-ic">${icon('logout', 18)}</span><span class="role-name">登出</span></button>
    </div>`,
    actions: [],
    onMount: el => {
      el.querySelectorAll('[data-more]').forEach(b => b.addEventListener('click', async () => {
        const id = b.dataset.more;
        const { closeModal } = await import('./lib/util.js');
        closeModal(null);
        if (id === 'logout') { logout(); renderLogin(); return; }
        go('#/' + id);
      }));
    }
  });
}

async function unitPicker() {
  const units = unitList();
  const cur = currentUnit();
  await modal({
    title: '選擇旅團',
    sub: `${units.length} 個旅團 · 每個旅團資料獨立`,
    wide: true,
    body: `<div class="unit-grid">
      ${units.map(x => `<button class="unit-card" data-unit="${esc(x.code)}" ${x.code === cur ? 'disabled' : ''}>
        <span class="code">${esc(x.code)}</span>
        <span class="grow"><span class="semibold" style="display:block">${esc(x.name || '')}</span>
          <span class="xs faint">${esc(x.nameEn || '')} ${x.local ? '· 本地旅團' : ''}</span></span>
        ${x.code === cur ? '<span class="badge b-brand">目前</span>' : icon('chevronR', 16)}
      </button>`).join('')}
    </div>
    <div class="hint mt-16">冇你想揀嘅旅團？去「帳號與系統 → 旅團設定」睇新增方法（喺 <code>data/units.json</code> 註冊）。</div>`,
    actions: [{ label: '關閉', class: 'btn', value: null }],
    onMount: el => {
      el.querySelectorAll('[data-unit]').forEach(b => b.addEventListener('click', () => {
        const code = b.dataset.unit;
        if (code === cur) return;
        switchUnit(code);
      }));
    }
  });
}

/* 示範模式橫額按鈕（每次 render 後重新綁定） */
document.addEventListener('click', async e => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (t.id === 'mockExit') { exitMock(); return; }
  if (t.id === 'mockReset') {
    if (await confirmDlg({ title: '重設示範資料', okText: '確定重設', message: '會把示範資料還原成 <code>data/mock/</code> 嘅初始內容。' })) {
      clearMockData();
      const url = new URL(location.href);
      url.searchParams.set('mock', '1');
      location.href = url.toString();
    }
    return;
  }
  if (t.id === 'mockRole') {
    loginAsMock(t.value);
    render();
  }
});

boot();
