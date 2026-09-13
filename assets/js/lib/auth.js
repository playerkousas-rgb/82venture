/* ============================================================
   auth.js — 三級權限：超級管理員 / 領袖 / 執委會
   ============================================================ */

import { load, commit, getSession, setSession } from './store.js';
import { toast } from './util.js';

export const ROLES = {
  super: {
    id: 'super', name: '超級管理員', short: '超管',
    desc: '全部權限，可管理所有帳號密碼',
    color: 'var(--accent-600)'
  },
  leader: {
    id: 'leader', name: '領袖', short: '領袖',
    desc: '管理會議、財務、團員、團章',
    color: 'var(--brand-700)'
  },
  exco: {
    id: 'exco', name: '執行委員會', short: '執委',
    desc: '日常操作：會議、記帳、收費',
    color: 'var(--brand-500)'
  }
};

/* 權限矩陣 —— true = 可以做；'own' = 只能處理自己建立的 */
export const PERMS = {
  'meeting.view':      { super: 1, leader: 1, exco: 1 },
  'meeting.create':    { super: 1, leader: 1, exco: 1 },
  'meeting.edit':      { super: 1, leader: 1, exco: 'own' },
  'meeting.delete':    { super: 1, leader: 1, exco: 0 },
  'meeting.minutes':   { super: 1, leader: 1, exco: 1 },
  'meeting.approve':   { super: 1, leader: 1, exco: 0 },

  'finance.view':      { super: 1, leader: 1, exco: 1 },
  'finance.create':    { super: 1, leader: 1, exco: 1 },
  'finance.edit':      { super: 1, leader: 1, exco: 'own' },
  'finance.delete':    { super: 1, leader: 1, exco: 0 },
  'finance.report':    { super: 1, leader: 1, exco: 1 },
  'finance.export':    { super: 1, leader: 1, exco: 0 },

  'fee.view':          { super: 1, leader: 1, exco: 1 },
  'fee.mark':          { super: 1, leader: 1, exco: 1 },
  'fee.edit':          { super: 1, leader: 1, exco: 0 },

  'member.view':       { super: 1, leader: 1, exco: 1 },
  'member.create':     { super: 1, leader: 1, exco: 0 },
  'member.edit':       { super: 1, leader: 1, exco: 0 },
  'member.note':       { super: 1, leader: 1, exco: 1 },
  'member.delete':     { super: 1, leader: 1, exco: 0 },

  'progress.view':     { super: 1, leader: 1, exco: 1 },
  'progress.config':   { super: 1, leader: 1, exco: 0 },

  'constitution.view':   { super: 1, leader: 1, exco: 1 },
  'constitution.edit':   { super: 1, leader: 1, exco: 0 },
  'constitution.publish':{ super: 1, leader: 1, exco: 0 },

  'admin.view':         { super: 1, leader: 1, exco: 1 },
  'admin.pw.super':     { super: 1, leader: 0, exco: 0 },
  'admin.pw.leader':    { super: 1, leader: 1, exco: 0 },
  'admin.pw.exco':      { super: 1, leader: 1, exco: 1 },
  'admin.data':         { super: 1, leader: 1, exco: 0 }
};

export function accountByRole(role) {
  return load().accounts.find(a => a.role === role) || null;
}
export function login(role, username, password) {
  const acc = load().accounts.find(a => a.role === role);
  if (!acc) return { ok: false, msg: '找不到此角色' };
  if (acc.username !== String(username || '').trim()) return { ok: false, msg: '帳號不正確' };
  if (acc.password !== String(password || '')) return { ok: false, msg: '密碼不正確' };
  setSession({ role: acc.role, accountId: acc.id, username: acc.username, name: acc.name, at: Date.now() });
  return { ok: true };
}
export function logout() { setSession(null); }
export function current() { return getSession(); }
export function currentRole() { return getSession()?.role || null; }

export function can(perm, ctx) {
  const s = getSession();
  if (!s) return false;
  const rule = PERMS[perm];
  if (!rule) return false;
  const v = rule[s.role];
  if (v === 1) return true;
  if (v === 0 || v == null) return false;
  if (v === 'own') {
    // ctx.createdBy 為建立者帳號 username
    return ctx && (ctx.createdBy === s.username || ctx.chair === s.username);
  }
  return false;
}

/** 可否更改某帳號的密碼 */
export function canChangePasswordOf(accountId) {
  const s = getSession();
  if (!s) return false;
  const acc = load().accounts.find(a => a.id === accountId);
  if (!acc) return false;
  if (s.role === 'super') return true;
  if (s.role === 'leader') return acc.role === 'leader' || acc.role === 'exco';
  if (s.role === 'exco') return acc.role === 'exco';
  return false;
}

export function changePassword(accountId, newPassword) {
  const db = load();
  const acc = db.accounts.find(a => a.id === accountId);
  if (!acc) return false;
  if (!canChangePasswordOf(accountId)) { toast('你沒有權限更改此帳號的密碼', 'err'); return false; }
  if (!newPassword || String(newPassword).length < 4) { toast('密碼至少需要 4 個字元', 'err'); return false; }
  acc.password = String(newPassword);
  acc.pwUpdatedAt = new Date().toISOString().slice(0, 10);
  commit();
  return true;
}

export function changeUsername(accountId, newUsername) {
  const db = load();
  const acc = db.accounts.find(a => a.id === accountId);
  if (!acc) return false;
  if (!canChangePasswordOf(accountId)) { toast('你沒有權限更改此帳號', 'err'); return false; }
  const u = String(newUsername || '').trim();
  if (u.length < 2) { toast('帳號至少需要 2 個字元', 'err'); return false; }
  if (db.accounts.some(a => a.id !== accountId && a.username === u)) { toast('此帳號名稱已被使用', 'err'); return false; }
  acc.username = u;
  commit();
  return true;
}
