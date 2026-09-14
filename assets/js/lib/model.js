/* ============================================================
   model.js — 共用業務邏輯
   （會議狀態、團員／生日、財務統計、物資庫存、團章）
   ============================================================ */

import { load, collection, find } from './store.js';
import { todayISO, parseBirthday, daysUntilBirthday, ageFrom, turningAge } from './dates.js';
import { agmIsDefault, unitFYOf, scoutFYLabel } from './fiscal.js';
export * from './fiscal.js';

/* ---------------- 基本 ---------------- */
export function settings() { return load().settings || {}; }
export function profile() { return load().profile || load().unit || {}; }
export function currency() { return settings().currency || 'HK$'; }
export function money(n) {
  const v = Number(n) || 0;
  return currency() + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/* ---------------- 會議 ---------------- */
export const MEETING_STATUS = {
  draft:     { label: '草稿',   cls: 'b-grey' },
  pending:   { label: '待處理', cls: 'b-warn' },
  confirmed: { label: '已確定', cls: 'b-info' },
  done:      { label: '已完成', cls: 'b-ok' },
  cancelled: { label: '已取消', cls: 'b-danger' }
};
export const MEETING_TYPES = { exco: '執委會會議', agm: '團員大會', activity: '活動會議', other: '其他' };
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

/* ---------------- 團員 ---------------- */
export function members() { return collection('members'); }
export function member(id) { return find('members', id); }
export function memberName(id) { return member(id)?.name || '—'; }
export function activeMembers() { return members().filter(m => m.status !== 'alumni'); }
export function memberStatus() {
  return { active: { l: '現役', c: 'b-ok' }, leave: { l: '休假', c: 'b-warn' }, alumni: { l: '舊團員', c: 'b-grey' } };
}
export function memberAge(m) { return ageFrom(m?.birthday); }
export function memberBirthdayText(m) {
  const p = parseBirthday(m?.birthday);
  if (!p) return '—';
  return p.hasYear ? `${p.iso}（${p.m} 月 ${p.d} 日）` : `${p.m} 月 ${p.d} 日（年份待補）`;
}

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

/* ---------------- 生日 ---------------- */
/** 所有團員依「距離下次生日」排序 */
export function birthdayList({ includeAlumni = false } = {}) {
  return members()
    .filter(m => !includeAlumni ? m.status !== 'alumni' : true)
    .filter(m => parseBirthday(m.birthday))
    .map(m => ({
      member: m, name: m.name, id: m.id, birthday: m.birthday,
      days: daysUntilBirthday(m.birthday), age: ageFrom(m.birthday), turning: turningAge(m.birthday),
      md: parseBirthday(m.birthday).md
    }))
    .sort((a, b) => a.days - b.days);
}

/** 生日喺 n 日內（包括今日） */
export function birthdaysWithin(days = 7, opts) {
  return birthdayList(opts).filter(x => x.days !== null && x.days <= days);
}

/** 今個月生日 */
export function birthdaysThisMonth(month = new Date().getMonth() + 1, opts) {
  const mm = String(month).padStart(2, '0');
  return birthdayList(opts).filter(x => x.md.startsWith(mm)).sort((a, b) => Number(a.md.slice(3)) - Number(b.md.slice(3)));
}

export function birthdaySummary() {
  const s = settings().birthday || {};
  return {
    today: birthdaysWithin(0),
    in7: birthdaysWithin(Number(s.remindDaysBefore || 7)),
    month: birthdaysThisMonth(),
    unknown: members().filter(m => !parseBirthday(m.birthday) && m.status !== 'alumni').map(m => m.name)
  };
}

/* ---------------- 財務 ---------------- */
export function tx() { return collection('transactions'); }
export function claims() { return collection('claims'); }
export function fees() { return collection('fees'); }
export function budgets() { return collection('budgets'); }
export function categories(type) { return (load().categories || {})[type] || []; }
export function methods() { return load().methods || ['現金']; }

export function sumBy(list, type) {
  return list.filter(t => t.type === type).reduce((s, t) => s + (Number(t.amount) || 0), 0);
}
export function balance(list = tx()) { return sumBy(list, 'income') - sumBy(list, 'expense'); }
export function monthStats(key) {
  const list = tx().filter(t => String(t.date).slice(0, 7) === key);
  return { income: sumBy(list, 'income'), expense: sumBy(list, 'expense'), net: balance(list), count: list.length };
}
export function allMonths() {
  const set = new Set(tx().map(t => String(t.date).slice(0, 7)));
  set.add(todayISO().slice(0, 7));
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
export function openingBalance() {
  const s = settings();
  return { amount: Number(s.openingBalance || 0), date: s.openingBalanceDate || '' };
}
/** 某段期間嘅結餘（期初 + 期間收入 − 期間支出） */
export function balanceAt(startISO) {
  const before = tx().filter(t => String(t.date) < startISO);
  return openingBalance().amount + balance(before);
}
export function pendingClaims() { return claims().filter(c => (c.status || 'pending') === 'pending'); }

/* 團費 */
export function feeSummary(list = fees()) {
  const paid = list.filter(f => f.paid);
  const unpaid = list.filter(f => !f.paid);
  return {
    total: list.length, paidCount: paid.length, unpaidCount: unpaid.length,
    collected: paid.reduce((s, f) => s + (Number(f.amount) || 0), 0),
    outstanding: unpaid.reduce((s, f) => s + (Number(f.amount) || 0), 0),
    expected: list.reduce((s, f) => s + (Number(f.amount) || 0), 0),
    rate: list.length ? Math.round(paid.length / list.length * 100) : 0
  };
}
export function overdueFees() {
  const today = todayISO();
  return fees().filter(f => !f.paid && f.due && f.due < today);
}

/* ---------- 團費（金額可改，唔係寫死） ---------- */
/** 標準團費（每位團員每年）—— 由 settings.feePerYear 讀，可隨時改 */
export function standardFee() { return Number(settings().feePerYear ?? 360); }
/** 海外／優惠團費（預設標準嘅 1/4） */
export function overseasFee() {
  const v = settings().feeOverseas;
  if (v === undefined || v === null || v === '') return Math.round(standardFee() / 4);
  return Number(v);
}
/** 團費預設到期日（例：年度首年 9 月 30 日） */
export function defaultFeeDue(period = feePeriodOf(todayISO())) {
  const tpl = settings().feeDueTemplate;
  const y = String(period).slice(0, 4);
  return (tpl || `${y}-09-30`).replace(/[{]y[}]/g, y);
}

/** 由日期推算團費期別（跟童軍年度，例如 2025-12-07 → 2025-26） */
export function feePeriodOf(dateISO) {
  return scoutFYLabel(dateISO || todayISO(), Number(settings().scoutFYStartMonth || 4));
}
/** 所有出現過嘅期別（由新到舊），並確保「本年度」一定在列 */
export function feePeriods() {
  const list = [...new Set(fees().map(f => f.period).filter(Boolean))];
  const cur = feePeriodOf(todayISO());
  if (!list.includes(cur)) list.push(cur);
  return list.sort().reverse();
}
/** 某位團員某期嘅收費紀錄 */
export function feeOf(memberId, period) {
  return fees().find(f => f.memberId === memberId && f.period === period) || null;
}
/** 團費收款表：每位（非舊團員）團員 × 某一期 */
export function feeGrid(period = feePeriodOf(todayISO()), { includeAlumni = false } = {}) {
  const fallback = standardFee();
  return members()
    .filter(m => includeAlumni || m.status !== 'alumni')
    .map(m => {
      const f = feeOf(m.id, period);
      return {
        member: m, id: f?.id || null,
        amount: Number(f?.amount ?? fallback),
        paid: !!f?.paid, paidDate: f?.paidDate || '', method: f?.method || '',
        ref: f?.ref || '', due: f?.due || '', note: f?.note || '',
        txId: f?.txId || '', exists: !!f
      };
    })
    .sort((a, b) => (a.paid === b.paid ? String(a.member.name).localeCompare(String(b.member.name), 'zh-Hant') : a.paid ? 1 : -1));
}
/** 團費統計（某人／某期） */
export function feeStats(period = feePeriodOf(todayISO())) {
  const rows = feeGrid(period);
  const paid = rows.filter(r => r.paid), unpaid = rows.filter(r => !r.paid);
  const today = todayISO();
  return {
    period, rows, total: rows.length, paidCount: paid.length, unpaidCount: unpaid.length,
    collected: paid.reduce((s, r) => s + r.amount, 0),
    outstanding: unpaid.reduce((s, r) => s + r.amount, 0),
    expected: rows.reduce((s, r) => s + r.amount, 0),
    rate: rows.length ? Math.round(paid.length / rows.length * 100) : 0,
    overdue: unpaid.filter(r => r.due && r.due < today).length,
    noRecord: rows.filter(r => !r.exists).length
  };
}
/** 喺文字入面搵吓有冇團員名（用嚟由「曉莉 團費」對應到團員） */
export function matchMemberByName(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const list = members();
  // 1) 全名包含喺文字入面
  const full = list.find(m => m.name && t.includes(m.name));
  if (full) return full;
  // 2) 文字本身係花名／名字一部分（例：日彤 → 劉日彤、天蔚 → 方天蔚）
  const short = list
    .filter(m => m.name && m.name.length >= 3 && t.length >= 2 && m.name.includes(t))
    .sort((a, b) => a.name.length - b.name.length)[0];
  if (short) return short;
  // 3) 英文名
  return list.find(m => m.eng && t.toLowerCase().includes(String(m.eng).toLowerCase())) || null;
}

/* ---------------- 物資 ---------------- */
export function invItems() { return collection('invItems'); }
export function invLoans() { return collection('invLoans'); }
export function invAudits() { return collection('invAudits'); }
export function invItem(id) { return find('invItems', id); }
export function invCategories() { return settings().inventory?.categories || []; }

const OPEN_LOAN = ['approved', 'out'];
export function itemTotals(itemId) {
  const item = invItem(itemId);
  if (!item) return { total: 0, adjusted: 0, out: 0, reserved: 0, available: 0 };
  const adjusted = Number(item.total || 0) + invAudits()
    .filter(a => a.itemId === itemId)
    .reduce((s, a) => s + Number(a.delta || 0), 0);
  const out = invLoans().filter(l => l.itemId === itemId && OPEN_LOAN.includes(l.status))
    .reduce((s, l) => s + Number(l.qty || 0), 0);
  const reserved = invLoans().filter(l => l.itemId === itemId && l.status === 'requested')
    .reduce((s, l) => s + Number(l.qty || 0), 0);
  return { total: Number(item.total || 0), adjusted, out, reserved, available: adjusted - out };
}
export function availableQty(itemId) { return itemTotals(itemId).available; }
export function nextItemCode() {
  const db = load();
  const n = invItems().length + 1;
  return db.invNextCode && !invItems().some(i => i.code === db.invNextCode)
    ? db.invNextCode
    : 'G-' + String(n).padStart(3, '0');
}
export function loansByStatus(status) { return invLoans().filter(l => l.status === status); }
export function pendingLoans() { return invLoans().filter(l => l.status === 'requested'); }
export function activeLoans() { return invLoans().filter(l => OPEN_LOAN.includes(l.status)); }
export function overdueLoans() {
  const t = todayISO();
  return invLoans().filter(l => OPEN_LOAN.includes(l.status) && l.dueDate && l.dueDate < t);
}
export function loanStatus() {
  return {
    requested: { l: '待批核', c: 'b-warn' },
    approved:  { l: '已批核（待取）', c: 'b-info' },
    out:       { l: '借出中', c: 'b-brand' },
    returned:  { l: '已歸還', c: 'b-ok' },
    rejected:  { l: '已拒絕', c: 'b-danger' },
    cancelled: { l: '已取消', c: 'b-grey' }
  };
}
export function stockSummary() {
  const items = invItems();
  return {
    kinds: items.length,
    units: items.reduce((s, i) => s + Number(i.total || 0), 0),
    out: activeLoans().reduce((s, l) => s + Number(l.qty || 0), 0),
    pending: pendingLoans().length,
    overdue: overdueLoans().length,
    low: items.filter(i => itemTotals(i.id).available <= 0)
  };
}

/* ---------------- 團章 ---------------- */
export function constitution() { return load().constitution || {}; }
export function articleCount(c = constitution()) {
  return (c.chapters || []).reduce((s, ch) => s + (ch.articles?.length || 0) + (ch.articles || []).reduce((t, a) => t + (a.items?.length || 0), 0), 0);
}

/* ---------------- 待辦 / 日程 ---------------- */
export function openActions() {
  const out = [];
  collection('meetings').forEach(m => {
    (m.decisions || []).forEach(d => { if (!d.done) out.push({ ...d, meetingId: m.id, meetingTitle: m.title }); });
  });
  return out.sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
}
export function upcomingMeetings(n = 4) {
  const today = todayISO();
  return collection('meetings')
    .filter(m => String(m.date).slice(0, 10) >= today && m.status !== 'done' && m.status !== 'cancelled')
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, n);
}
export function pendingMeetings() { return collection('meetings').filter(m => m.status === 'pending'); }

/* ---------------- 通知中心（儀表板用） ---------------- */
export function notices() {
  const out = [];
  const b = birthdaySummary();
  b.today.forEach(x => out.push({ kind: 'birthday', level: 'ok', text: `今日係 ${x.name} 生日 🎂`, link: '#/members/birthdays' }));
  b.in7.filter(x => x.days > 0).forEach(x => out.push({
    kind: 'birthday', level: 'warn',
    text: `${x.name} ${x.days} 日後生日（${Number(x.md.slice(0, 2))} 月 ${Number(x.md.slice(3))} 日${x.turning ? `，將滿 ${x.turning} 歲` : ''}）`,
    link: '#/members/birthdays'
  }));
  overdueFees().forEach(f => out.push({ kind: 'fee', level: 'danger', text: `團費逾期未收：${memberName(f.memberId)}（${money(f.amount)}，到期 ${f.due}）`, link: '#/finance/fees' }));
  pendingClaims().forEach(c => out.push({ kind: 'claim', level: 'info', text: `收支申報待批：${c.byName || ''} ${c.item}（${money(c.amount)}）`, link: '#/finance/claims' }));
  pendingLoans().forEach(l => out.push({ kind: 'loan', level: 'info', text: `物資借用待批：${l.borrowerName || ''} 借 ${invItem(l.itemId)?.name || ''} ×${l.qty}`, link: '#/inventory/loans' }));
  overdueLoans().forEach(l => out.push({ kind: 'loan', level: 'danger', text: `物資逾期未還：${l.borrowerName || ''} · ${invItem(l.itemId)?.name || ''}（應還 ${l.dueDate}）`, link: '#/inventory/loans' }));
  openActions().filter(a => a.due && a.due < todayISO()).forEach(a => out.push({ kind: 'action', level: 'warn', text: `會議行動逾期：${a.text}`, link: '#/meetings' }));
  // 每年一次：AGM 日期（旅財政年度起點）未確認
  const fy = unitFYOf(todayISO(), settings().agmDates || []);
  if (agmIsDefault(fy.agmYear, settings().agmDates || [])) {
    out.push({ kind: 'agm', level: 'info',
      text: `${fy.agmYear} 年 AGM 日期未確認（現用 ${fy.start}）—— 旅財政年度由此起計，請逐年輸入實際日期`,
      link: '#/finance/reports' });
  }
  return out;
}
