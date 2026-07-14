const shows = [
  { title: 'После полуночи', meta: 'Драма · 8 серий', poster: 'poster-one', genre: 'Драма' },
  { title: 'Тихий сигнал', meta: 'Мистика · 10 серий', poster: 'poster-two', genre: 'Мистика' },
  { title: 'Один на один', meta: 'Мелодрама · 12 серий', poster: 'poster-three', genre: 'Мелодрама' },
  { title: 'Пятый этаж', meta: 'Триллер · 6 серий', poster: 'poster-four', genre: 'Триллер' },
  { title: 'Второй шанс', meta: 'Семейный · 9 серий', poster: 'poster-five', genre: 'Семейный' },
  { title: 'Вне маршрута', meta: 'Приключения · 7 серий', poster: 'poster-two', genre: 'Приключения' },
  { title: 'Без обратного адреса', meta: 'Драма · 11 серий', poster: 'poster-one', genre: 'Драма' },
  { title: 'Только сегодня', meta: 'Мелодрама · 8 серий', poster: 'poster-three', genre: 'Мелодрама' }
];

const shorts = [
  { title: 'Никому не говори', category: 'СЦЕНА ИЗ «НУЛЕВОЙ ТОЧКИ»', text: 'Тот самый разговор, после которого уже нельзя вернуться назад.', tone: 'linear-gradient(160deg,#283a51,#0b1018 48%,#6c3a4e)' },
  { title: 'Один звонок', category: 'ТИЗЕР · «ТИХИЙ СИГНАЛ»', text: 'Один мотив. Одна тайна. И дорога, которая ведёт дальше.', tone: 'linear-gradient(160deg,#4a2d36,#171017 48%,#b67a4c)' },
  { title: 'Всё начинается здесь', category: 'НАРЕЗКА · «ПОСЛЕ ПОЛУНОЧИ»', text: 'Иногда тишина говорит громче любого признания.', tone: 'linear-gradient(160deg,#203a54,#0c1017 48%,#556d9c)' }
];

const recommendationNode = document.querySelector('#recommendations');
const catalogNode = document.querySelector('#catalog-grid');
const chipsNode = document.querySelector('#genre-chips');
const player = document.querySelector('#player-dialog');
const playerTitle = document.querySelector('#player-title');
let activeGenre = 'Все';
let currentShort = 0;

function mediaCard(show) {
  return `<button class="media-card play-button" data-title="${show.title}" type="button"><div class="card-poster ${show.poster}"><span>${show.genre.toUpperCase()}</span></div><h3>${show.title}</h3><p>${show.meta}</p></button>`;
}

function renderCatalog() {
  const visibleShows = activeGenre === 'Все' ? shows : shows.filter((show) => show.genre === activeGenre);
  catalogNode.innerHTML = visibleShows.map(mediaCard).join('');
}

function renderGenres() {
  const genres = ['Все', ...new Set(shows.map((show) => show.genre))];
  chipsNode.innerHTML = genres.map((genre) => `<button class="chip ${genre === activeGenre ? 'is-active' : ''}" data-genre="${genre}" type="button">${genre}</button>`).join('');
}

function openPlayer(title) {
  playerTitle.textContent = title;
  player.showModal();
}

function renderShort() {
  const short = shorts[currentShort];
  document.querySelector('#shorts-stage').style.background = short.tone;
  document.querySelector('#shorts-stage').innerHTML = `<div class="short-actions"><button type="button" aria-label="Нравится">♡</button><button type="button" aria-label="Поделиться">↗</button><button type="button" aria-label="Сохранить">⌑</button></div><div class="short-content"><span class="short-category">${short.category}</span><h2>${short.title}</h2><p>${short.text}</p></div>`;
  document.querySelector('#shorts-counter').textContent = `${String(currentShort + 1).padStart(2, '0')} / ${String(shorts.length).padStart(2, '0')}`;
}

function navigate(route) {
  document.querySelectorAll('[data-screen]').forEach((screen) => screen.classList.toggle('is-visible', screen.dataset.screen === route));
  document.querySelectorAll('[data-route]').forEach((button) => button.classList.toggle('is-active', button.dataset.route === route));
  document.querySelector('#app-main').scrollTo({ top: 0, behavior: 'smooth' });
}

recommendationNode.innerHTML = shows.slice(0, 5).map(mediaCard).join('');
renderGenres();
renderCatalog();
renderShort();

document.addEventListener('click', (event) => {
  const routeButton = event.target.closest('[data-route]');
  if (routeButton) navigate(routeButton.dataset.route);
  const playButton = event.target.closest('.play-button, .continue-card');
  if (playButton) openPlayer(playButton.dataset.title || 'После полуночи');
  const genreButton = event.target.closest('[data-genre]');
  if (genreButton) { activeGenre = genreButton.dataset.genre; renderGenres(); renderCatalog(); }
});

document.querySelector('#close-player').addEventListener('click', () => player.close());
document.querySelector('#shorts-next').addEventListener('click', () => { currentShort = (currentShort + 1) % shorts.length; renderShort(); });
document.querySelector('#shorts-prev').addEventListener('click', () => { currentShort = (currentShort - 1 + shorts.length) % shorts.length; renderShort(); });
document.querySelector('#global-search').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLocaleLowerCase('ru');
  if (!query) { activeGenre = 'Все'; renderGenres(); renderCatalog(); return; }
  navigate('catalog');
  catalogNode.innerHTML = shows.filter((show) => `${show.title} ${show.meta} ${show.genre}`.toLocaleLowerCase('ru').includes(query)).map(mediaCard).join('') || '<p class="empty-state">Ничего не найдено. Попробуйте другое слово.</p>';
});
document.addEventListener('keydown', (event) => {
  if (document.querySelector('#shorts-screen').classList.contains('is-visible') && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    currentShort = event.key === 'ArrowDown' ? (currentShort + 1) % shorts.length : (currentShort - 1 + shorts.length) % shorts.length;
    renderShort();
  }
});
