/* ============================================================
   main.js — App Shell / 路由 / 登入
   ============================================================ */

import * as dashboard from './views/dashboard.js';
import * as meetings from './views/meetings.js';
import * as finance from './views/finance.js';
import * as members from './views/members.js';
import * as progress from './views/progress.js';
import * as constitution from './views/constitution.js';
import * as admin from './views/admin.js';

import { parse, go } from './lib/router.js';
import { load } from './lib/store.js';
import { ROLES, login, logout, current, currentRole, can } from './lib/auth.js';
import { pendingMeetings, overdueFees, openActions } from './lib/model.js';
import { esc, icon, avatar, modal, toast } from './lib/util.js';

const VIEWS = { dashboard, meetings, finance, members, progress, constitution, admin };

const NAV = [
  { id: 'dashboard',    label: '儀表板',  icon: 'home' },
  { id: 'meetings',     label: '會議',    icon: 'calendar', badge: () => pendingMeetings().length },
  { id: 'finance',      label: '財務',    icon: 'wallet',   badge: () => overdueFees().length },
  { id: 'members',      label: '團員',    icon: 'users' },
  { id: 'progress',     label: '進度',    icon: 'chart' },
  { id: 'constitution', label: '團章',    icon: 'book' },
  { id: 'admin',        label: '管理',    icon: 'shield' }
];
const MOBILE_MAIN = ['dashboard', 'meetings', 'finance', 'members'];

const app = document.getElementById('app');

/* ============================================================
   BOOT
   ============================================================ */
function boot() {
  window.addEventListener('hashchange', render);
  window.addEventListener('v82:refresh', render);
  if (!current()) return renderLogin();
  render();
}

/* ============================================================
   LOGIN
   ============================================================ */
let selectedRole = 'super';

function renderLogin() {
  document.body.classList.add('login-body');
  app.innerHTML = `
  <div class="login-wrap">
    <aside class="login-hero">
      <div class="brandmark">
        <div class="logo">82</div>
        <div>
          <div style="font-weight:800;font-size:16px;letter-spacing:-.01em">82venture</div>
          <div class="xs" style="color:#8DB8A3">深資童軍 · 自務自治</div>
        </div>
      </div>
      <div>
        <h1 class="hero-title">一站式<br>執委會管理平台</h1>
        <p class="hero-sub">會議、財務、團員、團章 —— 一個地方搞掂，團務交接唔使再靠 WhatsApp 同 Excel。</p>
        <div class="hero-list">
          ${[['會議由議程到記錄，全程留底', 'calendar'],
             ['收支即時結餘，團費自動追數', 'wallet'],
             ['團章改完即刻出 QR Code 畀團員', 'qr'],
             ['三個層級權限，各有各改密碼', 'shield']]
            .map(([t, i]) => `<div class="hero-item"><span class="tick">${icon(i === 'qr' ? 'qr' : i, 11)}</span><span>${t}</span></div>`).join('')}
        </div>
      </div>
      <div class="xs" style="color:#6E9C86">© ${new Date().getFullYear()} 82venture · 內部使用</div>
    </aside>

    <main class="login-panel">
      <div class="login-card">
        <h1>登入</h1>
        <p class="sub">揀你嘅身份，再輸入指定密碼</p>

        <div class="role-grid" id="roleGrid">
          ${['super', 'leader', 'exco'].map(r => {
            const R = ROLES[r];
            return `<button class="role-card" data-role="${r}" aria-pressed="${selectedRole === r}">
              <span class="role-ic">${r === 'super' ? icon('shield', 19) : r === 'leader' ? icon('flag', 19) : icon('users', 19)}</span>
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
            <input class="input" id="liUser" value="${esc(ROLES[selectedRole] ? defaultUser(selectedRole) : '')}" autocomplete="username">
          </div>
          <div class="field mt-12">
            <label class="label">密碼</label>
            <input class="input" id="liPass" type="password" placeholder="請輸入密碼" autocomplete="current-password">
          </div>
          <div id="liErr" class="err mt-8"></div>
          <button type="submit" class="btn btn-primary btn-lg btn-block mt-16">${icon(keyIco(), 17)} 進入系統</button>
        </form>

        <div class="demo-hint">
          <b>示範密碼（正式用之前記得改）：</b><br>
          超級管理員　<code>sheep</code> / <code>0728</code><br>
          領袖　　　　<code>leader</code> / <code>8202</code><br>
          執委會　　　<code>exco</code> / <code>8203</code>
        </div>
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

  app.querySelector('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    err.textContent = '';
    const u = userInput.value.trim();
    const p = passInput.value;
    if (!u) { err.textContent = '請輸入登入帳號'; return; }
    if (!p) { err.textContent = '請輸入密碼'; return; }
    const res = login(selectedRole, u, p);
    if (!res.ok) {
      err.textContent = res.msg;
      passInput.value = '';
      passInput.focus();
      return;
    }
    document.body.classList.remove('login-body');
    location.hash = '#/dashboard';
    render();
  });
}
function keyIco() { return 'key'; }
function defaultUser(role) {
  return load().accounts.find(a => a.role === role)?.username || '';
}

/* ============================================================
   SHELL
   ============================================================ */
function render() {
  if (!current()) return renderLogin();
  const r = parse();
  const view = VIEWS[r.section] || VIEWS.dashboard;

  app.innerHTML = `
  <div class="shell">
    <nav class="sidebar">
      <div class="sb-brand">
        <div class="logo">82</div>
        <div>
          <div class="t">82venture</div>
          <div class="s">執委會管理平台</div>
        </div>
      </div>
      <div class="sb-nav">
        ${NAV.map(n => sidebarItem(n, r.section)).join('')}
      </div>
      <div class="sb-foot">
        <div class="sb-user">
          <span class="avatar avatar-sm" style="background:${ROLES[currentRole()]?.color || '#0F5132'}">
            ${icon(currentRole() === 'super' ? 'shield' : currentRole() === 'leader' ? 'flag' : 'users', 14)}
          </span>
          <div class="grow" style="min-width:0">
            <div class="n truncate">${esc(current()?.name || '')}</div>
            <div class="r truncate">${esc(ROLES[currentRole()]?.name || '')} · ${esc(current()?.username || '')}</div>
          </div>
          <button class="btn btn-ghost btn-xs btn-icon" id="btnLogout" title="登出"
            style="color:#8DB8A3">${icon('logout', 15)}</button>
        </div>
      </div>
    </nav>

    <div class="main">
      <header class="topbar">
        <div style="min-width:0">
          <div class="tb-title truncate">${esc(view.title ? view.title() : '')}</div>
          <div class="tb-sub truncate">${esc(load().settings.groupName)}</div>
        </div>
        <div class="row gap-8">
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
    if (id === 'more') return moreSheet(r.section);
    go('#/' + id);
  }));
  app.querySelectorAll('#btnLogout, #btnLogout2').forEach(el => el.addEventListener('click', async () => {
    if (await modal({
      title: '登出', body: '<p class="sm">確定登出系統？</p>',
      actions: [{ label: '取消', class: 'btn', value: false }, { label: '登出', class: 'btn-primary', value: true }]
    })) { logout(); document.body.classList.add('login-body'); renderLogin(); }
  }));

  const root = app.querySelector('#view');
  try { view.mount(root, r); } catch (e) { console.error('mount error', e); }
  window.scrollTo({ top: 0 });
}

function sidebarItem(n, active) {
  const b = n.badge ? n.badge() : 0;
  return `<button class="sb-item" data-nav="${n.id}" aria-current="${active === n.id ? 'page' : 'false'}">
    ${icon(n.icon, 18)}<span>${n.label}</span>
    ${b ? `<span class="cnt">${b}</span>` : ''}
  </button>`;
}

function moreSheet(activeSection) {
  const items = NAV.filter(n => !MOBILE_MAIN.includes(n.id));
  modal({
    title: '更多',
    body: `<div class="grid g-2" style="gap:10px">
      ${items.map(n => `<button class="role-card" data-more="${n.id}" style="flex-direction:column;align-items:flex-start;gap:6px">
        <span class="role-ic">${icon(n.icon, 18)}</span>
        <span class="role-name">${n.label}</span></button>`).join('')}
      <button class="role-card" data-more="logout" style="flex-direction:column;align-items:flex-start;gap:6px">
        <span class="role-ic">${icon('logout', 18)}</span>
        <span class="role-name">登出</span></button>
    </div>`,
    actions: [],
    onMount: el => {
      el.querySelectorAll('[data-more]').forEach(b => b.addEventListener('click', async () => {
        const id = b.dataset.more;
        const { closeModal } = await import('./lib/util.js');
        closeModal(null);
        if (id === 'logout') {
          if (await modal({ title: '登出', body: '<p class="sm">確定登出系統？</p>',
            actions: [{ label: '取消', class: 'btn', value: false }, { label: '登出', class: 'btn-primary', value: true }] })) {
            logout(); renderLogin();
          }
          return;
        }
        go('#/' + id);
      }));
    }
  });
}

boot();
