/* ============================================================
   progress.js — 進度紀錄系統接駁
   三種入法：
     1) Portal 信任模式（推薦）：唔使喺對面開帳號、唔使帶密碼
        ?u=0082&role=exec_committee&ymis=…&name=…&from=portal&embed=1
     2) 專用帳戶模式：喺對面系統開一個執委帳戶，呢度幫你自動填入
     3) 只開連結：最保守，自己登入
   ============================================================ */

import { load, commit, collection, setSetting } from '../lib/store.js';
import { profile, settings, members, memberName } from '../lib/model.js';
import { esc, icon, modal, toast, copyText, qrSvg, downloadSvgEl } from '../lib/util.js';
import { downloadQrSvg } from '../lib/exporter.js';
import { go } from '../lib/router.js';
import { can, current, displayName } from '../lib/auth.js';
import { pageHead, noteBox, kv } from './ui.js';

let showEmbed = false;

export function title() { return '進度紀錄'; }

function cfg() {
  const p = profile();
  const db = load();
  return {
    url: p.progress?.url || db.settings.progressUrl || '',
    name: p.progress?.name || '團員進度紀錄系統',
    mode: p.progress?.mode || 'portal',
    portal: p.progress?.portal || { unitParam: db.unitCode, role: 'exec_committee', ymis: '', extraParams: 'embed=1' },
    dedicated: p.progress?.dedicated || { username: '', password: '' },
    paramUser: p.progress?.paramUser || 'ymis',
    paramPass: p.progress?.paramPass || 'p'
  };
}

function buildUrl(c) {
  if (!c.url) return '';
  const qs = new URLSearchParams();
  if (c.mode === 'portal') {
    const p = c.portal || {};
    if (p.unitParam) qs.set('u', p.unitParam);
    if (p.role) qs.set('role', p.role);
    if (p.ymis) qs.set('ymis', p.ymis);
    qs.set('name', (p.name || '執委會').trim());
    qs.set('from', 'portal');
    (String(p.extraParams || '').split('&').filter(Boolean)).forEach(kv => {
      const [k, v = '1'] = kv.split('=');
      qs.set(k.trim(), v);
    });
  } else if (c.mode === 'dedicated') {
    const d = c.dedicated || {};
    if (d.username) qs.set(c.paramUser, d.username);
    if (d.password) qs.set(c.paramPass, d.password);
  }
  const sep = c.url.includes('?') ? '&' : '?';
  return qs.toString() ? c.url + sep + qs.toString() : c.url;
}

/* ============================================================
   就緒檢查（呢個系統係咪已經預備好連通進度追蹤？）
   ============================================================ */
export function readiness() {
  const c = cfg();
  const db = load();
  const act = members().filter(m => m.status === 'active');
  const checks = [
    { ok: !!c.url, label: '進度系統網址已填', detail: c.url || '（未填 —— 撳「設定」）' },
    { ok: /^https:\/\//.test(c.url || ''), label: '網址係 HTTPS（Apps Script /exec）', detail: c.url ? c.url.slice(0, 48) + '…' : '—' },
    { ok: !!c.mode, label: '已揀連接模式', detail: { portal: 'Portal 信任模式（免密碼）', dedicated: '專用帳戶', link: '只開連結' }[c.mode] || c.mode },
    { ok: c.mode !== 'portal' || !!(c.portal?.unitParam), label: 'Portal 帶旅團編號（u）', detail: c.portal?.unitParam || '（未填）' },
    { ok: c.mode !== 'portal' || !!(c.portal?.role), label: 'Portal 帶角色（role）', detail: c.portal?.role || '（未填）' },
    { ok: c.mode !== 'dedicated' || !!(c.dedicated?.username && c.dedicated?.password), label: c.mode === 'dedicated' ? '專用帳戶帳密已填' : '唔需要專用帳戶帳密', detail: c.mode === 'dedicated' ? (c.dedicated?.username || '（未填）') : '—' },
    { ok: act.length > 0, label: `名冊有現役用戶（${act.length} 位）`, detail: act.slice(0, 3).map(m => m.name).join('、') + (act.length > 3 ? ' 等' : '') },
    { ok: !!buildUrl(c), label: '可以組合出登入連結', detail: buildUrl(c) || '（未有網址）' }
  ];
  const last = db.settings?.progressCheck || null;
  return { checks, pass: checks.filter(x => x.ok).length, total: checks.length, ready: checks.every(x => x.ok), last, url: buildUrl(c) || c.url, name: c.name, mode: c.mode };
}

/** 由瀏覽器實際 ping 一次（Apps Script 多數唔畀讀回應，所以只報告可達性） */
export async function checkConnection(url, timeoutMs = 12000) {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    return {
      ok: true, opaque: res.type === 'opaque', status: res.status || 0,
      ms: Date.now() - started, at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      msg: res.type === 'opaque'
        ? '有回應（Apps Script 唔畀瀏覽器讀內容，屬正常）—— 網址可達'
        : `HTTP ${res.status}`
    };
  } catch (e) {
    clearTimeout(timer);
    const aborted = e?.name === 'AbortError';
    return {
      ok: false, ms: Date.now() - started, at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      msg: aborted ? `逾時（${Math.round(timeoutMs / 1000)} 秒冇回應）` : (e?.message || String(e))
    };
  }
}

export function render() {
  const c = cfg();
  const url = c.url;
  const launch = buildUrl(c);
  const role = c.portal?.role || 'exec_committee';
  const R = readiness();

  return `
  ${pageHead({
    title: '進度紀錄系統',
    sub: url ? `${c.name} · 已接駁` : '未接駁 —— 填入進度系統網址即完成',
    actions: `
      ${url ? `<button class="btn btn-sm btn-primary" data-act="open">${icon('external', 15)} 開啟（${c.mode === 'portal' ? 'Portal 身份' : c.mode === 'dedicated' ? '自動登入' : '連結'}）</button>` : ''}
      ${can('progress.config') ? `<button class="btn btn-sm" data-act="config">${icon('settings', 15)} 設定</button>` : ''}`
  })}

  ${!url ? noteBox('尚未接駁。按右上角「設定」填你嘅進度系統網址（例如你嗰個 Google Apps Script 連結）就得。') : `
  <div class="grid g-2-1">
    <div class="col gap-16">
      <div class="card">
        <div class="card-head">
          <div class="row gap-10">
            <div class="stat-ic" style="background:var(--ok-bg);color:var(--ok)">${icon('check', 18)}</div>
            <div><div class="card-title">${esc(c.name)}</div>
              <div class="card-sub mono" style="word-break:break-all">${esc(c.url)}</div></div>
          </div>
          <span class="badge b-ok"><span class="dot"></span>已接駁</span>
        </div>
        <div style="padding:20px">
          <div class="grid g-2" style="align-items:start">
            <div>
              <div class="seg mb-12">
                ${[['portal', 'Portal 信任模式'], ['dedicated', '專用帳戶'], ['link', '只開連結']].map(([k, l]) =>
                  `<button data-mode="${k}" aria-selected="${c.mode === k}" ${can('progress.config') ? '' : 'disabled'}>${l}</button>`).join('')}
              </div>
              <p class="sm muted mb-12">
                ${c.mode === 'portal'
                  ? '由本系統帶身份過去（from=portal），對面系統會當你係執委，<b>毋須密碼</b>。你嗰個 GAS 已支援呢個做法。'
                  : c.mode === 'dedicated'
                    ? '喺對面系統開一個專用執委帳戶，呢度幫你自動填入帳號密碼。密碼會存喺你部機（localStorage）。'
                    : '只會開啟連結，你需要自己喺對面登入。'}
              </p>
              <div class="row gap-8 wrap">
                <button class="btn btn-primary" data-act="open">${icon('external', 16)} 以執委身份開啟</button>
                <button class="btn" data-act="copy-url">${icon('copy', 16)} 複製連結</button>
                <button class="btn" data-act="qr">${icon('qr', 16)} QR Code</button>
                <button class="btn" data-act="copy-cred">${icon('key', 16)} 複製帳密</button>
              </div>
              <div class="mt-16">
                <label class="check"><input type="checkbox" id="embedToggle" ${showEmbed ? 'checked' : ''}> 喺下面內嵌預覽</label>
                <div class="hint mt-4">部分網站（例如 Google）唔允許被內嵌，會顯示空白，屬正常。</div>
              </div>
            </div>
            <div class="center">
              <div class="qr-box" style="width:170px;margin:0 auto">
                <div id="progQr">${qrSvg(launch || c.url, 4, 1)}</div>
              </div>
              <div class="xs faint mt-8">掃描即可開啟進度系統</div>
              <button class="btn btn-xs mt-8" data-act="qr">下載 QR</button>
            </div>
          </div>

          ${showEmbed ? `<div class="mt-16"><iframe src="${esc(launch || c.url)}" style="width:100%;height:520px;border:1px solid var(--line);border-radius:var(--r-lg);background:#fff"></iframe></div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div><div class="card-title">執委專用帳戶 / Portal 身份</div>
          <div class="card-sub">你問嘅問題：應該點揀？</div></div></div>
        <div style="padding:18px">
          ${noteBox(`<b>建議：用 Portal 信任模式（唔使開新帳號）。</b><br>
            因為你嗰邊嘅系統（VSBADGE 架構）已經支援 <code>&amp;from=portal</code>，只要帶旅團編號、角色同顯示名，就會當你係執委直接入，<b>唔使密碼、唔使喺 URL 出現密碼</b>。<br><br>
            <b>如果想保守啲</b>：喺對面系統正常開一個「執委」帳戶，揀「專用帳戶」模式，好處係可以隨時喺對面停用該帳戶；壞處係密碼會經過網址，建議用完清一清瀏覽器紀錄。`, 'brand')}
          <div class="grid g-2 mt-16" style="gap:14px">
            <div class="card" style="box-shadow:none">
              <div style="padding:14px 16px">
                <div class="semibold sm mb-6" style="color:var(--brand-700)">Portal 模式（推薦）</div>
                <ul class="xs muted" style="padding-left:16px;line-height:1.9;margin:0">
                  <li>免在對面開帳號</li>
                  <li>URL 唔會出現密碼</li>
                  <li>要對面系統支援 <code>from=portal</code></li>
                  <li>隨時喺「設定」關掉即可</li>
                </ul>
              </div>
            </div>
            <div class="card" style="box-shadow:none">
              <div style="padding:14px 16px">
                <div class="semibold sm mb-6" style="color:var(--brand-700)">專用帳戶模式</div>
                <ul class="xs muted" style="padding-left:16px;line-height:1.9;margin:0">
                  <li>對面可以單獨停用／改密碼</li>
                  <li>唔需要改對面系統程式</li>
                  <li>帳密要存喺本機，URL 會帶密碼</li>
                  <li>建議只喺信任嘅電腦用</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="mt-16">
            ${kv([
              ['目前模式', esc({ portal: 'Portal 信任模式', dedicated: '專用帳戶', link: '只開連結' }[c.mode])],
              ['傳送身份', esc(c.mode === 'portal' ? `角色 ${role} · 旅團 ${c.portal?.unitParam || ''}` : c.mode === 'dedicated' ? `帳號 ${c.dedicated?.username || '（未填）'}` : '唔傳身份')],
              ['登入者', `${esc(displayName())}（${esc(current()?.role === 'exco' ? '執委' : current()?.role === 'leader' ? '領袖' : '超管')}）`]
            ])}
          </div>
        </div>
      </div>
    </div>

    <div class="col gap-16">
      <div class="card">
        <div class="card-head">
          <div><div class="card-title">連通進度追蹤：準備好未？</div>
            <div class="card-sub">${R.pass} / ${R.total} 項完成${R.last ? ` · 上次檢查 ${esc(R.last.at)}` : ''}</div></div>
          <span class="badge ${R.ready ? 'b-ok' : 'b-warn'}"><span class="dot"></span>${R.ready ? '已預備好' : '未齊'}</span>
        </div>
        <div style="padding:12px 16px">
          ${R.checks.map(k => `<div class="row gap-10" style="padding:6px 0;border-bottom:1px solid var(--line-2)">
            <span style="color:${k.ok ? 'var(--ok)' : 'var(--warn)'}">${icon(k.ok ? 'check' : 'alert', 15)}</span>
            <div class="grow" style="min-width:0"><div class="sm">${esc(k.label)}</div>
              <div class="xs faint mono" style="word-break:break-all">${esc(String(k.detail).slice(0, 70))}</div></div>
          </div>`).join('')}
          <div class="row gap-8 mt-12 wrap">
            <button class="btn btn-sm btn-primary" data-act="check">${icon('send', 15)} 檢查連線（實測）</button>
            ${can('progress.config') ? `<button class="btn btn-sm" data-act="config">${icon('settings', 15)} 設定</button>` : ''}
          </div>
          <div id="progCheckOut" class="hint mt-8">${R.last
            ? `上次結果：${R.last.ok ? '✓' : '✗'} ${esc(R.last.msg)}（${R.last.ms} ms）`
            : '未做過實測。撳「檢查連線」會由你嘅瀏覽器直接 ping 一次進度系統。'}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">本系統保留嘅進度相關資料</div></div>
        <div>
          ${members().filter(m => m.status === 'active').slice(0, 8).map(m => `
            <div class="list-item" data-open="${m.id}">
              <div class="li-main"><div class="li-t">${esc(m.name)}</div>
                <div class="li-s">${esc(m.role || '團員')}${m.birthday ? ` · 生日 ${esc(m.birthday)}` : ''}</div></div>
              ${icon('chevronR', 15)}
            </div>`).join('')}
        </div>
        <div style="padding:12px 16px;border-top:1px solid var(--line-2)" class="xs faint">
          獎章／訓練進度由對面系統管理；呢度只保留出席率、團費同物料紀錄。
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">連結內容預覽</div></div>
        <div style="padding:14px 16px">
          <div class="mono xs" style="word-break:break-all;background:var(--line-2);padding:10px;border-radius:10px">${esc(launch || c.url)}</div>
          ${c.mode === 'portal' ? `<div class="hint mt-8">對面系統見到 <code>from=portal</code> 就會以 ${esc(role)} 身份直接進入，唔會再問密碼。</div>` : ''}
          ${c.mode === 'dedicated' ? `<div class="hint mt-8" style="color:var(--danger)">注意：呢條連結含有帳號密碼，唔好喺公共電腦留低瀏覽器紀錄。</div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">教學</div></div>
        <div style="padding:14px 16px">
          <button class="btn btn-sm btn-block" data-go="#/docs">${icon('note', 15)} 睇完整接駁教學</button>
        </div>
      </div>
    </div>
  </div>`}`;
}

export function mount(root) {
  const c = cfg();
  const launch = buildUrl(c);

  root.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => {
    if (!el.dataset.open) return;
    go('#/members/' + el.dataset.open);
  }));

  root.querySelectorAll('[data-act="open"]').forEach(b => b.addEventListener('click', () => {
    if (launch) window.open(launch, '_blank', 'noopener');
    else toast('未設定網址', 'err');
  }));

  root.querySelectorAll('[data-act="check"]').forEach(b => b.addEventListener('click', async () => {
    const out = root.querySelector('#progCheckOut');
    const target = launch || c.url;
    if (!target) { toast('未設定進度系統網址', 'err'); return; }
    b.disabled = true;
    if (out) out.textContent = '檢查中…（最多等 12 秒）';
    const res = await checkConnection(target);
    const db = load();
    db.settings = { ...(db.settings || {}), progressCheck: { ...res, url: target } };
    commit();
    if (out) {
      out.innerHTML = `${res.ok ? '<b style="color:var(--ok)">✓ 連通</b>' : '<b style="color:var(--danger)">✗ 連唔通</b>'} · ${esc(res.msg)} · ${res.ms} ms`
        + (res.ok && res.opaque ? `<div class="xs faint mt-4">註：Apps Script 預設唔會回傳跨網域內容，所以瀏覽器讀唔到 JSON；
          要睇返傳資料，請撳「開啟」用新分頁測試。</div>` : '');
    }
    b.disabled = false;
    toast(res.ok ? '進度系統可達' : '連唔通進度系統', res.ok ? 'ok' : 'err');
  }));

  root.querySelectorAll('[data-act="copy-url"]').forEach(b => b.addEventListener('click', async () => {
    if (await copyText(launch || c.url)) toast('已複製連結', 'ok');
  }));

  root.querySelectorAll('[data-act="copy-cred"]').forEach(b => b.addEventListener('click', async () => {
    const txt = c.mode === 'dedicated'
      ? `進度系統：${c.name}\n網址：${c.url}\n帳號：${c.dedicated?.username || '（未設定）'}\n密碼：${c.dedicated?.password || '（未設定）'}`
      : `進度系統：${c.name}\n網址：${c.url}\n身份：以 82venture Portal 執委身份進入（免密碼）`;
    if (await copyText(txt)) toast('已複製帳密／連結', 'ok');
  }));

  root.querySelectorAll('[data-act="qr"]').forEach(b => b.addEventListener('click', async () => {
    await modal({
      title: '進度系統 QR Code', sub: c.name,
      body: `<div class="center">
          <div class="qr-box" style="width:260px"><div id="qrHost">${qrSvg(launch || c.url, 6, 2)}</div></div>
          <div class="sm muted mt-12" style="word-break:break-all">${esc(launch || c.url)}</div>
        </div>`,
      actions: [{ label: '下載 SVG', class: 'btn', onClick: el => {
        const host = el.querySelector('#qrHost');
        downloadQrSvg(launch || c.url, '進度系統QR.svg', 8, 3);
        return false;
      } }, { label: '關閉', class: 'btn-primary', value: null }]
    });
  }));

  const toggle = root.querySelector('#embedToggle');
  if (toggle) toggle.addEventListener('change', () => { showEmbed = toggle.checked; refresh(); });

  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', async () => {
    if (b.disabled || !can('progress.config')) return;
    const m = b.dataset.mode;
    const p = profile();
    p.progress = { ...(p.progress || {}), mode: m };
    commit(); toast('已切換連接模式', 'ok'); refresh();
  }));

  root.querySelectorAll('[data-act="config"]').forEach(b => b.addEventListener('click', async () => {
    const cc = cfg();
    const list = members();
    const r = await modal({
      title: '設定進度系統接駁', wide: true,
      body: `
        <div class="grid g-2" style="gap:12px">
          <div class="field" style="grid-column:1/-1"><label class="label">進度系統網址 <span class="req">*</span></label>
            <input class="input" id="q-url" value="${esc(cc.url)}" placeholder="https://script.google.com/macros/s/…/exec"></div>
          <div class="field" style="grid-column:1/-1"><label class="label">顯示名稱</label>
            <input class="input" id="q-name" value="${esc(cc.name)}"></div>
          <div class="field"><label class="label">連接模式</label>
            <select class="select" id="q-mode">
              <option value="portal" ${cc.mode === 'portal' ? 'selected' : ''}>Portal 信任模式（推薦）</option>
              <option value="dedicated" ${cc.mode === 'dedicated' ? 'selected' : ''}>專用帳戶（自動帶帳密）</option>
              <option value="link" ${cc.mode === 'link' ? 'selected' : ''}>只開連結</option>
            </select></div>
          <div class="field"><label class="label">Portal 角色</label>
            <input class="input" id="q-role" value="${esc(cc.portal?.role || 'exec_committee')}" placeholder="exec_committee / branch_leader"></div>
          <div class="field"><label class="label">旅團編號參數（u）</label>
            <input class="input" id="q-unit" value="${esc(cc.portal?.unitParam || load().unitCode)}"></div>
          <div class="field"><label class="label">Portal 顯示名（ymis 值）</label>
            <input class="input" id="q-ymis" value="${esc(cc.portal?.ymis || '')}" placeholder="例：EXCO-82 或留空"></div>
          <div class="field"><label class="label">其他參數（& 分隔）</label>
            <input class="input" id="q-extra" value="${esc(cc.portal?.extraParams || 'embed=1')}"></div>
          <div class="field"><label class="label">專用帳戶登入帳號</label>
            <input class="input" id="q-duser" value="${esc(cc.dedicated?.username || '')}"></div>
          <div class="field"><label class="label">專用帳戶密碼</label>
            <input class="input" id="q-dpass" type="text" value="${esc(cc.dedicated?.password || '')}"></div>
          <div class="field"><label class="label">帳號參數名</label>
            <input class="input" id="q-puser" value="${esc(cc.paramUser)}" placeholder="ymis / u / account"></div>
          <div class="field"><label class="label">密碼參數名</label>
            <input class="input" id="q-ppass" value="${esc(cc.paramPass)}" placeholder="p / pw / password"></div>
        </div>
        <div class="hint mt-12">Portal 模式：連結會係 <code>…/exec?u=${esc(load().unitCode)}&role=exec_committee&from=portal&embed=1</code>，對面系統會直接當你係執委。</div>
        <div class="hint mt-8" style="color:var(--danger)">專用帳戶模式嘅密碼會存喺呢部電腦（localStorage）同出現在網址，請自行衡量風險。</div>`,
      actions: [{ label: '取消', class: 'btn', value: null },
        { label: '儲存', class: 'btn-primary', onClick: el => ({
          url: el.querySelector('#q-url').value.trim(),
          name: el.querySelector('#q-name').value.trim() || '團員進度紀錄系統',
          mode: el.querySelector('#q-mode').value,
          portal: {
            unitParam: el.querySelector('#q-unit').value.trim(),
            role: el.querySelector('#q-role').value.trim(),
            ymis: el.querySelector('#q-ymis').value.trim(),
            extraParams: el.querySelector('#q-extra').value.trim()
          },
          dedicated: {
            username: el.querySelector('#q-duser').value.trim(),
            password: el.querySelector('#q-dpass').value
          },
          paramUser: el.querySelector('#q-puser').value.trim() || 'ymis',
          paramPass: el.querySelector('#q-ppass').value.trim() || 'p'
        }) }]
    });
    if (!r) return;
    const p = profile();
    p.progress = { ...(p.progress || {}), ...r };
    commit();
    toast('已更新接駁設定', 'ok');
    refresh();
  }));
}

export function refresh() { window.dispatchEvent(new CustomEvent('v82:refresh')); }
