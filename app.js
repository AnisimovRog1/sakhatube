const demoAsset = (path) => `https://sakhatube-production.up.railway.app/v1/demo-media/${path}?media=20260715-09`;
const ccTestAsset = (path) => demoAsset(`cc-test-set/${path}`);
const demoMedia = {
  hls: demoAsset('sintel-demo/episode/master.m3u8'),
  preview: demoAsset('sintel-demo/episode/preview.mp4'),
  clip: demoAsset('sintel-demo/clip/clip.mp4'),
  poster: demoAsset('sintel-demo/poster.jpg')
};

const shows = [
  { title: 'Sintel: начало пути', meta: 'Бесплатно · CC BY 3.0 · 24 сек', poster: 'poster-demo', posterUrl: ccTestAsset('posters/sintel-01.jpg'), genre: 'Приключения', mp4: ccTestAsset('long/sintel-01.mp4'), playerMeta: 'ЛЕГАЛЬНЫЙ ТЕСТ · SINTEL · CC BY 3.0' },
  { title: 'Sintel: след на снегу', meta: 'Бесплатно · CC BY 3.0 · 24 сек', poster: 'poster-two', posterUrl: ccTestAsset('posters/sintel-02.jpg'), genre: 'Приключения', mp4: ccTestAsset('long/sintel-02.mp4'), playerMeta: 'ЛЕГАЛЬНЫЙ ТЕСТ · SINTEL · CC BY 3.0' },
  { title: 'Sintel: решение', meta: 'Бесплатно · CC BY 3.0 · 24 сек', poster: 'poster-four', posterUrl: ccTestAsset('posters/sintel-03.jpg'), genre: 'Драма', mp4: ccTestAsset('long/sintel-03.mp4'), playerMeta: 'ЛЕГАЛЬНЫЙ ТЕСТ · SINTEL · CC BY 3.0' },
  { title: 'Big Buck Bunny: утро', meta: 'Бесплатно · CC BY 3.0 · 30 сек', poster: 'poster-five', posterUrl: ccTestAsset('posters/bunny-01.jpg'), genre: 'Анимация', mp4: ccTestAsset('long/bunny-01.mp4'), playerMeta: 'ЛЕГАЛЬНЫЙ ТЕСТ · BIG BUCK BUNNY · CC BY 3.0' },
  { title: 'Big Buck Bunny: навстречу', meta: 'Бесплатно · CC BY 3.0 · 30 сек', poster: 'poster-one', posterUrl: ccTestAsset('posters/bunny-02.jpg'), genre: 'Анимация', mp4: ccTestAsset('long/bunny-02.mp4'), playerMeta: 'ЛЕГАЛЬНЫЙ ТЕСТ · BIG BUCK BUNNY · CC BY 3.0' },
  { title: 'Elephants Dream', meta: 'Бесплатно · CC BY 3.0 · 10 мин', poster: 'poster-three', posterUrl: ccTestAsset('posters/elephants-dream.jpg'), genre: 'Анимация', mp4: ccTestAsset('long/elephants-dream.mp4'), playerMeta: 'ОТКРЫТОЕ КИНО · ELEPHANTS DREAM · CC BY 3.0' },
  { title: 'Cosmos Laundromat: First Cycle', meta: 'Бесплатно · CC BY 4.0 · 12 мин', poster: 'poster-two', posterUrl: ccTestAsset('posters/cosmos-laundromat.jpg'), genre: 'Анимация', mp4: ccTestAsset('long/cosmos-laundromat.mp4'), playerMeta: 'ОТКРЫТОЕ КИНО · COSMOS LAUNDROMAT · CC BY 4.0' },
  { title: 'Caminandes 3: Llamigos', meta: 'Бесплатно · CC BY 3.0 · 2 мин', poster: 'poster-five', posterUrl: ccTestAsset('posters/caminandes-llamigos.jpg'), genre: 'Анимация', mp4: ccTestAsset('long/caminandes-llamigos.mp4'), playerMeta: 'ОТКРЫТОЕ КИНО · CAMINANDES · CC BY 3.0' }
];

const sintelShortCopy = [
  ['После тишины', 'Путь продолжается, когда вокруг остаётся только снег.'],
  ['След на ветру', 'Один шаг меняет всё.'],
  ['Точка выбора', 'Сцена, к которой хочется вернуться.'],
  ['Выше облаков', 'Там, где дорога исчезает из виду.'],
  ['Без лишних слов', 'Короткий фрагмент большой истории.']
];

const bunnyShortCopy = [
  ['Тихое утро', 'Иногда лучший момент — просто остановиться.'],
  ['Первый луч', 'Свет меняет настроение за секунду.'],
  ['Найти свой ритм', 'Небольшая сцена для хорошего настроения.'],
  ['Где начинается день', 'В кадре остаётся только самое важное.'],
  ['Смотреть до конца', 'Когда история продолжается без слов.']
];

const shorts = [
  ...['01', '02', '03', '04', '05'].map((number, index) => ({
    contentId: 'cc-shorts',
    title: sintelShortCopy[index][0],
    category: 'SINTEL · CC BY 3.0',
    text: sintelShortCopy[index][1],
    likes: ['12,8 тыс.', '9,4 тыс.', '18,1 тыс.', '7,6 тыс.', '14,2 тыс.'][index],
    comments: ['324', '212', '487', '156', '291'][index],
    tone: 'linear-gradient(160deg,#17283c,#09111c 48%,#293e57)',
    mp4: ccTestAsset(`shorts/sintel-${number}.mp4`),
    poster: ccTestAsset(`short-posters/sintel-${number}.jpg`)
  })),
  ...['01', '02', '03', '04', '05'].map((number, index) => ({
    contentId: 'cc-shorts',
    title: bunnyShortCopy[index][0],
    category: 'BIG BUCK BUNNY · CC BY 3.0',
    text: bunnyShortCopy[index][1],
    likes: ['11,3 тыс.', '8,9 тыс.', '16,5 тыс.', '6,8 тыс.', '13,7 тыс.'][index],
    comments: ['308', '193', '451', '148', '267'][index],
    tone: 'linear-gradient(160deg,#3e2b1f,#10151a 48%,#1c5265)',
    mp4: ccTestAsset(`shorts/bunny-${number}.mp4`),
    poster: ccTestAsset(`short-posters/bunny-${number}.jpg`)
  }))
];

const shortIcons = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4Z"/><path d="m17 10 3 4m0-4-3 4"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4Z"/><path d="M17 9a4 4 0 0 1 0 6m2.3-8.3a7 7 0 0 1 0 10.6"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z"/></svg>',
  comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 9 9 0 0 1-3.8-.9L4 19l1.3-3.4A7 7 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"/></svg>',
  repost: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h9.5L14 4.5"/><path d="M17 17H7.5L10 19.5"/><path d="M16.5 7A5 5 0 0 1 19 11.3v.7M7.5 17A5 5 0 0 1 5 12.7V12"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h6v6"/><path d="m19 5-9.5 9.5"/><path d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-7.2 18-3.7-7.3L3 10.1 21 3Z"/><path d="m10.1 13.7 4.1-4.1"/></svg>',
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h12v16l-6-3.6-6 3.6Z"/></svg>'
};

const catalogApi = {
  available: false,
  sessionId: createPlaybackSessionId()
};
let playerTrackingStop = null;
let shortTrackingStop = null;

function createPlaybackSessionId() {
  const key = 'sakhatube-playback-session';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function canUseCatalogApi() {
  return window.location.protocol === 'https:' || window.location.protocol === 'http:';
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function safeMediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, window.location.href);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function pickText(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function mediaValue(item, key) {
  const sources = [item, item.media, item.video, item.stream, item.playback].filter((value) => value && typeof value === 'object');
  return pickText(...sources.map((source) => source[key]));
}

function mapPublicContent(item, index = 0) {
  if (!item || typeof item !== 'object') return null;
  const title = pickText(item.title, item.name);
  if (!title) return null;
  const kind = pickText(item.kind, item.type).toLowerCase();
  const access = pickText(item.access, item.accessType).toLowerCase();
  const episodes = Number.isFinite(item.episodes) ? item.episodes : Number(item.episodeCount);
  const accessLabel = { free: 'Бесплатно', subscription: 'По подписке', purchase: 'Покупка' }[access] || 'Видео';
  const episodeLabel = Number.isFinite(episodes) && episodes > 0 ? ` · ${episodes} ${episodes === 1 ? 'серия' : 'серий'}` : '';
  const posterUrl = safeMediaUrl(pickText(
    item.posterUrl,
    item.thumbnailUrl,
    item.coverUrl,
    typeof item.poster === 'string' ? item.poster : '',
    mediaValue(item, 'posterUrl'),
    mediaValue(item, 'thumbnailUrl')
  ));
  const mp4 = safeMediaUrl(pickText(item.mp4, item.mp4Url, item.mediaUrl, mediaValue(item, 'mp4'), mediaValue(item, 'mp4Url'), mediaValue(item, 'url')));
  const hls = safeMediaUrl(pickText(item.hls, item.hlsUrl, item.manifestUrl, mediaValue(item, 'hls'), mediaValue(item, 'hlsUrl'), mediaValue(item, 'manifestUrl')));
  const contentId = pickText(item.id, item.contentId);
  return {
    contentId,
    title,
    meta: pickText(item.meta, item.subtitle, `${accessLabel}${episodeLabel}`),
    poster: `poster-${['one', 'two', 'three', 'four', 'five'][index % 5]}`,
    posterUrl,
    genre: pickText(item.genre, item.category, kind === 'clip' ? 'Клипы' : 'Видео'),
    mp4,
    hls,
    playerMeta: pickText(item.playerMeta, item.label, kind ? kind.toUpperCase() : '', accessLabel.toUpperCase()) || 'ВИДЕО'
  };
}

function isPublicShort(item) {
  const kind = pickText(item?.kind, item?.type, item?.format).toLowerCase();
  const ratio = pickText(item?.aspectRatio, item?.ratio).replaceAll(' ', '');
  return item?.isShort === true || ['clip', 'short', 'shorts'].includes(kind) || ratio === '9:16';
}

function mapPublicShort(item, index) {
  const content = mapPublicContent(item, index);
  if (!content) return null;
  return {
    ...content,
    category: pickText(item.category, item.genre, content.playerMeta, 'КЛИП').toUpperCase(),
    text: pickText(item.synopsis, item.description, item.summary, 'Короткий фрагмент большой истории.'),
    likes: pickText(String(item.likes || ''), item.likesLabel, '—'),
    comments: pickText(String(item.comments || ''), item.commentsLabel, '—'),
    tone: ['linear-gradient(160deg,#17283c,#09111c 48%,#293e57)', 'linear-gradient(160deg,#3e2b1f,#10151a 48%,#1c5265)'][index % 2],
    poster: content.posterUrl
  };
}

function resolveCatalogEntries(payload) {
  const initialItems = Array.isArray(payload?.items) ? payload.items.filter((item) => item && typeof item === 'object') : [];
  const byId = new Map(initialItems.map((item) => [String(item.id ?? item.contentId ?? ''), item]).filter(([id]) => id));
  const resolveItem = (entry) => {
    if (entry && typeof entry === 'object') return entry;
    return byId.get(String(entry)) || null;
  };
  const shelfItems = Array.isArray(payload?.shelves)
    ? payload.shelves.flatMap((shelf) => {
      if (Array.isArray(shelf)) return shelf.map(resolveItem);
      const entries = Array.isArray(shelf?.items) ? shelf.items : (Array.isArray(shelf?.contentIds) ? shelf.contentIds : []);
      return entries.map(resolveItem);
    })
    : [];
  const hero = resolveItem(payload?.hero?.item ?? payload?.hero?.content ?? payload?.hero);
  const unique = new Map();
  [hero, ...shelfItems, ...initialItems].filter(Boolean).forEach((item) => {
    const key = String(item.id ?? item.contentId ?? item.title ?? item.name ?? unique.size);
    if (!unique.has(key)) unique.set(key, item);
  });
  return { hero, items: [...unique.values()] };
}

function applyPublicCatalog(payload) {
  const { hero, items } = resolveCatalogEntries(payload);
  const mapped = items.map(mapPublicContent).filter(Boolean);
  if (!mapped.length) return false;
  const mappedHero = mapPublicContent(hero);
  const ordered = mappedHero
    ? [mappedHero, ...mapped.filter((item) => item.contentId !== mappedHero.contentId || item.title !== mappedHero.title)]
    : mapped;
  shows.splice(0, shows.length, ...ordered);
  const remoteShorts = items.filter(isPublicShort).map(mapPublicShort).filter(Boolean);
  if (remoteShorts.length) shorts.splice(0, shorts.length, ...remoteShorts);
  currentCarousel = 0;
  currentShort = Math.min(currentShort, Math.max(shorts.length - 1, 0));
  return true;
}

function setCatalogSourceStatus(state) {
  const node = document.querySelector('#catalog-source-status');
  if (!node) return;
  if (state === 'live') {
    node.hidden = true;
    return;
  }
  node.textContent = state === 'file' ? 'Демо-режим' : 'Локальный каталог';
  node.hidden = false;
}

async function loadPublicCatalog() {
  if (!canUseCatalogApi()) {
    setCatalogSourceStatus('file');
    return false;
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch('/v1/catalog/home', {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`catalog_${response.status}`);
    const payload = await response.json();
    if (!applyPublicCatalog(payload)) throw new Error('catalog_empty');
    catalogApi.available = true;
    setCatalogSourceStatus('live');
    applyLocale();
    renderShort();
    startCarousel();
    return true;
  } catch {
    catalogApi.available = false;
    setCatalogSourceStatus('fallback');
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function reportPlayback(contentId, event, extra = {}) {
  if (!catalogApi.available || !contentId) return;
  const payload = {
    contentId,
    sessionId: catalogApi.sessionId,
    event,
    ...extra
  };
  void fetch('/v1/events/playback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function attachPlaybackTracking(video, contentId) {
  if (!catalogApi.available || !contentId || !video) return () => {};
  const controller = new AbortController();
  const { signal } = controller;
  let firstFrameSent = false;
  let buffering = false;
  const position = () => ({ positionMs: Math.max(0, Math.floor((video.currentTime || 0) * 1000)) });
  const sendBuffer = () => {
    if (buffering || video.ended) return;
    buffering = true;
    reportPlayback(contentId, 'buffer_start', position());
  };
  reportPlayback(contentId, 'intent', position());
  video.addEventListener('playing', () => {
    if (!firstFrameSent) {
      firstFrameSent = true;
      reportPlayback(contentId, 'first_frame', position());
    }
    if (buffering) {
      buffering = false;
      reportPlayback(contentId, 'buffer_end', position());
    }
  }, { signal });
  video.addEventListener('waiting', sendBuffer, { signal });
  video.addEventListener('stalled', sendBuffer, { signal });
  video.addEventListener('error', () => {
    reportPlayback(contentId, 'error', { ...position(), errorCode: `media_${video.error?.code || 'unknown'}` });
  }, { signal });
  video.addEventListener('ended', () => reportPlayback(contentId, 'complete', position()), { signal });
  return () => controller.abort();
}

const locales = {
  ru: {
    label: 'Русский',
    'nav.home': 'Главная', 'nav.catalog': 'Каталог', 'nav.foryou': 'Для вас', 'nav.offline': 'Офлайн', 'nav.profile': 'Профиль',
    'brand.tagline': 'Истории, которые хочется досмотреть.', 'search.placeholder': 'Найти сериал или героя',
    'home.premieres': 'Премьеры', 'home.catalogEyebrow': 'КАТАЛОГ', 'home.categories': 'Категории', 'home.viewAll': 'Открыть каталог →',
    'home.continueEyebrow': 'ПРОДОЛЖИТЬ', 'home.keepMoment': 'Продолжить просмотр', 'home.allStory': 'В каталог →',
    'home.forYouEyebrow': 'ДЛЯ ТЕБЯ', 'home.newStories': 'Выбрать на вечер', 'home.all': 'Все новинки →',
    'catalog.eyebrow': 'КАТАЛОГ', 'catalog.title': 'Найди историю под настроение', 'catalog.description': 'Сериалы, шоу и короткие видео.<span>Всё на своём месте.</span>',
    'foryou.eyebrow': 'ПЕРСОНАЛЬНАЯ ЛЕНТА', 'foryou.title': 'Для<br /><em>вас.</em>', 'foryou.description': 'Смотри дальше без поиска.<span>Сцены, тизеры и эпизоды по твоим интересам.</span>',
    'downloads.eyebrow': 'ОФЛАЙН', 'downloads.title': 'Загрузки', 'downloads.description': 'Смотри без сети.<span>В дороге, в самолёте, где угодно.</span>',
    'profile.eyebrow': 'МОЙ ПРОФИЛЬ', 'profile.settings': 'Настроить', 'profile.summary': 'Локальный профиль на этом устройстве',
    premiere: 'ПРЕМЬЕРА', all: 'Все', 'toast.language': 'Язык интерфейса: {language}', 'toast.settings': 'Настройки профиля сохранены'
  },
  en: {
    label: 'English',
    'nav.home': 'Home', 'nav.catalog': 'Catalog', 'nav.foryou': 'For you', 'nav.offline': 'Offline', 'nav.profile': 'Profile',
    'brand.tagline': 'Stories worth finishing.', 'search.placeholder': 'Find a series or character',
    'home.premieres': 'Premieres', 'home.catalogEyebrow': 'CATALOG', 'home.categories': 'Categories', 'home.viewAll': 'Open catalog →',
    'home.continueEyebrow': 'CONTINUE', 'home.keepMoment': 'Continue watching', 'home.allStory': 'Go to catalog →',
    'home.forYouEyebrow': 'FOR YOU', 'home.newStories': 'Pick for tonight', 'home.all': 'See new releases →',
    'catalog.eyebrow': 'CATALOG', 'catalog.title': 'Find a story for your mood', 'catalog.description': 'Series, shows, and short videos.<span>Everything in its place.</span>',
    'foryou.eyebrow': 'PERSONAL FEED', 'foryou.title': 'For<br /><em>you.</em>', 'foryou.description': 'Keep watching without searching.<span>Scenes, teasers, and episodes picked for you.</span>',
    'downloads.eyebrow': 'OFFLINE', 'downloads.title': 'Downloads', 'downloads.description': 'Watch offline.<span>On the road, in the air, anywhere.</span>',
    'profile.eyebrow': 'MY PROFILE', 'profile.settings': 'Settings', 'profile.summary': 'Local profile on this device',
    premiere: 'PREMIERE', all: 'All', 'toast.language': 'Interface language: {language}', 'toast.settings': 'Profile settings saved'
  },
  sah: {
    label: 'Саха тыла',
    'nav.home': 'Сүрүн', 'nav.catalog': 'Бөлөх', 'nav.foryou': 'Эйиэхэ', 'nav.offline': 'Оффлайн', 'nav.profile': 'Профиль',
    'home.categories': 'Бөлөх'
  }
};

const defaultProfile = { name: 'Гость', language: 'ru', avatar: '', autoplay: true, dataSaver: false };
const recommendationNode = document.querySelector('#recommendations');
const catalogNode = document.querySelector('#catalog-grid');
const chipsNode = document.querySelector('#genre-chips');
const player = document.querySelector('#player-dialog');
const playerTitle = document.querySelector('#player-title');
const playerMeta = document.querySelector('#player-meta');
const playerVideo = document.querySelector('#player-video');
const playerPoster = document.querySelector('#player-poster');
const playerEmptyCopy = document.querySelector('#player-empty-copy');
const playerStage = document.querySelector('#player-stage');
const playerControls = document.querySelector('#player-controls');
const playerToggle = document.querySelector('#player-toggle');
const playerMute = document.querySelector('#player-mute');
const playerFullscreen = document.querySelector('#player-fullscreen');
const notificationsDialog = document.querySelector('#notifications-dialog');
const settingsDialog = document.querySelector('#settings-dialog');
const actionDialog = document.querySelector('#action-dialog');
const accountDialog = document.querySelector('#account-dialog');
const commentsDialog = document.querySelector('#comments-dialog');
const settingsForm = document.querySelector('#settings-form');
const accountForm = document.querySelector('#account-form');
const commentForm = document.querySelector('#comment-form');
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
let shortTouchStartY = null;
let shortWheelTotal = 0;

const playerIcons = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6Z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l4 3V7l-4 3H4Zm11.5-.5a4 4 0 0 1 0 5m2.7-7.3a7 7 0 0 1 0 9.6"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l4 3V7l-4 3H4ZM16 9l4 6m0-6-4 6"/></svg>'
};

function setPlayerControlIcon(button, icon, label) {
  button.innerHTML = playerIcons[icon];
  button.setAttribute('aria-label', label);
}
let lastShortChangeAt = 0;
let shortCleanTimer;
let profile = loadProfile();
let viewerAuth = loadViewerAuth();
let pendingAvatar;
let activeCommentsContentId = '';
let loadedComments = [];
const pendingCommentsByContent = new Map();
const communityRulesVersion = '2026-07-16';
let viewerRefreshPromise = null;

function loadViewerAuth() {
  try {
    const saved = JSON.parse(localStorage.getItem('sakhatube-viewer-auth') || 'null');
    if (!saved?.accessToken || !saved?.refreshToken || !saved?.viewer?.id) return null;
    return saved;
  } catch {
    return null;
  }
}

function saveViewerAuth(next) {
  viewerAuth = next?.accessToken && next?.refreshToken && next?.viewer?.id ? next : null;
  try {
    if (viewerAuth) localStorage.setItem('sakhatube-viewer-auth', JSON.stringify(viewerAuth));
    else localStorage.removeItem('sakhatube-viewer-auth');
  } catch {
    // The interface remains usable when private browsing blocks local storage.
  }
}

function viewerDisplayId(id) {
  return `ID · ${String(id).toUpperCase()}`;
}

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
    if (['foryou.title', 'foryou.description', 'catalog.description', 'downloads.description'].includes(node.dataset.i18n)) node.innerHTML = value;
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
  try {
    localStorage.setItem('sakhatube-profile', JSON.stringify(profile));
  } catch {
    // Private browsing may deny storage; keep the profile for this session.
  }
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

function playbackData(show) {
  const attributes = [];
  if (show.contentId) attributes.push(`data-content-id="${escapeHTML(show.contentId)}"`);
  if (show.mp4) attributes.push(`data-mp4="${escapeHTML(show.mp4)}"`);
  if (show.hls) attributes.push(`data-hls="${escapeHTML(show.hls)}"`);
  if (show.posterUrl) attributes.push(`data-poster="${escapeHTML(show.posterUrl)}"`);
  if (show.playerMeta) attributes.push(`data-player-meta="${escapeHTML(show.playerMeta)}"`);
  return attributes.length ? ` ${attributes.join(' ')}` : '';
}

function posterStyle(show) {
  return show.posterUrl ? ` style="background-image:linear-gradient(180deg,transparent 42%,rgba(4,6,10,.72)),url('${encodeURI(show.posterUrl).replaceAll("'", '%27')}')"` : '';
}

function mediaCard(show) {
  return `<button class="media-card play-button" data-title="${escapeHTML(show.title)}"${playbackData(show)} type="button"><div class="card-poster ${escapeHTML(show.poster)}"${posterStyle(show)}><span>${escapeHTML(show.genre.toUpperCase())}</span></div><h3>${escapeHTML(show.title)}</h3><p>${escapeHTML(show.meta)}</p></button>`;
}

function renderCatalog() {
  const visibleShows = activeGenre === 'Все' ? shows : shows.filter((show) => show.genre === activeGenre);
  catalogNode.innerHTML = visibleShows.map(mediaCard).join('');
}

function homeCard(show) {
  return mediaCard(show);
}

function renderHomeFeatured() {
  const visibleShows = homeGenre === 'Все' ? shows.slice(0, 6) : shows.filter((show) => show.genre === homeGenre).slice(0, 6);
  homeFeaturedNode.innerHTML = visibleShows.map(homeCard).join('');
  homeGenreNode.innerHTML = ['Все', ...new Set(shows.map((show) => show.genre))].map((genre) => `<button class="${genre === homeGenre ? 'is-active' : ''}" data-home-genre="${escapeHTML(genre)}" type="button">${genre === 'Все' ? t('all') : escapeHTML(genre)}</button>`).join('');
}

function renderCarousel() {
  carouselNode.innerHTML = shows.slice(0, 5).map((show, index) => `<button class="carousel-slide ${index === currentCarousel ? 'is-current' : ''}" data-carousel-index="${index}" data-title="${escapeHTML(show.title)}"${playbackData(show)} type="button"><div class="carousel-cover ${escapeHTML(show.poster)}"${posterStyle(show)}><span>${t('premiere')}</span><div class="carousel-copy"><p>${escapeHTML(show.genre)}</p><h2>${escapeHTML(show.title)}</h2><small>${escapeHTML(show.meta)}</small></div></div></button>`).join('');
  carouselDots.innerHTML = shows.slice(0, 5).map((show, index) => `<button class="${index === currentCarousel ? 'is-current' : ''}" data-carousel-dot="${index}" type="button" aria-label="${escapeHTML(`${t('home.premieres')}: ${show.title}`)}"></button>`).join('');
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
  chipsNode.innerHTML = genres.map((genre) => `<button class="chip ${genre === activeGenre ? 'is-active' : ''}" data-genre="${escapeHTML(genre)}" type="button">${genre === 'Все' ? t('all') : escapeHTML(genre)}</button>`).join('');
}

function renderProfile() {
  const displayName = viewerAuth?.viewer?.displayName || profile.name.trim() || defaultProfile.name;
  const initial = [...displayName][0].toLocaleUpperCase();
  document.querySelectorAll('[data-profile-name]').forEach((node) => { node.textContent = displayName; });
  document.querySelectorAll('[data-profile-initial], .avatar-button').forEach((node) => {
    const hasImage = Boolean(profile.avatar);
    node.textContent = hasImage ? '' : initial;
    node.style.backgroundImage = hasImage ? `url("${profile.avatar}")` : '';
    node.classList.toggle('has-image', hasImage);
  });
  document.querySelectorAll('[data-profile-summary]').forEach((node) => {
    node.textContent = viewerAuth?.viewer?.username ? `@${viewerAuth.viewer.username}` : `${languageLabel()} · ${t('profile.summary')}`;
  });
  document.querySelectorAll('[data-profile-user-id]').forEach((node) => {
    const id = viewerAuth?.viewer?.id;
    node.hidden = !id;
    node.textContent = id ? viewerDisplayId(id) : '';
  });
  document.querySelectorAll('[data-account-button]').forEach((node) => {
    node.textContent = viewerAuth?.viewer ? 'Аккаунт' : 'Войти';
  });
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
  const layout = document.querySelector('.shorts-layout');
  const previousVideo = stage.querySelector('video');
  shortTrackingStop?.();
  shortTrackingStop = null;
  if (previousVideo) {
    previousVideo.pause();
    previousVideo.removeAttribute('src');
    previousVideo.load();
  }
  window.clearTimeout(shortCleanTimer);
  stage.classList.remove('is-clean', 'is-paused');
  stage.style.background = short.tone;
  layout.style.setProperty('--short-backdrop', `url("${encodeURI(short.poster).replaceAll('"', '%22')}")`);
  const video = short.mp4 ? `<video class="short-video" src="${escapeHTML(short.mp4)}" poster="${escapeHTML(short.poster)}" autoplay muted loop playsinline preload="auto"></video>` : '';
  stage.innerHTML = `${video}<div class="short-topbar"><button data-short-action="exit" type="button" aria-label="Выйти из раздела Для вас">${shortIcons.back}</button><span>Для вас</span></div><div class="short-top-actions"><button data-short-action="sound" type="button" aria-label="Включить звук">${shortIcons.soundOff}</button></div><div class="short-actions"><button data-short-action="like" type="button" aria-label="Нравится"><b>${shortIcons.heart}</b><small>${escapeHTML(short.likes)}</small></button><button data-short-action="comments" type="button" aria-label="Комментарии"><b>${shortIcons.comment}</b><small>${escapeHTML(short.comments)}</small></button><button data-short-action="repost" type="button" aria-label="Сделать репост"><b>${shortIcons.repost}</b><small>Репост</small></button><button data-short-action="share" type="button" aria-label="Отправить"><b>${shortIcons.send}</b><small>Отправить</small></button><button data-short-action="more" type="button" aria-label="Дополнительно"><b>${shortIcons.more}</b><small>Ещё</small></button><button class="short-author" data-short-action="author" type="button" aria-label="Открыть автора"><img src="${escapeHTML(short.poster)}" alt="" /></button></div><div class="short-content"><span class="short-category">${escapeHTML(short.category)}</span><h2>${escapeHTML(short.title)}</h2><p>${escapeHTML(short.text)}</p><span class="short-hint">Нажми — пауза · свайпни вверх</span></div>`;
  document.querySelector('#shorts-counter').textContent = `${String(currentShort + 1).padStart(2, '0')} / ${String(shorts.length).padStart(2, '0')}`;
  const next = shorts[(currentShort + 1) % shorts.length];
  const preloader = document.querySelector('#short-preload');
  preloader.src = next.mp4;
  preloader.load();
  const activeVideo = stage.querySelector('.short-video');
  if (activeVideo) {
    shortTrackingStop = attachPlaybackTracking(activeVideo, short.contentId);
    void activeVideo.play().catch(() => {});
  }
  shortCleanTimer = window.setTimeout(() => stage.classList.add('is-clean'), 3600);
}

function changeShort(direction) {
  currentShort = (currentShort + direction + shorts.length) % shorts.length;
  lastShortChangeAt = Date.now();
  renderShort();
}

function stopPlayer() {
  playerTrackingStop?.();
  playerTrackingStop = null;
  playerVideo.pause();
  playerVideo.removeAttribute('src');
  playerVideo.load();
  playerVideo.hidden = true;
  playerPoster.hidden = false;
  playerControls.hidden = true;
}

function openPlayer(title, source = {}) {
  playerTrackingStop?.();
  playerTrackingStop = null;
  playerTitle.textContent = title;
  const playbackUrl = source.mp4 || source.hls;
  playerMeta.textContent = source.playerMeta || 'ОБРАБОТКА ВИДЕО';
  if (playbackUrl) {
    // Mobile browsers permit immediate playback only when it starts muted.
    // Keep the real poster above the video until the first playing event so
    // the viewer never sees an empty black rectangle while media starts.
    const posterUrl = safeMediaUrl(source.poster);
    playerStage.style.setProperty('--player-backdrop', posterUrl ? `url("${encodeURI(posterUrl).replaceAll('"', '%22')}")` : '');
    playerPoster.style.backgroundImage = posterUrl
      ? `linear-gradient(180deg,rgba(4,6,10,.12),rgba(4,6,10,.68)),url("${encodeURI(posterUrl).replaceAll('"', '%22')}")`
      : '';
    playerPoster.hidden = false;
    playerEmptyCopy.textContent = 'Подготавливаем видео…';
    playerVideo.muted = true;
    setPlayerControlIcon(playerMute, 'soundOff', 'Включить звук');
    playerVideo.src = playbackUrl;
    playerVideo.hidden = false;
    playerControls.hidden = false;
    openDialog(player);
    playerTrackingStop = attachPlaybackTracking(playerVideo, source.contentId);
    void playerVideo.play().catch(() => {});
    return;
  } else {
    stopPlayer();
    playerEmptyCopy.textContent = 'Видео ещё обрабатывается. Вернись чуть позже.';
  }
  openDialog(player);
}

function openPlayerFrom(element) {
  const title = element.dataset.title || 'После полуночи';
  openPlayer(title, {
    hls: element.dataset.hls,
    mp4: element.dataset.mp4,
    poster: element.dataset.poster,
    playerMeta: element.dataset.playerMeta,
    contentId: element.dataset.contentId
  });
}

function navigate(route) {
  const shortsVideo = document.querySelector('#shorts-stage .short-video');
  if (route !== 'foryou') shortsVideo?.pause();
  document.body.classList.toggle('is-shorts-mode', route === 'foryou');
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

function setAccountMode(mode) {
  const register = mode === 'register';
  const firebaseEnabled = window.SakhaTubeFirebaseAuth?.enabled === true;
  accountDialog.dataset.mode = register ? 'register' : 'login';
  accountDialog.querySelectorAll('[data-account-mode]').forEach((button) => {
    const active = button.dataset.accountMode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  accountDialog.querySelectorAll('.account-register-field').forEach((field) => { field.hidden = !register; });
  accountDialog.querySelectorAll('.account-login-field').forEach((field) => { field.hidden = register; });
  const loginLabel = document.querySelector('.account-login-field');
  if (loginLabel?.firstChild) loginLabel.firstChild.textContent = firebaseEnabled ? 'E-mail' : 'Логин или e-mail';
  const loginInput = document.querySelector('#account-login');
  if (loginInput) {
    loginInput.type = firebaseEnabled ? 'email' : 'text';
    loginInput.inputMode = firebaseEnabled ? 'email' : 'text';
  }
  const displayNameInput = document.querySelector('#account-display-name');
  if (displayNameInput) displayNameInput.required = register;
  const usernameField = document.querySelector('#account-username')?.closest('label');
  if (usernameField) usernameField.hidden = !register;
  document.querySelector('#account-title').textContent = register ? 'Создать аккаунт' : 'Войти';
  document.querySelector('#account-submit').textContent = register ? 'Создать аккаунт' : 'Войти';
  document.querySelector('#account-password').setAttribute('autocomplete', register ? 'new-password' : 'current-password');
  document.querySelector('#account-recovery').hidden = register || !firebaseEnabled;
  document.querySelector('#account-social').hidden = register || !firebaseEnabled;
  document.querySelector('#account-hint').textContent = firebaseEnabled
    ? (register ? 'Укажите имя, логин, e-mail и пароль. Подтвердите e-mail, затем войдите — ID появится после входа.' : 'Введите e-mail и пароль.')
    : register
    ? 'Придумайте логин и пароль. E-mail нужен только для подтверждения и восстановления. Постоянный ID появится после подтверждения аккаунта.'
    : 'Введите логин и пароль. Для ранних аккаунтов работает также e-mail.';
  const error = document.querySelector('#account-error');
  error.hidden = true;
  error.textContent = '';
}

function openAccountDialog() {
  if (viewerAuth?.viewer) {
    openAction('Вы уже вошли', `@${viewerAuth.viewer.username || viewerAuth.viewer.email}\n${viewerDisplayId(viewerAuth.viewer.id)}`, 'АККАУНТ');
    return;
  }
  accountForm.reset();
  setAccountMode('login');
  openDialog(accountDialog);
}

async function submitAccount(event) {
  event.preventDefault();
  const mode = accountDialog.dataset.mode || 'login';
  const login = document.querySelector('#account-login').value.trim();
  const username = document.querySelector('#account-username').value.trim();
  const email = document.querySelector('#account-email').value.trim().toLowerCase();
  const password = document.querySelector('#account-password').value;
  const displayName = document.querySelector('#account-display-name').value.trim();
  const firebaseEnabled = window.SakhaTubeFirebaseAuth?.enabled === true;
  const error = document.querySelector('#account-error');
  const submit = document.querySelector('#account-submit');
  error.hidden = true;
  error.textContent = '';
  if (!password || (mode === 'register' && (!displayName || !username || !email || password.length < 12)) || (mode === 'login' && !login)) {
    error.textContent = mode === 'register'
      ? 'Укажите имя, логин, e-mail и пароль минимум из 12 символов.'
      : (firebaseEnabled ? 'Укажите e-mail и пароль.' : 'Укажите логин и пароль.');
    error.hidden = false;
    return;
  }
  submit.disabled = true;
  submit.textContent = mode === 'register' ? 'Создаём…' : 'Входим…';
  try {
    const firebaseAuth = window.SakhaTubeFirebaseAuth;
    const useFirebase = firebaseEnabled;
    let payload;
    if (useFirebase) {
      const identity = mode === 'register'
        ? await firebaseAuth.register({ email, password, displayName: displayName || username })
        : await firebaseAuth.login({ email: login, password });
      if (mode === 'register') {
        try {
          const pending = await fetch('/v1/auth/firebase/register-pending', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ idToken: identity.idToken, username, displayName: displayName || username })
          });
          const pendingPayload = await pending.json().catch(() => ({}));
          if (!pending.ok) throw new Error(pendingPayload.message || 'Не удалось подготовить аккаунт. Попробуйте ещё раз.');
          payload = pendingPayload;
        } finally {
          // Registration is deliberately not a login. The user confirms the
          // e-mail, then signs in to receive a SakhaTube session.
          await firebaseAuth.logout();
        }
      } else {
        const exchange = await fetch('/v1/auth/firebase/exchange', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken: identity.idToken })
        });
        payload = await exchange.json().catch(() => ({}));
        if (!exchange.ok) throw new Error(payload.message || 'Не удалось войти. Подтвердите e-mail и попробуйте ещё раз.');
      }
    } else {
      const response = await fetch(`/v1/auth/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { email, username, password, displayName: displayName || undefined } : { login, password })
      });
      payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Не удалось выполнить запрос. Попробуйте ещё раз.');
    }
    if (mode === 'register') {
      document.querySelector('#account-password').value = '';
      error.textContent = payload.message || 'Проверьте e-mail и подтвердите аккаунт. После этого можно войти.';
      error.hidden = false;
      return;
    }
    saveViewerAuth(payload);
    profile = { ...profile, name: payload.viewer.displayName || profile.name };
    saveProfile();
    renderProfile();
    closeDialog(accountDialog);
    showToast(mode === 'register'
      ? `Аккаунт создан. ${viewerDisplayId(payload.viewer.id)}`
      : `Вы вошли. ${viewerDisplayId(payload.viewer.id)}`);
  } catch (requestError) {
    error.textContent = requestError.message || 'Не удалось выполнить запрос. Попробуйте ещё раз.';
    error.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = mode === 'register' ? 'Создать аккаунт' : 'Войти';
  }
}

async function requestPasswordRecovery() {
  const firebaseAuth = window.SakhaTubeFirebaseAuth;
  const login = document.querySelector('#account-login').value.trim();
  const error = document.querySelector('#account-error');
  if (!firebaseAuth?.enabled) return;
  if (!login) {
    error.textContent = 'Укажите e-mail — отправим ссылку для восстановления.';
    error.hidden = false;
    document.querySelector('#account-login').focus();
    return;
  }
  const recovery = document.querySelector('#account-recovery');
  recovery.disabled = true;
  try {
    await firebaseAuth.sendPasswordReset(login);
    // Use one message for existing and non-existing accounts so the recovery
    // control cannot be used to discover registered e-mail addresses.
    error.textContent = 'Если этот e-mail зарегистрирован, ссылка для восстановления уже отправлена.';
    error.hidden = false;
  } catch (requestError) {
    error.textContent = requestError.message || 'Не удалось отправить письмо. Попробуйте ещё раз.';
    error.hidden = false;
  } finally {
    recovery.disabled = false;
  }
}

async function signInWithApple() {
  const firebaseAuth = window.SakhaTubeFirebaseAuth;
  const error = document.querySelector('#account-error');
  const button = document.querySelector('#apple-sign-in');
  if (!firebaseAuth?.enabled) return;
  error.hidden = true;
  error.textContent = '';
  button.disabled = true;
  try {
    const identity = await firebaseAuth.loginWithApple();
    if (!identity) return;
    const exchange = await fetch('/v1/auth/firebase/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: identity.idToken, displayName: identity.displayName })
    });
    const payload = await exchange.json().catch(() => ({}));
    if (!exchange.ok) throw new Error(payload.message || 'Не удалось войти через Apple.');
    saveViewerAuth(payload);
    profile = { ...profile, name: payload.viewer.displayName || profile.name };
    saveProfile();
    renderProfile();
    closeDialog(accountDialog);
    showToast(`Вы вошли. ${viewerDisplayId(payload.viewer.id)}`);
  } catch (requestError) {
    error.textContent = requestError.message || 'Не удалось войти через Apple.';
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

async function restoreFirebaseViewer() {
  const firebaseAuth = window.SakhaTubeFirebaseAuth;
  if (!firebaseAuth?.enabled) return;
  try {
    const identity = await firebaseAuth.restore();
    if (!identity?.emailVerified) return;
    const exchange = await fetch('/v1/auth/firebase/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: identity.idToken })
    });
    const restored = await exchange.json().catch(() => null);
    if (!exchange.ok || !restored?.viewer) return;
    saveViewerAuth(restored);
    profile = { ...profile, name: restored.viewer.displayName || profile.name };
    saveProfile();
    renderProfile();
  } catch {
    // A Firebase network/configuration error must not block the local app.
  }
}

function openAction(title, copy, eyebrow = 'SAKHATUBE') {
  document.querySelector('#action-eyebrow').textContent = eyebrow;
  document.querySelector('#action-title').textContent = title;
  document.querySelector('#action-copy').textContent = copy;
  openDialog(actionDialog);
}

function viewerRequestHeaders() {
  return viewerAuth?.accessToken ? { authorization: `Bearer ${viewerAuth.accessToken}` } : {};
}

async function refreshViewerSession() {
  if (!viewerAuth?.refreshToken) return false;
  if (!viewerRefreshPromise) {
    viewerRefreshPromise = (async () => {
      try {
        const response = await fetch('/v1/auth/refresh', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ refreshToken: viewerAuth.refreshToken })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.accessToken || !payload?.refreshToken || !payload?.viewer) throw new Error('refresh_failed');
        saveViewerAuth(payload);
        profile = { ...profile, name: payload.viewer.displayName || profile.name };
        saveProfile();
        renderProfile();
        return true;
      } catch {
        saveViewerAuth(null);
        renderProfile();
        return false;
      } finally {
        viewerRefreshPromise = null;
      }
    })();
  }
  return viewerRefreshPromise;
}

async function viewerFetch(url, options = {}) {
  const send = () => fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...viewerRequestHeaders() },
    credentials: options.credentials || 'same-origin'
  });
  const initial = await send();
  if (initial.status !== 401 || !viewerAuth?.refreshToken || !await refreshViewerSession()) return initial;
  return send();
}

function needsCommunityRulesAcceptance() {
  return Boolean(viewerAuth?.viewer) && viewerAuth.viewer.communityRulesVersion !== communityRulesVersion;
}

async function acceptCommunityRules() {
  const response = await viewerFetch('/v1/community-rules/acceptance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version: communityRulesVersion, accepted: true })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.viewer) throw new Error(payload.message || 'Не удалось принять правила сообщества.');
  saveViewerAuth({ ...viewerAuth, viewer: payload.viewer });
  renderProfile();
}

function commentDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const sameDay = new Date().toDateString() === date.toDateString();
  return new Intl.DateTimeFormat('ru-RU', sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short' }).format(date);
}

function localPendingComments(contentId) {
  return pendingCommentsByContent.get(contentId) || [];
}

function setCommentsStatus(message) {
  const node = document.querySelector('#comments-status');
  if (node) node.textContent = message;
}

function renderComments() {
  const list = document.querySelector('#comments-list');
  const formHint = document.querySelector('#comment-form-hint');
  const text = document.querySelector('#comment-text');
  const submit = document.querySelector('#comment-submit');
  const consent = document.querySelector('#comment-rules-consent');
  const consentInput = document.querySelector('#comment-rules-input');
  if (!list || !formHint || !text || !submit) return;
  const pending = localPendingComments(activeCommentsContentId);
  const items = [...pending, ...loadedComments];
  list.innerHTML = items.length
    ? items.map((comment) => {
      const ownPending = comment.pending === true;
      const actions = ownPending
        ? `<button type="button" data-comment-delete="${escapeHTML(comment.id)}" aria-label="Удалить комментарий">Удалить</button>`
        : `<button type="button" data-comment-report="${escapeHTML(comment.id)}" aria-label="Пожаловаться на комментарий">Жалоба</button>`;
      return `<article class="comment-item"><div><span class="comment-author">${escapeHTML(comment.authorName)}</span><span class="comment-meta">${escapeHTML(commentDate(comment.createdAt))}</span><p class="comment-text">${escapeHTML(comment.text)}</p>${ownPending ? '<span class="comment-pending">На модерации — его видите только вы.</span>' : ''}</div><div class="comment-item-actions">${actions}</div></article>`;
    }).join('')
    : '<p class="comments-empty">Пока нет комментариев. Будьте первым, кто начнёт обсуждение.</p>';

  const signedIn = Boolean(viewerAuth?.accessToken);
  const needsRules = signedIn && needsCommunityRulesAcceptance();
  text.disabled = !signedIn;
  text.placeholder = signedIn ? 'Напишите комментарий' : 'Войдите, чтобы написать комментарий';
  submit.disabled = false;
  submit.textContent = signedIn ? 'Отправить' : 'Войти';
  if (consent) consent.hidden = !needsRules;
  if (!needsRules && consentInput) consentInput.checked = false;
  formHint.textContent = signedIn
    ? (needsRules ? 'Прими правила сообщества перед первой публикацией.' : 'Комментарий появится после модерации.')
    : 'Войдите в аккаунт, чтобы участвовать в обсуждении.';
}

async function loadComments() {
  if (!activeCommentsContentId) return;
  setCommentsStatus('Загружаем комментарии…');
  loadedComments = [];
  renderComments();
  if (!canUseCatalogApi()) {
    setCommentsStatus('Комментарии доступны в опубликованной версии SakhaTube.');
    return;
  }
  try {
    const response = await fetch(`/v1/content/${encodeURIComponent(activeCommentsContentId)}/comments?limit=50`, {
      headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Не удалось загрузить комментарии.');
    loadedComments = Array.isArray(payload.items) ? payload.items : [];
    setCommentsStatus(loadedComments.length ? `Комментарии · ${loadedComments.length}` : 'Комментарии');
  } catch (error) {
    setCommentsStatus(error.message || 'Не удалось загрузить комментарии. Попробуйте ещё раз.');
  }
  renderComments();
}

async function openShortComments(short) {
  activeCommentsContentId = short.contentId || 'cc-shorts';
  document.querySelector('#comments-title').textContent = `Комментарии · ${short.title}`;
  const text = document.querySelector('#comment-text');
  if (text) text.value = '';
  openDialog(commentsDialog);
  await loadComments();
}

async function submitComment(event) {
  event.preventDefault();
  if (!viewerAuth?.accessToken) {
    closeDialog(commentsDialog);
    openAccountDialog();
    return;
  }
  const text = document.querySelector('#comment-text');
  const submit = document.querySelector('#comment-submit');
  const value = text?.value.trim();
  if (!value) {
    setCommentsStatus('Напишите комментарий перед отправкой.');
    text?.focus();
    return;
  }
  if (needsCommunityRulesAcceptance()) {
    const consent = document.querySelector('#comment-rules-input');
    if (!consent?.checked) {
      setCommentsStatus('Прими правила сообщества перед первой публикацией.');
      consent?.focus();
      return;
    }
  }
  submit.disabled = true;
  submit.textContent = 'Отправляем…';
  try {
    if (needsCommunityRulesAcceptance()) await acceptCommunityRules();
    const response = await viewerFetch(`/v1/content/${encodeURIComponent(activeCommentsContentId)}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: value })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Не удалось отправить комментарий.');
    const pending = localPendingComments(activeCommentsContentId);
    pending.unshift({ ...payload.item, pending: true });
    pendingCommentsByContent.set(activeCommentsContentId, pending);
    text.value = '';
    setCommentsStatus('Комментарий отправлен на модерацию.');
    showToast('Комментарий отправлен на модерацию');
  } catch (error) {
    setCommentsStatus(error.message || 'Не удалось отправить комментарий.');
  } finally {
    renderComments();
  }
}

async function deletePendingComment(id) {
  try {
    const response = await viewerFetch(`/v1/comments/${encodeURIComponent(id)}/delete`, {
      method: 'POST'
    });
    if (!response.ok && response.status !== 404) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || 'Не удалось удалить комментарий.');
    }
    pendingCommentsByContent.set(activeCommentsContentId, localPendingComments(activeCommentsContentId).filter((item) => item.id !== id));
    setCommentsStatus('Комментарий удалён.');
    renderComments();
  } catch (error) {
    setCommentsStatus(error.message || 'Не удалось удалить комментарий.');
  }
}

async function reportComment(id) {
  if (!viewerAuth?.accessToken) {
    closeDialog(commentsDialog);
    openAccountDialog();
    return;
  }
  if (!window.confirm('Отправить жалобу на этот комментарий?')) return;
  try {
    const response = await viewerFetch(`/v1/comments/${encodeURIComponent(id)}/report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'abuse' })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Не удалось отправить жалобу.');
    setCommentsStatus('Жалоба отправлена на проверку.');
    showToast('Жалоба отправлена');
  } catch (error) {
    setCommentsStatus(error.message || 'Не удалось отправить жалобу.');
  }
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
      openAction('Нулевая точка', 'Драма, 12 серий. Первые две серии доступны без подписки. Здесь будут трейлер, все эпизоды и условия доступа.', 'СЕРИАЛ');
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
      openAction('SakhaTube Plus', 'Подписка ещё не запущена. Когда платежи Apple и Google будут подключены, здесь появятся тарифы, восстановление покупок и история платежей.', 'СКОРО');
      break;
    case 'account':
      openAccountDialog();
      break;
    case 'continue':
      openPlayer(shows[0].title, shows[0]);
      break;
    case 'history':
      openAction('История просмотров', 'Продолжай с того же места на любом устройстве. История станет доступна после входа в аккаунт.', 'БИБЛИОТЕКА');
      break;
    case 'saved':
      openAction('Сохранённое', 'Избранное, «на потом» и сохранённые видео будут собраны в одном месте.', 'БИБЛИОТЕКА');
      break;
    case 'security':
      openAction('Безопасность и устройства', 'Здесь можно будет посмотреть активные устройства, завершить сеанс и изменить способ входа.', 'БЕЗОПАСНОСТЬ');
      break;
    case 'download-actions':
      openAction('Загрузка «После полуночи»', 'Пауза, качество и удаление файла. Офлайн-доступ проверяется перед просмотром.', 'ОФЛАЙН');
      break;
    default:
      if (trigger) showToast('Раздел появится в следующем обновлении.');
  }
}

async function handleShortAction(action, button) {
  const short = shorts[currentShort];
  if (action === 'like') {
    const isActive = button.classList.toggle('is-active');
    button.querySelector('b').setAttribute('aria-hidden', 'true');
    showToast(isActive ? 'Добавлено в избранное' : 'Убрано из избранного');
  }
  if (action === 'save') {
    const isActive = button.classList.toggle('is-active');
    button.querySelector('b').setAttribute('aria-hidden', 'true');
    showToast(isActive ? 'Сохранено на потом' : 'Убрано из сохранённого');
  }
  if (action === 'comments') await openShortComments(short);
  if (action === 'repost') {
    button.classList.toggle('is-active');
    showToast(button.classList.contains('is-active') ? 'Репост добавлен в ваш профиль' : 'Репост убран из профиля');
  }
  if (action === 'author') openAction('Blender Open Movies', 'Официальный автор открытого фильма. Лицензия и источник указаны в карточке видео.', 'АВТОР');
  if (action === 'more') openAction('Настроить рекомендации', 'Можно скрыть ролик, пожаловаться или убрать похожие материалы из ленты.', 'ДЛЯ ВАС');
  if (action === 'sound') {
    const video = document.querySelector('#shorts-stage .short-video');
    if (!video) return;
    video.muted = !video.muted;
    button.innerHTML = video.muted ? shortIcons.soundOff : shortIcons.soundOn;
    button.setAttribute('aria-label', video.muted ? 'Включить звук' : 'Выключить звук');
    showToast(video.muted ? 'Звук выключен' : 'Звук включён');
  }
  if (action === 'exit') navigate('home');
  if (action === 'share') {
    const shareData = { title: short.title, text: `SakhaTube · ${short.title}`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else if (navigator.clipboard) await navigator.clipboard.writeText(window.location.href);
      showToast('Можно отправлять');
    } catch (error) {
      if (error.name !== 'AbortError') showToast('Не удалось открыть меню отправки');
    }
  }
}

recommendationNode.innerHTML = shows.slice(0, 5).map(mediaCard).join('');
applyLocale();
renderShort();
startCarousel();
void loadPublicCatalog();
void restoreFirebaseViewer();

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

  const commentDelete = event.target.closest('[data-comment-delete]');
  if (commentDelete) {
    void deletePendingComment(commentDelete.dataset.commentDelete);
    return;
  }

  const commentReport = event.target.closest('[data-comment-report]');
  if (commentReport) {
    void reportComment(commentReport.dataset.commentReport);
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
    openPlayerFrom(carouselButton);
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
    openPlayerFrom(playButton);
    return;
  }

  const genreButton = event.target.closest('[data-genre]');
  if (genreButton) {
    activeGenre = genreButton.dataset.genre;
    renderGenres();
    renderCatalog();
  }
});

document.querySelector('#close-player').addEventListener('click', () => {
  stopPlayer();
  closeDialog(player);
});
player.addEventListener('close', stopPlayer);
document.querySelector('#player-poster-play').addEventListener('click', () => {
  if (playerVideo.src) void playerVideo.play().catch(() => {});
});
playerToggle.addEventListener('click', () => {
  if (playerVideo.paused) void playerVideo.play().catch(() => {});
  else playerVideo.pause();
});
playerMute.addEventListener('click', () => {
  playerVideo.muted = !playerVideo.muted;
  setPlayerControlIcon(playerMute, playerVideo.muted ? 'soundOff' : 'soundOn', playerVideo.muted ? 'Включить звук' : 'Выключить звук');
});
document.querySelector('#player-progress').addEventListener('input', (event) => {
  if (Number.isFinite(playerVideo.duration)) playerVideo.currentTime = playerVideo.duration * (Number(event.target.value) / 100);
});
playerFullscreen.addEventListener('click', () => {
  if (document.fullscreenElement) {
    void document.exitFullscreen?.();
    return;
  }
  // Safari on iPhone does not expose fullscreen for arbitrary elements;
  // entering it through the video element is the native, reliable path.
  if (typeof playerStage.requestFullscreen === 'function') {
    void playerStage.requestFullscreen();
  } else if (typeof playerVideo.webkitEnterFullscreen === 'function') {
    playerVideo.webkitEnterFullscreen();
  } else {
    showToast('Плеер уже открыт на весь экран');
  }
});
playerVideo.addEventListener('play', () => setPlayerControlIcon(playerToggle, 'pause', 'Пауза'));
playerVideo.addEventListener('loadeddata', () => {
  // Do not reveal an empty black frame while a mobile browser is still decoding.
  if (playerVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) playerPoster.hidden = true;
});
playerVideo.addEventListener('pause', () => setPlayerControlIcon(playerToggle, 'play', 'Продолжить'));
playerVideo.addEventListener('error', () => {
  playerPoster.hidden = false;
  playerEmptyCopy.textContent = 'Не удалось загрузить видео. Проверь соединение и попробуй ещё раз.';
  playerControls.hidden = true;
});
playerVideo.addEventListener('click', () => {
  if (playerVideo.paused) void playerVideo.play().catch(() => {});
  else playerVideo.pause();
});
playerVideo.addEventListener('timeupdate', () => {
  const duration = playerVideo.duration || 0;
  const current = playerVideo.currentTime || 0;
  document.querySelector('#player-progress').value = duration ? String((current / duration) * 100) : '0';
  document.querySelector('#player-time').textContent = `${Math.floor(current / 60)}:${String(Math.floor(current % 60)).padStart(2, '0')}`;
});
document.querySelector('#player-continue').addEventListener('click', () => {
  closeDialog(player);
  showToast(`Продолжаем «${playerTitle.textContent}»`);
});
document.querySelector('#shorts-next').addEventListener('click', () => {
  changeShort(1);
});
document.querySelector('#shorts-prev').addEventListener('click', () => {
  changeShort(-1);
});
document.querySelector('#shorts-stage').addEventListener('touchstart', (event) => {
  shortTouchStartY = event.changedTouches[0]?.clientY ?? null;
}, { passive: true });
document.querySelector('#shorts-stage').addEventListener('touchend', (event) => {
  const endY = event.changedTouches[0]?.clientY;
  if (shortTouchStartY === null || endY === undefined) return;
  const deltaY = endY - shortTouchStartY;
  shortTouchStartY = null;
  if (Math.abs(deltaY) < 48) return;
  changeShort(deltaY < 0 ? 1 : -1);
}, { passive: true });
document.querySelector('#shorts-stage').addEventListener('click', (event) => {
  if (event.target.closest('button')) return;
  const stage = event.currentTarget;
  const video = stage.querySelector('.short-video');
  if (!video) return;
  stage.classList.remove('is-clean');
  window.clearTimeout(shortCleanTimer);
  if (video.paused) {
    void video.play().catch(() => {});
    stage.classList.remove('is-paused');
  } else {
    video.pause();
    stage.classList.add('is-paused');
  }
  shortCleanTimer = window.setTimeout(() => stage.classList.add('is-clean'), 2800);
});
document.querySelector('#shorts-stage').addEventListener('wheel', (event) => {
  if (Math.abs(event.deltaY) < 12) return;
  event.preventDefault();
  shortWheelTotal += event.deltaY;
  if (Math.abs(shortWheelTotal) < 90 || Date.now() - lastShortChangeAt < 350) return;
  changeShort(shortWheelTotal > 0 ? 1 : -1);
  shortWheelTotal = 0;
}, { passive: false });
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
accountForm.addEventListener('submit', submitAccount);
document.querySelector('#account-recovery').addEventListener('click', requestPasswordRecovery);
document.querySelector('#apple-sign-in').addEventListener('click', signInWithApple);
commentForm.addEventListener('submit', submitComment);
accountDialog.querySelectorAll('[data-account-mode]').forEach((button) => {
  button.addEventListener('click', () => setAccountMode(button.dataset.accountMode));
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
  catalogNode.innerHTML = shows.filter((show) => `${show.title} ${show.meta} ${show.genre}`.toLocaleLowerCase().includes(query)).map(mediaCard).join('') || '<div class="empty-state"><strong>Нет совпадений.</strong><span>Попробуй название, героя или жанр.</span></div>';
});
document.addEventListener('keydown', (event) => {
  if (event.target.closest('.continue-card') && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    openPlayer(shows[0].title, shows[0]);
  }
  if (document.querySelector('#foryou-screen').classList.contains('is-visible') && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    changeShort(event.key === 'ArrowDown' ? 1 : -1);
  }
});
