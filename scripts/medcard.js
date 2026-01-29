/* global Telegram */

const STORAGE_KEY = 'mymetrica:medcard:v1';

// Mocks for testing purposes (fake analyses)
const MOCK_DATA = [
  {
    id: '1',
    title: 'Общий анализ крови',
    date: '2025-10-15',
    summary: 'Гемоглобин в норме, повышены лейкоциты. Наблюдается небольшой воспалительный процесс.',
    tags: ['warn'],
    markers: [
      { name: 'Гемоглобин', value: '135', unit: 'г/л', status: 'norm' },
      { name: 'Эритроциты', value: '4.8', unit: '10^12/л', status: 'norm' },
      { name: 'Лейкоциты', value: '11.5', unit: '10^9/л', status: 'warn', ref: '4.0 - 9.0' },
      { name: 'Тромбоциты', value: '250', unit: '10^9/л', status: 'norm' },
      { name: 'СОЭ', value: '15', unit: 'мм/ч', status: 'warn', ref: '2 - 10' }
    ]
  },
  {
    id: '2',
    title: 'Биохимический анализ',
    date: '2025-09-01',
    summary: 'Все основные показатели печени и почек в пределах референсных значений.',
    tags: ['norm'],
    markers: [
      { name: 'АЛТ', value: '24', unit: 'Ед/л', status: 'norm' },
      { name: 'АСТ', value: '28', unit: 'Ед/л', status: 'norm' },
      { name: 'Билирубин общий', value: '12.5', unit: 'мкмоль/л', status: 'norm' },
      { name: 'Глюкоза', value: '5.1', unit: 'ммоль/л', status: 'norm' },
      { name: 'Холестерин', value: '4.8', unit: 'ммоль/л', status: 'norm' }
    ]
  },
  {
    id: '3',
    title: 'Гормоны щитовидной железы',
    date: '2025-08-12',
    summary: 'ТТГ немного снижен, остальные гормоны в норме. Рекомендуется повторить через 3 месяца.',
    tags: ['warn'],
    markers: [
      { name: 'ТТГ', value: '0.35', unit: 'мЕд/л', status: 'warn', ref: '0.4 - 4.0' },
      { name: 'Т3 свободный', value: '4.2', unit: 'пмоль/л', status: 'norm' },
      { name: 'Т4 свободный', value: '14.5', unit: 'пмоль/л', status: 'norm' },
      { name: 'Анти-ТПО', value: '12', unit: 'Ед/мл', status: 'norm' }
    ]
  },
  {
    id: '4',
    title: 'Витамин D и микроэлементы',
    date: '2025-06-20',
    summary: 'Выявлен дефицит витамина D. Железо и ферритин в норме.',
    tags: ['bad'],
    markers: [
      { name: 'Витамин D (25-OH)', value: '18', unit: 'нг/мл', status: 'bad', ref: '30 - 100' },
      { name: 'Ферритин', value: '45', unit: 'мкг/л', status: 'norm' },
      { name: 'Железо сывороточное', value: '22', unit: 'мкмоль/л', status: 'norm' },
      { name: 'Магний', value: '0.85', unit: 'ммоль/л', status: 'norm' }
    ]
  },
  {
    id: '5',
    title: 'Коагулограмма',
    date: '2025-05-15',
    summary: 'Показатели свертываемости крови без отклонений.',
    tags: ['norm'],
    markers: [
      { name: 'Фибриноген', value: '3.2', unit: 'г/л', status: 'norm' },
      { name: 'АЧТВ', value: '32', unit: 'сек', status: 'norm' },
      { name: 'Протромбиновое время', value: '14', unit: 'сек', status: 'norm' },
      { name: 'МНО', value: '1.05', unit: '', status: 'norm' }
    ]
  }
];

function $(sel) {
  return document.querySelector(sel);
}

function loadAnalyses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : MOCK_DATA;
  } catch {
    return [];
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

function renderTags(tags) {
  if (!tags || !tags.length) return '';
  return `
    <div class="analysis-card__tags">
      ${tags.map(t => {
        if (t === 'norm') return '<span class="analysis-tag">Норма</span>';
        if (t === 'warn') return '<span class="analysis-tag is-warn">Внимание</span>';
        if (t === 'bad') return '<span class="analysis-tag is-bad">Отклонение</span>';
        return '';
      }).join('')}
    </div>
  `;
}

function renderMarkers(markers) {
  if (!markers || !markers.length) return '';
  return `
    <div class="analysis-markers" aria-hidden="true">
      ${markers.map(m => `
        <div class="marker-row">
          <div class="marker-row__main">
            <div class="marker-name">${m.name}</div>
            ${m.ref ? `<div class="marker-ref">Норма: ${m.ref}</div>` : ''}
          </div>
          <div class="marker-value ${m.status === 'warn' ? 'is-warn' : m.status === 'bad' ? 'is-bad' : ''}">
            ${m.value} <span class="marker-unit">${m.unit}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderList(items) {
  const listEl = $('#medcardList');
  const emptyEl = $('#medcardEmpty');
  
  if (!items || items.length === 0) {
    if (listEl) listEl.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  if (listEl) listEl.hidden = false;
  if (emptyEl) emptyEl.hidden = true;

  listEl.innerHTML = items.map(item => `
    <div class="analysis-card" role="button" tabindex="0">
      <div class="analysis-card__head">
        <div class="analysis-card__title">${item.title}</div>
        <div class="analysis-card__date">${formatDate(item.date)}</div>
      </div>
      <div class="analysis-card__summary">${item.summary}</div>
      ${renderTags(item.tags)}
      ${renderMarkers(item.markers)}
      <div class="analysis-card__chev">
        <svg class="icon-svg" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </div>
  `).join('');

  // Add click handlers for expansion
  listEl.querySelectorAll('.analysis-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('is-expanded');
      const markers = card.querySelector('.analysis-markers');
      if (markers) {
        markers.setAttribute('aria-hidden', !card.classList.contains('is-expanded'));
      }
      
      if (window.Telegram?.WebApp) {
        Telegram.WebApp.HapticFeedback?.selectionChanged?.();
      }
    });
  });
}

function initBack() {
  const btn = $('#backBtn');
  btn?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  if (window.Telegram?.WebApp) {
    Telegram.WebApp.BackButton.show();
    Telegram.WebApp.BackButton.onClick(() => {
      window.location.href = 'index.html';
    });
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
  }
}

function main() {
  initBack();
  const items = loadAnalyses();
  renderList(items);
}

main();
