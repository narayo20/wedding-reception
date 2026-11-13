/* 앱 진입점 — 라우팅, 상단 요약, PWA 등록 */
(function () {
  'use strict';

  const ROUTES = ['reception', 'list', 'settle', 'settings'];
  const TITLES = {
    reception: '접수',
    list: '접수 명단',
    settle: '정산',
    settings: '설정',
  };

  const viewEl = document.getElementById('view');
  const topbar = document.getElementById('topbar');
  const tabbar = document.getElementById('tabbar');

  let current = null;
  let currentView = null;

  const parseHash = () => {
    const m = /^#\/([a-z]+)/.exec(location.hash);
    return m && ROUTES.includes(m[1]) ? m[1] : 'reception';
  };

  function buildHeader() {
    topbar.innerHTML = `
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="5.5" width="18" height="13.5" rx="2.5"/>
            <path d="m3.6 7.6 8.4 5.4 8.4-5.4"/>
            <path d="M12 4.6c-.9-1.2-2.8-1-3.3.5-.4 1.2.6 2.3 3.3 4 2.7-1.7 3.7-2.8 3.3-4-.5-1.5-2.4-1.7-3.3-.5Z" fill="currentColor" stroke="none" opacity=".85"/>
          </svg>
        </span>
        <div style="min-width:0">
          <div class="brand-title">축의금 접수</div>
          <div class="brand-sub" id="brandSub"></div>
        </div>
      </div>
      <div class="top-total">
        <span>총</span><b id="topTotal">0</b><em>원</em>
      </div>`;
  }

  function updateHeader(state) {
    const total = document.getElementById('topTotal');
    if (total) total.textContent = U.won(Store.stats().total);

    const sub = document.getElementById('brandSub');
    if (!sub) return;
    const closed = state.settlement.closed;
    sub.classList.toggle('is-closed', closed);
    sub.innerHTML = closed
      ? `마감 완료 · ${U.dateLabel(state.wedding.date)}`
      : `<span class="dot-ok"></span>${U.dateLabel(state.wedding.date)}`;
  }

  function updateTabs() {
    tabbar.querySelectorAll('.tab').forEach((a) => {
      const active = a.dataset.route === current;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function navigate(route) {
    if (!ROUTES.includes(route)) route = 'reception';
    if (route === current) return;

    current = route;
    currentView = null;
    viewEl.innerHTML = '';

    const view = Views[route].mount(viewEl, Store.get());
    currentView = view;

    viewEl.classList.remove('view-enter');
    void viewEl.offsetWidth;
    viewEl.classList.add('view-enter');

    updateTabs();
    updateHeader(Store.get());
    document.title = `${TITLES[route]} · 축의금 접수`;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* 데이터 변경 시 상단 요약 + 현재 화면 갱신 */
  Store.subscribe((state) => {
    updateHeader(state);
    if (currentView && typeof currentView.update === 'function') {
      currentView.update(state);
    }
  });

  window.addEventListener('hashchange', () => navigate(parseHash()));

  tabbar.addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tab');
    if (!tab) return;
    if (tab.dataset.route === current) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  buildHeader();
  if (!location.hash) {
    try {
      history.replaceState(null, '', '#/reception');
    } catch (e) {
      location.hash = '#/reception';
    }
  }
  navigate(parseHash());

  /* ---------- PWA ---------- */

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__deferredInstallPrompt = e;
    window.dispatchEvent(new Event('installavailable'));
  });

  window.addEventListener('appinstalled', () => {
    window.__deferredInstallPrompt = null;
    window.dispatchEvent(new Event('installavailable'));
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* 오프라인 캐시는 부가 기능 */ });
    });
  }
})();
