/* 공통 유틸리티 — U 네임스페이스 */
(function () {
  'use strict';

  const nf = new Intl.NumberFormat('ko-KR');
  const won = (n) => nf.format(Math.round(Number(n) || 0));
  const pad2 = (n) => String(n).padStart(2, '0');

  const todayKey = (d = new Date()) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const parseDateKey = (key) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };

  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

  const dateLabel = (key) => {
    const d = parseDateKey(key);
    if (!d) return '날짜 미지정';
    return `${d.getFullYear()}. ${pad2(d.getMonth() + 1)}. ${pad2(d.getDate())}. (${WEEK[d.getDay()]})`;
  };

  const timeLabel = (ts) => {
    const d = new Date(ts);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  const dateTimeLabel = (ts) => {
    const d = new Date(ts);
    return `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  const escapeHTML = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const digits = (v) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  const debounce = (fn, ms = 150) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  /* 금액 입력: 콤마 자동 포맷 + raw 값 보관 */
  function bindAmount(input, onChange) {
    const apply = () => {
      const raw = digits(input.value);
      input.dataset.value = String(raw);
      const formatted = raw ? won(raw) : '';
      if (input.value !== formatted) input.value = formatted;
      if (onChange) onChange(raw);
    };
    input.addEventListener('input', apply);
    return {
      get: () => digits(input.dataset.value || input.value),
      set: (v) => {
        const n = digits(v);
        input.dataset.value = String(n);
        input.value = n ? won(n) : '';
        if (onChange) onChange(n);
      },
      clear: () => {
        input.dataset.value = '0';
        input.value = '';
        if (onChange) onChange(0);
      },
    };
  }

  function download(filename, content, type = 'text/plain;charset=utf-8') {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fallback */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  /* ---------- Toast ---------- */

  function toast(message, opts = {}) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast';
    const msg = document.createElement('span');
    msg.className = 'toast-msg';
    msg.textContent = message;
    el.appendChild(msg);

    let timer = null;
    const close = () => {
      clearTimeout(timer);
      el.classList.remove('show');
      setTimeout(() => el.remove(), 240);
    };

    if (opts.action) {
      const b = document.createElement('button');
      b.className = 'toast-action';
      b.type = 'button';
      b.textContent = opts.action;
      b.addEventListener('click', () => {
        close();
        if (typeof opts.onAction === 'function') opts.onAction();
      });
      el.appendChild(b);
    }

    host.appendChild(el);
    while (host.children.length > 3) host.firstElementChild.remove();
    requestAnimationFrame(() => el.classList.add('show'));

    const ttl = opts.duration ?? (opts.action ? 5200 : 2800);
    timer = setTimeout(close, ttl);
  }

  /* ---------- Sheet / modal ---------- */

  const sheet = {
    _onKey: null,
    _onClose: null,
    _lastFocus: null,
    _closeTimer: null,

    open({ title, html = '', footer = '', onMount, onClose }) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
      this.close(false);
      const root = document.getElementById('overlay');
      if (!root) return;
      this._lastFocus = document.activeElement;

      root.innerHTML = `
        <div class="sheet-wrap" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}">
          <div class="sheet-backdrop" data-sheet-close></div>
          <div class="sheet">
            <div class="sheet-grip"></div>
            <div class="sheet-head">
              <h3>${escapeHTML(title)}</h3>
              <button type="button" class="icon-btn" data-sheet-close aria-label="닫기">
                <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>
            <div class="sheet-body">${html}</div>
            ${footer ? `<div class="sheet-foot">${footer}</div>` : ''}
          </div>
        </div>`;
      root.hidden = false;
      document.body.classList.add('sheet-open');

      root.querySelectorAll('[data-sheet-close]').forEach((b) =>
        b.addEventListener('click', () => this.close()));

      this._onKey = (e) => { if (e.key === 'Escape') this.close(); };
      document.addEventListener('keydown', this._onKey);
      this._onClose = onClose;

      requestAnimationFrame(() => {
        root.classList.add('is-open');
        const focusTarget =
          root.querySelector('input:not([type=hidden]), select, textarea') ||
          root.querySelector('.btn-primary, [data-ok]') ||
          root.querySelector('button');
        focusTarget?.focus({ preventScroll: true });
      });

      if (typeof onMount === 'function') onMount(root.querySelector('.sheet'));
    },

    close(animate = true) {
      const root = document.getElementById('overlay');
      if (!root || root.hidden) return;
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
      document.removeEventListener('keydown', this._onKey);
      const cb = this._onClose;
      this._onClose = null;
      if (cb) cb();

      document.body.classList.remove('sheet-open');
      root.classList.remove('is-open');
      const finish = () => {
        root.hidden = true;
        root.innerHTML = '';
        if (this._lastFocus && document.contains(this._lastFocus)) {
          try { this._lastFocus.focus({ preventScroll: true }); } catch (e) { /* noop */ }
        }
        this._lastFocus = null;
      };
      if (animate) this._closeTimer = setTimeout(finish, 220);
      else finish();
    },
  };

  function confirmSheet({
    title = '확인',
    message = '',
    confirmLabel = '확인',
    cancelLabel = '취소',
    danger = false,
  }) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
      sheet.open({
        title,
        html: `<p class="confirm-msg">${message}</p>`,
        footer: `
          <button type="button" class="btn-ghost" data-cancel>${escapeHTML(cancelLabel)}</button>
          <button type="button" class="${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${escapeHTML(confirmLabel)}</button>`,
        onMount(root) {
          root.querySelector('[data-ok]').addEventListener('click', () => {
            finish(true);
            sheet.close();
          });
          root.querySelector('[data-cancel]').addEventListener('click', () => {
            finish(false);
            sheet.close();
          });
        },
        onClose() { finish(false); },
      });
    });
  }

  window.U = {
    won, pad2, todayKey, parseDateKey, dateLabel, timeLabel, dateTimeLabel,
    escapeHTML, uid, digits, clamp, sum, debounce,
    bindAmount, download, copyText, toast,
    sheet, confirm: confirmSheet,
  };
})();
