/* 접수 데이터 저장소 — localStorage 기반, 자동 저장 + 변경 알림 */
(function () {
  'use strict';

  const KEY = 'wedding.reception.v1';
  const PREV = KEY + '.prev';
  const APP_TAG = 'wedding-reception';
  const DATA_VERSION = 1;

  const SIDES = ['groom', 'bride'];
  const METHODS = ['cash', 'transfer'];

  const defaultState = () => ({
    version: DATA_VERSION,
    wedding: {
      date: U.todayKey(),
      groom: '',
      bride: '',
      hall: '',
      mealPrice: 0,
    },
    seq: { groom: 0, bride: 0 },
    entries: [],
    settlement: {
      cashCounted: null,
      envelopeCounted: null,
      closed: false,
      closedAt: null,
      memo: '',
    },
    audit: [],
  });

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  function normalizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const side = raw.side === 'bride' ? 'bride' : 'groom';
    const amount = Math.max(0, Math.round(num(raw.amount)));
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : U.uid(),
      no: Math.max(0, Math.round(num(raw.no))),
      side,
      name: String(raw.name ?? '').trim() || '이름 없음',
      relation: String(raw.relation ?? '').trim(),
      amount,
      method: raw.method === 'transfer' ? 'transfer' : 'cash',
      headcount: U.clamp(Math.round(num(raw.headcount) || 1), 1, 99),
      memo: String(raw.memo ?? '').trim(),
      createdAt: num(raw.createdAt) || Date.now(),
      updatedAt: num(raw.updatedAt) || num(raw.createdAt) || Date.now(),
      deletedAt: raw.deletedAt ? num(raw.deletedAt) : null,
    };
  }

  function normalize(raw) {
    const d = defaultState();
    if (!raw || typeof raw !== 'object') return d;
    const state = {
      ...d,
      ...raw,
      version: DATA_VERSION,
      wedding: { ...d.wedding, ...(raw.wedding || {}) },
      seq: { ...d.seq, ...(raw.seq || {}) },
      settlement: { ...d.settlement, ...(raw.settlement || {}) },
      entries: Array.isArray(raw.entries) ? raw.entries.map(normalizeEntry).filter(Boolean) : [],
      audit: Array.isArray(raw.audit) ? raw.audit.slice(-300) : [],
    };
    state.seq = seqFrom(state.entries, state.seq);
    state.wedding.date = /^\d{4}-\d{2}-\d{2}$/.test(state.wedding.date || '')
      ? state.wedding.date
      : U.todayKey();
    state.wedding.mealPrice = Math.max(0, Math.round(num(state.wedding.mealPrice)));
    state.settlement.cashCounted = nullableCount(state.settlement.cashCounted);
    state.settlement.envelopeCounted = nullableCount(state.settlement.envelopeCounted);
    state.settlement.closed = !!state.settlement.closed;
    return state;
  }

  const nullableCount = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Math.round(num(v));
    return Number.isFinite(n) ? Math.max(0, n) : null;
  };

  function seqFrom(entries, base) {
    const seq = { groom: Math.max(0, Math.round(num(base?.groom))), bride: Math.max(0, Math.round(num(base?.bride))) };
    entries.forEach((e) => {
      const no = Math.max(0, Math.round(num(e.no)));
      if (no > seq[e.side]) seq[e.side] = no;
    });
    return seq;
  }

  function read(key) {
    try {
      const txt = localStorage.getItem(key);
      return txt ? JSON.parse(txt) : null;
    } catch (e) {
      return null;
    }
  }

  let state = normalize(read(KEY) || read(PREV) || defaultState());
  let storageWarned = false;
  const listeners = new Set();

  function persist() {
    try {
      const serialized = JSON.stringify(state);
      const prev = localStorage.getItem(KEY);
      if (prev) localStorage.setItem(PREV, prev);
      localStorage.setItem(KEY, serialized);
    } catch (e) {
      if (!storageWarned) {
        storageWarned = true;
        U.toast('저장 공간이 부족합니다. 설정에서 JSON 백업을 받아 두세요.', { duration: 6000 });
      }
    }
  }

  function emit() {
    for (const fn of listeners) {
      try { fn(state); } catch (e) { console.error(e); }
    }
  }

  function commit() {
    persist();
    emit();
  }

  function log(action, entry, extra = {}) {
    state.audit.push({
      at: Date.now(),
      action,
      entryId: entry ? entry.id : null,
      name: entry ? entry.name : '',
      side: entry ? entry.side : null,
      amount: entry ? entry.amount : 0,
      ...extra,
    });
    if (state.audit.length > 300) state.audit.splice(0, state.audit.length - 300);
  }

  const locked = () => state.settlement.closed;

  /* ---------- Selectors ---------- */

  function activeEntries() {
    return state.entries
      .filter((e) => !e.deletedAt)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function stats() {
    const active = activeEntries();
    const calc = (list) => ({
      count: list.length,
      total: U.sum(list.map((e) => e.amount)),
      headcount: U.sum(list.map((e) => e.headcount || 1)),
      cash: U.sum(list.filter((e) => e.method === 'cash').map((e) => e.amount)),
      transfer: U.sum(list.filter((e) => e.method === 'transfer').map((e) => e.amount)),
    });
    const all = calc(active);
    return {
      ...all,
      cashCount: active.filter((e) => e.method === 'cash').length,
      transferCount: active.filter((e) => e.method === 'transfer').length,
      groom: calc(active.filter((e) => e.side === 'groom')),
      bride: calc(active.filter((e) => e.side === 'bride')),
      active,
    };
  }

  /* ---------- Mutations ---------- */

  function addEntry(input) {
    if (locked()) return { ok: false, error: 'closed' };
    const side = input.side === 'bride' ? 'bride' : 'groom';
    const amount = Math.max(0, Math.round(num(input.amount)));
    if (!amount) return { ok: false, error: 'amount' };

    const no = (state.seq[side] || 0) + 1;
    const now = Date.now();
    const entry = {
      id: U.uid(),
      no,
      side,
      name: String(input.name ?? '').trim() || '이름 없음',
      relation: String(input.relation ?? '').trim(),
      amount,
      method: input.method === 'transfer' ? 'transfer' : 'cash',
      headcount: U.clamp(Math.round(num(input.headcount) || 1), 1, 99),
      memo: String(input.memo ?? '').trim(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    state.seq[side] = no;
    state.entries.push(entry);
    log('add', entry);
    commit();
    return { ok: true, entry };
  }

  function updateEntry(id, patch) {
    if (locked()) return { ok: false, error: 'closed' };
    const entry = state.entries.find((e) => e.id === id);
    if (!entry) return { ok: false, error: 'missing' };

    const before = { amount: entry.amount, side: entry.side, name: entry.name };
    if (patch.side === 'groom' || patch.side === 'bride') {
      if (patch.side !== entry.side) {
        const no = (state.seq[patch.side] || 0) + 1;
        state.seq[patch.side] = no;
        entry.side = patch.side;
        entry.no = no;
      }
    }
    if (patch.name !== undefined) entry.name = String(patch.name).trim() || entry.name;
    if (patch.relation !== undefined) entry.relation = String(patch.relation).trim();
    if (patch.memo !== undefined) entry.memo = String(patch.memo).trim();
    if (patch.amount !== undefined) entry.amount = Math.max(0, Math.round(num(patch.amount)));
    if (patch.method !== undefined) entry.method = patch.method === 'transfer' ? 'transfer' : 'cash';
    if (patch.headcount !== undefined) entry.headcount = U.clamp(Math.round(num(patch.headcount) || 1), 1, 99);
    entry.updatedAt = Date.now();
    log('update', entry, { before });
    commit();
    return { ok: true, entry };
  }

  function deleteEntry(id) {
    if (locked()) return { ok: false, error: 'closed' };
    const entry = state.entries.find((e) => e.id === id);
    if (!entry) return { ok: false, error: 'missing' };
    entry.deletedAt = Date.now();
    entry.updatedAt = Date.now();
    log('delete', entry);
    commit();
    return { ok: true, entry };
  }

  function restoreEntry(id) {
    if (locked()) return { ok: false, error: 'closed' };
    const entry = state.entries.find((e) => e.id === id);
    if (!entry) return { ok: false, error: 'missing' };
    entry.deletedAt = null;
    entry.updatedAt = Date.now();
    log('restore', entry);
    commit();
    return { ok: true, entry };
  }

  function setWedding(patch) {
    Object.assign(state.wedding, patch);
    state.wedding.mealPrice = Math.max(0, Math.round(num(state.wedding.mealPrice)));
    commit();
  }

  function setSettlement(patch) {
    Object.assign(state.settlement, patch);
    if ('cashCounted' in patch) state.settlement.cashCounted = nullableCount(patch.cashCounted);
    if ('envelopeCounted' in patch) state.settlement.envelopeCounted = nullableCount(patch.envelopeCounted);
    persist();
    emit();
  }

  function closeSettlement() {
    state.settlement.closed = true;
    state.settlement.closedAt = Date.now();
    log('close', null);
    commit();
  }

  function reopenSettlement() {
    state.settlement.closed = false;
    state.settlement.closedAt = null;
    log('reopen', null);
    commit();
  }

  function resetEntries() {
    state.entries = [];
    state.seq = { groom: 0, bride: 0 };
    state.settlement = defaultState().settlement;
    log('reset', null);
    commit();
  }

  /* ---------- Backup ---------- */

  function exportPayload() {
    return {
      app: APP_TAG,
      version: DATA_VERSION,
      exportedAt: new Date().toISOString(),
      ...JSON.parse(JSON.stringify(state)),
    };
  }

  function importPayload(raw) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'format' };
    if (!Array.isArray(raw.entries)) return { ok: false, error: 'format' };
    const next = normalize(raw);
    if (!next.entries.length && !next.wedding.groom && !next.wedding.bride) {
      return { ok: false, error: 'empty' };
    }
    state = next;
    state.settlement.closed = false;
    state.settlement.closedAt = null;
    log('import', null);
    commit();
    return { ok: true, count: state.entries.filter((e) => !e.deletedAt).length };
  }

  function loadSample() {
    const base = new Date();
    base.setHours(10, 24, 0, 0);
    const rows = [
      ['groom', '김민준', '직장 동료', 50000, 'cash', 1],
      ['bride', '이수아', '대학 친구', 100000, 'cash', 2],
      ['groom', '박지훈', '고등학교 친구', 30000, 'transfer', 1],
      ['bride', '최예린', '직장 동료', 50000, 'cash', 1],
      ['groom', '정우성', '가족', 300000, 'cash', 4],
      ['bride', '한소희', '친척', 200000, 'transfer', 2],
      ['groom', '오세훈', '선배', 50000, 'cash', 2],
      ['bride', '강다은', '동생 친구', 30000, 'cash', 1],
      ['groom', '윤재호', '이웃', 100000, 'cash', 2],
      ['bride', '서지우', '대학 동기', 50000, 'transfer', 1],
      ['groom', '임도현', '직장 상사', 200000, 'cash', 2],
      ['bride', '문채원', '친구', 50000, 'cash', 1],
      ['groom', '신동민', '친척', 100000, 'cash', 3],
      ['bride', '조하늘', '직장 동료', 30000, 'transfer', 1],
    ];
    state.entries = [];
    state.seq = { groom: 0, bride: 0 };
    rows.forEach(([side, name, relation, amount, method, headcount], i) => {
      const no = (state.seq[side] || 0) + 1;
      state.seq[side] = no;
      const at = base.getTime() + i * 6.5 * 60 * 1000;
      state.entries.push({
        id: U.uid() + i,
        no,
        side,
        name,
        relation,
        amount,
        method,
        headcount,
        memo: '',
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
      });
    });
    state.wedding = {
      date: U.todayKey(),
      groom: state.wedding.groom || '김도윤',
      bride: state.wedding.bride || '이서연',
      hall: state.wedding.hall || '루미에르 웨딩홀 3층 그랜드홀',
      mealPrice: state.wedding.mealPrice || 70000,
    };
    state.settlement = defaultState().settlement;
    state.audit = [];
    log('sample', null);
    commit();
  }

  window.Store = {
    get: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    stats,
    activeEntries,
    addEntry,
    updateEntry,
    deleteEntry,
    restoreEntry,
    setWedding,
    setSettlement,
    closeSettlement,
    reopenSettlement,
    resetEntries,
    exportPayload,
    importPayload,
    loadSample,
    STORAGE_KEY: KEY,
  };
})();
