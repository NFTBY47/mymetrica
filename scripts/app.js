/* global Telegram */

const state = {
  selectedDateISO: null,
  todayISO: null,
  pillsByDate: {},
  pillsPlanByDate: {},
};

const PILLS_STORAGE_KEY = 'mymetrica:pills:v1';

function $(sel, root = document) {
  return root.querySelector(sel);
}

function formatRuDayMonth(iso) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(dt);
}

function getPillsTitle(iso) {
  const todayISO = state.todayISO || toISODate(new Date());
  if (iso === todayISO) return 'На сегодня';

  const [y, m, d] = todayISO.split('-').map((x) => Number(x));
  const todayDate = new Date(y, m - 1, d);
  const tomorrowISO = toISODate(addDays(todayDate, 1));
  if (iso === tomorrowISO) return 'На завтра';

  return `На ${formatRuDayMonth(iso)}`;
}

function scheduleMidnightRefresh() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 5, 0);
  const ms = Math.max(250, next.getTime() - now.getTime());

  setTimeout(() => {
    const prevToday = state.todayISO;
    state.todayISO = toISODate(new Date());

    if (prevToday && state.selectedDateISO === prevToday) {
      state.selectedDateISO = state.todayISO;
    }

    renderCalendar();
    scheduleMidnightRefresh();
  }, ms);
}

function loadPillsStorage() {
  try {
    const raw = localStorage.getItem(PILLS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function syncPillsFromStorage() {
  const data = loadPillsStorage();
  const map = {};
  const plan = {};

  Object.entries(data).forEach(([iso, items]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    if (!Array.isArray(items) || items.length === 0) return;
    map[iso] = true;
    plan[iso] = items;
  });

  state.pillsByDate = map;
  state.pillsPlanByDate = plan;
}

function getInitialSelectedISO() {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('date');
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  } catch {
    // ignore
  }
  return null;
}

function initStorageSync() {
  const refresh = () => {
    syncPillsFromStorage();
    renderCalendar();
  };

  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}

function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function toISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, delta) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

let toastTimer;
function toast(message) {
  const el = $('#toast');
  if (!el) return;

  el.textContent = message;
  el.classList.add('is-visible');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('is-visible');
  }, 1800);
}

function applyUserName() {
  const nameEl = $('#currentName');
  const avatarEl = $('.avatar');
  if (!nameEl) return;

  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  try {
    const user = tg.initDataUnsafe?.user;
    if (user?.first_name) {
      nameEl.textContent = user.first_name;
    }
    
    if (user?.photo_url && avatarEl) {
      const img = document.createElement('img');
      img.src = user.photo_url;
      img.alt = user.first_name || 'Аватар';
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 18px;';
      avatarEl.innerHTML = '';
      avatarEl.appendChild(img);
    }
  } catch {
  }
}

function initPillsEmptyState() {
  const today = new Date();
  state.pillsByDate = {};
  state.pillsPlanByDate = {};
  state.todayISO = toISODate(today);
  state.selectedDateISO = state.todayISO;

  const initial = getInitialSelectedISO();
  if (initial) state.selectedDateISO = initial;
}

function renderPillsSummary() {
  const el = $('#pillsSummary');
  if (!el) return;

  const iso = state.selectedDateISO;
  const items = state.pillsPlanByDate[iso] || [];
  const title = getPillsTitle(iso);

  if (items.length === 0) {
    el.innerHTML = `
      <div class="pills__title">${title}</div>
      <div class="pill" role="note">
        <div>
          <div class="pill__name">Пока нет таблеток</div>
          <div class="pill__meta">Нажмите «Открыть», чтобы добавить приём</div>
        </div>
        <div class="pill__time">—</div>
      </div>
    `.trim();
    return;
  }

  const list = items
    .map(
      (p) => `
        <div class="pill">
          <div>
            <div class="pill__name">${p.name}</div>
            <div class="pill__meta">${p.meta}</div>
          </div>
          <div class="pill__time">${p.time}</div>
        </div>
      `.trim(),
    )
    .join('');

  el.innerHTML = `
    <div class="pills__title">${title}</div>
    <div class="pills__list">${list}</div>
  `.trim();
}

function renderCalendar() {
  const strip = $('#calendarStrip');
  if (!strip) return;

  const today = new Date();
  state.todayISO = toISODate(today);
  const start = addDays(today, -3);
  const daysCount = 14;

  const dow = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  strip.innerHTML = '';
  for (let i = 0; i < daysCount; i += 1) {
    const d = addDays(start, i);
    const iso = toISODate(d);
    const isToday = iso === toISODate(today);
    const isSelected = iso === state.selectedDateISO;
    const hasPills = Boolean(state.pillsByDate[iso]);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `day${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}${hasPills ? ' has-pills' : ''}`;
    btn.dataset.iso = iso;
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-label', `${d.getDate()} ${d.getMonth() + 1}`);
    btn.innerHTML = `
      <div class="day__dow">${dow[d.getDay()]}</div>
      <div class="day__num">${d.getDate()}</div>
      <div class="day__dot" aria-hidden="true"></div>
    `.trim();

    strip.appendChild(btn);
  }

  const selected = strip.querySelector('.day.is-selected');
  if (selected) {
    selected.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  renderPillsSummary();
}

function initCalendar() {
  const strip = $('#calendarStrip');
  if (!strip) return;

  strip.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('.day');
    if (!btn) return;

    state.selectedDateISO = btn.dataset.iso;
    renderCalendar();

    toast(`План на ${btn.querySelector('.day__num')?.textContent}`);
    if (window.Telegram?.WebApp) {
      Telegram.WebApp.HapticFeedback?.selectionChanged?.();
    }
  });
}

function initActions() {
  document.addEventListener('click', (e) => {
    const target = e.target?.closest?.('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    switch (action) {
      case 'close':
        if (window.Telegram?.WebApp) Telegram.WebApp.close();
        else toast('Закрытие доступно внутри Telegram');
        break;
      case 'menu':
        toast('Меню: скоро');
        break;
      case 'support':
        if (window.Telegram?.WebApp?.openTelegramLink) {
          Telegram.WebApp.openTelegramLink('https://t.me/mymetrica_help');
        } else if (window.Telegram?.WebApp?.openLink) {
          Telegram.WebApp.openLink('https://t.me/mymetrica_help');
        } else {
          window.open('https://t.me/mymetrica_help', '_blank');
        }
        break;
      case 'notifications':
        toast('Пока нет уведомлений');
        break;
      case 'balance':
        toast('Баланс: бесплатно без ограничений');
        break;
      case 'add':
        toast('Загрузка анализа: скоро');
        break;
      case 'decode':
        window.location.href = 'decode.html';
        break;
      case 'medcard':
        window.location.href = 'medcard.html';
        break;
      case 'pills':
        window.location.href = `pills.html?date=${encodeURIComponent(state.selectedDateISO)}`;
        break;
      case 'dynamics':
        window.location.href = 'dynamics.html';
        break;
      case 'chat':
        toast('Чат ассистента: скоро');
        break;
      case 'referral':
        toast('Рефералы: скоро');
        break;
      case 'invite':
        toast('Приглашение в семью: скоро');
        break;
      case 'subscription':
        toast('Подписка: скоро');
        break;
      default:
        toast('Скоро');
    }

    if (window.Telegram?.WebApp) {
      Telegram.WebApp.HapticFeedback?.impactOccurred?.('light');
    }
  });
}

function applyTelegramTheme() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  tg.ready();
  tg.expand();

  document.documentElement.classList.add('is-telegram');

  try {
    tg.setBackgroundColor?.('#fafbfc');
    tg.setHeaderColor?.('#fafbfc');
    
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
      tg.MainButton?.hide();
      tg.BackButton?.hide();
    }
  } catch {
  }
}

function main() {
  applyTelegramTheme();
  initPillsEmptyState();
  syncPillsFromStorage();
  initCalendar();
  renderCalendar();
  initActions();
  applyUserName();
  scheduleMidnightRefresh();
  initStorageSync();
}

main();
