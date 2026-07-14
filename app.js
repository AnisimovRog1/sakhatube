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

const defaultProfile = { name: 'Алексей', language: 'Русский', autoplay: true, dataSaver: false };
const recommendationNode = document.querySelector('#recommendations');
const catalogNode = document.querySelector('#catalog-grid');
const chipsNode = document.querySelector('#genre-chips');
const player = document.querySelector('#player-dialog');
const playerTitle = document.querySelector('#player-title');
const notificationsDialog = document.querySelector('#notifications-dialog');
const settingsDialog = document.querySelector('#settings-dialog');
const actionDialog = document.querySelector('#action-dialog');
const settingsForm = document.querySelector('#settings-form');
const toast = document.querySelector('#toast');
let activeGenre = 'Все';
let currentShort = 0;
let toastTimer;
let profile = loadProfile();

function loadProfile() {
  try {
    return { ...defaultProfile, ...JSON.parse(localStorage.getItem('sakhatube-profile') || '{}') };
  } catch {
    return { ...defaultProfile };
  }
}

function saveProfile() {
  localStorage.setItem('sakhatube-profile', JSON.stringify(profile));
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

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

function renderProfile() {
  const displayName = profile.name.trim() || defaultProfile.name;
  const initial = [...displayName][0].toLocaleUpperCase('ru');
  document.querySelectorAll('[data-profile-name]').forEach((node) => { node.textContent = displayName; });
  document.querySelectorAll('[data-profile-initial], .avatar-button').forEach((node) => { node.textContent = initial; });
  document.querySelectorAll('[data-profile-summary]').forEach((node) => { node.textContent = `${profile.language} · 5 сериалов в избранном`; });
  document.querySelector('.language-button').textContent = profile.language === 'Русский' ? 'САХА · РУ' : 'РУ · САХА';
}

function renderShort() {
  const short = shorts[currentShort];
  const stage = document.querySelector('#shorts-stage');
  stage.style.background = short.tone;
  stage.innerHTML = `<div class="short-actions"><button data-short-action="like" type="button" aria-label="Нравится">♡</button><button data-short-action="share" type="button" aria-label="Поделиться">↗</button><button data-short-action="save" type="button" aria-label="Сохранить">⌑</button></div><div class="short-content"><span class="short-category">${short.category}</span><h2>${short.title}</h2><p>${short.text}</p></div>`;
  document.querySelector('#shorts-counter').textContent = `${String(currentShort + 1).padStart(2, '0')} / ${String(shorts.length).padStart(2, '0')}`;
}

function openPlayer(title) {
  playerTitle.textContent = title;
  openDialog(player);
}

function navigate(route) {
  document.querySelectorAll('[data-screen]').forEach((screen) => screen.classList.toggle('is-visible', screen.dataset.screen === route));
  document.querySelectorAll('[data-route]').forEach((button) => button.classList.toggle('is-active', button.dataset.route === route));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSettings() {
  closeDialog(notificationsDialog);
  document.querySelector('#profile-name-input').value = profile.name;
  document.querySelector('#profile-language-input').value = profile.language;
  document.querySelector('#autoplay-input').checked = profile.autoplay;
  document.querySelector('#data-saver-input').checked = profile.dataSaver;
  openDialog(settingsDialog);
}

function openAction(title, copy, eyebrow = 'SAKHATUBE') {
  document.querySelector('#action-eyebrow').textContent = eyebrow;
  document.querySelector('#action-title').textContent = title;
  document.querySelector('#action-copy').textContent = copy;
  openDialog(actionDialog);
}

function openNotifications() {
  document.querySelector('#notifications-button i')?.remove();
  openDialog(notificationsDialog);
}

function handleAction(action, trigger) {
  switch (action) {
    case 'catalog':
      navigate('catalog');
      break;
    case 'details':
      openAction('Нулевая точка', 'Драма на 12 серий. Первые две серии уже доступны без подписки. Полная карточка сериала, трейлер, эпизоды и доступ появятся в следующей продуктовой фазе.', 'СЕРИАЛ');
      break;
    case 'notifications':
      openNotifications();
      break;
    case 'profile-settings':
      openSettings();
      break;
    case 'language':
      profile.language = profile.language === 'Русский' ? 'Саха' : 'Русский';
      saveProfile();
      renderProfile();
      showToast(`Язык интерфейса: ${profile.language}`);
      break;
    case 'subscription':
      openAction('Sakha+ активна', 'Подписка действует до 14 августа 2026. Здесь будут управление тарифом, восстановление покупок и прозрачная история платежей.', 'ПОДПИСКА');
      break;
    case 'continue':
      openPlayer('После полуночи');
      break;
    case 'history':
      openAction('История просмотров', 'В истории сохраняются позиции просмотра и можно продолжить сериал на любом устройстве. Управление историей появится вместе с авторизацией и синхронизацией.', 'БИБЛИОТЕКА');
      break;
    case 'saved':
      openAction('Сохранённое', 'Здесь будут избранное, «посмотреть позже» и сохранённые клипы. Это отдельная библиотека, а не смешанный список рекомендаций.', 'БИБЛИОТЕКА');
      break;
    case 'security':
      openAction('Безопасность и устройства', 'В готовом приложении здесь будут активные устройства, завершение сеансов, смена способа входа и двухэтапная защита чувствительных действий.', 'БЕЗОПАСНОСТЬ');
      break;
    case 'download-actions':
      openAction('Загрузка «После полуночи»', 'Здесь будут пауза, выбор качества, удаление файла и информация о свободном месте. Права на офлайн-видео всегда проверяются перед воспроизведением.', 'ОФЛАЙН');
      break;
    default:
      if (trigger) showToast('Действие подготовлено для следующей версии.');
  }
}

async function handleShortAction(action, button) {
  const short = shorts[currentShort];
  if (action === 'like') {
    const isActive = button.classList.toggle('is-active');
    button.textContent = isActive ? '♥' : '♡';
    showToast(isActive ? 'Клип понравился' : 'Лайк убран');
  }
  if (action === 'save') {
    const isActive = button.classList.toggle('is-active');
    button.textContent = isActive ? '✓' : '⌑';
    showToast(isActive ? 'Клип сохранён' : 'Клип убран из сохранённого');
  }
  if (action === 'share') {
    const shareData = { title: short.title, text: `SakhaTube — ${short.title}`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else if (navigator.clipboard) await navigator.clipboard.writeText(window.location.href);
      showToast('Ссылка готова к отправке');
    } catch (error) {
      if (error.name !== 'AbortError') showToast('Не удалось открыть меню отправки');
    }
  }
}

recommendationNode.innerHTML = shows.slice(0, 5).map(mediaCard).join('');
renderGenres();
renderCatalog();
renderShort();
renderProfile();

document.addEventListener('click', (event) => {
  const closeButton = event.target.closest('[data-close-dialog]');
  if (closeButton) {
    closeDialog(document.querySelector(`#${closeButton.dataset.closeDialog}`));
    return;
  }

  const routeButton = event.target.closest('[data-route]');
  if (routeButton) {
    if (routeButton.tagName === 'A') event.preventDefault();
    navigate(routeButton.dataset.route);
    return;
  }

  const notification = event.target.closest('[data-notification-title]');
  if (notification) {
    closeDialog(notificationsDialog);
    openPlayer(notification.dataset.notificationTitle);
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    handleAction(actionButton.dataset.action, actionButton);
    return;
  }

  const shortAction = event.target.closest('[data-short-action]');
  if (shortAction) {
    handleShortAction(shortAction.dataset.shortAction, shortAction);
    return;
  }

  const playButton = event.target.closest('.play-button, .continue-card');
  if (playButton) {
    openPlayer(playButton.dataset.title || 'После полуночи');
    return;
  }

  const genreButton = event.target.closest('[data-genre]');
  if (genreButton) {
    activeGenre = genreButton.dataset.genre;
    renderGenres();
    renderCatalog();
  }
});

document.querySelector('#close-player').addEventListener('click', () => closeDialog(player));
document.querySelector('#player-continue').addEventListener('click', () => {
  closeDialog(player);
  showToast(`Продолжаем «${playerTitle.textContent}»`);
});
document.querySelector('#shorts-next').addEventListener('click', () => {
  currentShort = (currentShort + 1) % shorts.length;
  renderShort();
});
document.querySelector('#shorts-prev').addEventListener('click', () => {
  currentShort = (currentShort - 1 + shorts.length) % shorts.length;
  renderShort();
});
settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  profile = {
    name: document.querySelector('#profile-name-input').value.trim() || defaultProfile.name,
    language: document.querySelector('#profile-language-input').value,
    autoplay: document.querySelector('#autoplay-input').checked,
    dataSaver: document.querySelector('#data-saver-input').checked
  };
  saveProfile();
  renderProfile();
  closeDialog(settingsDialog);
  showToast('Настройки профиля сохранены');
});
document.querySelector('#global-search').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLocaleLowerCase('ru');
  if (!query) {
    activeGenre = 'Все';
    renderGenres();
    renderCatalog();
    return;
  }
  navigate('catalog');
  catalogNode.innerHTML = shows.filter((show) => `${show.title} ${show.meta} ${show.genre}`.toLocaleLowerCase('ru').includes(query)).map(mediaCard).join('') || '<p class="empty-state">Ничего не найдено. Попробуйте другое слово.</p>';
});
document.addEventListener('keydown', (event) => {
  if (event.target.closest('.continue-card') && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    openPlayer('После полуночи');
  }
  if (document.querySelector('#shorts-screen').classList.contains('is-visible') && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    currentShort = event.key === 'ArrowDown' ? (currentShort + 1) % shorts.length : (currentShort - 1 + shorts.length) % shorts.length;
    renderShort();
  }
});
