/* ============================================================
   members.js — 團員進度及個人紀錄
   ============================================================ */

import { collection, find, add, update, remove } from '../lib/store.js';
import {
  members, member, memberName, attendanceStats, fees, MEETING_TYPES,
  statusBadge, ATTEND
} from '../lib/model.js';
import {
  esc, icon, money, fmtDate, avatar, uid, todayISO, modal, confirmDlg,
  toast, download, copyText
} from '../lib/util.js';
import { go, setQuery } from '../lib/router.js';
import { can } from '../lib/auth.js';

let kw = '';
let statusFilter = 'all';
let tagFilter = 'all';

const STATUS = { active: { l: '現役', c: 'b-ok' }, leave: { l: '休假', c: 'b-warn' }, alumni: { l: '舊團員', c: 'b-grey' } };

export function title() { return '團員'; }

export function render(params) {
  if (params.id === 'new') return editor(null);
  if (params.id) return detail(params.id);
  return listView();
}

/* ============================================================
   LIST
   ============================================================ */
function listView() {
  const all = members();
  const tags = [...new Set(all.flatMap(m => m.tags || []))];
  let list = all;
  if (statusFilter !== 'all') list = list.filter(m => m.status === statusFilter);
  if (tagFilter !== 'all') list = list.filter(m => (m.tags || []).includes(tagFilter));
  if (kw) {
    const k = kw.toLowerCase();
    list = list.filter(m => (m.name + ' ' + (m.eng || '') + ' ' + (m.role || '') + ' ' + (m.phone || '')).toLowerCase().includes(k));
  }
  const counts = {
    all: all.length,
    active: all.filter(m => m.status === 'active').length,
    leave: all.filter(m => m.status === 'leave').length,
    alumni: all.filter(m => m.status === 'alumni').length
  };

  return `
  <div class="page-head">
    <div>
      <div class="page-title">團員</div>
      <div class="page-sub">個人資料、出席紀錄、收費狀況同備註</div>
    </div>
    <div class="row gap-8 wrap no-print">
      <button class="btn" data-act="export">${icon('download', 16)} 匯出 CSV</button>
      ${can('member.create') ? `<button class="btn btn-primary" data-act="new">${icon('plus', 16)} 新增團員</button>` : ''}
    </div>
  </div>

  <div class="row-between mb-16 wrap gap-12 no-print">
    <div class="chipbar">
      ${[['all', '全部'], ['active', '現役'], ['leave', '休假'], ['alumni', '舊團員']]
        .map(([k, l]) => `<button class="chip" aria-pressed="${statusFilter === k}" data-status="${k}">${l} <span class="faint">${counts[k]}</span></button>`).join('')}
    </div>
    <div style="position:relative;min-width:200px">
      <input class="input" id="mSearch" placeholder="搜尋姓名／職位／電話…" value="${esc(kw)}" style="padding-left:32px">
      <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--faint);display:flex">${icon('search', 15)}</span>
    </div>
  </div>

  ${tags.length ? `<div class="chipbar mb-16 no-print">
    <button class="chip" aria-pressed="${tagFilter === 'all'}" data-tag="all">全部標籤</button>
    ${tags.map(t => `<button class="chip" aria-pressed="${tagFilter === t}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
  </div>` : ''}

  <div class="card">
    ${list.length ? `<div class="scroll-x"><table class="table">
      <thead><tr>
        <th>團員</th><th>職位</th><th>聯絡</th><th>入團日期</th>
        <th class="center">出席率</th><th class="center">收費</th><th>狀態</th><th></th>
      </tr></thead>
      <tbody>${list.map(m => {
        const s = attendanceStats(m.id);
        const mf = fees().filter(f => f.memberId === m.id);
        const unpaid = mf.filter(f => !f.paid);
        return `<tr style="cursor:pointer" data-open="${m.id}">
          <td><div class="row gap-10">${avatar(m.name)}
            <div><div class="semibold">${esc(m.name)}</div><div class="xs faint">${esc(m.eng || '')}</div></div></div></td>
          <td><div class="sm">${esc(m.role)}</div>
            ${(m.tags || []).length ? `<div class="row gap-4 mt-4">${m.tags.map(t => `<span class="badge b-grey">${esc(t)}</span>`).join('')}</div>` : ''}</td>
          <td><div class="sm mono">${esc(m.phone || '—')}</div><div class="xs faint">${esc(m.email || '')}</div></td>
          <td class="mono sm">${esc(m.join || '—')}</td>
          <td class="center" style="min-width:92px">
            <div class="sm mono" style="color:${s.rate >= 80 ? 'var(--ok)' : s.rate >= 50 ? 'var(--warn)' : 'var(--danger)'}">${s.rate}%</div>
            <div class="bar mt-4 ${s.rate >= 80 ? '' : s.rate >= 50 ? 'warn' : 'danger'}"><span style="width:${s.rate}%"></span></div>
            <div class="xs faint mt-4">${s.present}/${s.total} 次</div>
          </td>
          <td class="center">${unpaid.length
            ? `<span class="badge b-danger">欠 ${unpaid.length} 筆</span>`
            : `<span class="badge b-ok"><span class="dot"></span>已清</span>`}</td>
          <td><span class="badge ${STATUS[m.status]?.c || 'b-grey'}"><span class="dot"></span>${STATUS[m.status]?.l || m.status}</span></td>
          <td class="right"><button class="btn btn-xs btn-ghost" data-open="${m.id}">${icon('chevronR', 15)}</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>` : `<div class="empty">${icon('users', 34)}<div class="empty-title">搵唔到團員</div></div>`}
  </div>`;
}

/* ============================================================
   DETAIL — 個人紀錄
   ============================================================ */
function detail(id) {
  const m = member(id);
  if (!m) return `<div class="card"><div class="empty">搵唔到呢位團員</div></div>`;
  const s = attendanceStats(m.id);
  const myFees = fees().filter(f => f.memberId === id);
  const doneMeetings = collection('meetings').filter(x => x.status === 'done');
  const myActions = [];
  collection('meetings').forEach(mt => (mt.decisions || []).forEach(d => {
    if (d.owner === id) myActions.push({ ...d, meetingTitle: mt.title, meetingId: mt.id });
  }));

  return `
  <div class="no-print mb-12"><button class="btn btn-ghost btn-sm" data-go="#/members">${icon('chevronL', 15)} 返回團員列表</button></div>

  <div class="page-head">
    <div class="row gap-16 grow">
      ${avatar(m.name, 'avatar-lg')}
      <div class="grow">
        <div class="row gap-8 wrap">
          <span class="page-title">${esc(m.name)}</span>
          <span class="badge ${STATUS[m.status]?.c || 'b-grey'}"><span class="dot"></span>${STATUS[m.status]?.l || m.status}</span>
        </div>
        <div class="page-sub">${esc(m.eng || '')} · ${esc(m.role)} · ${esc(m.join || '')} 入團</div>
        ${(m.tags || []).length ? `<div class="row gap-4 mt-8">${m.tags.map(t => `<span class="badge b-grey">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="row gap-8 wrap no-print">
      <button class="btn" data-act="copy-contact">${icon('copy', 16)} 複製聯絡</button>
      ${can('member.edit') ? `<button class="btn" data-act="edit">${icon('edit', 16)} 編輯資料</button>` : ''}
      ${can('member.delete') ? `<button class="btn btn-danger" data-act="del">${icon('trash', 16)}</button>` : ''}
    </div>
  </div>

  <div class="grid g-4 mb-16">
    <div class="stat"><div class="stat-label">出席率</div>
      <div class="stat-value" style="color:${s.rate >= 80 ? 'var(--ok)' : s.rate >= 50 ? 'var(--warn)' : 'var(--danger)'}">${s.rate}%</div>
      <div class="stat-foot">${s.present} / ${s.total} 次會議</div></div>
    <div class="stat"><div class="stat-label">出席明細</div>
      <div class="stat-value" style="font-size:19px">${s.late} 遲 · ${s.apology} 假 · ${s.absent} 缺</div>
      <div class="stat-foot">已完成會議共 ${s.total} 次</div></div>
    <div class="stat"><div class="stat-label">收費狀況</div>
      <div class="stat-value">${myFees.filter(f => f.paid).length} / ${myFees.length}</div>
      <div class="stat-foot">${myFees.filter(f => !f.paid).length
        ? `尚欠 ${esc(money(myFees.filter(f => !f.paid).reduce((a, b) => a + b.amount, 0)))}`
        : '全部已清'}</div></div>
    <div class="stat"><div class="stat-label">負責行動</div>
      <div class="stat-value">${myActions.filter(a => !a.done).length}</div>
      <div class="stat-foot">共 ${myActions.length} 項決議行動</div></div>
  </div>

  <div class="grid g-2-1">
    <div class="col gap-16">
      <!-- 個人資料 -->
      <div class="card">
        <div class="card-head"><div class="card-title">基本資料</div></div>
        <div style="padding:16px 18px">
          <dl class="kv">
            <dt>中文姓名</dt><dd>${esc(m.name)}</dd>
            <dt>英文姓名</dt><dd>${esc(m.eng || '—')}</dd>
            <dt>團內職位</dt><dd>${esc(m.role || '—')}</dd>
            <dt>電話</dt><dd class="mono">${esc(m.phone || '—')}</dd>
            <dt>電郵</dt><dd>${esc(m.email || '—')}</dd>
            <dt>入團日期</dt><dd class="mono">${esc(m.join || '—')}</dd>
          </dl>
        </div>
      </div>

      <!-- 出席紀錄 -->
      <div class="card">
        <div class="card-head">
          <div><div class="card-title">出席紀錄</div><div class="card-sub">嚟自已完成會議嘅點名</div></div>
        </div>
        ${doneMeetings.length ? `<div class="scroll-x"><table class="table table-compact">
          <thead><tr><th>會議</th><th>日期</th><th class="center">出席狀況</th></tr></thead>
          <tbody>${doneMeetings.sort((a, b) => b.date.localeCompare(a.date)).map(mt => {
            const st = (mt.attendance || {})[id];
            const a = st ? ATTEND[st] : null;
            return `<tr>
              <td><div class="sm semibold">${esc(mt.title)}</div>
                <div class="xs faint">${esc(MEETING_TYPES[mt.type] || '')}</div></td>
              <td class="mono sm">${esc(mt.date)}</td>
              <td class="center">${a ? `<span class="badge ${a.cls}"><span class="dot"></span>${a.label}</span>`
                : '<span class="xs faint">未點名</span>'}</td></tr>`;
          }).join('')}</tbody></table></div>` : '<div class="empty sm">仲未完成任何會議</div>'}
      </div>

      <!-- 負責行動 -->
      <div class="card">
        <div class="card-head"><div class="card-title">負責嘅行動</div>
          <div class="card-sub">由會議決議分派</div></div>
        ${myActions.length ? `<div>${myActions.map(a => `
          <div class="list-item" data-go="#/meetings/${a.meetingId}">
            <span style="color:${a.done ? 'var(--ok)' : 'var(--faint)'};display:flex">${icon('check', 17)}</span>
            <div class="li-main">
              <div class="li-t sm" style="${a.done ? 'text-decoration:line-through;color:var(--faint)' : ''}">${esc(a.text)}</div>
              <div class="li-s">${esc(a.meetingTitle)} · 到期 ${esc(a.due || '未定')}</div>
            </div>
            <span class="badge ${a.done ? 'b-ok' : 'b-warn'}">${a.done ? '完成' : '待辦'}</span>
          </div>`).join('')}</div>` : '<div class="empty sm">暫時冇指派行動</div>'}
      </div>
    </div>

    <div class="col gap-16">
      <!-- 收費 -->
      <div class="card">
        <div class="card-head"><div><div class="card-title">收費記錄</div>
          <div class="card-sub">團費同活動費</div></div>
          <button class="btn btn-ghost btn-sm" data-go="#/finance?tab=fees">管理</button></div>
        ${myFees.length ? `<div>${myFees.map(f => `
          <div class="row gap-10" style="padding:11px 16px;border-bottom:1px solid var(--line-2)">
            <div class="grow"><div class="sm semibold">${esc(f.label)}</div>
              <div class="xs faint">${esc(f.kind)} · 到期 ${esc(f.due || '—')}</div></div>
            <div class="right"><div class="sm mono bold">${esc(money(f.amount))}</div>
              ${f.paid ? `<span class="badge b-ok"><span class="dot"></span>已收</span>`
                       : `<span class="badge b-warn"><span class="dot"></span>未收</span>`}</div>
          </div>`).join('')}</div>` : '<div class="empty sm">冇收費記錄</div>'}
      </div>

      <!-- 備註 -->
      <div class="card">
        <div class="card-head">
          <div><div class="card-title">領袖備註</div><div class="card-sub">觀察、跟進事項</div></div>
          ${can('member.note') ? `<button class="btn btn-sm" data-act="edit-note">${icon('edit', 15)} ${m.note ? '編輯' : '新增'}</button>` : ''}
        </div>
        <div style="padding:16px 18px">
          ${m.note ? `<div style="white-space:pre-wrap;font-size:14px;line-height:1.75">${esc(m.note)}</div>`
                   : '<div class="faint sm">暫時冇備註</div>'}
        </div>
      </div>

      <!-- 進度系統 -->
      <div class="card">
        <div class="card-head"><div class="card-title">進度紀錄</div></div>
        <div style="padding:16px 18px">
          <p class="sm muted mb-12">團員嘅進度紀錄（獎章、訓練、評核）放喺現有系統管理，由呢度直接過去。</p>
          <button class="btn btn-sm btn-block" data-go="#/progress">${icon('external', 15)} 開啟進度紀錄系統</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   EDITOR
   ============================================================ */
function editor(m) {
  const d = m || { name: '', eng: '', role: '隊員', phone: '', email: '', join: todayISO(), status: 'active', tags: [], note: '' };
  return `
  <div class="no-print mb-12"><button class="btn btn-ghost btn-sm" data-go="#/members">${icon('chevronL', 15)} 返回</button></div>
  <div class="page-head"><div><div class="page-title">${m ? '編輯團員' : '新增團員'}</div>
    <div class="page-sub">基本資料同團內職位</div></div></div>

  <div class="card card-pad" style="max-width:720px">
    <div class="grid g-2">
      <div class="field"><label class="label">中文姓名 <span class="req">*</span></label>
        <input class="input" id="f-name" value="${esc(d.name)}"></div>
      <div class="field"><label class="label">英文姓名</label>
        <input class="input" id="f-eng" value="${esc(d.eng || '')}"></div>
      <div class="field"><label class="label">團內職位</label>
        <select class="select" id="f-role">
          ${['執委會主席', '副主席', '秘書', '司庫', '活動統籌', '文書', '隊長', '副隊長', '隊員']
            .map(r => `<option ${d.role === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select></div>
      <div class="field"><label class="label">狀態</label>
        <select class="select" id="f-status">
          ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${d.status === k ? 'selected' : ''}>${v.l}</option>`).join('')}
        </select></div>
      <div class="field"><label class="label">電話</label>
        <input class="input" id="f-phone" value="${esc(d.phone || '')}" placeholder="9123 4567"></div>
      <div class="field"><label class="label">電郵</label>
        <input class="input" id="f-email" value="${esc(d.email || '')}"></div>
      <div class="field"><label class="label">入團日期</label>
        <input class="input" type="date" id="f-join" value="${esc(d.join || '')}"></div>
      <div class="field"><label class="label">標籤（逗號分隔）</label>
        <input class="input" id="f-tags" value="${esc((d.tags || []).join(', '))}" placeholder="執委會, 小隊"></div>
      <div class="field" style="grid-column:1/-1"><label class="label">備註</label>
        <textarea class="textarea" id="f-note">${esc(d.note || '')}</textarea></div>
    </div>
    <div class="row gap-8 mt-24" style="justify-content:flex-end">
      <button class="btn" data-go="#/members">取消</button>
      <button class="btn btn-primary" data-act="save">${icon('save', 16)} 儲存</button>
    </div>
  </div>`;
}

/* ============================================================
   MOUNT
   ============================================================ */
export function mount(root, params) {
  const id = params.id && params.id !== 'new' ? params.id : null;

  root.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => go(el.dataset.go)));
  root.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => go('#/members/' + el.dataset.open)));
  root.querySelectorAll('[data-status]').forEach(el => el.addEventListener('click', () => { statusFilter = el.dataset.status; refresh(); }));
  root.querySelectorAll('[data-tag]').forEach(el => el.addEventListener('click', () => { tagFilter = el.dataset.tag; refresh(); }));

  const search = root.querySelector('#mSearch');
  if (search) search.addEventListener('input', () => { kw = search.value; refresh(search.value); });

  root.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
    const act = btn.dataset.act;

    if (act === 'new') return go('#/members/new');

    if (act === 'export') {
      const head = ['姓名', '英文姓名', '職位', '電話', '電郵', '入團日期', '狀態', '出席率', '標籤'];
      const rows = members().map(m => [m.name, m.eng, m.role, m.phone, m.email, m.join,
        STATUS[m.status]?.l || m.status, attendanceStats(m.id).rate + '%', (m.tags || []).join(' / ')]);
      const csv = '﻿' + [head, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
      download(`82venture_團員名冊_${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
      toast('已匯出團員名冊', 'ok');
    }

    if (!id) return;
    const m = member(id);
    if (!m) return;

    if (act === 'edit') go('#/members/' + id + '/edit');

    if (act === 'copy-contact') {
      if (await copyText(`${m.name}　${m.role}\n電話：${m.phone || '—'}\n電郵：${m.email || '—'}`)) toast('已複製聯絡資料', 'ok');
    }

    if (act === 'edit-note') {
      const r = await modal({
        title: '領袖備註', sub: m.name,
        body: `<div class="field"><label class="label">內容</label>
          <textarea class="textarea" id="q-note" style="min-height:150px">${esc(m.note || '')}</textarea>
          <div class="hint">只限領袖同超管可見；如想團員本人睇到，請喺進度系統填寫。</div></div>`,
        actions: [{ label: '取消', class: 'btn', value: null },
          { label: '儲存', class: 'btn-primary', onClick: el => el.querySelector('#q-note').value }]
      });
      if (r !== null && r !== undefined) { update('members', id, { note: r }); toast('備註已儲存', 'ok'); refresh(); }
    }

    if (act === 'del') {
      if (await confirmDlg({ title: '刪除團員', danger: true, okText: '確定刪除',
        message: `確定刪除「<b>${esc(m.name)}</b>」？<br><span class="muted">相關收費記錄會保留，但團員資料會刪除。</span>` })) {
        remove('members', id); toast('已刪除'); go('#/members');
      }
    }

    if (act === 'save') {
      const v = s => root.querySelector(s)?.value ?? '';
      const name = v('#f-name').trim();
      if (!name) { toast('請填寫姓名', 'err'); return; }
      const payload = {
        name, eng: v('#f-eng').trim(), role: v('#f-role'), status: v('#f-status'),
        phone: v('#f-phone').trim(), email: v('#f-email').trim(), join: v('#f-join'),
        tags: v('#f-tags').split(/[,，]/).map(x => x.trim()).filter(Boolean),
        note: v('#f-note')
      };
      if (m) { update('members', id, payload); toast('資料已更新', 'ok'); go('#/members/' + id); }
      else { const nm = add('members', { id: uid('m'), ...payload }); toast('團員已新增', 'ok'); go('#/members/' + nm.id); }
    }
  }));
}

export function refresh(keepSearch) {
  window.dispatchEvent(new CustomEvent('v82:refresh', { detail: { keepSearch } }));
}
