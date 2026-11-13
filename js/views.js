/* 화면(뷰) 모듈 — 접수 / 명단 / 정산 / 설정 */
(function () {
  'use strict';

  const SIDE_LABEL = { groom: '신랑측', bride: '신부측' };
  const SIDE_SHORT = { groom: '신랑', bride: '신부' };
  const METHOD_LABEL = { cash: '현금', transfer: '계좌이체' };
  const AMOUNT_CHIPS = [30000, 50000, 100000, 200000, 300000, 500000];
  const RELATIONS = ['가족', '친척', '친구', '직장 동료', '직장 상사', '선배', '후배', '이웃', '스승'];
  const ACTION_LABEL = {
    add: '접수', update: '수정', delete: '삭제', restore: '복구',
    close: '마감', reopen: '마감 해제', reset: '초기화', import: '불러오기', sample: '샘플',
  };

  const h = U.escapeHTML;
  const $ = (sel, root = document) => root.querySelector(sel);
  const pad3 = (n) => String(n || 0).padStart(3, '0');

  const draft = {
    side: 'groom',
    amount: 0,
    method: 'cash',
    headcount: 1,
    name: '',
    relation: '',
    memo: '',
  };

  function metaLine(entry) {
    return [
      entry.relation,
      METHOD_LABEL[entry.method],
      `식사 ${entry.headcount || 1}명`,
      U.timeLabel(entry.createdAt),
    ].filter(Boolean).join(' · ');
  }

  function syncChips(container, amount) {
    if (!container) return;
    container.querySelectorAll('[data-amt]').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.amt) === amount);
    });
  }

  function chipsHTML(amount) {
    return AMOUNT_CHIPS.map((v) =>
      `<button type="button" data-amt="${v}" class="${amount === v ? 'active' : ''}">${v / 10000}만</button>`
    ).join('');
  }

  function relationOptions(id) {
    return `<datalist id="${id}">${RELATIONS.map((v) => `<option value="${v}"></option>`).join('')}</datalist>`;
  }

  /* =========================================================
     접수 화면
     ========================================================= */

  const reception = {
    mount(root, state) {
      const closed = state.settlement.closed;

      root.innerHTML = `
        <section class="hero">
          <div class="hero-top">
            <span class="hero-date">${h(U.dateLabel(state.wedding.date))}</span>
            <span class="live">자동 저장</span>
          </div>
          <div class="hero-amount"><span id="heroTotal">0</span><span class="unit">원</span></div>
          <div class="hero-meta">
            <span><b id="heroCount">0</b>건</span>
            <span class="sep"></span>
            <span>현금 <b id="heroCash">0</b>원</span>
            <span class="sep"></span>
            <span>식사 <b id="heroHeads">0</b>명</span>
          </div>
        </section>

        <div class="locked-banner" id="lockedBanner" ${closed ? '' : 'hidden'}>
          <span>정산이 마감되어 접수가 잠겼어요.</span>
          <a href="#/settle">마감 해제</a>
        </div>

        <form class="card entry-form" id="entryForm" autocomplete="off" novalidate>
          <fieldset id="entryFields" ${closed ? 'disabled' : ''}>
            <div class="field">
              <div class="field-head">
                <label>어느 쪽 하객인가요?</label>
                <span class="hint" id="nextNo"></span>
              </div>
              <div class="seg seg-side" id="sideSeg" role="group" aria-label="신랑측 또는 신부측">
                <button type="button" data-side="groom" class="${draft.side === 'groom' ? 'active' : ''}">신랑측</button>
                <button type="button" data-side="bride" class="${draft.side === 'bride' ? 'active' : ''}">신부측</button>
              </div>
            </div>

            <div class="field">
              <div class="field-head">
                <label for="fAmount">축의금</label>
                <span class="hint">봉투 번호 자동 부여</span>
              </div>
              <div class="amount-input">
                <input id="fAmount" inputmode="numeric" placeholder="0"
                  value="${draft.amount ? U.won(draft.amount) : ''}" data-value="${draft.amount}"
                  aria-label="축의금 금액">
                <span class="unit">원</span>
              </div>
              <div class="chips" id="amountChips">${chipsHTML(draft.amount)}</div>
            </div>

            <div class="field-row">
              <div class="field">
                <label for="fName">성함</label>
                <input id="fName" type="text" inputmode="text" placeholder="홍길동"
                  enterkeyhint="next" value="${h(draft.name)}">
              </div>
              <div class="field">
                <label for="fRelation">관계 <span class="tiny muted">선택</span></label>
                <input id="fRelation" type="text" list="relationMain" placeholder="직장 동료" value="${h(draft.relation)}">
                ${relationOptions('relationMain')}
              </div>
            </div>

            <div class="field-row uneven">
              <div class="field">
                <label>식사 인원</label>
                <div class="stepper">
                  <button type="button" data-step="-1" aria-label="인원 줄이기">−</button>
                  <b><span class="n" id="headsNum">${draft.headcount}</span><span class="u">명</span></b>
                  <button type="button" data-step="1" aria-label="인원 늘리기">+</button>
                </div>
              </div>
              <div class="field">
                <label>결제 수단</label>
                <div class="seg seg-method" id="methodSeg" role="group" aria-label="결제 수단">
                  <button type="button" data-method="cash" class="${draft.method === 'cash' ? 'active' : ''}">현금</button>
                  <button type="button" data-method="transfer" class="${draft.method === 'transfer' ? 'active' : ''}">계좌</button>
                </div>
              </div>
            </div>

            <div class="field">
              <label for="fMemo">메모 <span class="tiny muted">선택</span></label>
              <input id="fMemo" type="text" placeholder="예: 대학 동기, 부부 동반" value="${h(draft.memo)}">
            </div>

            <button type="submit" class="btn-primary wide" id="saveBtn">접수 저장</button>
            <p class="form-note">저장 후에도 <b>명단</b>에서 수정하거나 삭제할 수 있어요.</p>
          </fieldset>
        </form>

        <section class="card recent">
          <div class="card-head">
            <h2>최근 접수</h2>
            <a href="#/list" class="link">전체 보기 →</a>
          </div>
          <div id="recentList"></div>
        </section>
      `;

      const form = $('#entryForm', root);
      const fields = $('#entryFields', root);
      const banner = $('#lockedBanner', root);
      const nameInput = $('#fName', root);
      const relationInput = $('#fRelation', root);
      const memoInput = $('#fMemo', root);
      const amountInput = $('#fAmount', root);
      const chips = $('#amountChips', root);
      const headsNum = $('#headsNum', root);
      const nextNo = $('#nextNo', root);
      const recentHost = $('#recentList', root);
      const sideSeg = $('#sideSeg', root);
      const methodSeg = $('#methodSeg', root);

      const amountHandle = U.bindAmount(amountInput, (v) => {
        draft.amount = v;
        syncChips(chips, v);
      });

      const syncNextNo = () => {
        const next = (Store.get().seq[draft.side] || 0) + 1;
        nextNo.textContent = `다음 ${SIDE_SHORT[draft.side]} ${next}번`;
      };

      sideSeg.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-side]');
        if (!btn) return;
        draft.side = btn.dataset.side === 'bride' ? 'bride' : 'groom';
        sideSeg.querySelectorAll('[data-side]').forEach((b) =>
          b.classList.toggle('active', b.dataset.side === draft.side));
        syncNextNo();
      });

      chips.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-amt]');
        if (!btn) return;
        amountHandle.set(Number(btn.dataset.amt));
      });

      methodSeg.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-method]');
        if (!btn) return;
        draft.method = btn.dataset.method === 'transfer' ? 'transfer' : 'cash';
        methodSeg.querySelectorAll('[data-method]').forEach((b) =>
          b.classList.toggle('active', b.dataset.method === draft.method));
      });

      root.querySelectorAll('[data-step]').forEach((btn) => {
        btn.addEventListener('click', () => {
          draft.headcount = U.clamp(draft.headcount + Number(btn.dataset.step), 1, 20);
          headsNum.textContent = String(draft.headcount);
        });
      });

      nameInput.addEventListener('input', () => {
        draft.name = nameInput.value;
        nameInput.classList.remove('invalid');
      });
      relationInput.addEventListener('input', () => { draft.relation = relationInput.value; });
      memoInput.addEventListener('input', () => { draft.memo = memoInput.value; });

      const resetForm = () => {
        draft.amount = 0;
        draft.name = '';
        draft.relation = '';
        draft.memo = '';
        draft.headcount = 1;
        amountHandle.clear();
        nameInput.value = '';
        relationInput.value = '';
        memoInput.value = '';
        headsNum.textContent = '1';
        nameInput.classList.remove('invalid');
        nameInput.focus({ preventScroll: true });
      };

      const save = () => {
        if (Store.get().settlement.closed) {
          U.toast('마감된 상태예요. 정산에서 마감을 해제해 주세요.');
          return;
        }
        const name = draft.name.trim();
        if (!name) {
          U.toast('성함을 입력해 주세요.');
          nameInput.classList.add('invalid');
          nameInput.focus({ preventScroll: true });
          return;
        }
        if (!draft.amount) {
          U.toast('축의금 금액을 입력해 주세요.');
          amountInput.focus({ preventScroll: true });
          return;
        }
        const res = Store.addEntry({ ...draft, name });
        if (!res.ok) {
          U.toast(res.error === 'closed' ? '마감된 상태예요.' : '저장하지 못했어요.');
          return;
        }
        const e = res.entry;
        U.toast(`${e.name}님 ${U.won(e.amount)}원 접수 · ${SIDE_SHORT[e.side]} ${e.no}번`, {
          action: '실행취소',
          onAction: () => {
            const r = Store.deleteEntry(e.id);
            if (r.ok) U.toast('방금 접수를 취소했어요.');
            else U.toast('마감된 상태에서는 취소할 수 없어요.');
          },
        });
        resetForm();
      };

      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        save();
      });

      const renderRecent = () => {
        const list = Store.stats().active.slice(0, 5);
        if (!list.length) {
          recentHost.innerHTML = `<div class="empty"><span class="emoji">💌</span>아직 접수 내역이 없어요.<br>첫 번째 축의금을 기록해 보세요.</div>`;
          return;
        }
        recentHost.innerHTML = `<div class="recent-list">${list.map((e) => `
          <button type="button" class="recent-item" data-id="${h(e.id)}">
            <span class="side-dot ${e.side}"></span>
            <span class="ri-main">
              <span class="ri-name">${h(e.name)}<span class="no">${SIDE_SHORT[e.side]} ${e.no}</span></span>
              <span class="ri-sub">${h(metaLine(e))}</span>
            </span>
            <span class="ri-amt">${U.won(e.amount)}<em>원</em></span>
          </button>`).join('')}</div>`;
      };

      recentHost.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.recent-item');
        if (!btn) return;
        const entry = Store.get().entries.find((e) => e.id === btn.dataset.id);
        if (entry) openEditor(entry);
      });

      const view = {
        update(next) {
          const s = Store.stats();
          $('#heroTotal', root).textContent = U.won(s.total);
          $('#heroCount', root).textContent = String(s.count);
          $('#heroCash', root).textContent = U.won(s.cash);
          $('#heroHeads', root).textContent = String(s.headcount);

          const isClosed = next.settlement.closed;
          banner.hidden = !isClosed;
          fields.disabled = isClosed;
          form.classList.toggle('is-locked', isClosed);
          syncNextNo();
          renderRecent();
        },
      };

      view.update(state);
      return view;
    },
  };

  /* =========================================================
     접수 수정 시트
     ========================================================= */

  function openEditor(entry) {
    if (!entry) return;
    if (Store.get().settlement.closed) {
      U.toast('마감된 상태에서는 수정할 수 없어요. 정산에서 마감을 해제해 주세요.');
      return;
    }

    const d = {
      side: entry.side,
      amount: entry.amount,
      method: entry.method,
      headcount: entry.headcount || 1,
      name: entry.name,
      relation: entry.relation || '',
      memo: entry.memo || '',
    };

    U.sheet.open({
      title: '접수 수정',
      html: `
        <form class="sheet-form" id="editForm" autocomplete="off" novalidate>
          <div class="field">
            <div class="field-head">
              <label>측</label>
              <span class="hint">현재 ${SIDE_SHORT[entry.side]} ${entry.no}번</span>
            </div>
            <div class="seg seg-side" id="eSide">
              <button type="button" data-side="groom" class="${d.side === 'groom' ? 'active' : ''}">신랑측</button>
              <button type="button" data-side="bride" class="${d.side === 'bride' ? 'active' : ''}">신부측</button>
            </div>
          </div>

          <div class="field">
            <label for="eAmount">축의금</label>
            <div class="amount-input">
              <input id="eAmount" inputmode="numeric" value="${U.won(d.amount)}" data-value="${d.amount}" aria-label="축의금 금액">
              <span class="unit">원</span>
            </div>
            <div class="chips" id="eChips">${chipsHTML(d.amount)}</div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="eName">성함</label>
              <input id="eName" type="text" value="${h(d.name)}">
            </div>
            <div class="field">
              <label for="eRelation">관계</label>
              <input id="eRelation" type="text" list="relationEdit" placeholder="선택" value="${h(d.relation)}">
              ${relationOptions('relationEdit')}
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label>식사 인원</label>
              <div class="stepper">
                <button type="button" data-step="-1" aria-label="인원 줄이기">−</button>
                <b><span class="n" id="eHeads">${d.headcount}</span><span class="u">명</span></b>
                <button type="button" data-step="1" aria-label="인원 늘리기">+</button>
              </div>
            </div>
            <div class="field">
              <label>결제 수단</label>
              <div class="seg seg-method" id="eMethod">
                <button type="button" data-method="cash" class="${d.method === 'cash' ? 'active' : ''}">현금</button>
                <button type="button" data-method="transfer" class="${d.method === 'transfer' ? 'active' : ''}">계좌</button>
              </div>
            </div>
          </div>

          <div class="field">
            <label for="eMemo">메모</label>
            <input id="eMemo" type="text" value="${h(d.memo)}">
          </div>

          <p class="sheet-note">측을 바꾸면 새 봉투 번호가 부여됩니다. 기록 시각은 처음 접수한 시간으로 유지돼요.</p>
        </form>`,
      footer: `
        <button type="button" data-del>삭제</button>
        <button type="submit" form="editForm" class="btn-primary">저장</button>`,
      onMount(sheet) {
        const amountInput = $('#eAmount', sheet);
        const eChips = $('#eChips', sheet);
        const eSide = $('#eSide', sheet);
        const eMethod = $('#eMethod', sheet);
        const eName = $('#eName', sheet);
        const eRelation = $('#eRelation', sheet);
        const eMemo = $('#eMemo', sheet);
        const eHeads = $('#eHeads', sheet);

        const amountHandle = U.bindAmount(amountInput, (v) => {
          d.amount = v;
          syncChips(eChips, v);
        });

        eChips.addEventListener('click', (ev) => {
          const btn = ev.target.closest('[data-amt]');
          if (btn) amountHandle.set(Number(btn.dataset.amt));
        });

        eSide.addEventListener('click', (ev) => {
          const btn = ev.target.closest('[data-side]');
          if (!btn) return;
          d.side = btn.dataset.side === 'bride' ? 'bride' : 'groom';
          eSide.querySelectorAll('[data-side]').forEach((b) =>
            b.classList.toggle('active', b.dataset.side === d.side));
        });

        eMethod.addEventListener('click', (ev) => {
          const btn = ev.target.closest('[data-method]');
          if (!btn) return;
          d.method = btn.dataset.method === 'transfer' ? 'transfer' : 'cash';
          eMethod.querySelectorAll('[data-method]').forEach((b) =>
            b.classList.toggle('active', b.dataset.method === d.method));
        });

        sheet.querySelectorAll('[data-step]').forEach((btn) => {
          btn.addEventListener('click', () => {
            d.headcount = U.clamp(d.headcount + Number(btn.dataset.step), 1, 20);
            eHeads.textContent = String(d.headcount);
          });
        });

        eName.addEventListener('input', () => { d.name = eName.value; eName.classList.remove('invalid'); });
        eRelation.addEventListener('input', () => { d.relation = eRelation.value; });
        eMemo.addEventListener('input', () => { d.memo = eMemo.value; });

        $('#editForm', sheet).addEventListener('submit', (ev) => {
          ev.preventDefault();
          const name = d.name.trim();
          if (!name) {
            U.toast('성함을 입력해 주세요.');
            eName.classList.add('invalid');
            eName.focus();
            return;
          }
          if (!d.amount) {
            U.toast('축의금 금액을 입력해 주세요.');
            amountInput.focus();
            return;
          }
          const sideChanged = d.side !== entry.side;
          const res = Store.updateEntry(entry.id, { ...d, name });
          if (!res.ok) {
            U.toast('수정하지 못했어요. 마감 상태를 확인해 주세요.');
            return;
          }
          U.sheet.close();
          U.toast(
            sideChanged
              ? `${name}님 정보를 수정했어요 · ${SIDE_SHORT[res.entry.side]} ${res.entry.no}번`
              : `${name}님 정보를 수정했어요.`
          );
        });

        $('[data-del]', sheet).addEventListener('click', async () => {
          const ok = await U.confirm({
            title: '접수 삭제',
            message: `<b>${h(entry.name)}</b>님의 ${U.won(entry.amount)}원 접수를 삭제할까요?<br>기록은 남아 있고 실행 취소할 수 있어요.`,
            confirmLabel: '삭제',
            danger: true,
          });
          if (!ok) return;
          const res = Store.deleteEntry(entry.id);
          if (!res.ok) {
            U.toast('삭제하지 못했어요.');
            return;
          }
          U.sheet.close();
          U.toast(`${entry.name}님 접수를 삭제했어요.`, {
            action: '되돌리기',
            onAction: () => {
              const r = Store.restoreEntry(entry.id);
              if (r.ok) U.toast('접수를 되살렸어요.');
              else U.toast('마감된 상태에서는 복구할 수 없어요.');
            },
          });
        });
      },
    });
  }

  /* =========================================================
     명단 화면
     ========================================================= */

  const listFilter = { q: '', side: 'all', method: 'all' };

  const listView = {
    mount(root) {
      root.innerHTML = `
        <div class="page-head">
          <div>
            <h1>접수 명단</h1>
            <div class="sub">이름을 눌러 수정할 수 있어요</div>
          </div>
          <button type="button" class="btn-ghost btn-sm" id="exportCsv" aria-label="CSV 내보내기">CSV</button>
        </div>

        <div class="search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>
          <input id="q" type="search" placeholder="이름 · 관계 · 메모 검색" value="${h(listFilter.q)}" aria-label="접수 검색">
        </div>

        <div class="filter-row" id="filters">
          <button type="button" class="chip-toggle" data-side="all">전체</button>
          <button type="button" class="chip-toggle" data-side="groom">신랑측</button>
          <button type="button" class="chip-toggle" data-side="bride">신부측</button>
          <span class="divider" aria-hidden="true"></span>
          <button type="button" class="chip-toggle" data-method="cash">현금</button>
          <button type="button" class="chip-toggle" data-method="transfer">계좌이체</button>
        </div>

        <div class="list-summary" id="listSummary"></div>
        <div class="entry-list" id="entryList"></div>
      `;

      const qInput = $('#q', root);
      const summary = $('#listSummary', root);
      const host = $('#entryList', root);
      const filters = $('#filters', root);

      const getFiltered = () => {
        const all = Store.stats().active;
        const q = listFilter.q.trim().toLowerCase();
        return all.filter((e) => {
          if (listFilter.side !== 'all' && e.side !== listFilter.side) return false;
          if (listFilter.method !== 'all' && e.method !== listFilter.method) return false;
          if (q) {
            const hay = `${e.name} ${e.relation} ${e.memo} ${e.no}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
      };

      const syncFilterChips = () => {
        filters.querySelectorAll('[data-side]').forEach((b) =>
          b.classList.toggle('active', b.dataset.side === listFilter.side));
        filters.querySelectorAll('[data-method]').forEach((b) =>
          b.classList.toggle('active', b.dataset.method === listFilter.method));
      };

      const render = () => {
        const all = Store.stats().active;
        const list = getFiltered();
        const total = U.sum(list.map((e) => e.amount));
        const heads = U.sum(list.map((e) => e.headcount || 1));

        const filtered = list.length !== all.length;
        summary.innerHTML = `<span>${list.length}건${filtered ? ` · 전체 ${all.length}건` : ''} · 식사 ${heads}명</span><b>${U.won(total)}원</b>`;

        if (!list.length) {
          host.innerHTML = all.length
            ? `<div class="empty"><span class="emoji">🔍</span>조건에 맞는 접수가 없어요.<br>검색어나 필터를 바꿔 보세요.</div>`
            : `<div class="empty"><span class="emoji">📋</span>아직 접수 내역이 없어요.<br>접수 화면에서 첫 기록을 남겨 보세요.</div>`;
          return;
        }

        host.innerHTML = list.map((e) => `
          <button type="button" class="entry-row" data-id="${h(e.id)}" aria-label="${h(e.name)} 접수 수정">
            <span class="side-pill ${e.side}">${SIDE_SHORT[e.side]}</span>
            <span class="er-main">
              <span class="er-top">
                <b>${h(e.name)}</b>
                <span class="er-no">#${pad3(e.no)}</span>
                ${e.memo ? '<span class="er-no">메모</span>' : ''}
              </span>
              <span class="er-sub">${h(metaLine(e))}</span>
            </span>
            <span class="er-amt">${U.won(e.amount)}<em>원</em>${
              e.method === 'transfer' ? '<span class="in">계좌이체</span>' : ''
            }</span>
          </button>`).join('');
      };

      qInput.addEventListener('input', () => {
        listFilter.q = qInput.value;
        render();
      });

      filters.addEventListener('click', (ev) => {
        const sideBtn = ev.target.closest('[data-side]');
        if (sideBtn) {
          listFilter.side = sideBtn.dataset.side;
          syncFilterChips();
          render();
          return;
        }
        const methodBtn = ev.target.closest('[data-method]');
        if (methodBtn) {
          listFilter.method = listFilter.method === methodBtn.dataset.method ? 'all' : methodBtn.dataset.method;
          syncFilterChips();
          render();
        }
      });

      host.addEventListener('click', (ev) => {
        const row = ev.target.closest('.entry-row');
        if (!row) return;
        const entry = Store.get().entries.find((e) => e.id === row.dataset.id);
        if (entry) openEditor(entry);
      });

      $('#exportCsv', root).addEventListener('click', exportCsv);

      const view = {
        update() { syncFilterChips(); render(); },
      };

      syncFilterChips();
      render();
      return view;
    },
  };

  /* =========================================================
     CSV / 요약 내보내기
     ========================================================= */

  function csvCell(v) {
    let s = String(v ?? '');
    // 스프레드시트 수식 주입 방지
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv() {
    const state = Store.get();
    const entries = Store.stats().active
      .slice()
      .sort((a, b) => (a.side === b.side ? a.no - b.no : a.side === 'groom' ? -1 : 1));

    if (!entries.length) {
      U.toast('내보낼 접수 내역이 없어요.');
      return;
    }

    const rows = [['측', '봉투번호', '성함', '관계', '축의금', '결제수단', '식사인원', '메모', '접수일시']];
    entries.forEach((e) => {
      rows.push([
        SIDE_LABEL[e.side],
        e.no,
        e.name,
        e.relation,
        e.amount,
        METHOD_LABEL[e.method],
        e.headcount || 1,
        e.memo,
        U.dateTimeLabel(e.createdAt),
      ]);
    });
    const csv = '\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    U.download(`축의금_명단_${state.wedding.date.replace(/-/g, '')}.csv`, csv, 'text/csv;charset=utf-8');
    U.toast('CSV 파일을 내려받았어요.');
  }

  function diffText(diff, unit = '원', won = U.won) {
    if (!diff) return '일치';
    const abs = unit === '개' ? `${U.won(Math.abs(diff))}개` : `${won(Math.abs(diff))}원`;
    return diff > 0 ? `기록보다 ${abs} 많음` : `기록보다 ${abs} 적음`;
  }

  function summaryText() {
    const state = Store.get();
    const s = Store.stats();
    const w = state.wedding;
    const st = state.settlement;
    const lines = [
      '축의금 정산 요약',
      U.dateLabel(w.date) + (w.hall ? ` · ${w.hall}` : ''),
    ];
    if (w.groom || w.bride) lines.push(`${w.groom || '-'} · ${w.bride || '-'}`);
    lines.push(
      '',
      `총 축의금: ${U.won(s.total)}원 (${s.count}건)`,
      `현금: ${U.won(s.cash)}원 / 계좌이체: ${U.won(s.transfer)}원`,
      `식사 인원: ${s.headcount}명`,
      `신랑측: ${U.won(s.groom.total)}원 (${s.groom.count}건, ${s.groom.headcount}명)`,
      `신부측: ${U.won(s.bride.total)}원 (${s.bride.count}건, ${s.bride.headcount}명)`
    );
    if (w.mealPrice) lines.push(`예상 식대: ${U.won(w.mealPrice * s.headcount)}원 (1인 ${U.won(w.mealPrice)}원)`);
    if (st.cashCounted !== null) {
      lines.push(`실제 현금: ${U.won(st.cashCounted)}원 (${diffText(st.cashCounted - s.cash)})`);
    }
    if (st.envelopeCounted !== null) {
      lines.push(`실제 봉투: ${st.envelopeCounted}개 (${diffText(st.envelopeCounted - s.cashCount, '개')})`);
    }
    return lines.join('\n');
  }

  /* =========================================================
     정산 화면
     ========================================================= */

  const settlement = {
    mount(root, state) {
      const st = state.settlement;
      const w = state.wedding;

      root.innerHTML = `
        <div class="page-head no-print">
          <div>
            <h1>정산</h1>
            <div class="sub">${h(U.dateLabel(w.date))}</div>
          </div>
          <span class="status-badge ${st.closed ? 'done' : 'live'}" id="statusBadge">${st.closed ? '마감 완료' : '진행 중'}</span>
        </div>

        <div class="print-only print-head">
          <h1>축의금 정산서</h1>
          <p>${h(U.dateLabel(w.date))}${w.hall ? ' · ' + h(w.hall) : ''}</p>
          <p>${w.groom || w.bride ? h(`${w.groom || '-'} · ${w.bride || '-'}`) : ''}</p>
        </div>

        <div class="settle-hero">
          <span class="label">총 축의금</span>
          <div class="big"><b id="sTotal">0</b><em>원</em></div>
          <div class="stat-grid">
            <div><span>현금</span><b><span id="sCash">0</span><em>원</em></b></div>
            <div><span>계좌이체</span><b><span id="sTransfer">0</span><em>원</em></b></div>
            <div><span>식사 인원</span><b><span id="sHeads">0</span><em>명</em></b></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h2>현금 · 봉투 대조</h2>
            <span class="tiny muted">실제와 비교해 보세요</span>
          </div>
          <div class="compare">
            <div class="compare-row">
              <div class="cr-label">
                <span class="k">기록된 현금</span>
                <span class="v"><span id="recCash">0</span><em>원</em></span>
                <span class="s" id="recCashCount">현금 0건</span>
              </div>
              <div class="cr-input">
                <input id="cashCounted" inputmode="numeric" placeholder="실제 계산" aria-label="실제 현금 합계">
                <span>원</span>
              </div>
            </div>
            <div class="diff" id="cashDiff"></div>

            <div class="compare-row">
              <div class="cr-label">
                <span class="k">기록된 봉투</span>
                <span class="v"><span id="recEnv">0</span><em>개</em></span>
                <span class="s">현금으로 접수된 건수</span>
              </div>
              <div class="cr-input">
                <input id="envCounted" inputmode="numeric" placeholder="실제 봉투" aria-label="실제 봉투 수">
                <span>개</span>
              </div>
            </div>
            <div class="diff" id="envDiff"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>양가 정산</h2></div>
          <table class="split-table">
            <thead><tr><th>구분</th><th>건수</th><th>축의금</th><th>식사</th></tr></thead>
            <tbody>
              <tr><td class="groom-c">신랑측</td><td id="gCount">0</td><td id="gTotal">0원</td><td id="gHeads">0명</td></tr>
              <tr><td class="bride-c">신부측</td><td id="bCount">0</td><td id="bTotal">0원</td><td id="bHeads">0명</td></tr>
              <tr><td>합계</td><td id="tCount">0</td><td id="tTotal">0원</td><td id="tHeads">0명</td></tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-head">
            <h2>예상 식대</h2>
            <a href="#/settings" class="link no-print">단가 수정</a>
          </div>
          <div class="line"><span>식사 인원</span><b id="mHead">0명</b></div>
          <div class="line"><span>1인 식대</span><b id="mPrice">—</b></div>
          <div class="line"><span>예상 식대 합계</span><b id="mTotal">—</b></div>
          <div class="line total"><span>축의금 − 식대</span><b id="mNet">—</b></div>
          <div class="meal-note" id="mealNote"></div>
        </div>

        <div class="card no-print">
          <div class="card-head"><h2>정산 마감</h2></div>
          <p class="tiny muted" id="closeHint" style="line-height:1.6;margin:2px 0 12px"></p>
          <button type="button" class="btn-primary wide" id="closeBtn">마감하기</button>
        </div>

        <div class="print-only print-sign">
          <div class="sign-line"><span>정산 담당</span><b></b></div>
          <div class="sign-line"><span>확인</span><b></b></div>
          <p class="print-note">위 내역은 앱에 기록된 접수를 기준으로 정산한 결과입니다.</p>
        </div>

        <div class="actions-row no-print">
          <button type="button" class="btn-ghost" id="printBtn">정산서 인쇄</button>
          <button type="button" class="btn-ghost" id="csvBtn">CSV 내보내기</button>
          <button type="button" class="btn-ghost span2" id="copyBtn">정산 요약 복사</button>
        </div>
      `;

      const cashInput = $('#cashCounted', root);
      const envInput = $('#envCounted', root);
      const cashDiffEl = $('#cashDiff', root);
      const envDiffEl = $('#envDiff', root);
      const statusBadge = $('#statusBadge', root);
      const closeBtn = $('#closeBtn', root);

      const cashHandle = U.bindAmount(cashInput, (v) => {
        Store.setSettlement({ cashCounted: cashInput.value.trim() === '' ? null : v });
      });
      const envHandle = U.bindAmount(envInput, (v) => {
        Store.setSettlement({ envelopeCounted: envInput.value.trim() === '' ? null : v });
      });

      if (st.cashCounted !== null) cashHandle.set(st.cashCounted);
      if (st.envelopeCounted !== null) envHandle.set(st.envelopeCounted);

      const setText = (id, text) => {
        const node = document.getElementById(id);
        if (node) node.textContent = text;
      };

      const setDiff = (node, actual, recorded, unit) => {
        if (actual === null || actual === undefined) {
          node.className = 'diff';
          node.textContent = unit === '개'
            ? '실제 봉투 수를 입력하면 차이를 확인할 수 있어요.'
            : '실제 금액을 입력하면 차액을 계산해요.';
          return;
        }
        const diff = actual - recorded;
        const abs = unit === '개' ? `${U.won(Math.abs(diff))}개` : `${U.won(Math.abs(diff))}원`;
        if (diff === 0) {
          node.className = 'diff ok';
          node.textContent = `✓ 기록과 일치합니다 (${unit === '개' ? U.won(recorded) + '개' : U.won(recorded) + '원'})`;
        } else {
          node.className = 'diff warn';
          node.innerHTML = `기록보다 <b>${abs}</b> ${diff > 0 ? '많습니다' : '적습니다'}`;
        }
      };

      const view = {
        update(next) {
          const s = Store.stats();
          const wNext = next.wedding;
          const stNext = next.settlement;

          setText('sTotal', U.won(s.total));
          setText('sCash', U.won(s.cash));
          setText('sTransfer', U.won(s.transfer));
          setText('sHeads', String(s.headcount));

          setText('recCash', U.won(s.cash));
          setText('recCashCount', `현금 ${s.cashCount}건`);
          setText('recEnv', String(s.cashCount));
          setText('gCount', String(s.groom.count));
          setText('bCount', String(s.bride.count));
          setText('tCount', String(s.count));
          setText('gTotal', `${U.won(s.groom.total)}원`);
          setText('bTotal', `${U.won(s.bride.total)}원`);
          setText('tTotal', `${U.won(s.total)}원`);
          setText('gHeads', `${s.groom.headcount}명`);
          setText('bHeads', `${s.bride.headcount}명`);
          setText('tHeads', `${s.headcount}명`);

          setDiff(cashDiffEl, stNext.cashCounted, s.cash, '원');
          setDiff(envDiffEl, stNext.envelopeCounted, s.cashCount, '개');

          setText('mHead', `${s.headcount}명`);
          const price = wNext.mealPrice;
          setText('mPrice', price ? `${U.won(price)}원` : '미설정');
          setText('mTotal', price ? `${U.won(price * s.headcount)}원` : '—');
          const netNode = document.getElementById('mNet');
          if (netNode) {
            if (price) {
              const net = s.total - price * s.headcount;
              netNode.textContent = `${U.won(net)}원`;
              netNode.className = net < 0 ? 'neg' : 'pos';
            } else {
              netNode.textContent = '—';
              netNode.className = '';
            }
          }
          const note = document.getElementById('mealNote');
          if (note) {
            note.innerHTML = price
              ? `식사 인원 <b>${s.headcount}명</b> × 1인 <b>${U.won(price)}원</b> 기준입니다. 실제 업체 청구서와 다를 수 있어요.`
              : `<b>설정</b>에서 1인 식대를 입력하면 예상 식대와 잔액이 자동으로 계산됩니다.`;
          }

          statusBadge.className = `status-badge ${stNext.closed ? 'done' : 'live'}`;
          statusBadge.textContent = stNext.closed ? '마감 완료' : '진행 중';
          closeBtn.className = stNext.closed ? 'btn-ghost wide' : 'btn-primary wide';
          closeBtn.textContent = stNext.closed ? '마감 해제' : '마감하기';
          const hint = document.getElementById('closeHint');
          if (hint) {
            hint.innerHTML = stNext.closed
              ? `마감되었습니다${stNext.closedAt ? ` (${U.dateTimeLabel(stNext.closedAt)})` : ''}. 해제하면 다시 접수·수정할 수 있어요.`
              : `마감하면 접수 입력과 수정이 잠깁니다. 현금과 봉투 대조를 마친 뒤 눌러 주세요.`;
          }
        },
      };

      closeBtn.addEventListener('click', async () => {
        const s = Store.stats();
        const stNow = Store.get().settlement;
        const closedNow = stNow.closed;
        if (closedNow) {
          const ok = await U.confirm({
            title: '마감 해제',
            message: '마감을 해제하면 접수 입력과 수정이 다시 가능해집니다.',
            confirmLabel: '해제',
          });
          if (ok) {
            Store.reopenSettlement();
            U.toast('마감을 해제했어요.');
          }
          return;
        }

        const issues = [];
        if (stNow.cashCounted === null) issues.push('실제 현금 미입력');
        else if (stNow.cashCounted !== s.cash) {
          const d = stNow.cashCounted - s.cash;
          issues.push(`현금 ${d > 0 ? '+' : '−'}${U.won(Math.abs(d))}원 차이`);
        }
        if (stNow.envelopeCounted === null) issues.push('실제 봉투 수 미입력');
        else if (stNow.envelopeCounted !== s.cashCount) {
          const d = stNow.envelopeCounted - s.cashCount;
          issues.push(`봉투 ${d > 0 ? '+' : '−'}${U.won(Math.abs(d))}개 차이`);
        }
        const issueHtml = issues.length
          ? `<span class="confirm-warn">확인 필요: ${issues.join(' · ')}</span>`
          : `<span class="confirm-ok">현금과 봉투가 모두 일치합니다 ✓</span>`;

        const ok = await U.confirm({
          title: '정산 마감',
          message: `총 <b>${U.won(s.total)}원</b> · <b>${s.count}건</b>으로 마감할까요?<br>마감 후에는 접수 입력과 수정이 잠깁니다.<br>${issueHtml}`,
          confirmLabel: '마감하기',
        });
        if (ok) {
          Store.closeSettlement();
          U.toast('정산을 마감했어요.');
        }
      });

      $('#printBtn', root).addEventListener('click', () => window.print());
      $('#csvBtn', root).addEventListener('click', exportCsv);
      $('#copyBtn', root).addEventListener('click', async () => {
        const ok = await U.copyText(summaryText());
        U.toast(ok ? '정산 요약을 복사했어요.' : '복사하지 못했어요. 화면의 내용을 직접 선택해 주세요.');
      });

      view.update(state);

      // 마감 상태가 바뀌면 inputs는 유지하고 나머지만 갱신
      const originalUpdate = view.update;
      view.update = (next) => {
        if (next.settlement.closed !== Store.get().settlement.closed) {
          // no-op: original update already reads fresh state
        }
        originalUpdate(next);
      };

      return view;
    },
  };

  /* =========================================================
     설정 화면
     ========================================================= */

  let installBound = false;

  const settings = {
    mount(root, state) {
      const w = state.wedding;

      root.innerHTML = `
        <div class="page-head">
          <div>
            <h1>설정</h1>
            <div class="sub">예식 정보와 데이터를 관리해요</div>
          </div>
        </div>

        <form class="card settings-form" id="weddingForm" autocomplete="off">
          <h2>예식 정보</h2>
          <div class="field">
            <label for="wDate">예식 날짜</label>
            <input type="date" id="wDate" value="${h(w.date)}">
          </div>
          <div class="field-row">
            <div class="field">
              <label for="wGroom">신랑</label>
              <input id="wGroom" type="text" placeholder="신랑 이름" value="${h(w.groom)}">
            </div>
            <div class="field">
              <label for="wBride">신부</label>
              <input id="wBride" type="text" placeholder="신부 이름" value="${h(w.bride)}">
            </div>
          </div>
          <div class="field">
            <label for="wHall">예식장</label>
            <input id="wHall" type="text" placeholder="예: 루미에르 웨딩홀 3층" value="${h(w.hall)}">
          </div>
          <div class="field">
            <label for="wMeal">1인 식대</label>
            <div class="amount-input">
              <input id="wMeal" inputmode="numeric" placeholder="0" value="${w.mealPrice ? U.won(w.mealPrice) : ''}" data-value="${w.mealPrice}">
              <span class="unit">원</span>
            </div>
            <span class="tiny muted">입력하면 정산 화면에서 예상 식대가 자동 계산됩니다.</span>
          </div>
          <div class="actions">
            <button type="submit" class="btn-primary">저장</button>
          </div>
        </form>

        <div class="card">
          <div class="card-head"><h2>데이터 관리</h2><span class="tiny muted" id="dataSummary"></span></div>
          <div class="list-rows">
            <button type="button" class="list-row" id="backupBtn">
              <span class="lr-main"><b>JSON 백업 내려받기</b><span>모든 접수 내역과 설정을 파일 하나로 저장</span></span>
              <span class="lr-end">↓</span>
            </button>
            <button type="button" class="list-row" id="restoreBtn">
              <span class="lr-main"><b>백업 불러오기</b><span>저장해 둔 JSON 파일로 복원 (현재 데이터 덮어쓰기)</span></span>
              <span class="lr-end">↑</span>
            </button>
            <button type="button" class="list-row" id="csvBtn">
              <span class="lr-main"><b>CSV 내보내기</b><span>엑셀에서 열어 볼 수 있는 명단 파일</span></span>
              <span class="lr-end">↗</span>
            </button>
            <button type="button" class="list-row" id="sampleBtn">
              <span class="lr-main"><b>샘플 데이터 채우기</b><span>미리 사용해 보기 (현재 접수 내역은 지워져요)</span></span>
              <span class="lr-end">＋</span>
            </button>
          </div>
          <input type="file" id="fileInput" accept="application/json,.json" hidden>
          <div class="info-box" style="margin-top:14px">
            <b>이 기기의 브라우저에 자동 저장됩니다.</b> 인터넷이 끊겨도 접수·정산이 가능해요.
            다른 기기와 함께 쓰려면 한 대에서 접수한 뒤 <b>JSON 백업</b>으로 옮겨 주세요.
          </div>
        </div>

        <div class="card" id="installCard" hidden>
          <h2>홈 화면에 추가</h2>
          <p class="tiny muted" style="margin:6px 0 12px;line-height:1.6">
            홈 화면에 추가하면 앱처럼 전체 화면으로 열 수 있어요.
          </p>
          <button type="button" class="btn-ghost" id="installBtn" style="width:100%">앱 설치</button>
        </div>

        <div class="card">
          <div class="card-head"><h2>최근 변경 내역</h2><span class="tiny muted">최근 12건</span></div>
          <ul class="audit" id="auditList"></ul>
          <div class="info-box" style="margin-top:12px">
            접수·수정·삭제 기록이 남습니다. 실수로 삭제한 접수는 <b>복구</b>할 수 있어요.
          </div>
        </div>

        <div class="card danger-zone">
          <h2>접수 데이터 초기화</h2>
          <p>모든 접수 내역과 정산 기록이 삭제됩니다. 예식 정보와 식대 설정은 유지돼요. 되돌릴 수 없으니 먼저 JSON 백업을 받아 두세요.</p>
          <button type="button" class="btn-ghost-danger" id="resetBtn">접수 데이터 모두 지우기</button>
        </div>

        <div class="info-box">
          <b>축의금 접수 · 정산</b> · 오프라인 사용 가능<br>
          아이폰·아이패드는 Safari의 <b>공유 → 홈 화면에 추가</b>로 설치할 수 있어요.
        </div>
      `;

      const form = $('#weddingForm', root);
      const mealInput = $('#wMeal', root);
      const auditList = $('#auditList', root);
      const dataSummary = $('#dataSummary', root);
      const fileInput = $('#fileInput', root);

      const mealHandle = U.bindAmount(mealInput, () => {});

      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        Store.setWedding({
          date: $('#wDate', root).value || U.todayKey(),
          groom: $('#wGroom', root).value.trim(),
          bride: $('#wBride', root).value.trim(),
          hall: $('#wHall', root).value.trim(),
          mealPrice: mealHandle.get(),
        });
        U.toast('예식 정보를 저장했어요.');
      });

      const renderAudit = () => {
        const s = Store.get();
        const rows = s.audit.slice(-12).reverse();
        if (!rows.length) {
          auditList.innerHTML = `<li><span class="txt muted">아직 변경 내역이 없어요.</span></li>`;
          return;
        }
        auditList.innerHTML = rows.map((a) => {
          const entry = a.entryId ? s.entries.find((e) => e.id === a.entryId) : null;
          const canRestore = a.action === 'delete' && entry && entry.deletedAt;
          const isEntryAction = ['add', 'update', 'delete', 'restore'].includes(a.action);
          let text = '';
          if (a.action === 'close') text = '정산을 마감했어요';
          else if (a.action === 'reopen') text = '마감을 해제했어요';
          else if (a.action === 'reset') text = '접수 데이터를 초기화했어요';
          else if (a.action === 'import') text = '백업을 불러왔어요';
          else if (a.action === 'sample') text = '샘플 데이터를 채웠어요';
          else {
            const who = a.name ? `${a.name}` : '접수';
            const amt = a.amount ? ` · ${U.won(a.amount)}원` : '';
            text = `${who}${amt}`;
          }
          return `<li>
            <span class="at">${U.dateTimeLabel(a.at)}</span>
            <span class="txt">${
              isEntryAction
                ? `<span class="act ${a.action}">${ACTION_LABEL[a.action] || a.action}</span> `
                : ''
            }${h(text)}</span>
            ${canRestore ? `<button type="button" data-restore="${h(a.entryId)}">복구</button>` : ''}
          </li>`;
        }).join('');
      };

      const updateSummary = () => {
        const s = Store.stats();
        dataSummary.textContent = `${s.count}건 · ${U.won(s.total)}원`;
      };

      auditList.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-restore]');
        if (!btn) return;
        const res = Store.restoreEntry(btn.dataset.restore);
        if (res.ok) U.toast(`${res.entry.name}님 접수를 복구했어요.`);
        else U.toast('복구하지 못했어요. 마감 상태를 확인해 주세요.');
      });

      $('#backupBtn', root).addEventListener('click', () => {
        const payload = Store.exportPayload();
        U.download(
          `축의금_백업_${Store.get().wedding.date}.json`,
          JSON.stringify(payload, null, 2),
          'application/json;charset=utf-8'
        );
        U.toast('백업 파일을 내려받았어요.');
      });

      $('#restoreBtn', root).addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        let data;
        try {
          data = JSON.parse(await file.text());
        } catch (e) {
          U.toast('JSON 파일을 읽지 못했어요. 백업 파일인지 확인해 주세요.');
          return;
        }
        const count = Array.isArray(data.entries)
          ? data.entries.filter((e) => e && !e.deletedAt).length
          : 0;
        const ok = await U.confirm({
          title: '백업 불러오기',
          message: `이 백업에는 접수 <b>${U.won(count)}건</b>이 들어 있어요. 현재 데이터를 덮어쓸까요?`,
          confirmLabel: '덮어쓰기',
          danger: true,
        });
        if (!ok) return;
        const res = Store.importPayload(data);
        if (!res.ok) {
          U.toast(res.error === 'empty' ? '비어 있는 백업 파일이에요.' : '백업 형식이 올바르지 않아요.');
          return;
        }
        U.toast(`접수 ${res.count}건을 불러왔어요.`);
      });

      $('#csvBtn', root).addEventListener('click', exportCsv);

      $('#sampleBtn', root).addEventListener('click', async () => {
        const hasData = Store.stats().count > 0;
        const ok = await U.confirm({
          title: '샘플 데이터',
          message: hasData
            ? '현재 접수 내역이 모두 지워지고 샘플 14건으로 바뀝니다. 계속할까요?'
            : '샘플 접수 14건을 채워 화면을 미리 확인해 볼까요?',
          confirmLabel: '채우기',
          danger: hasData,
        });
        if (!ok) return;
        Store.loadSample();
        U.toast('샘플 데이터를 채웠어요.');
      });

      $('#resetBtn', root).addEventListener('click', async () => {
        const ok = await U.confirm({
          title: '접수 데이터 초기화',
          message: '모든 접수 내역과 정산 기록이 삭제됩니다.<br>이 작업은 되돌릴 수 없어요.',
          confirmLabel: '모두 지우기',
          danger: true,
        });
        if (!ok) return;
        Store.resetEntries();
        U.toast('접수 데이터를 초기화했어요.');
      });

      /* PWA 설치 */
      const installCard = $('#installCard', root);
      const installBtn = $('#installBtn', root);
      const syncInstall = () => {
        installCard.hidden = !window.__deferredInstallPrompt;
      };
      if (!installBound) {
        installBound = true;
        window.addEventListener('installavailable', () => {
          const card = document.getElementById('installCard');
          if (card) card.hidden = !window.__deferredInstallPrompt;
        });
      }
      installBtn.addEventListener('click', async () => {
        const prompt = window.__deferredInstallPrompt;
        if (!prompt) {
          U.toast('브라우저 메뉴에서 "홈 화면에 추가"를 선택해 주세요.');
          return;
        }
        prompt.prompt();
        try { await prompt.userChoice; } catch (e) { /* noop */ }
        window.__deferredInstallPrompt = null;
        syncInstall();
      });

      const view = {
        update() {
          renderAudit();
          updateSummary();
          syncInstall();
        },
      };

      renderAudit();
      updateSummary();
      syncInstall();
      return view;
    },
  };

  window.Views = {
    reception,
    list: listView,
    settle: settlement,
    settings,
  };
})();
