/* global Telegram */

function $(sel, root = document) {
  return root.querySelector(sel);
}

function removeCourse({ name, meta }) {
  const n = String(name || '').trim();
  const m = String(meta || '').trim();
  if (!n) return 0;

  const data = loadPills();
  let removed = 0;

  Object.keys(data).forEach((iso) => {
    const arr = Array.isArray(data[iso]) ? data[iso] : [];
    if (arr.length === 0) {
      delete data[iso];
      return;
    }

    const next = arr.filter((x) => {
      const sameName = String(x?.name || '').trim() === n;
      const sameMeta = String(x?.meta || '').trim() === m;
      const keep = !(sameName && sameMeta);
      if (!keep) removed += 1;
      return keep;
    });

    if (next.length === 0) delete data[iso];
    else data[iso] = next;
  });

  savePills(data);
  return removed;
}

function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

let toastTimer;
function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 1800);
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

function formatRuFull(iso) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt);
}

const STORAGE_KEY = 'mymetrica:pills:v1';

function loadPills() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function savePills(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getSelectedISO() {
  const url = new URL(window.location.href);
  const q = url.searchParams.get('date');
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return toISODate(new Date());
}

function setSelectedISO(iso) {
  const url = new URL(window.location.href);
  url.searchParams.set('date', iso);
  window.history.replaceState({}, '', url.toString());
}

const ui = {
  selectedISO: null,
  todayISO: null,
  repeatMode: 'once',
  intervalDays: 2,
  intervalUnit: 'days',
  intervalN: 2,
  times: [''],
  returnTo: null,
  timeDraft: '09:00',
  timeEditingIdx: null,
  sheetMonthAnchor: null,
  sheetDraftISO: null,
  switchEls: null,
  editing: null,
};

const SHEET_ANIM_MS = 220;
let sheetLockUntil = 0;
let pendingSheetOp = null;

function isSheetLocked() {
  return Date.now() < sheetLockUntil;
}

function lockSheets() {
  sheetLockUntil = Date.now() + SHEET_ANIM_MS;
  setTimeout(() => {
    if (Date.now() < sheetLockUntil) return;
    if (!pendingSheetOp) return;
    const op = pendingSheetOp;
    pendingSheetOp = null;
    op();
  }, SHEET_ANIM_MS + 20);
}

function blurActive() {
  const a = document.activeElement;
  if (!a) return;
  if (typeof a.blur === 'function') a.blur();
}

function isSheetOpen(id) {
  const el = document.getElementById(id);
  return Boolean(el && el.classList.contains('is-open'));
}

function syncSheetOpenClass() {
  const open = ['dateSheet', 'addSheet', 'repeatSheet', 'timeSheet'].some((id) => isSheetOpen(id));
  document.documentElement.classList.toggle('is-sheet-open', open);
}

function openSheet(id, { force = false } = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!force && isSheetLocked()) {
    pendingSheetOp = () => openSheet(id, { force: true });
    return;
  }
  if (!force) lockSheets();
  blurActive();
  el.classList.add('is-open');
  el.setAttribute('aria-hidden', 'false');
  syncSheetOpenClass();
}

function closeSheet(id, { force = false } = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!force && isSheetLocked()) {
    pendingSheetOp = () => closeSheet(id, { force: true });
    return;
  }
  if (!force) lockSheets();
  blurActive();
  el.classList.remove('is-open');
  el.setAttribute('aria-hidden', 'true');
  syncSheetOpenClass();
  setTimeout(() => {
    window.scrollTo(0, 0);
  }, 0);
}

function closeAllSheets({ keep = [], force = true } = {}) {
  ['dateSheet', 'addSheet', 'repeatSheet', 'timeSheet'].forEach((id) => {
    if (keep.includes(id)) return;
    closeSheet(id, { force });
  });
}

function initKeyboardFixes() {
  const nameEl = $('#pillName');
  const metaEl = $('#pillMeta');
  [nameEl, metaEl].forEach((el) => {
    if (!el) return;
    el.addEventListener('focus', () => {
      setTimeout(() => {
        el.scrollIntoView?.({ block: 'center', inline: 'nearest' });
      }, 250);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        blurActive();
      }
    });
  });
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseTime(value) {
  const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { h: 9, mm: 0 };
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return { h: Number.isFinite(h) ? h : 9, mm: Number.isFinite(mm) ? mm : 0 };
}

function setTimeDraft(h, mm) {
  ui.timeDraft = `${pad2(h)}:${pad2(mm)}`;
}

function syncTimePickerSelection() {
  const { h, mm } = parseTime(ui.timeDraft);
  const hoursWrap = $('#timeHours');
  const minsWrap = $('#timeMinutes');
  if (!hoursWrap || !minsWrap) return;

  $all('.time-picker__item.is-selected', hoursWrap).forEach((x) => x.classList.remove('is-selected'));
  $all('.time-picker__item.is-selected', minsWrap).forEach((x) => x.classList.remove('is-selected'));

  const hEl = hoursWrap.querySelector(`.time-picker__item[data-value="${pad2(h)}"]`);
  const mEl = minsWrap.querySelector(`.time-picker__item[data-value="${pad2(mm)}"]`);
  if (hEl) hEl.classList.add('is-selected');
  if (mEl) mEl.classList.add('is-selected');

  hEl?.scrollIntoView?.({ block: 'nearest' });
  mEl?.scrollIntoView?.({ block: 'nearest' });
}

function openTimeSheetFor(idx) {
  const t = ui.times?.[idx] || '09:00';
  const { h, mm } = parseTime(t);
  setTimeDraft(h, mm);
  ui.timeEditingIdx = idx;
  if (isSheetOpen('addSheet')) {
    ui.returnTo = 'addSheet';
    closeSheet('addSheet', { force: true });
  }
  closeAllSheets({ keep: ['timeSheet'] });
  openSheet('timeSheet', { force: true });
  syncTimePickerSelection();
}

function openTimeSheetAdd() {
  const base = ui.times?.[ui.times.length - 1] || '09:00';
  const { h, mm } = parseTime(base);
  setTimeDraft(h, mm);
  ui.timeEditingIdx = null;
  if (isSheetOpen('addSheet')) {
    ui.returnTo = 'addSheet';
    closeSheet('addSheet', { force: true });
  }
  closeAllSheets({ keep: ['timeSheet'] });
  openSheet('timeSheet', { force: true });
  syncTimePickerSelection();
}

function formatRepeatLabel() {
  switch (ui.repeatMode) {
    case 'daily': {
      const n = Array.isArray(ui.times) ? ui.times.length : 1;
      if (n <= 1) return 'Каждый день';
      return `Каждый день · ${n} раза`;
    }
    case 'weekdays':
      return 'По будням';
    case 'weekly':
      return 'Раз в неделю';
    case 'interval': {
      const n = ui.intervalN || 2;
      if (ui.intervalUnit === 'weeks') return `Каждые ${n} нед.`;
      if (ui.intervalUnit === 'months') return `Каждые ${n} мес.`;
      return `Каждые ${n} дня`;
    }
    case 'once':
    default:
      return 'Только по необходимости';
  }
}

function updateRepeatLabel() {
  const el = $('#repeatLabel');
  if (el) el.textContent = formatRepeatLabel();
}

function normalizeTimes(count) {
  const base = ['09:00', '14:00', '19:00', '22:00'];
  const next = [];
  for (let i = 0; i < count; i += 1) {
    next.push(ui.times?.[i] || base[i] || '09:00');
  }
  ui.times = next;
}

function renderTimes() {
  const wrap = $('#timesWrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  const times = Array.isArray(ui.times) && ui.times.length > 0 ? ui.times : ['09:00'];
  ui.times = times;

  times.forEach((t, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-btn';
    btn.dataset.idx = String(idx);
    btn.innerHTML = `<span class="time-btn__value"></span><span class="time-btn__remove" aria-hidden="true">×</span>`;
    btn.querySelector('.time-btn__value').textContent = String(t || '').trim() || '09:00';

    btn.addEventListener('click', (e) => {
      const remove = e.target?.closest?.('.time-btn__remove');
      const i = Number(btn.dataset.idx);
      if (!Number.isFinite(i)) return;

      if (remove) {
        ui.times.splice(i, 1);
        if (ui.times.length === 0) ui.times = ['09:00'];
        renderTimes();
        updateRepeatLabel();
        Telegram.WebApp?.HapticFeedback?.impactOccurred?.('light');
        return;
      }

      openTimeSheetFor(i);
      Telegram.WebApp?.HapticFeedback?.impactOccurred?.('light');
    });

    wrap.appendChild(btn);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'time-add-btn';
  addBtn.textContent = '+ Добавить';
  addBtn.addEventListener('click', () => {
    openTimeSheetAdd();
    Telegram.WebApp?.HapticFeedback?.impactOccurred?.('light');
  });
  wrap.appendChild(addBtn);
}

function getTomorrowISO(fromISO) {
  const [y, m, d] = fromISO.split('-').map((x) => Number(x));
  return toISODate(addDays(new Date(y, m - 1, d), 1));
}

function updateDaySwitcherUI() {
  const els = ui.switchEls;
  if (!els) return;

  const todayISO = ui.todayISO || toISODate(new Date());
  const tomorrowISO = getTomorrowISO(todayISO);

  const set = (el, on) => {
    if (!el) return;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  };

  const active = ui.selectedISO === todayISO ? 'today' : ui.selectedISO === tomorrowISO ? 'tomorrow' : 'date';
  set(els.tabToday, active === 'today');
  set(els.tabTomorrow, active === 'tomorrow');
  set(els.tabDate, active === 'date');

  if (els.dayLabel) {
    els.dayLabel.textContent = formatRuFull(ui.selectedISO);
  }
}

function updateHeaderDateLabel() {
  const label = $('#pillsDateLabel');
  if (label) label.textContent = formatRuFull(ui.selectedISO);
}

function formatRuShort(iso) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(dt);
}

function formatSelectedDateLabel(iso) {
  const todayISO = ui.todayISO || toISODate(new Date());
  if (iso === todayISO) return 'Сегодня';
  const [y, m, d] = todayISO.split('-').map((x) => Number(x));
  const tomorrowISO = toISODate(addDays(new Date(y, m - 1, d), 1));
  if (iso === tomorrowISO) return 'Завтра';
  return formatRuShort(iso);
}

function updateSelectedDateField() {
  const label = $('#selectedDateLabel');
  if (label) label.textContent = formatSelectedDateLabel(ui.selectedISO);
}

function openDateSheet() {
  closeAllSheets();
  openSheet('dateSheet');
  ui.sheetDraftISO = ui.selectedISO;
  const [y, m] = ui.selectedISO.split('-').map((x) => Number(x));
  ui.sheetMonthAnchor = new Date(y, m - 1, 1);
  renderMonthSheet();
}

function closeDateSheet() {
  closeSheet('dateSheet');

  if (ui.returnTo === 'addSheet') {
    openSheet('addSheet', { force: true });
    ui.returnTo = null;
  }
}

function commitDateSheet() {
  if (!ui.sheetDraftISO) return;
  ui.selectedISO = ui.sheetDraftISO;
  setSelectedISO(ui.selectedISO);
  updateHeaderDateLabel();
  updateSelectedDateField();
  renderList(ui.selectedISO);
  updateDaySwitcherUI();
  closeDateSheet();
}

function renderMonthSheet() {
  const title = $('#monthTitle');
  const daysWrap = $('#monthDays');
  if (!title || !daysWrap) return;

  const anchor = ui.sheetMonthAnchor || new Date();
  const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(anchor);
  title.textContent = monthName;

  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  // Monday-start offset
  const firstDow = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();

  daysWrap.innerHTML = '';
  for (let i = 0; i < firstDow; i += 1) {
    const pad = document.createElement('div');
    pad.className = 'md md--pad';
    daysWrap.appendChild(pad);
  }

  const todayISO = ui.todayISO || toISODate(new Date());
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dt = new Date(year, month, day);
    const iso = toISODate(dt);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'md';
    if (iso === todayISO) btn.classList.add('is-today');
    if (iso === ui.sheetDraftISO) btn.classList.add('is-selected');
    btn.dataset.iso = iso;
    btn.setAttribute('role', 'gridcell');
    btn.textContent = String(day);
    daysWrap.appendChild(btn);
  }
}

function initDateSheet() {
  const openBtn = $('#openDatePicker');
  const backdrop = $('#dateSheetBackdrop');
  const closeBtn = $('#dateSheetClose');
  const done = $('#dateSheetDone');
  const prev = $('#monthPrev');
  const next = $('#monthNext');
  const daysWrap = $('#monthDays');
  const quickToday = $('#quickToday');
  const quickTomorrow = $('#quickTomorrow');

  openBtn?.addEventListener('click', () => {
    if (isSheetOpen('addSheet')) {
      ui.returnTo = 'addSheet';
      closeSheet('addSheet');
    }
    openDateSheet();
    Telegram.WebApp?.HapticFeedback?.impactOccurred?.('light');
  });
  backdrop?.addEventListener('click', closeDateSheet);
  closeBtn?.addEventListener('click', closeDateSheet);
  done?.addEventListener('click', commitDateSheet);

  prev?.addEventListener('click', () => {
    const a = ui.sheetMonthAnchor || new Date();
    ui.sheetMonthAnchor = new Date(a.getFullYear(), a.getMonth() - 1, 1);
    renderMonthSheet();
  });
  next?.addEventListener('click', () => {
    ui.sheetMonthAnchor = new Date(ui.sheetMonthAnchor.getFullYear(), ui.sheetMonthAnchor.getMonth() + 1, 1);
    renderMonthSheet();
  });

  daysWrap?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('.md');
    if (!btn || btn.classList.contains('md--pad')) return;
    ui.sheetDraftISO = btn.dataset.iso;
    $all('.md.is-selected', daysWrap).forEach((x) => x.classList.remove('is-selected'));
    btn.classList.add('is-selected');
    Telegram.WebApp?.HapticFeedback?.selectionChanged?.();
  });

  quickToday?.addEventListener('click', () => {
    ui.sheetDraftISO = ui.todayISO || toISODate(new Date());
    const [y, m] = ui.sheetDraftISO.split('-').map((x) => Number(x));
    ui.sheetMonthAnchor = new Date(y, m - 1, 1);
    renderMonthSheet();
  });

  quickTomorrow?.addEventListener('click', () => {
    const todayISO = ui.todayISO || toISODate(new Date());
    const [y, m, d] = todayISO.split('-').map((x) => Number(x));
    ui.sheetDraftISO = toISODate(addDays(new Date(y, m - 1, d), 1));
    const [yy, mm] = ui.sheetDraftISO.split('-').map((x) => Number(x));
    ui.sheetMonthAnchor = new Date(yy, mm - 1, 1);
    renderMonthSheet();
  });
}

function initTimeSheet() {
  const sheet = $('#timeSheet');
  const backdrop = $('#timeSheetBackdrop');
  const closeBtn = $('#timeSheetClose');
  const done = $('#timeSheetDone');
  const hoursWrap = $('#timeHours');
  const minsWrap = $('#timeMinutes');

  if (!sheet || !hoursWrap || !minsWrap) return;

  const build = () => {
    hoursWrap.innerHTML = '';
    minsWrap.innerHTML = '';

    for (let h = 0; h <= 23; h += 1) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'time-picker__item';
      b.dataset.value = pad2(h);
      b.textContent = pad2(h);
      b.addEventListener('click', () => {
        const { mm } = parseTime(ui.timeDraft);
        setTimeDraft(h, mm);
        syncTimePickerSelection();
        Telegram.WebApp?.HapticFeedback?.selectionChanged?.();
      });
      hoursWrap.appendChild(b);
    }

    const mins = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    mins.forEach((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'time-picker__item';
      b.dataset.value = pad2(m);
      b.textContent = pad2(m);
      b.addEventListener('click', () => {
        const { h } = parseTime(ui.timeDraft);
        setTimeDraft(h, m);
        syncTimePickerSelection();
        Telegram.WebApp?.HapticFeedback?.selectionChanged?.();
      });
      minsWrap.appendChild(b);
    });
  };

  const close = () => {
    closeSheet('timeSheet');
    if (ui.returnTo === 'addSheet') {
      openSheet('addSheet', { force: true });
      ui.returnTo = null;
    }
  };

  const commit = () => {
    const v = String(ui.timeDraft || '').trim();
    if (!/^\d{2}:\d{2}$/.test(v)) {
      close();
      return;
    }

    if (!Array.isArray(ui.times)) ui.times = [];

    if (ui.timeEditingIdx == null) {
      ui.times.push(v);
    } else {
      const i = Number(ui.timeEditingIdx);
      if (Number.isFinite(i) && i >= 0) ui.times[i] = v;
    }

    ui.times = ui.times.map((t) => String(t || '').trim()).filter(Boolean);
    if (ui.times.length === 0) ui.times = ['09:00'];

    renderTimes();
    updateRepeatLabel();
    Telegram.WebApp?.HapticFeedback?.impactOccurred?.('light');
    close();
  };

  build();

  backdrop?.addEventListener('click', close);
  closeBtn?.addEventListener('click', close);
  done?.addEventListener('click', commit);
}

function addItemsForRule({
  startISO,
  name,
  meta,
  times,
  repeat,
  intervalDays,
}) {
  const data = loadPills();

  const [y, m, d] = startISO.split('-').map((x) => Number(x));
  const startDate = new Date(y, m - 1, d);

  const makeItem = (time) => ({
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name,
    meta,
    time,
  });

  let stepDays = 0;
  let horizonDays = 0;
  let weekdaysOnly = false;
  switch (repeat) {
    case 'daily':
      stepDays = 1;
      horizonDays = 90;
      break;
    case 'weekdays':
      stepDays = 1;
      horizonDays = 180;
      weekdaysOnly = true;
      break;
    case 'interval': {
      const n = Number(intervalDays);
      stepDays = Number.isFinite(n) ? Math.max(2, Math.min(30, n)) : 2;
      horizonDays = 365;
      break;
    }
    case 'weekly':
      stepDays = 7;
      horizonDays = 365;
      break;
    case 'once':
    default:
      stepDays = 0;
      horizonDays = 0;
      break;
  }

  const pushToDate = (iso) => {
    const arr = Array.isArray(data[iso]) ? data[iso] : [];
    const ts = Array.isArray(times) ? times : [];
    ts.forEach((t) => {
      const tv = String(t || '').trim();
      if (!tv) return;
      arr.push(makeItem(tv));
    });
    data[iso] = arr;
  };

  if (stepDays === 0) {
    pushToDate(startISO);
    savePills(data);
    return;
  }

  for (let delta = 0; delta <= horizonDays; delta += stepDays) {
    const dt = addDays(startDate, delta);
    if (weekdaysOnly) {
      const day = dt.getDay();
      if (day === 0 || day === 6) continue;
    }
    const iso = toISODate(dt);
    pushToDate(iso);
  }

  savePills(data);
}

function updatePillItem({ iso, id, patch }) {
  const data = loadPills();
  const arr = Array.isArray(data[iso]) ? data[iso] : [];
  const idx = arr.findIndex((x) => x && x.id === id);
  if (idx < 0) return false;
  arr[idx] = { ...arr[idx], ...patch };
  data[iso] = arr;
  savePills(data);
  return true;
}

function renderList(iso) {
  const listEl = $('#pillsList');
  const emptyEl = $('#pillsEmpty');
  if (!listEl || !emptyEl) return;

  const data = loadPills();
  const items = Array.isArray(data[iso]) ? data[iso] : [];

  listEl.innerHTML = '';

  if (items.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }

  emptyEl.style.display = 'none';

  const sorted = items
    .slice()
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));

  sorted.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'pill-row';

    row.innerHTML = `
      <div class="pill-row__main">
        <div class="pill-row__name"></div>
        <div class="pill-row__meta"></div>
      </div>
      <div class="pill-row__right">
        <div class="pill-row__time"></div>
        <button class="edit-btn" type="button" aria-label="Редактировать">
          <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20h4l10.5-10.5a2 2 0 00-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="trash-btn" type="button" aria-label="Удалить">
          <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 7h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 7l1 14h6l1-14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `.trim();

    row.querySelector('.pill-row__name').textContent = p.name || 'Без названия';
    row.querySelector('.pill-row__meta').textContent = p.meta || '';
    row.querySelector('.pill-row__time').textContent = p.time || '';

    row.querySelector('.trash-btn')?.addEventListener('click', () => {
      const removed = removeCourse({ name: p.name, meta: p.meta });
      renderList(iso);
      toast(removed > 0 ? 'Удалено' : 'Не найдено');
      Telegram.WebApp?.HapticFeedback?.impactOccurred?.('light');
    });

    row.querySelector('.edit-btn')?.addEventListener('click', () => {
      ui.editing = { iso, id: p.id };

      ui.selectedISO = iso;
      setSelectedISO(iso);
      updateHeaderDateLabel();
      updateSelectedDateField();
      updateDaySwitcherUI();

      ui.returnTo = null;
      closeAllSheets();
      openSheet('addSheet');

      const nameEl = $('#pillName');
      const metaEl = $('#pillMeta');
      if (nameEl) nameEl.value = p.name || '';
      if (metaEl) metaEl.value = p.meta || '';

      ui.times = [String(p.time || '').trim()].filter(Boolean);
      if (ui.times.length === 0) ui.times = ['09:00'];
      renderTimes();

      ui.repeatMode = 'once';
      ui.intervalUnit = 'days';
      ui.intervalN = 2;
      ui.intervalDays = 2;
      updateRepeatLabel();

      Telegram.WebApp?.HapticFeedback?.impactOccurred?.('light');
    });

    listEl.appendChild(row);
  });
}

function initHeader(iso) {
  const backBtn = $('#backBtn');
  const goBack = () => {
    window.location.href = `index.html?date=${encodeURIComponent(ui.selectedISO || iso)}`;
  };

  backBtn?.addEventListener('click', goBack);

  if (window.Telegram?.WebApp) {
    Telegram.WebApp.BackButton?.show?.();
    Telegram.WebApp.BackButton?.onClick?.(goBack);
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();

    document.documentElement.classList.add('is-telegram');
    try {
      Telegram.WebApp.setBackgroundColor?.('#fbfcff');
      Telegram.WebApp.setHeaderColor?.('#fbfcff');
    } catch {
    }
  }
}

function initForm(iso) {
  const form = $('#pillsForm');
  if (!form) return;

  if (!Array.isArray(ui.times) || ui.times.length === 0 || !ui.times[0]) {
    const now = new Date();
    ui.times = [`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`];
  }
  renderTimes();
  updateRepeatLabel();

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = ($('#pillName')?.value || '').trim();
    const meta = ($('#pillMeta')?.value || '').trim();
    const repeat = ui.repeatMode || 'once';

    const times = Array.isArray(ui.times) ? ui.times.map((t) => String(t || '').trim()).filter(Boolean) : [];

    if (!name || times.length === 0) {
      toast('Заполните название и время');
      return;
    }

    if (ui.editing?.id && ui.editing?.iso) {
      const ok = updatePillItem({
        iso: ui.editing.iso,
        id: ui.editing.id,
        patch: { name, meta, time: times[0] },
      });
      ui.editing = null;

      renderList(ui.selectedISO || iso);
      toast(ok ? 'Сохранено' : 'Не найдено');
      Telegram.WebApp?.HapticFeedback?.impactOccurred?.('light');

      closeSheet('addSheet');
      return;
    }

    addItemsForRule({
      startISO: ui.selectedISO || iso,
      name,
      meta,
      times,
      repeat,
      intervalDays: ui.intervalDays,
    });

    $('#pillName').value = '';
    $('#pillMeta').value = '';

    const now = new Date();
    ui.times = [`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`];
    renderTimes();

    renderList(ui.selectedISO || iso);
    toast('Добавлено');
    Telegram.WebApp?.HapticFeedback?.impactOccurred?.('light');

    closeSheet('addSheet');
  });
}

function main() {
  ui.selectedISO = getSelectedISO();
  ui.todayISO = toISODate(new Date());
  initHeader(ui.selectedISO);
  updateHeaderDateLabel();
  updateSelectedDateField();
  initDateSheet();
  initTimeSheet();
  initForm(ui.selectedISO);
  initKeyboardFixes();
  renderList(ui.selectedISO);

  ui.switchEls = {
    tabToday: $('#tabToday'),
    tabTomorrow: $('#tabTomorrow'),
    tabDate: $('#tabDate'),
    dayLabel: $('#selectedDayLabel'),
  };

  const setISO = (iso) => {
    ui.selectedISO = iso;
    setSelectedISO(iso);
    updateHeaderDateLabel();
    updateSelectedDateField();
    renderList(iso);
    updateDaySwitcherUI();
  };

  const todayISO = ui.todayISO;
  const tomorrowISO = getTomorrowISO(todayISO);

  ui.switchEls.tabToday?.addEventListener('click', () => setISO(todayISO));
  ui.switchEls.tabTomorrow?.addEventListener('click', () => setISO(tomorrowISO));
  ui.switchEls.tabDate?.addEventListener('click', () => {
    updateDaySwitcherUI();
    ui.returnTo = null;
    openDateSheet();
  });

  updateDaySwitcherUI();

  const addSheet = $('#addSheet');
  const addBackdrop = $('#addSheetBackdrop');
  const addOpen = $('#openAdd');
  const addClose = $('#addClose');

  const openAdd = () => {
    if (!addSheet) return;
    closeAllSheets();
    ui.editing = null;
    ui.repeatMode = 'once';
    ui.intervalUnit = 'days';
    ui.intervalN = 2;
    ui.intervalDays = 2;
    normalizeTimes(1);
    renderTimes();
    updateRepeatLabel();
    $('#pillName').value = '';
    $('#pillMeta').value = '';
    openSheet('addSheet');
    Telegram.WebApp?.HapticFeedback?.impactOccurred?.('light');
  };
  const closeAdd = () => {
    closeSheet('addSheet');
  };

  addOpen?.addEventListener('click', openAdd);
  addClose?.addEventListener('click', closeAdd);
  addBackdrop?.addEventListener('click', closeAdd);

  const repeatSheet = $('#repeatSheet');
  const repeatBackdrop = $('#repeatSheetBackdrop');
  const repeatBack = $('#repeatBack');
  const repeatClose = $('#repeatClose');
  const openRepeat = $('#openRepeat');
  const stepList = $('#repeatStepList');
  const stepInterval = $('#repeatStepInterval');
  const stepTimes = $('#repeatStepTimes');
  const intervalPicker = $('#intervalPicker');
  const intervalTitle = $('#intervalTitle');
  const repeatNext = $('#repeatNext');
  const repeatTitle = $('#repeatTitle');

  const showRepeatStep = (which) => {
    if (!stepList || !stepInterval || !stepTimes) return;
    stepList.hidden = which !== 'list';
    stepInterval.hidden = which !== 'interval';
    stepTimes.hidden = which !== 'times';
    if (repeatBack) repeatBack.hidden = which === 'list';
  };

  const openRepeatSheet = () => {
    if (isSheetOpen('addSheet')) {
      ui.returnTo = 'addSheet';
      closeSheet('addSheet', { force: true });
    }
    closeAllSheets({ keep: ['repeatSheet'] });
    openSheet('repeatSheet');
    if (repeatTitle) repeatTitle.textContent = 'Как часто вы его принимаете?';
    showRepeatStep('list');
  };
  const closeRepeatSheet = () => {
    closeSheet('repeatSheet');

    if (ui.returnTo === 'addSheet') {
      openSheet('addSheet', { force: true });
      ui.returnTo = null;
    }
  };

  openRepeat?.addEventListener('click', openRepeatSheet);
  repeatBackdrop?.addEventListener('click', closeRepeatSheet);
  repeatBack?.addEventListener('click', () => {
    if (repeatTitle) repeatTitle.textContent = 'Как часто вы его принимаете?';
    showRepeatStep('list');
    Telegram.WebApp?.HapticFeedback?.selectionChanged?.();
  });
  repeatClose?.addEventListener('click', closeRepeatSheet);

  const buildPicker = (max, selected) => {
    if (!intervalPicker) return;
    intervalPicker.innerHTML = '';
    for (let i = 1; i <= max; i += 1) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'num';
      b.textContent = String(i);
      if (i === selected) b.classList.add('is-selected');
      b.dataset.value = String(i);
      b.addEventListener('click', () => {
        $all('.num.is-selected', intervalPicker).forEach((x) => x.classList.remove('is-selected'));
        b.classList.add('is-selected');
        ui.intervalN = i;
      });
      intervalPicker.appendChild(b);
    }
    const sel = intervalPicker.querySelector('.num.is-selected');
    sel?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  };

  let pendingUnit = 'days';
  const applyIntervalUnit = (unit) => {
    pendingUnit = unit;
    ui.intervalUnit = unit;
    ui.intervalN = Math.max(1, ui.intervalN || 2);
    if (intervalTitle) {
      intervalTitle.textContent = unit === 'weeks' ? 'Установить интервал в неделях' : unit === 'months' ? 'Установить интервал в месяцах' : 'Установить интервал в днях';
    }
    buildPicker(unit === 'days' ? 30 : 12, unit === 'days' ? Math.max(2, ui.intervalN) : ui.intervalN);
  };

  stepList?.addEventListener('click', (e) => {
    const row = e.target?.closest?.('.action-row');
    if (!row) return;
    const v = row.dataset.repeat;

    if (v === 'daily') {
      ui.repeatMode = 'daily';
      if (repeatTitle) repeatTitle.textContent = 'Как часто вы его принимаете?';
      showRepeatStep('times');
      return;
    }

    if (v === 'every_other') {
      ui.repeatMode = 'interval';
      ui.intervalUnit = 'days';
      ui.intervalN = 2;
      ui.intervalDays = 2;
      updateRepeatLabel();
      closeRepeatSheet();
      return;
    }

    if (v === 'interval_days' || v === 'interval_weeks' || v === 'interval_months') {
      if (repeatTitle) repeatTitle.textContent = 'Установить интервал';
      showRepeatStep('interval');
      applyIntervalUnit(v === 'interval_weeks' ? 'weeks' : v === 'interval_months' ? 'months' : 'days');
      return;
    }

    ui.repeatMode = v === 'once' ? 'once' : v;
    updateRepeatLabel();
    closeRepeatSheet();
  });

  stepTimes?.addEventListener('click', (e) => {
    const row = e.target?.closest?.('.action-row');
    if (!row) return;
    const n = Number(row.dataset.times);
    normalizeTimes(Number.isFinite(n) ? n : 1);
    renderTimes();
    updateRepeatLabel();
    closeRepeatSheet();
  });

  repeatNext?.addEventListener('click', () => {
    ui.repeatMode = 'interval';
    ui.intervalUnit = pendingUnit;
    ui.intervalN = Math.max(1, ui.intervalN || 2);
    ui.intervalDays = ui.intervalUnit === 'weeks' ? ui.intervalN * 7 : ui.intervalUnit === 'months' ? ui.intervalN * 30 : Math.max(2, ui.intervalN);
    updateRepeatLabel();
    closeRepeatSheet();
  });

  updateRepeatLabel();
}

main();
