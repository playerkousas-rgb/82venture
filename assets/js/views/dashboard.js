/* ============================================================
   dashboard.js — 儀表板
   ============================================================ */

import {
  balance, monthStats, sumBy, tx, feeSummary, overdueFees,
  upcomingMeetings, openActions, pendingMeetings, memberName,
  statusBadge, members, constitution, articleCount, attendanceStats
} from '../lib/model.js';
import { money, icon, esc, fmtDate, weekday, relDay, avatar, todayISO, monthLabel } from '../lib/util.js';
import { go } from '../lib/router.js';
import { currentRole, ROLES } from '../lib/auth.js';

export function title() { return '儀表板'; }

export function render() {
  const monthKey = todayISO().slice(0, 7);
  const ms = monthStats(monthKey);
  const total = balance();
  const fs = feeSummary();
  const od = overdueFees();
  const up = upcomingMeetings(4);
  const acts = openActions();
  const pend = pendingMeetings();
  const c = constitution();
  const role = ROLES[currentRole()] || ROLES.exco;

  return `
  <div class="page-head">
    <div>
      <div class="page-title">你好，${esc(role.name)} 👋</div>
      <div class="page-sub">${esc(fmtDate(todayISO(), 'full'))} · 呢度係團務一覽</div>
    </div>
    <div class="row gap-8 wrap no-print">
      <button class="btn btn-soft" data-go="#/meetings/new">${icon('plus', 16)} 新增會議</button>
      <button class="btn btn-primary" data-go="#/finance?new=1">${icon('plus', 16)} 記一筆</button>
    </div>
  </div>

  <div class="grid g-4 mb-16">
    <div class="stat">
      <div class="row-between">
        <div class="stat-label">團務結餘</div>
        <div class="stat-ic">${icon('wallet', 18)}</div>
      </div>
      <div class="stat-value" style="color:${total >= 0 ? 'var(--brand-700)' : 'var(--danger)'}">${esc(money(total))}</div>
      <div class="stat-foot">累計總結餘</div>
    </div>
    <div class="stat">
      <div class="row-between">
        <div class="stat-label">本月收支</div>
        <div class="stat-ic">${icon('chart', 18)}</div>
      </div>
      <div class="stat-value">${esc(money(ms.net))}</div>
      <div class="stat-foot row gap-8">
        <span style="color:var(--ok)">↑ ${esc(money(ms.income))}</span>
        <span style="color:var(--danger)">↓ ${esc(money(ms.expense))}</span>
      </div>
    </div>
    <div class="stat">
      <div class="row-between">
        <div class="stat-label">團費收繳</div>
        <div class="stat-ic">${icon('users', 18)}</div>
      </div>
      <div class="stat-value">${fs.paidCount} / ${fs.total}</div>
      <div class="bar mt-8 ${fs.rate < 50 ? 'danger' : fs.rate < 80 ? 'warn' : ''}"><span style="width:${fs.rate}%"></span></div>
      <div class="stat-foot">${od.length ? `${od.length} 筆已逾期 · 尚欠 ${esc(money(fs.outstanding))}` : `尚欠 ${esc(money(fs.outstanding))}`}</div>
    </div>
    <div class="stat">
      <div class="row-between">
        <div class="stat-label">待處理會議</div>
        <div class="stat-ic">${icon('calendar', 18)}</div>
      </div>
      <div class="stat-value">${pend.length}</div>
      <div class="stat-foot">${acts.length} 項待辦行動未完</div>
    </div>
  </div>

  <div class="grid g-2-1">
    <div class="col gap-16">

      <!-- 即將舉行 -->
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">即將舉行嘅會議</div>
            <div class="card-sub">按日期排序</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-go="#/meetings">全部 ${icon('chevronR', 14)}</button>
        </div>
        ${up.length ? up.map(m => `
          <div class="list-item" data-go="#/meetings/${m.id}">
            <div style="width:46px;text-align:center;flex:0 0 auto">
              <div style="font-size:19px;font-weight:800;line-height:1;color:var(--brand-700)">${+m.date.slice(8, 10)}</div>
              <div class="xs faint">${m.date.slice(5, 7)} 月</div>
            </div>
            <div class="li-main">
              <div class="li-t truncate">${esc(m.title)}</div>
              <div class="li-s">${esc(relDay(m.date))} · ${esc(m.time)} · ${esc(m.venue || '地點待定')}</div>
            </div>
            ${statusBadge(m.status)}
            ${icon('chevronR', 15, 'faint')}
          </div>`).join('') : emptyBox('暫時冇即將舉行嘅會議', 'calendar')}
      </div>

      <!-- 團員出席率 -->
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">團員出席率</div>
            <div class="card-sub">根據已完成會議嘅點名記錄</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-go="#/members">全部 ${icon('chevronR', 14)}</button>
        </div>
        <div style="padding:6px 14px 14px">
          ${members().filter(m => m.status === 'active').slice(0, 6).map(m => {
            const s = attendanceStats(m.id);
            return `<div class="row gap-12" style="padding:9px 0;border-bottom:1px solid var(--line-2)">
              ${avatar(m.name, 'avatar-sm')}
              <div class="grow">
                <div class="row-between">
                  <span class="semibold sm">${esc(m.name)}</span>
                  <span class="sm mono" style="color:${s.rate >= 80 ? 'var(--ok)' : s.rate >= 50 ? 'var(--warn)' : 'var(--danger)'}">${s.rate}%</span>
                </div>
                <div class="bar mt-4 ${s.rate >= 80 ? '' : s.rate >= 50 ? 'warn' : 'danger'}"><span style="width:${s.rate}%"></span></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div class="col gap-16">
      <!-- 待辦行動 -->
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">待辦行動</div>
            <div class="card-sub">由會議決議帶出</div>
          </div>
          <span class="badge ${acts.length ? 'b-warn' : 'b-ok'}">${acts.length}</span>
        </div>
        ${acts.length ? `<div style="padding:6px 14px 14px">${acts.slice(0, 5).map(a => `
          <div class="list-item" data-go="#/meetings/${a.meetingId}" style="padding:10px 0">
            <div class="grow">
              <div class="li-t sm">${esc(a.text)}</div>
              <div class="li-s">${esc(memberName(a.owner))} · 到期 ${esc(a.due || '未定')}</div>
            </div>
          </div>`).join('')}</div>` : emptyBox('所有行動已跟進完', 'check')}
      </div>

      <!-- 團費逾期 -->
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">團費／活動費逾期</div>
            <div class="card-sub">需要跟進</div>
          </div>
          <span class="badge ${od.length ? 'b-danger' : 'b-ok'}">${od.length}</span>
        </div>
        ${od.length ? `<div style="padding:6px 14px 14px">${od.slice(0, 5).map(f => `
          <div class="row gap-12" style="padding:9px 0;border-bottom:1px solid var(--line-2)">
            ${avatar(memberName(f.memberId), 'avatar-sm')}
            <div class="grow"><div class="sm semibold">${esc(memberName(f.memberId))}</div>
            <div class="xs faint">${esc(f.label)}</div></div>
            <span class="sm mono bold" style="color:var(--danger)">${esc(money(f.amount))}</span>
          </div>`).join('')}
          <button class="btn btn-sm btn-block mt-12" data-go="#/finance?tab=fees">去收費跟進</button>
          </div>` : emptyBox('冇逾期款項', 'check')}
      </div>

      <!-- 團章 -->
      <div class="card">
        <div class="card-head">
          <div class="card-title">團章</div>
          <button class="btn btn-ghost btn-sm" data-go="#/constitution">開啟 ${icon('chevronR', 14)}</button>
        </div>
        <div style="padding:14px 18px 18px">
          <div class="row-between mb-8">
            <span class="sm muted">現行版本</span>
            <span class="bold">v${esc(c.version)}</span>
          </div>
          <div class="row-between mb-8">
            <span class="sm muted">上次更新</span>
            <span class="sm">${esc(c.updatedAt)} · ${esc(c.updatedBy)}</span>
          </div>
          <div class="row-between mb-12">
            <span class="sm muted">章 / 條</span>
            <span class="sm">${c.chapters.length} 章 · ${articleCount(c)} 條</span>
          </div>
          <button class="btn btn-sm btn-block" data-go="#/constitution?share=1">${icon('qr', 15)} 產生分享 QR Code</button>
        </div>
      </div>
    </div>
  </div>`;
}

function emptyBox(text, ic = 'grid') {
  return `<div class="empty">${icon(ic, 34)}<div class="empty-title">${esc(text)}</div></div>`;
}

export function mount(root) {
  root.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', () => go(el.dataset.go));
  });
}
