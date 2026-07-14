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

const locales = {
  ru: {
    label: 'Русский',
    'nav.home': 'Главная', 'nav.catalog': 'Каталог', 'nav.foryou': 'Для вас', 'nav.offline': 'Офлайн', 'nav.profile': 'Профиль',
    'brand.tagline': 'Смотри своё.', 'search.placeholder': 'Сериал, герой или жанр',
    'home.premieres': 'Премьеры', 'home.catalogEyebrow': 'КАТАЛОГ', 'home.categories': 'Категории', 'home.viewAll': 'Смотреть всё →',
    'home.continueEyebrow': 'ПРОДОЛЖИТЬ', 'home.keepMoment': 'Не теряй момент', 'home.allStory': 'Вся история →',
    'home.forYouEyebrow': 'ДЛЯ ТЕБЯ', 'home.newStories': 'Новые истории', 'home.all': 'Все →',
    'catalog.eyebrow': 'КАТАЛОГ', 'catalog.title': 'Выбери настроение', 'catalog.description': 'Сериалы, шоу и клипы — без лишнего шума.',
    'foryou.eyebrow': 'ПЕРСОНАЛЬНАЯ ЛЕНТА', 'foryou.title': 'Для<br /><em>вас.</em>', 'foryou.description': 'Эпизоды, лучшие сцены и тизеры, подобранные по твоему просмотру.',
    'downloads.eyebrow': 'ОФЛАЙН', 'downloads.title': 'Загрузки', 'downloads.description': 'Смотри в дороге и там, где сеть нестабильна.',
    'profile.eyebrow': 'МОЙ ПРОФИЛЬ', 'profile.settings': 'Настроить', 'profile.summary': '5 сериалов в избранном',
    premiere: 'ПРЕМЬЕРА', all: 'Все', 'toast.language': 'Язык интерфейса: {language}', 'toast.settings': 'Настройки профиля сохранены'
  },
  en: {
    label: 'English',
    'nav.home': 'Home', 'nav.catalog': 'Catalog', 'nav.foryou': 'For you', 'nav.offline': 'Offline', 'nav.profile': 'Profile',
    'brand.tagline': 'Watch what is yours.', 'search.placeholder': 'Series, character, or genre',
    'home.premieres': 'Premieres', 'home.catalogEyebrow': 'CATALOG', 'home.categories': 'Categories', 'home.viewAll': 'View all →',
    'home.continueEyebrow': 'CONTINUE', 'home.keepMoment': 'Keep the moment', 'home.allStory': 'Full story →',
    'home.forYouEyebrow': 'FOR YOU', 'home.newStories': 'New stories', 'home.all': 'All →',
    'catalog.eyebrow': 'CATALOG', 'catalog.title': 'Pick a mood', 'catalog.description': 'Series, shows, and clips — without the noise.',
    'foryou.eyebrow': 'PERSONAL FEED', 'foryou.title': 'For<br /><em>you.</em>', 'foryou.description': 'Episodes, standout scenes, and teasers selected from your viewing.',
    'downloads.eyebrow': 'OFFLINE', 'downloads.title': 'Downloads', 'downloads.description': 'Watch on the road and wherever your connection is unreliable.',
    'profile.eyebrow': 'MY PROFILE', 'profile.settings': 'Settings', 'profile.summary': '5 series saved',
    premiere: 'PREMIERE', all: 'All', 'toast.language': 'Interface language: {language}', 'toast.settings': 'Profile settings saved'
  },
  sah: {
    label: 'Саха тыла',
    'nav.home': 'Сүрүн', 'nav.catalog': 'Бөлөх', 'nav.foryou': 'Эйиэхэ', 'nav.offline': 'Оффлайн', 'nav.profile': 'Профиль',
    'home.categories': 'Бөлөх'
  }
};

const defaultProfile = { name: 'Алексей', language: 'ru', avatar: '', autoplay: true, dataSaver: false };
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
const carouselViewport = document.querySelector('#carousel-viewport');
const carouselNode = document.querySelector('#premiere-carousel');
const carouselDots = document.querySelector('#carousel-dots');
const homeFeaturedNode = document.querySelector('#home-featured');
const homeGenreNode = document.querySelector('#home-genre-row');
let activeGenre = 'Все';
let homeGenre = 'Все';
let currentShort = 0;
let currentCarousel = 0;
let toastTimer;
let carouselTimer;
let profile = loadProfile();
let pendingAvatar;

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem('sakhatube-profile') || '{}');
    const legacyLanguage = { Русский: 'ru', Саха: 'sah' };
    return { ...defaultProfile, ...saved, language: legacyLanguage[saved.language] || saved.language || defaultProfile.language };
  } catch {
    return { ...defaultProfile };
  }
}

function currentLocale() {
  return locales[profile.language] ? profile.language : 'ru';
}

function t(key) {
  return locales[currentLocale()][key] ?? locales.ru[key] ?? key;
}

function languageLabel() {
  return locales[currentLocale()].label;
}

function applyLocale() {
  const language = currentLocale();
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const value = t(node.dataset.i18n);
    if (node.dataset.i18n === 'foryou.title') node.innerHTML = value;
    else node.textContent = value;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((node) => { node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel)); });
  renderGenres();
  renderCatalog();
  renderHomeFeatured();
  renderCarousel();
  renderProfile();
  window.requestAnimationFrame(() => setCarousel(currentCarousel, false));
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

function homeCard(show) {
  return `<button class="media-card play-button" data-title="${show.title}" type="button"><div class="card-poster ${show.poster}"><span>${show.genre.toUpperCase()}</span></div><h3>${show.title}</h3><p>${show.meta}</p></button>`;
}

function renderHomeFeatured() {
  const visibleShows = homeGenre === 'Все' ? shows.slice(0, 6) : shows.filter((show) => show.genre === homeGenre).slice(0, 6);
  homeFeaturedNode.innerHTML = visibleShows.map(homeCard).join('');
  homeGenreNode.innerHTML = ['Все', ...new Set(shows.map((show) => show.genre))].map((genre) => `<button class="${genre === homeGenre ? 'is-active' : ''}" data-home-genre="${genre}" type="button">${genre === 'Все' ? t('all') : genre}</button>`).join('');
}

function renderCarousel() {
  carouselNode.innerHTML = shows.slice(0, 5).map((show, index) => `<button class="carousel-slide ${index === currentCarousel ? 'is-current' : ''}" data-carousel-index="${index}" data-title="${show.title}" type="button"><div class="carousel-cover ${show.poster}"><span>${t('premiere')}</span><div class="carousel-copy"><p>${show.genre}</p><h2>${show.title}</h2><small>${show.meta}</small></div></div></button>`).join('');
  carouselDots.innerHTML = shows.slice(0, 5).map((show, index) => `<button class="${index === currentCarousel ? 'is-current' : ''}" data-carousel-dot="${index}" type="button" aria-label="${t('home.premieres')}: ${show.title}"></button>`).join('');
}

function setCarousel(index, shouldScroll = true) {
  const count = Math.min(shows.length, 5);
  currentCarousel = (index + count) % count;
  carouselNode.querySelectorAll('[data-carousel-index]').forEach((slide) => slide.classList.toggle('is-current', Number(slide.dataset.carouselIndex) === currentCarousel));
  carouselDots.querySelectorAll('[data-carousel-dot]').forEach((dot) => dot.classList.toggle('is-current', Number(dot.dataset.carouselDot) === currentCarousel));
  if (shouldScroll) {
    const activeSlide = carouselNode.querySelector(`[data-carousel-index="${currentCarousel}"]`);
    if (activeSlide) carouselViewport.scrollTo({ left: activeSlide.offsetLeft - (carouselViewport.clientWidth - activeSlide.clientWidth) / 2, behavior: 'smooth' });
  }
}

function stopCarousel() {
  window.clearInterval(carouselTimer);
}

function startCarousel() {
  stopCarousel();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  carouselTimer = window.setInterval(() => setCarousel(currentCarousel + 1), 5200);
}

function renderGenres() {
  const genres = ['Все', ...new Set(shows.map((show) => show.genre))];
  chipsNode.innerHTML = genres.map((genre) => `<button class="chip ${genre === activeGenre ? 'is-active' : ''}" data-genre="${genre}" type="button">${genre === 'Все' ? t('all') : genre}</button>`).join('');
}

function renderProfile() {
  const displayName = profile.name.trim() || defaultProfile.name;
  const initial = [...displayName][0].toLocaleUpperCase();
  document.querySelectorAll('[data-profile-name]').forEach((node) => { node.textContent = displayName; });
  document.querySelectorAll('[data-profile-initial], .avatar-button').forEach((node) => {
    const hasImage = Boolean(profile.avatar);
    node.textContent = hasImage ? '' : initial;
    node.style.backgroundImage = hasImage ? `url("${profile.avatar}")` : '';
    node.classList.toggle('has-image', hasImage);
  });
  document.querySelectorAll('[data-profile-summary]').forEach((node) => { node.textContent = `${languageLabel()} · ${t('profile.summary')}`; });
  document.querySelector('.language-button').textContent = 'РУ · EN · САХА';
}

function renderAvatarUploadPreview(source = profile.avatar, name = profile.name) {
  const preview = document.querySelector('#avatar-upload-preview');
  if (!preview) return;
  const hasImage = Boolean(source);
  preview.textContent = hasImage ? '' : [...(name.trim() || defaultProfile.name)][0].toLocaleUpperCase();
  preview.style.backgroundImage = hasImage ? `url("${source}")` : '';
  preview.classList.toggle('has-image', hasImage);
}

function compressAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('image'));
      image.onload = () => {
        const size = 320;
        const crop = Math.min(image.naturalWidth, image.naturalHeight);
        const startX = (image.naturalWidth - crop) / 2;
        const startY = (image.naturalHeight - crop) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(image, startX, startY, crop, crop, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
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
  pendingAvatar = undefined;
  document.querySelector('#profile-name-input').value = profile.name;
  document.querySelector('#profile-language-input').value = profile.language;
  document.querySelector('#autoplay-input').checked = profile.autoplay;
  document.querySelector('#data-saver-input').checked = profile.dataSaver;
  document.querySelector('#profile-avatar-input').value = '';
  renderAvatarUploadPreview();
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
      profile.language = { ru: 'en', en: 'sah', sah: 'ru' }[currentLocale()];
      saveProfile();
      applyLocale();
      showToast(t('toast.language').replace('{language}', languageLabel()));
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
applyLocale();
renderShort();
startCarousel();

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

  const carouselButton = event.target.closest('[data-carousel-index]');
  if (carouselButton) {
    setCarousel(Number(carouselButton.dataset.carouselIndex));
    openPlayer(carouselButton.dataset.title);
    startCarousel();
    return;
  }

  const carouselDot = event.target.closest('[data-carousel-dot]');
  if (carouselDot) {
    setCarousel(Number(carouselDot.dataset.carouselDot));
    startCarousel();
    return;
  }

  const homeGenreButton = event.target.closest('[data-home-genre]');
  if (homeGenreButton) {
    homeGenre = homeGenreButton.dataset.homeGenre;
    renderHomeFeatured();
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
carouselViewport.addEventListener('mouseenter', stopCarousel);
carouselViewport.addEventListener('mouseleave', startCarousel);
carouselViewport.addEventListener('pointerdown', stopCarousel);
carouselViewport.addEventListener('pointerup', startCarousel);
carouselViewport.addEventListener('pointercancel', startCarousel);
document.querySelector('#profile-avatar-input').addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) {
    showToast('Выбери фото до 12 МБ.');
    event.target.value = '';
    return;
  }
  try {
    pendingAvatar = await compressAvatar(file);
    renderAvatarUploadPreview(pendingAvatar, document.querySelector('#profile-name-input').value);
  } catch {
    showToast('Не удалось обработать это фото. Попробуй другое.');
    event.target.value = '';
  }
});
document.querySelector('#profile-name-input').addEventListener('input', (event) => {
  renderAvatarUploadPreview(pendingAvatar ?? profile.avatar, event.target.value);
});
settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  profile = {
    name: document.querySelector('#profile-name-input').value.trim() || defaultProfile.name,
    language: document.querySelector('#profile-language-input').value,
    avatar: pendingAvatar ?? profile.avatar,
    autoplay: document.querySelector('#autoplay-input').checked,
    dataSaver: document.querySelector('#data-saver-input').checked
  };
  saveProfile();
  applyLocale();
  closeDialog(settingsDialog);
  showToast(t('toast.settings'));
});
document.querySelector('#global-search').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLocaleLowerCase();
  if (!query) {
    activeGenre = 'Все';
    renderGenres();
    renderCatalog();
    return;
  }
  navigate('catalog');
  catalogNode.innerHTML = shows.filter((show) => `${show.title} ${show.meta} ${show.genre}`.toLocaleLowerCase().includes(query)).map(mediaCard).join('') || '<p class="empty-state">Ничего не найдено. Попробуйте другое слово.</p>';
});
document.addEventListener('keydown', (event) => {
  if (event.target.closest('.continue-card') && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    openPlayer('После полуночи');
  }
  if (document.querySelector('#foryou-screen').classList.contains('is-visible') && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    currentShort = event.key === 'ArrowDown' ? (currentShort + 1) % shorts.length : (currentShort - 1 + shorts.length) % shorts.length;
    renderShort();
  }
});
