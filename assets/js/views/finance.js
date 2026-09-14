/* ============================================================
   finance.js — 財務管理
   分頁：記帳 / 報表 / 收費追蹤 / 活動預算
   ============================================================ */

import { collection, find, add, update, remove, load, commit } from '../lib/store.js';
import {
  tx, sumBy, balance, monthStats, allMonths, categoryBreakdown,
  INCOME_CATS, EXPENSE_CATS, METHODS, fees, feeSummary, overdueFees, memberName, members
} from '../lib/model.js';
import {
  esc, icon, money, moneyPlain, fmtDate, uid, todayISO, monthKey, monthLabel, avatar,
  modal, confirmDlg, toast, download, copyText, num
} from '../lib/util.js';
import { go, setQuery } from '../lib/router.js';
import { can } from '../lib/auth.js';

let tab = 'ledger';
let monthFilter = 'all';
let typeFilter = 'all';
let catFilter = 'all';
let kw = '';
let feeKind = 'all';
let feeStatus = 'all';

export function title() { return '財務'; }

export function render(params) {
  if (params.query.tab) tab = params.query.tab;
  const all = tx();
  const mKey = todayISO().slice(0, 7);
  const ms = monthStats(mKey);
  const fs = feeSummary();

  return `
  <div class="page-head">
    <div>
      <div class="page-title">財務</div>
      <div class="page-sub">記帳、報表、收費追蹤 —— 由 Sheet 升級做系統</div>
    </div>
    <div class="row gap-8 wrap no-print">
      ${can('finance.export') ? `<button class="btn" data-act="export">${icon('download', 16)} 匯出 CSV</button>` : ''}
      ${can('finance.create') ? `<button class="btn btn-primary" data-act="add-tx">${icon('plus', 16)} 記一筆</button>` : ''}
    </div>
  </div>

  <div class="grid g-4 mb-16">
    <div class="stat">
      <div class="stat-label">${icon('wallet', 14)} 總結餘</div>
      <div class="stat-value" style="color:${balance() >= 0 ? 'var(--brand-700)' : 'var(--danger)'}">${esc(money(balance()))}</div>
      <div class="stat-foot">全期累計</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon('arrowUp', 14)} 本月收入</div>
      <div class="stat-value" style="color:var(--ok)">${esc(money(ms.income))}</div>
      <div class="stat-foot">${esc(monthLabel(mKey))} · ${ms.count} 筆</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon('arrowDown', 14)} 本月支出</div>
      <div class="stat-value" style="color:var(--danger)">${esc(money(ms.expense))}</div>
      <div class="stat-foot">${esc(monthLabel(mKey))}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon('users', 14)} 收費進度</div>
      <div class="stat-value">${fs.paidCount} / ${fs.total}</div>
      <div class="bar mt-8 ${fs.rate < 50 ? 'danger' : fs.rate < 80 ? 'warn' : ''}"><span style="width:${fs.rate}%"></span></div>
      <div class="stat-foot">尚欠 ${esc(money(fs.outstanding))}</div>
    </div>
  </div>

  <div class="seg mb-16 no-print" role="tablist">
    ${[['ledger', '收支記帳'], ['report', '月結報表'], ['fees', '收費追蹤'], ['budget', '活動預算']]
      .map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-tab="${k}">${l}</button>`).join('')}
  </div>

  <div id="finPane">${pane()}</div>`;
}

function pane() {
  if (tab === 'report') return reportPane();
  if (tab === 'fees') return feesPane();
  if (tab === 'budget') return budgetPane();
  return ledgerPane();
}

/* ============================================================
   記帳
   ============================================================ */
function filteredTx() {
  let l = tx();
  if (monthFilter !== 'all') l = l.filter(t => monthKey(t.date) === monthFilter);
  if (typeFilter !== 'all') l = l.filter(t => t.type === typeFilter);
  if (catFilter !== 'all') l = l.filter(t => t.category === catFilter);
  if (kw) {
    const k = kw.toLowerCase();
    l = l.filter(t => (t.item + ' ' + (t.note || '') + ' ' + (t.ref || '') + ' ' + (t.category || '')).toLowerCase().includes(k));
  }
  return l.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function ledgerPane() {
  const list = filteredTx();
  const inc = sumBy(list, 'income'), exp = sumBy(list, 'expense');
  const cats = [...new Set(tx().map(t => t.category))].sort();

  return `
  <div class="row-between mb-12 wrap gap-8 no-print">
    <div class="row gap-8 wrap">
      <select class="select" id="fMonth" style="width:auto">
        <option value="all" ${monthFilter === 'all' ? 'selected' : ''}>全部月份</option>
        ${allMonths().map(k => `<option value="${k}" ${monthFilter === k ? 'selected' : ''}>${esc(monthLabel(k))}</option>`).join('')}
      </select>
      <select class="select" id="fType" style="width:auto">
        <option value="all" ${typeFilter === 'all' ? 'selected' : ''}>收入 + 支出</option>
        <option value="income" ${typeFilter === 'income' ? 'selected' : ''}>只睇收入</option>
        <option value="expense" ${typeFilter === 'expense' ? 'selected' : ''}>只睇支出</option>
      </select>
      <select class="select" id="fCat" style="width:auto">
        <option value="all">全部類別</option>
        ${cats.map(c => `<option value="${esc(c)}" ${catFilter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
    </div>
    <div style="position:relative;min-width:180px">
      <input class="input" id="fKw" placeholder="搜尋項目／備註…" value="${esc(kw)}" style="padding-left:32px">
      <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--faint);display:flex">${icon('search', 15)}</span>
    </div>
  </div>

  <div class="row gap-8 mb-12 wrap no-print">
    <span class="badge b-ok">收入 ${esc(money(inc))}</span>
    <span class="badge b-danger">支出 ${esc(money(exp))}</span>
    <span class="badge ${inc - exp >= 0 ? 'b-brand' : 'b-warn'}">淨額 ${esc(money(inc - exp))}</span>
    <span class="badge b-grey">${list.length} 筆</span>
  </div>

  <div class="card">
    ${list.length ? `<div class="scroll-x"><table class="table table-compact">
      <thead><tr>
        <th style="width:100px">日期</th><th style="width:88px">類別</th><th>項目</th>
        <th class="right" style="width:110px">收入</th><th class="right" style="width:110px">支出</th>
        <th style="width:96px">方式</th><th class="center" style="width:64px">單據</th>
        ${can('finance.edit') ? '<th style="width:70px"></th>' : ''}
      </tr></thead>
      <tbody>${list.map(t => `
        <tr>
          <td class="mono sm">${esc(t.date)}</td>
          <td><span class="badge ${t.type === 'income' ? 'b-ok' : 'b-grey'}">${esc(t.category)}</span></td>
          <td><div class="semibold sm">${esc(t.item)}</div>
            ${t.note ? `<div class="xs faint">${esc(t.note)}</div>` : ''}
            ${t.by ? `<div class="xs faint">對象：${esc(memberName(t.by))}</div>` : ''}</td>
          <td class="num" style="color:var(--ok)">${t.type === 'income' ? esc(money(t.amount)) : ''}</td>
          <td class="num" style="color:var(--danger)">${t.type === 'expense' ? esc(money(t.amount)) : ''}</td>
          <td class="sm muted">${esc(t.method || '—')}</td>
          <td class="center">${t.receipt ? `<span style="color:var(--ok);display:flex;justify-content:center">${icon('check', 15)}</span>` : '<span class="faint">—</span>'}</td>
          ${can('finance.edit') ? `<td class="right nowrap">
            <button class="btn btn-xs btn-ghost" data-act="edit-tx" data-id="${t.id}">${icon('edit', 14)}</button>
            <button class="btn btn-xs btn-ghost" data-act="del-tx" data-id="${t.id}">${icon('trash', 14)}</button></td>` : ''}
        </tr>`).join('')}</tbody>
      <tfoot><tr style="border-top:2px solid var(--line)">
        <td colspan="3" class="right bold">合計</td>
        <td class="num bold" style="color:var(--ok)">${esc(money(inc))}</td>
        <td class="num bold" style="color:var(--danger)">${esc(money(exp))}</td>
        <td colspan="${can('finance.edit') ? 3 : 2}" class="bold">淨額 ${esc(money(inc - exp))}</td>
      </tr></tfoot>
    </table></div>` : `<div class="empty">${icon('wallet', 34)}<div class="empty-title">呢個篩選下冇記錄</div></div>`}
  </div>`;
}

/* ============================================================
   報表
   ============================================================ */
function reportPane() {
  const months = allMonths();
  const key = monthFilter === 'all' ? (months[0] || todayISO().slice(0, 7)) : monthFilter;
  const s = monthStats(key);
  const list = tx().filter(t => monthKey(t.date) === key);
  const incCats = categoryBreakdown(list, 'income');
  const expCats = categoryBreakdown(list, 'expense');
  const incMax = Math.max(1, ...incCats.map(c => c[1]));
  const expMax = Math.max(1, ...expCats.map(c => c[1]));

  const trend = [...months].reverse().slice(-6);
  const trendMax = Math.max(1, ...trend.map(k => Math.max(monthStats(k).income, monthStats(k).expense)));

  return `
  <div class="row-between mb-16 wrap gap-8 no-print">
    <select class="select" id="fMonth" style="width:auto">
      ${months.map(k => `<option value="${k}" ${k === key ? 'selected' : ''}>${esc(monthLabel(k))}</option>`).join('')}
    </select>
    <div class="row gap-8">
      <button class="btn btn-sm" data-act="print-report">${icon('print', 15)} 列印月結表</button>
      ${can('finance.export') ? `<button class="btn btn-sm" data-act="export-month">${icon('download', 15)} 下載 CSV</button>` : ''}
    </div>
  </div>

  <div id="reportSheet">
    <div class="grid g-3 mb-16">
      <div class="stat"><div class="stat-label">總收入</div>
        <div class="stat-value" style="color:var(--ok)">${esc(money(s.income))}</div></div>
      <div class="stat"><div class="stat-label">總支出</div>
        <div class="stat-value" style="color:var(--danger)">${esc(money(s.expense))}</div></div>
      <div class="stat"><div class="stat-label">本月淨額</div>
        <div class="stat-value" style="color:${s.net >= 0 ? 'var(--brand-700)' : 'var(--danger)'}">${esc(money(s.net))}</div>
        <div class="stat-foot">${s.count} 筆記錄</div></div>
    </div>

    <div class="grid g-2 mb-16">
      <div class="card card-pad">
        <div class="card-title mb-12">${esc(monthLabel(key))} 收入分類</div>
        ${incCats.length ? incCats.map(([c, v]) => barRow(c, v, s.income, incMax, 'var(--ok)')).join('')
          : '<div class="faint sm">本月冇收入記錄</div>'}
      </div>
      <div class="card card-pad">
        <div class="card-title mb-12">${esc(monthLabel(key))} 支出分類</div>
        ${expCats.length ? expCats.map(([c, v]) => barRow(c, v, s.expense, expMax, 'var(--danger)')).join('')
          : '<div class="faint sm">本月冇支出記錄</div>'}
      </div>
    </div>

    <div class="card card-pad mb-16">
      <div class="card-title mb-12">近 ${trend.length} 個月趨勢</div>
      <div class="row gap-16" style="align-items:flex-end;height:170px">
        ${trend.map(k => {
          const st = monthStats(k);
          return `<div class="col gap-4 center grow">
            <div class="row gap-4" style="align-items:flex-end;height:130px;justify-content:center">
              <div title="收入 ${esc(money(st.income))}" style="width:16px;height:${Math.round(st.income / trendMax * 125)}px;background:var(--ok);border-radius:4px 4px 0 0"></div>
              <div title="支出 ${esc(money(st.expense))}" style="width:16px;height:${Math.round(st.expense / trendMax * 125)}px;background:var(--danger);border-radius:4px 4px 0 0"></div>
            </div>
            <div class="xs faint">${k.slice(5)} 月</div>
            <div class="xs mono ${st.net >= 0 ? '' : ''}" style="color:${st.net >= 0 ? 'var(--ok)' : 'var(--danger)'}">${st.net >= 0 ? '+' : ''}${moneyPlain(st.net).split('.')[0]}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="row gap-16 mt-8 xs faint center" style="justify-content:center">
        <span class="row gap-4"><span style="width:9px;height:9px;background:var(--ok);border-radius:2px;display:inline-block"></span>收入</span>
        <span class="row gap-4"><span style="width:9px;height:9px;background:var(--danger);border-radius:2px;display:inline-block"></span>支出</span>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title">${esc(monthLabel(key))} 月結表</div>
        <div class="card-sub">司庫核對用 · 可列印</div></div>
      <div class="scroll-x"><table class="table table-compact">
        <thead><tr><th>日期</th><th>類別</th><th>項目</th><th>方式</th>
          <th class="right">收入</th><th class="right">支出</th></tr></thead>
        <tbody>${list.sort((a, b) => a.date.localeCompare(b.date)).map(t => `
          <tr><td class="mono sm">${esc(t.date)}</td><td>${esc(t.category)}</td>
            <td>${esc(t.item)}</td><td class="sm muted">${esc(t.method || '—')}</td>
            <td class="num">${t.type === 'income' ? esc(money(t.amount)) : ''}</td>
            <td class="num">${t.type === 'expense' ? esc(money(t.amount)) : ''}</td></tr>`).join('')}</tbody>
        <tfoot><tr style="border-top:2px solid var(--line)">
          <td colspan="4" class="right bold">合計</td>
          <td class="num bold">${esc(money(s.income))}</td>
          <td class="num bold">${esc(money(s.expense))}</td></tr>
          <tr><td colspan="4" class="right bold">本月淨額</td>
          <td colspan="2" class="num bold">${esc(money(s.net))}</td></tr></tfoot>
      </table></div>
    </div>
  </div>`;
}

function barRow(label, v, total, max, color) {
  const pct = total ? Math.round(v / total * 100) : 0;
  return `<div class="mb-12">
    <div class="row-between mb-4"><span class="sm semibold">${esc(label)}</span>
      <span class="sm mono">${esc(money(v))} <span class="faint">(${pct}%)</span></span></div>
    <div class="bar"><span style="width:${Math.round(v / max * 100)}%;background:${color}"></span></div>
  </div>`;
}

/* ============================================================
   收費追蹤
   ============================================================ */
function feesPane() {
  const all = fees();
  const kinds = [...new Set(all.map(f => f.kind))];
  let list = all;
  if (feeKind !== 'all') list = list.filter(f => f.kind === feeKind);
  if (feeStatus === 'paid') list = list.filter(f => f.paid);
  if (feeStatus === 'unpaid') list = list.filter(f => !f.paid);
  if (feeStatus === 'overdue') {
    const today = todayISO();
    list = list.filter(f => !f.paid && f.due && f.due < today);
  }
  const s = feeSummary();
  const today = todayISO();

  return `
  <div class="row-between mb-12 wrap gap-8 no-print">
    <div class="row gap-8 wrap">
      <select class="select" id="fKind" style="width:auto">
        <option value="all">全部項目</option>
        ${kinds.map(k => `<option value="${esc(k)}" ${feeKind === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}
      </select>
      <div class="chipbar">
        ${[['all', '全部'], ['unpaid', '未收'], ['overdue', '逾期'], ['paid', '已收']]
          .map(([k, l]) => `<button class="chip" aria-pressed="${feeStatus === k}" data-feefilter="${k}">${l}</button>`).join('')}
      </div>
    </div>
    <div class="row gap-8">
      ${can('fee.mark') ? `<button class="btn btn-sm" data-act="remind">${icon('mail', 15)} 複製催繳名單</button>
      <button class="btn btn-sm btn-primary" data-act="add-fee">${icon('plus', 15)} 新增收費</button>` : ''}
    </div>
  </div>

  <div class="grid g-3 mb-16">
    <div class="stat"><div class="stat-label">應收總額</div>
      <div class="stat-value">${esc(money(s.expected))}</div>
      <div class="stat-foot">${s.total} 筆收費項目</div></div>
    <div class="stat"><div class="stat-label">已收</div>
      <div class="stat-value" style="color:var(--ok)">${esc(money(s.collected))}</div>
      <div class="stat-foot">${s.paidCount} 筆 · ${s.rate}%</div></div>
    <div class="stat"><div class="stat-label">未收</div>
      <div class="stat-value" style="color:var(--danger)">${esc(money(s.outstanding))}</div>
      <div class="stat-foot">${s.unpaidCount} 筆 · ${overdueFees().length} 筆逾期</div></div>
  </div>

  <div class="card">
    ${list.length ? `<div class="scroll-x"><table class="table table-compact">
      <thead><tr><th>團員</th><th>項目</th><th class="right">金額</th><th>到期日</th><th>狀態</th>
        <th>收款方式</th><th>收款日</th>${can('fee.mark') ? '<th style="width:110px"></th>' : ''}</tr></thead>
      <tbody>${list.map(f => {
        const overdue = !f.paid && f.due && f.due < today;
        return `<tr>
          <td><div class="row gap-8">${avatar(memberName(f.memberId), 'avatar-sm')}
            <span class="sm semibold">${esc(memberName(f.memberId))}</span></div></td>
          <td><div class="sm">${esc(f.label)}</div><div class="xs faint">${esc(f.kind)}</div></td>
          <td class="num">${esc(money(f.amount))}</td>
          <td class="mono sm ${overdue ? '' : 'muted'}" style="${overdue ? 'color:var(--danger)' : ''}">${esc(f.due || '—')}</td>
          <td>${f.paid ? '<span class="badge b-ok"><span class="dot"></span>已收</span>'
                      : overdue ? '<span class="badge b-danger"><span class="dot"></span>逾期</span>'
                      : '<span class="badge b-warn"><span class="dot"></span>未收</span>'}</td>
          <td class="sm muted">${esc(f.method || '—')}</td>
          <td class="mono sm muted">${esc(f.paidDate || '—')}</td>
          ${can('fee.mark') ? `<td class="right nowrap">
            ${f.paid ? `<button class="btn btn-xs" data-act="unmark" data-id="${f.id}">撤銷</button>`
                     : `<button class="btn btn-xs btn-soft" data-act="mark" data-id="${f.id}">標記已收</button>`}
            ${can('fee.edit') ? `<button class="btn btn-xs btn-ghost" data-act="del-fee" data-id="${f.id}">${icon('trash', 14)}</button>` : ''}
          </td>` : ''}
        </tr>`;
      }).join('')}</tbody>
    </table></div>` : `<div class="empty">${icon('users', 34)}<div class="empty-title">冇符合條件嘅收費記錄</div></div>`}
  </div>`;
}

/* ============================================================
   活動預算（次要）
   ============================================================ */
function budgetPane() {
  const list = collection('budgets');
  return `
  <div class="row-between mb-16 wrap gap-8">
    <div class="page-sub">活動預算 vs 實際結算（次要功能）</div>
    ${can('finance.create') ? `<button class="btn btn-primary btn-sm" data-act="add-budget">${icon('plus', 15)} 新增活動預算</button>` : ''}
  </div>
  ${list.length ? list.map(b => {
    const bRev = (b.incomeItems || []).reduce((s, i) => s + num(i.budget), 0);
    const aRev = (b.incomeItems || []).reduce((s, i) => s + num(i.actual), 0);
    const bCost = (b.items || []).reduce((s, i) => s + num(i.budget), 0);
    const aCost = (b.items || []).reduce((s, i) => s + num(i.actual), 0);
    const net = aRev - aCost;
    return `<div class="card mb-16">
      <div class="card-head">
        <div><div class="card-title">${esc(b.event)}</div>
          <div class="card-sub">${esc(b.date)} · ${b.status === 'open' ? '進行中' : '已結算'}</div></div>
        <div class="row gap-6">
          <span class="badge ${net >= 0 ? 'b-ok' : 'b-danger'}">結算 ${esc(money(net))}</span>
          ${can('finance.edit') ? `<button class="btn btn-xs" data-act="edit-budget" data-id="${b.id}">${icon('edit', 14)} 填實際數</button>` : ''}
        </div>
      </div>
      <div class="scroll-x"><table class="table table-compact">
        <thead><tr><th>項目</th><th class="right">預算</th><th class="right">實際</th><th class="right">差異</th></tr></thead>
        <tbody>
          ${(b.incomeItems || []).map(i => budgetRow(i, true)).join('')}
          ${(b.items || []).map(i => budgetRow(i, false)).join('')}
        </tbody>
        <tfoot><tr style="border-top:2px solid var(--line)">
          <td class="bold">合計</td>
          <td class="num bold">${esc(money(bRev - bCost))}</td>
          <td class="num bold" style="color:${net >= 0 ? 'var(--ok)' : 'var(--danger)'}">${esc(money(net))}</td>
          <td class="num bold">${esc(money(net - (bRev - bCost)))}</td></tr></tfoot>
      </table></div>
    </div>`;
  }).join('') : `<div class="card"><div class="empty">${icon('target', 34)}
    <div class="empty-title">仲未有任何活動預算</div>
    <div class="sm mt-4">可以為每個活動開一份預算，完咗再填實際數對比。</div></div></div>`}`;
}
function budgetRow(i, isIncome) {
  const d = num(i.actual) - num(i.budget);
  const sign = isIncome ? 1 : -1;
  return `<tr>
    <td>${isIncome ? '<span class="badge b-ok">收入</span> ' : '<span class="badge b-grey">支出</span> '}${esc(i.name)}</td>
    <td class="num">${esc(money(i.budget))}</td>
    <td class="num">${esc(money(i.actual))}</td>
    <td class="num" style="color:${d * sign >= 0 ? 'var(--ok)' : 'var(--danger)'}">${num(i.actual) ? esc(money(d)) : '—'}</td>
  </tr>`;
}

/* ============================================================
   MOUNT
   ============================================================ */
export function mount(root, params) {
  root.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => {
    tab = el.dataset.tab; setQuery({ tab }); refresh();
  }));
  root.querySelectorAll('[data-feefilter]').forEach(el => el.addEventListener('click', () => {
    feeStatus = el.dataset.feefilter; refresh();
  }));

  const bind = (sel, fn, evt = 'change') => {
    const el = root.querySelector(sel); if (el) el.addEventListener(evt, fn);
  };
  bind('#fMonth', e => { monthFilter = e.target.value; refresh(); });
  bind('#fType', e => { typeFilter = e.target.value; refresh(); });
  bind('#fCat', e => { catFilter = e.target.value; refresh(); });
  bind('#fKw', e => { kw = e.target.value; refresh(); }, 'input');
  bind('#fKind', e => { feeKind = e.target.value; refresh(); });

  /* ---- toolbar ---- */
  const toolbar = root.querySelector('[data-act="add-tx"]');
  if (toolbar) toolbar.addEventListener('click', () => txModal());
  const exp = root.querySelector('[data-act="export"]');
  if (exp) exp.addEventListener('click', () => exportCSV(filteredTx(), '全期收支記錄'));
  const expM = root.querySelector('[data-act="export-month"]');
  if (expM) expM.addEventListener('click', () => {
    const key = monthFilter === 'all' ? allMonths()[0] : monthFilter;
    exportCSV(tx().filter(t => monthKey(t.date) === key), monthLabel(key) + '月結表');
  });
  const pr = root.querySelector('[data-act="print-report"]');
  if (pr) pr.addEventListener('click', () => window.print());

  /* ---- row actions ---- */
  root.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const act = btn.dataset.act;
      if (act === 'add-tx' || act === 'export' || act === 'export-month' || act === 'print-report') return; // 已處理

      if (act === 'edit-tx') {
        const t = find('transactions', btn.dataset.id);
        if (t) txModal(t);
      }

      if (act === 'del-tx') {
        const t = find('transactions', btn.dataset.id);
        if (t && await confirmDlg({
          title: '刪除記錄', danger: true, okText: '刪除',
          message: `確定刪除「<b>${esc(t.item)}</b>」${esc(money(t.amount))}？`
        })) { remove('transactions', t.id); toast('已刪除'); refresh(); }
      }

      if (act === 'add-fee') feeModal();

      if (act === 'mark' || act === 'unmark') {
        const f = find('fees', btn.dataset.id);
        if (!f) return;
        if (act === 'unmark') {
          update('fees', f.id, { paid: false, paidDate: '', method: '' });
          toast('已撤銷收款狀態'); refresh(); return;
        }
        const r = await modal({
          title: '標記已收款',
          sub: `${esc(memberName(f.memberId))} · ${esc(f.label)} · ${esc(money(f.amount))}`,
          body: `<div class="grid g-2">
              <div class="field"><label class="label">收款日期</label>
                <input class="input" type="date" id="q-date" value="${esc(todayISO())}"></div>
              <div class="field"><label class="label">收款方式</label>
                <select class="select" id="q-method">${METHODS.map(m => `<option>${m}</option>`).join('')}</select></div>
            </div>
            ${can('finance.create') ? `<label class="check mt-16"><input type="checkbox" id="q-ledger" checked>
              同時加入收支記帳（收入 · ${esc(f.kind)}）</label>` : ''}`,
          actions: [{ label: '取消', class: 'btn', value: null },
            { label: '確認收款', class: 'btn-primary', onClick: el => ({
                paidDate: el.querySelector('#q-date').value,
                method: el.querySelector('#q-method').value,
                ledger: el.querySelector('#q-ledger')?.checked })}]
        });
        if (r) {
          update('fees', f.id, { paid: true, paidDate: r.paidDate, method: r.method });
          if (r.ledger) {
            add('transactions', {
              id: uid('t'), date: r.paidDate, type: 'income', category: f.kind,
              item: `${memberName(f.memberId)} ${f.label}`, amount: num(f.amount),
              method: r.method, by: f.memberId, ref: '', note: '由收費追蹤自動產生', receipt: true
            });
          }
          toast('已標記收款' + (r.ledger ? '，並已記帳' : ''), 'ok');
          refresh();
        }
      }

      if (act === 'del-fee') {
        const f = find('fees', btn.dataset.id);
        if (f && await confirmDlg({ title: '刪除收費項目', danger: true, okText: '刪除',
          message: `確定刪除 ${esc(memberName(f.memberId))} 嘅「${esc(f.label)}」？` })) {
          remove('fees', f.id); toast('已刪除'); refresh();
        }
      }

      if (act === 'remind') {
        const list = overdueFees();
        if (!list.length) { toast('目前冇逾期款項', 'warn'); return; }
        const lines = list.map(f => `${memberName(f.memberId)}　${f.label}　${money(f.amount)}（到期 ${f.due}）`);
        const text = `【82venture 繳費提醒】\n以下項目已逾期，請盡快繳交：\n\n${lines.join('\n')}\n\n謝謝合作！`;
        if (await copyText(text)) toast(`已複製 ${list.length} 位團員嘅催繳名單`, 'ok');
      }

      if (act === 'add-budget' || act === 'edit-budget') {
        const b = act === 'edit-budget' ? find('budgets', btn.dataset.id) : null;
        const rows = items => (items || []).map(i =>
          `<div class="row gap-8 mb-8">
            <input class="input grow" data-n value="${esc(i.name)}" placeholder="項目名稱">
            <input class="input input-money" data-b type="number" value="${num(i.budget)}" style="width:110px">
            <input class="input input-money" data-a type="number" value="${num(i.actual)}" style="width:110px">
          </div>`).join('');

        const r = await modal({
          title: b ? '填寫實際數' : '新增活動預算', wide: true,
          body: `<div class="grid g-2">
              <div class="field"><label class="label">活動名稱</label>
                <input class="input" id="q-event" value="${b ? esc(b.event) : ''}"></div>
              <div class="field"><label class="label">日期</label>
                <input class="input" type="date" id="q-date" value="${b ? esc(b.date) : ''}"></div>
            </div>
            <div class="mt-16"><div class="label mb-8">收入項目　<span class="faint">名稱 / 預算 / 實際</span></div>
              <div id="incWrap">${rows(b?.incomeItems)}</div>
              <button class="btn btn-xs mt-4" data-addrow="incWrap">${icon('plus', 13)} 加收入項目</button></div>
            <div class="mt-16"><div class="label mb-8">支出項目　<span class="faint">名稱 / 預算 / 實際</span></div>
              <div id="expWrap">${rows(b?.items)}</div>
              <button class="btn btn-xs mt-4" data-addrow="expWrap">${icon('plus', 13)} 加支出項目</button></div>`,
          actions: [{ label: '取消', class: 'btn', value: null },
            { label: '儲存', class: 'btn-primary', onClick: el => ({
                event: el.querySelector('#q-event').value.trim(),
                date: el.querySelector('#q-date').value,
                incomeItems: readRows(el.querySelector('#incWrap')),
                items: readRows(el.querySelector('#expWrap')) })}],
          onMount: el => {
            el.querySelectorAll('[data-addrow]').forEach(b2 => b2.addEventListener('click', () => {
              const wrap = el.querySelector('#' + b2.dataset.addrow);
              const d = document.createElement('div');
              d.className = 'row gap-8 mb-8';
              d.innerHTML = `<input class="input grow" data-n placeholder="項目名稱">
                <input class="input input-money" data-b type="number" value="0" style="width:110px">
                <input class="input input-money" data-a type="number" value="0" style="width:110px">`;
              wrap.appendChild(d);
            }));
          }
        });
        if (r && r.event) {
          if (b) update('budgets', b.id, r);
          else add('budgets', { id: uid('b'), status: 'open', ...r });
          toast('已儲存', 'ok'); refresh();
        }
      }
    });
  });

  if (params.query.new === '1') { setTimeout(() => txModal(), 260); }
}

function readRows(wrap) {
  return Array.from(wrap.querySelectorAll('.row')).map(r => ({
    id: uid('bi'),
    name: r.querySelector('[data-n]')?.value.trim() || '未命名',
    budget: num(r.querySelector('[data-b]')?.value),
    actual: num(r.querySelector('[data-a]')?.value)
  })).filter(i => i.name !== '未命名' || i.budget || i.actual);
}

/* ---------- 記一筆 modal ---------- */
export async function txModal(existing) {
  const t = existing || { type: 'expense', date: todayISO(), category: '', item: '', amount: '', method: '現金', note: '', ref: '', by: '', receipt: true };
  const isIncome = t.type === 'income';
  const roster = members().filter(m => m.status !== 'alumni');

  const r = await modal({
    title: existing ? '編輯收支記錄' : '記一筆',
    sub: existing ? '' : '收入定支出？填好就會即時計入結餘',
    body: `
      <div class="seg mb-16" id="typeSeg" style="width:100%">
        <button data-t="income" aria-selected="${isIncome}" style="flex:1">${icon('arrowUp', 15)} 收入</button>
        <button data-t="expense" aria-selected="${!isIncome}" style="flex:1">${icon('arrowDown', 15)} 支出</button>
      </div>
      <div class="grid g-2">
        <div class="field"><label class="label">日期 <span class="req">*</span></label>
          <input class="input" type="date" id="q-date" value="${esc(t.date)}"></div>
        <div class="field"><label class="label">金額 (HK$) <span class="req">*</span></label>
          <input class="input input-money" type="number" step="0.01" id="q-amount" value="${t.amount}" placeholder="0.00"></div>
      </div>
      <div class="field mt-12"><label class="label">類別 <span class="req">*</span></label>
        <select class="select" id="q-cat"></select></div>
      <div class="field mt-12"><label class="label">項目名稱 <span class="req">*</span></label>
        <input class="input" id="q-item" value="${esc(t.item)}" placeholder="例如：九月份場地租金"></div>
      <div class="grid g-2 mt-12">
        <div class="field"><label class="label">收付方式</label>
          <select class="select" id="q-method">${METHODS.map(m => `<option ${t.method === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
        <div class="field"><label class="label">相關團員（可選）</label>
          <select class="select" id="q-by"><option value="">—</option>
            ${roster.map(m => `<option value="${m.id}" ${t.by === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
      </div>
      <div class="grid g-2 mt-12">
        <div class="field"><label class="label">單據編號（可選）</label>
          <input class="input" id="q-ref" value="${esc(t.ref || '')}" placeholder="例如：FPS-001"></div>
        <div class="field"><label class="label">&nbsp;</label>
          <label class="check" style="height:38px"><input type="checkbox" id="q-receipt" ${t.receipt ? 'checked' : ''}> 已有單據</label></div>
      </div>
      <div class="field mt-12"><label class="label">備註</label>
        <input class="input" id="q-note" value="${esc(t.note || '')}" placeholder="可留空"></div>`,
    actions: [
      { label: '取消', class: 'btn', value: null },
      { label: existing ? '儲存' : '記低佢', class: 'btn-primary', onClick: el => ({
          type: el.querySelector('#typeSeg [aria-selected="true"]').dataset.t,
          date: el.querySelector('#q-date').value,
          amount: el.querySelector('#q-amount').value,
          category: el.querySelector('#q-cat').value,
          item: el.querySelector('#q-item').value.trim(),
          method: el.querySelector('#q-method').value,
          by: el.querySelector('#q-by').value,
          ref: el.querySelector('#q-ref').value.trim(),
          receipt: el.querySelector('#q-receipt').checked,
          note: el.querySelector('#q-note').value.trim()
        })}
    ],
    onMount: el => {
      let type = t.type;
      const catSel = el.querySelector('#q-cat');
      const fill = () => {
        const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
        catSel.innerHTML = cats.map(c => `<option ${c === t.category ? 'selected' : ''}>${c}</option>`).join('');
      };
      fill();
      el.querySelectorAll('#typeSeg button').forEach(b => b.addEventListener('click', () => {
        type = b.dataset.t;
        el.querySelectorAll('#typeSeg button').forEach(x => x.setAttribute('aria-selected', x === b));
        fill();
      }));
    }
  });

  if (!r) return;
  if (!r.amount || num(r.amount) <= 0) { toast('請輸入正確金額', 'err'); return txModal(existing); }
  if (!r.item) { toast('請填寫項目名稱', 'err'); return txModal(existing); }

  const payload = { ...r, amount: num(r.amount) };
  if (existing) { update('transactions', existing.id, payload); toast('已更新', 'ok'); }
  else { add('transactions', { id: uid('t'), ...payload }); toast('已記錄 ' + money(payload.amount), 'ok'); }
  refresh();
}

/* ---------- 新增收費 modal ---------- */
async function feeModal() {
  const s = load().settings;
  const roster = members().filter(m => m.status !== 'alumni');
  const r = await modal({
    title: '新增收費項目',
    body: `<div class="field"><label class="label">收費項目 <span class="req">*</span></label>
        <input class="input" id="q-label" value="${esc(s.feePeriodLabel)}"></div>
      <div class="grid g-2 mt-12">
        <div class="field"><label class="label">類別</label>
          <select class="select" id="q-kind"><option>團費</option><option>活動費</option><option>其他</option></select></div>
        <div class="field"><label class="label">金額 (HK$)</label>
          <input class="input input-money" type="number" id="q-amount" value="${s.feeAmount}"></div>
      </div>
      <div class="field mt-12"><label class="label">到期日</label>
        <input class="input" type="date" id="q-due" value="${esc(todayISO())}"></div>
      <div class="field mt-12"><label class="label">向以下團員收取</label>
        <div style="border:1px solid var(--line);border-radius:var(--r);padding:10px;max-height:210px;overflow:auto">
          <label class="check mb-8"><input type="checkbox" id="q-all" checked> <b>全選</b></label>
          ${roster.map(m => `<label class="check mb-8" style="display:flex"><input type="checkbox" class="q-m" value="${m.id}" checked> ${esc(m.name)}　<span class="faint sm">${esc(m.role)}</span></label>`).join('')}
        </div></div>`,
    actions: [{ label: '取消', class: 'btn', value: null },
      { label: '建立', class: 'btn-primary', onClick: el => ({
          label: el.querySelector('#q-label').value.trim(),
          kind: el.querySelector('#q-kind').value,
          amount: num(el.querySelector('#q-amount').value),
          due: el.querySelector('#q-due').value,
          ids: Array.from(el.querySelectorAll('.q-m:checked')).map(x => x.value) })}],
    onMount: el => {
      const all = el.querySelector('#q-all');
      all.addEventListener('change', () => {
        el.querySelectorAll('.q-m').forEach(x => x.checked = all.checked);
      });
    }
  });
  if (!r || !r.label || !r.ids?.length) return;
  r.ids.forEach(mid => add('fees', {
    id: uid('f'), memberId: mid, kind: r.kind, label: r.label,
    amount: r.amount, due: r.due, paid: false, paidDate: '', method: ''
  }));
  toast(`已建立 ${r.ids.length} 筆收費`, 'ok');
  refresh();
}

/* ---------- CSV ---------- */
function exportCSV(list, name) {
  const head = ['日期', '類型', '類別', '項目', '金額', '收付方式', '相關團員', '單據編號', '已有單據', '備註'];
  const rows = list.map(t => [
    t.date, t.type === 'income' ? '收入' : '支出', t.category, t.item,
    moneyPlain(t.amount), t.method || '', memberName(t.by), t.ref || '',
    t.receipt ? 'Y' : 'N', t.note || ''
  ]);
  const csv = '﻿' + [head, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  download(`82venture_${name}_${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
  toast('已匯出 CSV', 'ok');
}

export function refresh() {
  window.dispatchEvent(new CustomEvent('v82:refresh'));
}
