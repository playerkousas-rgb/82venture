/* ============================================================
   admin.js — 帳號、密碼、權限、資料
   ============================================================ */

import { load, commit, collection } from '../lib/store.js';
import { ROLES, PERMS, can, canChangePasswordOf, changePassword, changeUsername, current, currentRole } from '../lib/auth.js';
import {
  esc, icon, modal, confirmDlg, toast, download, avatar, colorFrom, initials
} from '../lib/util.js';
import { go } from '../lib/router.js';

export function title() { return '帳號與權限'; }

const PERM_GROUPS = [
  { title: '會議', items: [
    ['meeting.view', '查看會議'], ['meeting.create', '新增會議'], ['meeting.edit', '編輯會議'],
    ['meeting.delete', '刪除會議'], ['meeting.minutes', '撰寫記錄 / 點名'], ['meeting.approve', '確認 / 通過']] },
  { title: '財務', items: [
    ['finance.view', '查看帳目'], ['finance.create', '新增收支'], ['finance.edit', '編輯收支'],
    ['finance.delete', '刪除收支'], ['finance.report', '查看報表'], ['finance.export', '匯出 CSV']] },
  { title: '收費', items: [['fee.view', '查看收費'], ['fee.mark', '標記收款'], ['fee.edit', '增刪收費項目']] },
  { title: '團員', items: [
    ['member.view', '查看團員'], ['member.create', '新增團員'], ['member.edit', '編輯資料'],
    ['member.note', '撰寫備註'], ['member.delete', '刪除團員']] },
  { title: '進度', items: [['progress.view', '開啟進度系統'], ['progress.config', '設定進度系統網址']] },
  { title: '團章', items: [
    ['constitution.view', '閱讀團章'], ['constitution.edit', '編輯條文'], ['constitution.publish', '發布新版本']] },
  { title: '系統', items: [
    ['admin.view', '開啟管理頁'], ['admin.pw.super', '改超管密碼'], ['admin.pw.leader', '改領袖密碼'],
    ['admin.pw.exco', '改執委密碼'], ['admin.data', '匯出 / 匯入資料']] }
];

export function render() {
  const db = load();
  const role = currentRole();

  return `
  <div class="page-head">
    <div>
      <div class="page-title">帳號與權限</div>
      <div class="page-sub">三個層級：超級管理員 → 領袖 → 執委會</div>
    </div>
  </div>

  <div class="grid g-3 mb-16">
    ${['super', 'leader', 'exco'].map(rid => {
      const acc = db.accounts.find(a => a.role === rid);
      const R = ROLES[rid];
      const editable = canChangePasswordOf(acc.id);
      const isMe = current()?.accountId === acc.id;
      return `
      <div class="card">
        <div class="card-head">
          <div class="row gap-10">
            <span class="avatar" style="background:${R.color}">${rid === 'super' ? icon('shield', 17) : rid === 'leader' ? icon('flag', 17) : icon('users', 17)}</span>
            <div><div class="card-title">${R.name}${isMe ? ' <span class="badge b-brand">你</span>' : ''}</div>
              <div class="card-sub">${R.desc}</div></div>
          </div>
        </div>
        <div style="padding:16px 18px">
          <dl class="kv mb-12">
            <dt>登入帳號</dt><dd class="mono semibold">${esc(acc.username)}</dd>
            <dt>密碼</dt><dd class="mono">${'•'.repeat(Math.min(8, String(acc.password).length))}
              ${acc.pwUpdatedAt ? `<span class="xs faint">（${esc(acc.pwUpdatedAt)} 改過）</span>` : ''}</dd>
          </dl>
          <div class="col gap-8">
            <button class="btn btn-sm btn-block ${editable ? 'btn-primary' : ''}" data-act="pw" data-id="${acc.id}" ${editable ? '' : 'disabled'}>
              ${icon('key', 15)} ${editable ? (isMe ? '更改我的密碼' : '更改此帳號密碼') : '冇權限更改'}
            </button>
            ${editable ? `<button class="btn btn-sm btn-block" data-act="uname" data-id="${acc.id}">${icon('user', 15)} 更改登入帳號</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>

  <div class="card mb-16">
    <div class="card-head">
      <div><div class="card-title">權限總表</div>
        <div class="card-sub">✓ 可以　<span class="faint">自</span> 只限自己建立嘅項目　— 唔可以</div></div>
    </div>
    <div class="scroll-x">
      <table class="table table-compact">
        <thead><tr>
          <th style="min-width:190px">功能</th>
          <th class="center" style="width:120px">超級管理員</th>
          <th class="center" style="width:120px">領袖</th>
          <th class="center" style="width:120px">執委會</th>
        </tr></thead>
        <tbody>
          ${PERM_GROUPS.map(g => `
            <tr><td colspan="4" style="background:#FAFCFB;font-weight:700;font-size:12px;letter-spacing:.04em;color:var(--faint);padding:8px 14px">${g.title.toUpperCase()}</td></tr>
            ${g.items.map(([k, label]) => {
              const r = PERMS[k] || {};
              return `<tr>
                <td>${esc(label)}<div class="xs faint mono">${k}</div></td>
                ${['super', 'leader', 'exco'].map(role => {
                  const v = r[role];
                  return `<td class="perm-cell">${v === 1
                    ? `<span class="perm-yes">${icon('check', 17)}</span>`
                    : v === 'own' ? '<span class="badge b-info">自</span>'
                    : '<span class="perm-no">—</span>'}</td>`;
                }).join('')}
              </tr>`;
            }).join('')}
          </tbody></table>`).join('')}
      </table>
    </div>
  </div>

  ${can('admin.data') ? `
  <div class="card">
    <div class="card-head">
      <div><div class="card-title">資料管理</div>
        <div class="card-sub">備份、還原、或者清走示範資料重新開始</div></div>
    </div>
    <div style="padding:16px 18px">
      <div class="row gap-8 wrap">
        <button class="btn" data-act="export">${icon('download', 16)} 匯出全部資料（JSON）</button>
        <button class="btn" data-act="import">${icon('upload', 16)} 匯入資料</button>
        <button class="btn btn-danger" data-act="reset">${icon('refresh', 16)} 重設為示範資料</button>
      </div>
      <div class="hint mt-12">而家資料儲喺呢個瀏覽器（localStorage）。換電腦或換瀏覽器睇唔到，記得定期匯出備份。</div>
    </div>
  </div>` : ''}`;
}

export function mount(root) {
  root.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
    const act = btn.dataset.act;
    const id = btn.dataset.id;
    const db = load();
    const acc = id ? db.accounts.find(a => a.id === id) : null;

    if (act === 'pw' && acc) {
      const R = ROLES[acc.role];
      const r = await modal({
        title: '更改密碼',
        sub: `${R.name} · 帳號 ${esc(acc.username)}`,
        body: `
          <div class="field"><label class="label">新密碼 <span class="req">*</span></label>
            <input class="input" type="text" id="q-p1" placeholder="至少 4 個字元" autocomplete="new-password"></div>
          <div class="field mt-12"><label class="label">再輸入一次 <span class="req">*</span></label>
            <input class="input" type="text" id="q-p2" autocomplete="new-password"></div>
          <div id="q-err" class="err mt-8"></div>
          ${current()?.accountId === acc.id ? '<div class="hint mt-12">改完之後下次登入要用新密碼。</div>'
            : `<div class="hint mt-12">你係以${ROLES[currentRole()]?.name}身份更改 ${R.name} 嘅密碼。</div>`}`,
        actions: [{ label: '取消', class: 'btn', value: null },
          { label: '更改密碼', class: 'btn-primary', onClick: el => {
              const p1 = el.querySelector('#q-p1').value;
              const p2 = el.querySelector('#q-p2').value;
              if (!p1 || p1.length < 4) { el.querySelector('#q-err').textContent = '密碼至少需要 4 個字元'; return false; }
              if (p1 !== p2) { el.querySelector('#q-err').textContent = '兩次輸入嘅密碼唔一樣'; return false; }
              return p1;
            }}]
      });
      if (r) { if (changePassword(id, r)) toast('密碼已更改', 'ok'); refresh(); }
    }

    if (act === 'uname' && acc) {
      const r = await modal({
        title: '更改登入帳號',
        sub: ROLES[acc.role].name,
        body: `<div class="field"><label class="label">新帳號名稱</label>
            <input class="input" id="q-u" value="${esc(acc.username)}" autocomplete="off"></div>
          <div class="hint mt-8">只改登入名稱，密碼維持不變。</div>`,
        actions: [{ label: '取消', class: 'btn', value: null },
          { label: '儲存', class: 'btn-primary', onClick: el => el.querySelector('#q-u').value }]
      });
      if (r) {
        if (changeUsername(id, r)) {
          toast('登入帳號已更改', 'ok');
          if (current()?.accountId === id) {
            const s = JSON.parse(localStorage.getItem('venture82.session.v1'));
            s.username = r; localStorage.setItem('venture82.session.v1', JSON.stringify(s));
          }
          refresh();
        }
      }
    }

    if (act === 'export') {
      download(`82venture_backup_${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(load(), null, 2));
      toast('已匯出備份', 'ok');
    }

    if (act === 'import') {
      const r = await modal({
        title: '匯入資料',
        sub: '會覆蓋而家所有資料',
        body: `<div class="field"><label class="label">貼上備份 JSON 內容</label>
            <textarea class="textarea" id="q-json" style="min-height:180px;font-family:var(--mono);font-size:12.5px" placeholder='{"version":1,…}'></textarea></div>
          <div class="hint mt-8">建議先匯出做備份，先至匯入。</div>`,
        actions: [{ label: '取消', class: 'btn', value: null },
          { label: '匯入', class: 'btn-primary', onClick: el => el.querySelector('#q-json').value }]
      });
      if (r) {
        try {
          const { importJSON } = await import('../lib/store.js');
          importJSON(r);
          toast('資料已匯入', 'ok');
          setTimeout(() => location.reload(), 500);
        } catch (e) {
          toast('匯入失敗：' + e.message, 'err');
        }
      }
    }

    if (act === 'reset') {
      if (await confirmDlg({
        title: '重設為示範資料', danger: true, okText: '確定重設',
        message: '所有會議、收支、團員、團章改動會 <b>全部清除</b>，還原成出廠示範資料，並登出。<br><br>建議先匯出備份。'
      })) {
        const { reset } = await import('../lib/store.js');
        reset();
        toast('已重設', 'ok');
        setTimeout(() => location.reload(), 400);
      }
    }
  }));
}

export function refresh() {
  window.dispatchEvent(new CustomEvent('v82:refresh'));
}
