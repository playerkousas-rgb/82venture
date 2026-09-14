/* ============================================================
   model.js — 共用業務邏輯（狀態標籤、財務統計、團員查找）
   ============================================================ */

import { load, collection, find } from './store.js';

/* ---------- 會議 ---------- */
export const MEETING_STATUS = {
  draft:     { label: '草稿',   cls: 'b-grey' },
  pending:   { label: '待處理', cls: 'b-warn' },
  confirmed: { label: '已確定', cls: 'b-info' },
  done:      { label: '已完成', cls: 'b-ok' },
  cancelled: { label: '已取消', cls: 'b-danger' }
};
export const MEETING_TYPES = {
  exco: '執委會會議', agm: '團員大會', activity: '活動會議', other: '其他'
};
export const ATTEND = {
  present: { label: '出席', cls: 'b-ok' },
  late:    { label: '遲到', cls: 'b-warn' },
  apology: { label: '請假', cls: 'b-info' },
  absent:  { label: '缺席', cls: 'b-danger' }
};
export function statusLabel(s) { return (MEETING_STATUS[s] || MEETING_STATUS.draft).label; }
export function statusBadge(s) {
  const m = MEETING_STATUS[s] || MEETING_STATUS.draft;
  return `<span class="badge ${m.cls}"><span class="dot"></span>${m.label}</span>`;
}

/* ---------- 團員 ---------- */
export function members() { return collection('members'); }
export function memberName(id) { return find('members', id)?.name || '—'; }
export function member(id) { return find('members', id); }
export function activeMembers() { return members().filter(m => m.status !== 'alumni'); }

export function attendanceStats(memberId) {
  const ms = collection('meetings').filter(m => m.status === 'done');
  let present = 0, late = 0, apology = 0, absent = 0;
  ms.forEach(m => {
    const s = (m.attendance || {})[memberId];
    if (s === 'present') present++;
    else if (s === 'late') { late++; present++; }
    else if (s === 'apology') apology++;
    else if (s === 'absent') absent++;
  });
  const total = Math.max(ms.length, 1);
  return { present, late, apology, absent, total: ms.length, rate: Math.round(present / total * 100) };
}

/* ---------- 財務統計 ---------- */
export function tx() { return collection('transactions'); }

export function sumBy(list, type) {
  return list.filter(t => t.type === type).reduce((s, t) => s + (Number(t.amount) || 0), 0);
}
export function balance(list = tx()) {
  return sumBy(list, 'income') - sumBy(list, 'expense');
}
export function monthStats(key) {
  const list = tx().filter(t => String(t.date).slice(0, 7) === key);
  return { income: sumBy(list, 'income'), expense: sumBy(list, 'expense'), net: balance(list), count: list.length };
}
export function allMonths() {
  const set = new Set(tx().map(t => String(t.date).slice(0, 7)));
  return [...set].sort().reverse();
}
export function categoryBreakdown(list, type) {
  const map = {};
  list.filter(t => t.type === type).forEach(t => {
    const k = t.category || '其他';
    map[k] = (map[k] || 0) + (Number(t.amount) || 0);
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}
export const INCOME_CATS  = ['團費', '活動費', '資助', '捐款', '其他收入'];
export const EXPENSE_CATS = ['場地', '活動', '物資', '文書', '交通', '雜項'];
export const METHODS = ['現金', '轉數快', '轉賬', '自動扣賬', '支票', '其他'];

/* ---------- 團費 ---------- */
export function fees() { return collection('fees'); }
export function feeSummary() {
  const all = fees();
  const paid = all.filter(f => f.paid);
  const unpaid = all.filter(f => !f.paid);
  return {
    total: all.length,
    paidCount: paid.length,
    unpaidCount: unpaid.length,
    collected: paid.reduce((s, f) => s + (Number(f.amount) || 0), 0),
    outstanding: unpaid.reduce((s, f) => s + (Number(f.amount) || 0), 0),
    expected: all.reduce((s, f) => s + (Number(f.amount) || 0), 0),
    rate: all.length ? Math.round(paid.length / all.length * 100) : 0
  };
}
export function overdueFees() {
  const today = new Date().toISOString().slice(0, 10);
  return fees().filter(f => !f.paid && f.due && f.due < today);
}

/* ---------- 團章 ---------- */
export function constitution() { return load().constitution; }
export function articleCount(c) {
  return (c?.chapters || []).reduce((s, ch) => s + (ch.articles?.length || 0), 0);
}

/* ---------- 待辦（跨模組） ---------- */
export function openActions() {
  const out = [];
  collection('meetings').forEach(m => {
    (m.decisions || []).forEach(d => {
      if (!d.done) out.push({ ...d, meetingId: m.id, meetingTitle: m.title });
    });
  });
  return out.sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
}
export function upcomingMeetings(n = 4) {
  const today = new Date().toISOString().slice(0, 10);
  return collection('meetings')
    .filter(m => m.date >= today && m.status !== 'done' && m.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, n);
}
export function pendingMeetings() {
  return collection('meetings').filter(m => m.status === 'pending');
}
