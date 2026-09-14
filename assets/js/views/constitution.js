/* ============================================================
   constitution.js — 團章（內建、可改、可輸出 QR / 分享 / 列印）
   ============================================================ */

import { load, commit, collection, find, add, update, remove } from '../lib/store.js';
import { constitution } from '../lib/model.js';
import {
  esc, icon, uid, todayISO, modal, confirmDlg, toast, qrSvg, copyText, download
} from '../lib/util.js';
import { setQuery, go } from '../lib/router.js';
import { can, current } from '../lib/auth.js';

let mode = 'view';   // view | edit

export function title() { return '團章'; }

export function render(params) {
  const c = constitution();
  if (params.query.share) setQuery({});

  return `
  <div class="page-head">
    <div>
      <div class="page-title">團章</div>
      <div class="page-sub">v${esc(c.version)} · 上次更新 ${esc(c.updatedAt)} 由 ${esc(c.updatedBy)}</div>
    </div>
    <div class="row gap-8 wrap no-print">
      <div class="seg" role="tablist">
        <button role="tab" aria-selected="${mode === 'view'}" data-mode="view">${icon('eye', 15)} 閱讀</button>
        <button role="tab" aria-selected="${mode === 'edit'}" data-mode="edit" ${can('constitution.edit') ? '' : 'disabled'}>${icon('edit', 15)} 編輯</button>
      </div>
      <button class="btn" data-act="share">${icon('qr', 16)} 分享 / QR</button>
      <button class="btn" data-act="print">${icon('print', 16)} 列印</button>
      ${can('constitution.publish') ? `<button class="btn btn-primary" data-act="save-version">${icon('save', 16)} 發布新版本</button>` : ''}
    </div>
  </div>

  <div class="grid g-2-1">
    <div>
      <div class="doc" id="docSheet">
        <div class="center mb-16">
          <div style="font-size:22px;font-weight:800;letter-spacing:-.01em">${esc(load().settings.groupName)}</div>
          <div class="sm muted mt-4">團　章　·　版本 ${esc(c.version)}　·　${esc(c.updatedAt)}</div>
        </div>

        ${mode === 'edit' ? editorPreamble(c) : `
          <div style="background:var(--brand-50);border-left:4px solid var(--brand-500);padding:14px 16px;border-radius:0 var(--r) var(--r) 0;margin-bottom:8px">
            <div class="semibold sm mb-4" style="color:var(--brand-800)">序言</div>
            <div style="white-space:pre-wrap">${esc(c.preamble)}</div>
          </div>`}

        ${c.chapters.map(ch => `
          <div class="${mode === 'edit' ? 'ch-edit-wrap' : ''}" style="position:relative">
            <h2>${esc(ch.no)}　${esc(ch.title)}
              ${mode === 'edit' ? `<span class="no-print">
                <button class="btn btn-xs btn-ghost" data-act="edit-ch" data-id="${ch.id}">${icon('edit', 13)}</button>
                <button class="btn btn-xs btn-ghost" data-act="del-ch" data-id="${ch.id}">${icon('trash', 13)}</button>
                <button class="btn btn-xs btn-ghost" data-act="add-art" data-id="${ch.id}">${icon('plus', 13)} 加條文</button>
              </span>` : ''}</h2>
            <ol>
              ${(ch.articles || []).map(a => `
                <li id="${a.id}">
                  <span class="art-no">${esc(a.no)}</span>${esc(a.text)}
                  ${mode === 'edit' ? `<span class="no-print">
                    <button class="btn btn-xs btn-ghost" data-act="edit-art" data-ch="${ch.id}" data-id="${a.id}">${icon('edit', 13)}</button>
                    <button class="btn btn-xs btn-ghost" data-act="del-art" data-ch="${ch.id}" data-id="${a.id}">${icon('trash', 13)}</button>
                  </span>` : ''}
                </li>`).join('') ||
                '<li class="faint">（本章暫無條文）</li>'}
            </ol>
          </div>`).join('')}

        ${mode === 'edit' ? `<div class="mt-16 no-print">
          <button class="btn btn-sm" data-act="add-ch">${icon('plus', 15)} 新增章節</button>
        </div>` : ''}

        <div class="mt-24 right faint xs print-only">
          ${esc(load().settings.groupName)} 團章 v${esc(c.version)}　·　${esc(c.updatedAt)}
        </div>
      </div>
    </div>

    <div class="col gap-16 no-print">
      <div class="card">
        <div class="card-head"><div class="card-title">快速動作</div></div>
        <div style="padding:14px 16px" class="col gap-8">
          <button class="btn btn-block" data-act="share">${icon('qr', 16)} 產生 QR Code</button>
          <button class="btn btn-block" data-act="copy-link">${icon('link', 16)} 複製分享連結</button>
          <button class="btn btn-block" data-act="print">${icon('print', 16)} 列印 / 存成 PDF</button>
          <button class="btn btn-block" data-act="dl-md">${icon('download', 16)} 下載 Markdown</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">版本記錄</div>
          <div class="card-sub">${c.history.length} 個版本</div></div>
        <div style="padding:14px 16px">
          <div class="timeline">
            ${c.history.map(h => `
              <div class="tl-item ${h.version === c.version ? 'done' : ''}">
                <div class="tl-date mono">${esc(h.date)}</div>
                <div class="sm semibold">v${esc(h.version)} <span class="faint">· ${esc(h.by)}</span></div>
                <div class="xs muted">${esc(h.note || '')}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">分享設定</div></div>
        <div style="padding:14px 16px">
          <div class="field">
            <label class="label">對外分享網址</label>
            <input class="input" id="shareUrl" value="${esc(load().settings.constitutionUrl || defaultShareUrl())}">
            <div class="hint mt-4">QR Code 會指向呢個網址；團員掃描後可睇到最新版本團章。</div>
          </div>
          <button class="btn btn-sm btn-block mt-12" data-act="save-url" ${can('constitution.publish') ? '' : 'disabled'}>
            ${icon('save', 15)} 儲存網址</button>
        </div>
      </div>
    </div>
  </div>`;
}

function editorPreamble(c) {
  return `<div style="border:1px dashed var(--line);border-radius:var(--r);padding:12px;margin-bottom:14px">
    <div class="label mb-8">序言</div>
    <textarea class="textarea" id="preInput" style="min-height:110px">${esc(c.preamble)}</textarea>
    <button class="btn btn-xs mt-8" data-act="save-pre">${icon('save', 13)} 儲存序言</button>
  </div>`;
}

function defaultShareUrl() {
  return location.href.split('#')[0] + '#/constitution';
}
export function shareUrl() {
  return load().settings.constitutionUrl || defaultShareUrl();
}

/* ============================================================
   MOUNT
   ============================================================ */
export function mount(root, params) {
  const c = constitution();

  root.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => {
    if (el.dataset.mode === 'edit' && !can('constitution.edit')) return;
    mode = el.dataset.mode; refresh();
  }));

  root.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
    const act = btn.dataset.act;

    if (act === 'print') return window.print();

    if (act === 'share') {
      const url = shareUrl();
      await modal({
        title: '分享團章', sub: `v${c.version} · ${esc(c.updatedAt)}`,
        body: `<div class="center">
            <div class="qr-box" style="width:250px">${qrSvg(url, 7, 2)}</div>
            <div class="sm muted mt-12" style="word-break:break-all">${esc(url)}</div>
          </div>
          <div class="row gap-8 mt-16">
            <button class="btn btn-sm grow" id="q-copy">${icon('copy', 15)} 複製連結</button>
            <button class="btn btn-sm grow" id="q-dl">${icon('download', 15)} 下載 QR（SVG）</button>
          </div>
          <div class="hint mt-12">提示：用手機掃描可直接開啟；列印出嚟貼喺團部都得。</div>`,
        actions: [{ label: '關閉', class: 'btn', value: null }],
        onMount: el => {
          el.querySelector('#q-copy').onclick = async () => {
            if (await copyText(url)) toast('已複製分享連結', 'ok');
          };
          el.querySelector('#q-dl').onclick = () => {
            download(`82venture_團章v${c.version}_QR.svg`, qrSvg(url, 8, 2), 'image/svg+xml');
            toast('已下載 QR Code');
          };
        }
      });
    }

    if (act === 'copy-link') {
      if (await copyText(shareUrl())) toast('已複製分享連結', 'ok');
    }

    if (act === 'save-url') {
      const v = root.querySelector('#shareUrl')?.value.trim();
      load().settings.constitutionUrl = v; commit();
      toast('分享網址已儲存', 'ok');
    }

    if (act === 'dl-md') {
      download(`82venture_團章_v${c.version}.md`, toMarkdown(c), 'text/markdown;charset=utf-8');
      toast('已下載 Markdown');
    }

    if (act === 'save-pre') {
      const v = root.querySelector('#preInput')?.value || '';
      load().constitution.preamble = v; touchConstitution(); toast('序言已更新', 'ok'); refresh();
    }

    if (act === 'add-ch') {
      const r = await modal({
        title: '新增章節',
        body: `<div class="grid g-2">
            <div class="field"><label class="label">章號</label>
              <input class="input" id="q-no" placeholder="第八章"></div>
            <div class="field"><label class="label">標題 <span class="req">*</span></label>
              <input class="input" id="q-title" placeholder="附則"></div>
          </div>`,
        actions: [{ label: '取消', class: 'btn', value: null },
          { label: '新增', class: 'btn-primary', onClick: el => ({
              no: el.querySelector('#q-no').value.trim(),
              title: el.querySelector('#q-title').value.trim() })}]
      });
      if (r && r.title) {
        load().constitution.chapters.push({ id: uid('c'), no: r.no || `第${c.chapters.length + 1}章`, title: r.title, articles: [] });
        touchConstitution(); toast('已新增章節', 'ok'); refresh();
      }
    }

    if (act === 'edit-ch') {
      const ch = c.chapters.find(x => x.id === btn.dataset.id);
      if (!ch) return;
      const r = await modal({
        title: '編輯章節',
        body: `<div class="grid g-2">
            <div class="field"><label class="label">章號</label>
              <input class="input" id="q-no" value="${esc(ch.no)}"></div>
            <div class="field"><label class="label">標題 <span class="req">*</span></label>
              <input class="input" id="q-title" value="${esc(ch.title)}"></div>
          </div>`,
        actions: [{ label: '取消', class: 'btn', value: null },
          { label: '儲存', class: 'btn-primary', onClick: el => ({
              no: el.querySelector('#q-no').value.trim(),
              title: el.querySelector('#q-title').value.trim() })}]
      });
      if (r && r.title) { Object.assign(ch, r); touchConstitution(); toast('已更新', 'ok'); refresh(); }
    }

    if (act === 'del-ch') {
      const ch = c.chapters.find(x => x.id === btn.dataset.id);
      if (!ch) return;
      if (await confirmDlg({ title: '刪除章節', danger: true, okText: '刪除',
        message: `確定刪除「<b>${esc(ch.no)} ${esc(ch.title)}</b>」？當中 ${(ch.articles || []).length} 條條文會一併刪除。` })) {
        c.chapters = c.chapters.filter(x => x.id !== ch.id);
        touchConstitution(); toast('已刪除'); refresh();
      }
    }

    if (act === 'add-art' || act === 'edit-art') {
      const ch = c.chapters.find(x => x.id === (btn.dataset.ch || btn.dataset.id));
      if (!ch) return;
      const a = act === 'edit-art' ? ch.articles.find(x => x.id === btn.dataset.id) : null;
      const r = await modal({
        title: a ? '編輯條文' : '新增條文', sub: `${esc(ch.no)} ${esc(ch.title)}`,
        body: `<div class="field"><label class="label">條號</label>
            <input class="input" id="q-no" value="${a ? esc(a.no) : suggestNo(ch)}"></div>
          <div class="field mt-12"><label class="label">條文內容 <span class="req">*</span></label>
            <textarea class="textarea" id="q-text" style="min-height:140px">${a ? esc(a.text) : ''}</textarea></div>`,
        actions: [{ label: '取消', class: 'btn', value: null },
          { label: '儲存', class: 'btn-primary', onClick: el => ({
              no: el.querySelector('#q-no').value.trim(),
              text: el.querySelector('#q-text').value.trim() })}]
      });
      if (r && r.text) {
        if (a) Object.assign(a, r);
        else ch.articles.push({ id: uid('a'), ...r });
        touchConstitution(); toast('已儲存', 'ok'); refresh();
      }
    }

    if (act === 'del-art') {
      const ch = c.chapters.find(x => x.id === btn.dataset.ch);
      if (!ch) return;
      if (await confirmDlg({ title: '刪除條文', danger: true, okText: '刪除', message: '確定刪除呢條條文？' })) {
        ch.articles = ch.articles.filter(x => x.id !== btn.dataset.id);
        touchConstitution(); toast('已刪除'); refresh();
      }
    }

    if (act === 'save-version') {
      const cur = c.version;
      const next = suggestVersion(cur);
      const r = await modal({
        title: '發布新版本',
        sub: `目前 v${esc(cur)}`,
        body: `<div class="grid g-2">
            <div class="field"><label class="label">版本號</label>
              <input class="input" id="q-ver" value="${esc(next)}"></div>
            <div class="field"><label class="label">日期</label>
              <input class="input" type="date" id="q-date" value="${esc(todayISO())}"></div>
          </div>
          <div class="field mt-12"><label class="label">修訂摘要 <span class="req">*</span></label>
            <textarea class="textarea" id="q-note" placeholder="例如：修訂第五章財務條文"></textarea></div>
          <div class="hint mt-8">發布後會加入版本記錄，QR Code 同分享連結會指向最新版本。</div>`,
        actions: [{ label: '取消', class: 'btn', value: null },
          { label: '發布', class: 'btn-primary', onClick: el => ({
              version: el.querySelector('#q-ver').value.trim(),
              date: el.querySelector('#q-date').value,
              note: el.querySelector('#q-note').value.trim() })}]
      });
      if (r && r.version && r.note) {
        c.version = r.version; c.updatedAt = r.date; c.updatedBy = current()?.username || 'system';
        c.history.unshift({ version: r.version, date: r.date, by: c.updatedBy, note: r.note });
        commit(); toast(`已發布 v${r.version}`, 'ok'); refresh();
      }
    }
  }));
}

function suggestNo(ch) {
  const n = (ch.articles || []).length;
  const base = ch.no.replace(/\D/g, '') || '1';
  return `${base}.${n + 1}`;
}
function suggestVersion(v) {
  const m = String(v).match(/^(\d+)\.(\d+)$/);
  if (!m) return v;
  return `${m[1]}.${Number(m[2]) + 1}`;
}
function touchConstitution() {
  const c = load().constitution;
  c.updatedAt = todayISO();
  c.updatedBy = current()?.username || 'system';
  commit();
}
function toMarkdown(c) {
  let md = `# ${load().settings.groupName} 團章\n\n> 版本 ${c.version} · 更新於 ${c.updatedAt}\n\n## 序言\n\n${c.preamble}\n`;
  c.chapters.forEach(ch => {
    md += `\n## ${ch.no}　${ch.title}\n\n`;
    (ch.articles || []).forEach(a => { md += `**${a.no}** ${a.text}\n\n`; });
  });
  return md;
}

export function refresh() {
  window.dispatchEvent(new CustomEvent('v82:refresh'));
}
