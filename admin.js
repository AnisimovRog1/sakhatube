const studioDefaults = {
  content: [
    { id: 'midnight', title: 'После полуночи', kind: 'Сериал', genre: 'Драма', episodes: 8, status: 'published', access: 'subscription', price: 0, poster: 'poster-one', views: 128430, likes: 18320, comments: 846 },
    { id: 'signal', title: 'Тихий сигнал', kind: 'Сериал', genre: 'Мистика', episodes: 10, status: 'published', access: 'free', price: 0, poster: 'poster-two', views: 96420, likes: 12180, comments: 593 },
    { id: 'one', title: 'Один на один', kind: 'Сериал', genre: 'Мелодрама', episodes: 12, status: 'published', access: 'purchase', price: 299, poster: 'poster-three', views: 81210, likes: 10440, comments: 466 },
    { id: 'floor', title: 'Пятый этаж', kind: 'Сериал', genre: 'Триллер', episodes: 6, status: 'draft', access: 'subscription', price: 0, poster: 'poster-four', views: 0, likes: 0, comments: 0 },
    { id: 'chance', title: 'Второй шанс', kind: 'Трейлер', genre: 'Семейный', episodes: 1, status: 'hidden', access: 'free', price: 0, poster: 'poster-five', views: 15370, likes: 1150, comments: 88 }
  ],
  homeOrder: ['midnight', 'signal', 'one', 'floor'],
  banners: [
    { id: 'banner-midnight', contentId: 'midnight', eyebrow: 'ПРЕМЬЕРА', title: 'После полуночи', description: 'Первая серия уже доступна. Продолжение выходит по пятницам.', cta: 'Смотреть сериал', tone: 'poster-one', active: true },
    { id: 'banner-signal', contentId: 'signal', eyebrow: 'НОВАЯ ИСТОРИЯ', title: 'Тихий сигнал', description: 'Десять серий, в которых каждая находка меняет картину.', cta: 'Открыть сериал', tone: 'poster-two', active: true },
    { id: 'banner-one', contentId: 'one', eyebrow: 'ВЫБОР РЕДАКЦИИ', title: 'Один на один', description: 'Полная история доступна по разовой покупке.', cta: 'Узнать больше', tone: 'poster-three', active: false }
  ],
  comments: [
    { id: 'c1', author: 'Мария К.', initials: 'МК', text: 'Очень жду продолжение. Концовка серии вообще не отпускает.', content: 'После полуночи', time: '12 минут назад', status: 'pending' },
    { id: 'c2', author: 'Илья Р.', initials: 'ИР', text: 'Когда выйдет следующая серия?', content: 'Тихий сигнал', time: '34 минуты назад', status: 'pending' },
    { id: 'c3', author: 'Кира', initials: 'К', text: 'Актёры очень хорошо сыграли в этой сцене.', content: 'Один на один', time: '1 час назад', status: 'approved' },
    { id: 'c4', author: 'Никита', initials: 'Н', text: 'Ссылка в описании не открывается.', content: 'После полуночи', time: '2 часа назад', status: 'hidden' }
  ],
  uploads: [
    { id: 'u1', name: 'После полуночи. Серия 6.mov', size: '2,4 ГБ', status: 'Готово к публикации', tone: 'ready' },
    { id: 'u2', name: 'Тихий сигнал. Трейлер.mp4', size: '846 МБ', status: 'Обработка качества', tone: 'processing' }
  ]
};

const storageKey = 'sakhatube-studio-demo';
const tokenKey = 'sakhatube-studio-access-token';
const posterTones = ['poster-one', 'poster-two', 'poster-three', 'poster-four', 'poster-five'];
const apiKindByStudioKind = { 'Сериал': 'series', 'Эпизод': 'episode', 'Трейлер': 'trailer', 'Короткое видео': 'clip' };
const studioKindByApiKind = { series: 'Сериал', episode: 'Эпизод', trailer: 'Трейлер', clip: 'Короткое видео' };
const apiStatusByStudioStatus = { hidden: 'unpublished' };
const studioStatusByApiStatus = { unpublished: 'hidden' };

let studio = loadStudio();
let contentFilter = 'all';
let commentFilter = 'pending';
let pendingDeleteId = null;
let previewMode = 'phone';
let bannerMediaDraft = null;
let toastTimer;
let remoteOverview = null;
let remoteMedia = [];
let homeHasUnsavedChanges = false;
let apiState = { state: 'preview', message: 'Локальный предпросмотр', loading: false };
let activeUpload = null;
let abortingUpload = false;

const contentTable = document.querySelector('#content-table');
const homeOrderGrid = document.querySelector('#home-order-grid');
const commentList = document.querySelector('#comment-list');
const uploadList = document.querySelector('#upload-list');
const bannerList = document.querySelector('#banner-list');
const homeLivePreview = document.querySelector('#home-live-preview');
const contentDialog = document.querySelector('#content-dialog');
const bannerDialog = document.querySelector('#banner-dialog');
const confirmDialog = document.querySelector('#confirm-dialog');
const connectionDialog = document.querySelector('#connection-dialog');
const contentForm = document.querySelector('#content-form');
const bannerForm = document.querySelector('#banner-form');
const connectionForm = document.querySelector('#connection-form');
const studioToast = document.querySelector('#studio-toast');
const connectionBadge = document.querySelector('#studio-connection');
const uploadInput = document.querySelector('#video-upload');
const uploadContentField = document.querySelector('#upload-content-field');
const uploadContentSelect = document.querySelector('#video-upload-content');
const uploadTransfer = document.querySelector('#upload-transfer');
const uploadTransferTitle = document.querySelector('#upload-transfer-title');
const uploadTransferCopy = document.querySelector('#upload-transfer-copy');
const uploadTransferProgress = document.querySelector('#upload-transfer-progress');
const uploadTransferPercent = document.querySelector('#upload-transfer-percent');
const uploadCancelButton = document.querySelector('#upload-cancel');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadStudio() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!saved?.content || !saved?.homeOrder || !saved?.comments || !saved?.uploads) return clone(studioDefaults);
    saved.content = saved.content.map((item) => ({ access: 'free', price: 0, ...item }));
    saved.banners = Array.isArray(saved.banners) ? saved.banners : clone(studioDefaults.banners);
    return saved;
  } catch {
    return clone(studioDefaults);
  }
}

function getAccessToken() {
  try {
    return sessionStorage.getItem(tokenKey) || '';
  } catch {
    return '';
  }
}

function setAccessToken(token) {
  try {
    sessionStorage.setItem(tokenKey, token);
  } catch {
    throw new Error('Браузер не позволил сохранить сессию Studio. Разреши session storage и повтори попытку.');
  }
}

function clearAccessToken() {
  try {
    sessionStorage.removeItem(tokenKey);
  } catch {
    // The visible state is still reset even if the browser storage is unavailable.
  }
}

function isApiMode() {
  return Boolean(getAccessToken());
}

function saveStudio() {
  if (isApiMode()) return;
  localStorage.setItem(storageKey, JSON.stringify(studio));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function compact(value) {
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function statusLabel(status) {
  return {
    published: 'Опубликовано', draft: 'Черновик', hidden: 'Скрыто', review: 'На проверке',
    scheduled: 'По расписанию', unpublished: 'Снято с показа', archived: 'В архиве'
  }[status] || status;
}

function accessLabel(access, price = 0) {
  if (access === 'subscription') return 'Подписка';
  if (access === 'purchase') return `${compact(price)} ₽`;
  return 'Бесплатно';
}

function contentById(id) {
  return studio.content.find((item) => item.id === id);
}

function bannerById(id) {
  return studio.banners.find((item) => item.id === id);
}

function posterFor(id) {
  let hash = 0;
  for (const character of String(id)) hash = ((hash << 5) - hash) + character.charCodeAt(0);
  return posterTones[Math.abs(hash) % posterTones.length];
}

function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'недавно';
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  return `${Math.floor(hours / 24)} дн. назад`;
}

function initials(name) {
  return String(name || 'Гость').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function apiStatusFromStudio(status) {
  return apiStatusByStudioStatus[status] || status;
}

function studioStatusFromApi(status) {
  return studioStatusByApiStatus[status] || status;
}

function normalizeApiContent(item) {
  const previous = contentById(item.id);
  return {
    id: item.id,
    title: item.title,
    kind: studioKindByApiKind[item.kind] || item.kind,
    apiKind: item.kind,
    genre: item.genre,
    synopsis: item.synopsis || '',
    episodes: item.episodes || 1,
    status: studioStatusFromApi(item.status),
    apiStatus: item.status,
    access: item.access || 'free',
    price: previous?.price || 0,
    poster: previous?.poster || posterFor(item.id),
    views: Number(item.views) || 0,
    likes: Number(item.likes) || 0,
    comments: previous?.comments || 0,
    compliance: item.compliance || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function normalizeApiComment(item) {
  return {
    id: item.id,
    author: item.authorName || 'Гость',
    initials: initials(item.authorName),
    text: item.text,
    contentId: item.contentId,
    content: contentById(item.contentId)?.title || 'Контент',
    time: relativeTime(item.createdAt),
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function uploadFromRemoteAsset(asset) {
  const state = String(asset.status || '').toLowerCase();
  const processing = String(asset.processingState || '').toLowerCase();
  const labels = {
    uploading: { status: 'Загрузка в защищённое хранилище', tone: 'processing' },
    uploaded: { status: 'Файл принят. Ожидает постановки в очередь', tone: 'queued' },
    queued: { status: 'В очереди обработки', tone: 'queued' },
    processing: { status: 'Подготавливаем версии для просмотра', tone: 'processing' },
    processed: { status: 'Версии просмотра готовы', tone: 'ready' },
    ready: { status: 'Готово к привязке и проверке', tone: 'ready' },
    aborted: { status: 'Загрузка остановлена', tone: 'stopped' },
    failed: { status: 'Обработка остановлена: проверь журнал worker', tone: 'error' },
    error: { status: 'Обработка завершилась ошибкой: проверь журнал worker', tone: 'error' }
  };
  const current = labels[state] || labels[processing] || { status: 'Статус обработки уточняется', tone: 'processing' };
  const content = asset.contentId ? contentById(asset.contentId) : null;
  return {
    id: `remote-asset-${asset.id}`,
    assetId: asset.id,
    name: asset.fileName || 'Исходное видео',
    size: formatBytes(Number(asset.size)),
    status: content ? `${current.status} · ${content.title}` : current.status,
    tone: current.tone,
    source: 'remote',
    createdAt: asset.createdAt,
    progress: state === 'processed' || state === 'ready' ? 100 : undefined
  };
}

function syncRemoteMedia() {
  const byAssetId = new Map(remoteMedia.map((asset) => [asset.id, asset]));
  const currentUploads = studio.uploads.filter((item) => !item.assetId || activeUpload?.assetId === item.assetId);
  const remoteUploads = [...byAssetId.values()].map(uploadFromRemoteAsset);
  const currentAssetIds = new Set(currentUploads.map((item) => item.assetId).filter(Boolean));
  studio.uploads = [
    ...currentUploads,
    ...remoteUploads.filter((item) => !currentAssetIds.has(item.assetId))
  ];
}

async function refreshRemoteMedia() {
  if (!isApiMode()) return;
  const result = await apiRequest('/v1/admin/assets?limit=100');
  remoteMedia = Array.isArray(result.items) ? result.items : [];
  syncRemoteMedia();
  renderUploads();
}

function refreshCommentMetadata() {
  studio.comments = studio.comments.map((comment) => ({ ...comment, content: contentById(comment.contentId)?.title || comment.content || 'Контент' }));
  studio.content = studio.content.map((item) => {
    const count = studio.comments.filter((comment) => comment.contentId === item.id && comment.status !== 'deleted').length;
    return { ...item, comments: isApiMode() ? count : count || item.comments || 0 };
  });
}

function isSafeBannerMedia(media) {
  return Boolean(media && typeof media.src === 'string' && /^data:image\/(?:jpeg|png|webp);base64,/i.test(media.src));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1) return 'оптимизировано';
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function applyBannerMedia(element, media) {
  if (!element) return;
  if (!isSafeBannerMedia(media)) {
    element.classList.remove('has-media');
    element.style.removeProperty('background-image');
    return;
  }
  element.classList.add('has-media');
  element.style.backgroundImage = `url("${media.src}")`;
}

function renderBannerMediaState() {
  const preview = document.querySelector('#banner-media-preview');
  const name = document.querySelector('#banner-media-name');
  const meta = document.querySelector('#banner-media-meta');
  const remove = document.querySelector('[data-action="remove-banner-media"]');
  if (isSafeBannerMedia(bannerMediaDraft)) {
    preview.src = bannerMediaDraft.src;
    preview.hidden = false;
    name.textContent = bannerMediaDraft.name || 'Изображение баннера';
    meta.textContent = `Готово для локального предпросмотра · ${formatBytes(bannerMediaDraft.size)}`;
    remove.hidden = false;
    return;
  }
  preview.removeAttribute('src');
  preview.hidden = true;
  name.textContent = 'Изображение не выбрано';
  meta.textContent = 'Можно оставить оформление без картинки.';
  remove.hidden = true;
}

function optimizeBannerImage(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) return Promise.reject(new Error('Выбери изображение JPG, PNG или WebP.'));
  if (file.size > 15 * 1024 * 1024) return Promise.reject(new Error('Файл больше 15 МБ. Выбери изображение поменьше.'));
  return new Promise((resolve, reject) => {
    const sourceReader = new FileReader();
    sourceReader.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
    sourceReader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Файл не похож на корректное изображение.'));
      image.onload = () => {
        const scale = Math.min(1, 1440 / image.naturalWidth, 810 / image.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) { reject(new Error('Браузер не смог подготовить изображение.')); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Не удалось оптимизировать изображение.')); return; }
          if (blob.size > 1.2 * 1024 * 1024) { reject(new Error('Изображение всё ещё слишком тяжёлое. Обрежь или сожми его и попробуй снова.')); return; }
          const resultReader = new FileReader();
          resultReader.onerror = () => reject(new Error('Не удалось сохранить оптимизированное изображение.'));
          resultReader.onload = () => resolve({ src: resultReader.result, name: file.name, size: blob.size });
          resultReader.readAsDataURL(blob);
        }, 'image/jpeg', 0.82);
      };
      image.src = sourceReader.result;
    };
    sourceReader.readAsDataURL(file);
  });
}

function showToast(message) {
  studioToast.textContent = message;
  studioToast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => studioToast.classList.remove('is-visible'), 3200);
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

function apiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function apiRequest(path, options = {}) {
  const token = getAccessToken();
  if (!token) throw apiError('Сначала подключи токен Studio API.', 401);
  const headers = new Headers(options.headers || {});
  headers.set('accept', 'application/json');
  headers.set('authorization', `Bearer ${token}`);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  let response;
  try {
    response = await fetch(path, { ...options, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  } catch {
    throw apiError('Нет связи с Studio API. Проверь интернет или адрес SakhaTube.', 0);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = apiError(payload.message || `Studio API вернул ошибку ${response.status}.`, response.status);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function normalizeUploadPlan(payload, file) {
  const assetId = payload?.asset?.id;
  const partSize = Number(payload?.partSize);
  const parts = Array.isArray(payload?.parts) ? payload.parts : [];
  if (!assetId || !Number.isInteger(partSize) || partSize < 1 || !parts.length) {
    throw apiError('Studio API вернул неполный план загрузки. Файл не был передан.', 0);
  }
  const expectedParts = Math.ceil(file.size / partSize);
  if (parts.length !== expectedParts) {
    throw apiError('Studio API вернул неверное количество частей. Файл не был передан.', 0);
  }
  const orderedParts = [...parts].sort((left, right) => Number(left.number) - Number(right.number));
  const valid = orderedParts.every((part, index) => Number(part.number) === index + 1 && typeof part.url === 'string' && /^https:\/\//i.test(part.url));
  if (!valid) throw apiError('Studio API вернул недействительные адреса защищённой загрузки. Файл не был передан.', 0);
  return { assetId, partSize, parts: orderedParts };
}

function updateUploadTransfer({ title, copy, percent = 0, cancellable = false, hidden = false } = {}) {
  uploadTransfer.hidden = hidden;
  if (hidden) return;
  uploadTransferTitle.textContent = title || 'Загрузка видео';
  uploadTransferCopy.textContent = copy || '';
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  uploadTransferProgress.value = safePercent;
  uploadTransferProgress.textContent = `${safePercent}%`;
  uploadTransferPercent.textContent = `${safePercent}%`;
  uploadCancelButton.hidden = !cancellable;
  uploadCancelButton.disabled = !cancellable;
}

function uploadProgressPercent(upload) {
  if (!upload?.fileSize) return 0;
  const loaded = [...upload.partProgress.values()].reduce((sum, value) => sum + value, 0);
  return Math.min(99, Math.round((loaded / upload.fileSize) * 100));
}

function updateUploadRecord(upload, changes) {
  const index = studio.uploads.findIndex((item) => item.id === upload.recordId);
  if (index < 0) return;
  studio.uploads[index] = { ...studio.uploads[index], ...changes };
  renderUploads();
}

async function abortActiveUpload() {
  if (!activeUpload) return;
  const upload = activeUpload;
  upload.cancelled = true;
  upload.requests.forEach((request) => request.abort());
  activeUpload = null;
  abortingUpload = true;
  updateUploadRecord(upload, {
    status: upload.assetId ? 'Останавливаем загрузку и закрываем серверный черновик…' : 'Загрузка остановлена до создания серверного черновика.',
    tone: 'stopped',
    progress: uploadProgressPercent(upload)
  });
  updateUploadTransfer({
    title: 'Загрузка остановлена',
    copy: upload.assetId ? 'Передача частей прекращена. Подтверждаем закрытие серверного черновика…' : 'Передача частей прекращена до создания серверного черновика.',
    percent: uploadProgressPercent(upload),
    hidden: false
  });
  renderConnectionState();
  if (!upload.assetId) {
    abortingUpload = false;
    renderConnectionState();
    showToast('Загрузка остановлена до создания серверного черновика.');
    return;
  }
  try {
    await apiRequest(`/v1/admin/assets/${encodeURIComponent(upload.assetId)}/upload-abort`, { method: 'POST', body: {} });
    updateUploadRecord(upload, {
      status: 'Загрузка остановлена. Серверный черновик закрыт.',
      tone: 'stopped',
      progress: uploadProgressPercent(upload)
    });
    updateUploadTransfer({
      title: 'Загрузка остановлена',
      copy: 'Передача частей прекращена. Сервер подтвердил закрытие черновика.',
      percent: uploadProgressPercent(upload),
      hidden: false
    });
    showToast('Загрузка остановлена. Серверный черновик закрыт.');
  } catch (error) {
    updateUploadRecord(upload, {
      status: `Загрузка остановлена в браузере. Сервер не подтвердил закрытие черновика: ${error.message || 'попробуй позже.'}`,
      tone: 'error',
      progress: uploadProgressPercent(upload)
    });
    updateUploadTransfer({
      title: 'Загрузка остановлена в браузере',
      copy: `Сервер не подтвердил закрытие черновика: ${error.message || 'попробуй позже.'}`,
      percent: uploadProgressPercent(upload),
      hidden: false
    });
    showToast('Загрузка остановлена, но сервер не подтвердил закрытие черновика.');
  } finally {
    abortingUpload = false;
    renderConnectionState();
  }
}

function putUploadPart(upload, part, blob) {
  return new Promise((resolve, reject) => {
    if (upload.cancelled || upload.failed) { reject(apiError('Загрузка остановлена.', 0)); return; }
    const request = new XMLHttpRequest();
    upload.requests.add(request);
    request.open('PUT', part.url, true);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || upload.cancelled || upload.failed) return;
      upload.partProgress.set(part.number, event.loaded);
      const percent = uploadProgressPercent(upload);
      updateUploadRecord(upload, { status: `Передача в защищённое хранилище · ${percent}%`, tone: 'processing', progress: percent });
      updateUploadTransfer({
        title: 'Передаём видео',
        copy: 'Файл идёт напрямую в защищённое хранилище. Он ещё не опубликован.',
        percent,
        cancellable: true
      });
    };
    request.onerror = () => reject(apiError('Не удалось передать одну из частей файла в защищённое хранилище.', 0));
    request.onabort = () => reject(apiError('Загрузка остановлена.', 0));
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(apiError(`Хранилище не приняло часть файла (${request.status}).`, request.status));
        return;
      }
      const etag = request.getResponseHeader('etag');
      if (!etag) {
        reject(apiError('Хранилище не вернуло ETag для части файла. Проверь CORS и повтори загрузку.', 0));
        return;
      }
      upload.partProgress.set(part.number, blob.size);
      resolve({ number: part.number, etag: etag.replace(/^"|"$/g, '') });
    };
    request.onloadend = () => upload.requests.delete(request);
    request.send(blob);
  });
}

async function uploadPartsWithLimit(upload, plan, file) {
  const results = [];
  let cursor = 0;
  const worker = async () => {
    while (!upload.cancelled && !upload.failed) {
      const index = cursor;
      cursor += 1;
      if (index >= plan.parts.length) return;
      const part = plan.parts[index];
      const start = (part.number - 1) * plan.partSize;
      const blob = file.slice(start, Math.min(file.size, start + plan.partSize));
      const result = await putUploadPart(upload, part, blob);
      results.push(result);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, plan.parts.length) }, () => worker()));
  if (upload.cancelled) throw apiError('Загрузка остановлена.', 0);
  return results.sort((left, right) => left.number - right.number);
}

async function closeLateInitializedUpload(upload) {
  abortingUpload = true;
  updateUploadRecord(upload, {
    status: 'Загрузка остановлена. Закрываем серверный черновик…',
    tone: 'stopped',
    progress: uploadProgressPercent(upload)
  });
  updateUploadTransfer({
    title: 'Загрузка остановлена',
    copy: 'Studio успела создать черновик. Подтверждаем его закрытие на сервере…',
    percent: uploadProgressPercent(upload),
    hidden: false
  });
  try {
    await apiRequest(`/v1/admin/assets/${encodeURIComponent(upload.assetId)}/upload-abort`, { method: 'POST', body: {} });
    updateUploadRecord(upload, {
      status: 'Загрузка остановлена. Серверный черновик закрыт.',
      tone: 'stopped',
      progress: uploadProgressPercent(upload)
    });
    updateUploadTransfer({
      title: 'Загрузка остановлена',
      copy: 'Передача частей прекращена. Сервер подтвердил закрытие черновика.',
      percent: uploadProgressPercent(upload),
      hidden: false
    });
  } catch (error) {
    updateUploadRecord(upload, {
      status: `Загрузка остановлена в браузере. Сервер не подтвердил закрытие черновика: ${error.message || 'попробуй позже.'}`,
      tone: 'error',
      progress: uploadProgressPercent(upload)
    });
    updateUploadTransfer({
      title: 'Загрузка остановлена в браузере',
      copy: `Сервер не подтвердил закрытие черновика: ${error.message || 'попробуй позже.'}`,
      percent: uploadProgressPercent(upload),
      hidden: false
    });
  } finally {
    abortingUpload = false;
    renderConnectionState();
  }
}

async function uploadVideoToStudio(file) {
  if (!file || !/^video\//i.test(file.type)) throw apiError('Выбери видеофайл.');
  if (!file.size) throw apiError('Пустой файл нельзя отправить.');
  if (activeUpload || abortingUpload) { showToast('Дождись завершения текущей операции с загрузкой.'); return; }

  const recordId = `remote-upload-${Date.now()}`;
  const upload = {
    recordId,
    fileSize: file.size,
    partProgress: new Map(),
    requests: new Set(),
    cancelled: false
  };
  activeUpload = upload;
  studio.uploads.unshift({ id: recordId, name: file.name, size: formatBytes(file.size), status: 'Подготовка защищённой загрузки', tone: 'processing', progress: 0, source: 'remote' });
  renderUploads();
  renderConnectionState();
  updateUploadTransfer({ title: 'Подготавливаем загрузку', copy: 'Получаем одноразовый план передачи. Файл ещё не отправлен.', percent: 0, cancellable: true });
  try {
    const contentId = uploadContentSelect.value || undefined;
    const init = await apiRequest('/v1/admin/assets/upload-init', {
      method: 'POST',
      body: { fileName: file.name, contentType: file.type, size: file.size, ...(contentId ? { contentId } : {}) }
    });
    const plan = normalizeUploadPlan(init, file);
    upload.assetId = plan.assetId;
    if (upload.cancelled) {
      await closeLateInitializedUpload(upload);
      throw apiError('Загрузка остановлена.', 0);
    }
    updateUploadRecord(upload, { status: 'Передача в защищённое хранилище · 0%', tone: 'processing', progress: 0, assetId: plan.assetId });
    updateUploadTransfer({ title: 'Передаём видео', copy: 'Файл идёт напрямую в защищённое хранилище. Он ещё не опубликован.', percent: 0, cancellable: true });
    const parts = await uploadPartsWithLimit(upload, plan, file);
    if (upload.cancelled) throw apiError('Загрузка остановлена.', 0);
    updateUploadRecord(upload, { status: 'Подтверждаем приём файла', tone: 'processing', progress: 100 });
    updateUploadTransfer({ title: 'Подтверждаем приём', copy: 'Studio передаёт список частей. Публикация не выполняется.', percent: 100, cancellable: false });
    await apiRequest(`/v1/admin/assets/${encodeURIComponent(plan.assetId)}/upload-complete`, { method: 'POST', body: { parts } });
    if (upload.cancelled) throw apiError('Загрузка остановлена.', 0);
    updateUploadRecord(upload, { status: 'Файл принят. Очередь обработки: ожидает.', tone: 'queued', progress: 100 });
    updateUploadTransfer({ title: 'Файл принят', copy: 'Очередь обработки: ожидает. Файл не опубликован.', percent: 100, cancellable: false });
    try { await refreshRemoteMedia(); } catch { /* The accepted upload is still visible locally. */ }
    showToast('Файл принят. Очередь обработки: ожидает.');
  } catch (error) {
    if (!upload.cancelled) {
      upload.failed = true;
      upload.requests.forEach((request) => request.abort());
      updateUploadRecord(upload, { status: error.message || 'Не удалось передать файл.', tone: 'error', progress: uploadProgressPercent(upload) });
      updateUploadTransfer({ title: 'Загрузка не завершена', copy: error.message || 'Не удалось передать файл.', percent: uploadProgressPercent(upload), cancellable: false });
      showToast(error.message || 'Не удалось передать файл.');
    }
  } finally {
    if (activeUpload === upload) activeUpload = null;
    renderConnectionState();
  }
}

function renderConnectionState() {
  const hasToken = isApiMode();
  connectionBadge.className = `connection-badge ${apiState.state === 'connected' ? 'is-connected' : apiState.state === 'loading' ? 'is-loading' : apiState.state === 'error' ? 'is-error' : 'is-preview'}`;
  connectionBadge.textContent = apiState.message;
  document.querySelectorAll('[data-action="connect-api"]').forEach((button) => { button.textContent = hasToken ? 'Управлять API' : 'Подключить API'; });
  document.documentElement.toggleAttribute('data-studio-loading', apiState.loading);
  document.body.setAttribute('aria-busy', apiState.loading || activeUpload ? 'true' : 'false');
  const remote = hasToken;
  document.querySelector('#upload-phase-note').textContent = remote
    ? 'Защищённый режим: видео передаётся напрямую в приватное хранилище. После приёма оно попадёт в очередь обработки и не будет опубликовано автоматически.'
    : 'Локальная очередь: файл не покидает устройство и не сохраняется в Studio. Для проверки остаётся только название и размер файла в этом браузере.';
  uploadContentField.hidden = !remote;
  document.querySelectorAll('[data-action="upload"]').forEach((button) => {
    button.disabled = Boolean(activeUpload) || abortingUpload || apiState.loading;
    button.title = activeUpload || abortingUpload ? 'Идёт другая операция с загрузкой. Дождись её завершения.' : '';
  });
  uploadContentSelect.disabled = Boolean(activeUpload) || abortingUpload || !remote;
  document.querySelectorAll('[data-action="new-banner"]').forEach((button) => {
    button.disabled = remote;
    button.title = remote ? 'Публикация баннеров будет подключена следующим серверным этапом.' : '';
  });
}

function setConnectionError(message = '') {
  const target = document.querySelector('#connection-error');
  target.textContent = message;
  target.hidden = !message;
}

async function loadRemoteStudio({ silent = false } = {}) {
  if (!isApiMode() || apiState.loading) return false;
  apiState = { state: 'loading', message: 'Studio API · синхронизация…', loading: true };
  renderConnectionState();
  const [overviewResult, contentResult, homeResult, commentsResult, mediaResult] = await Promise.allSettled([
    apiRequest('/v1/admin/overview'),
    apiRequest('/v1/admin/content'),
    apiRequest('/v1/admin/home/slots'),
    apiRequest('/v1/admin/comments'),
    apiRequest('/v1/admin/assets?limit=100')
  ]);
  const allResults = [overviewResult, contentResult, homeResult, commentsResult, mediaResult];
  const rejected = allResults.filter((result) => result.status === 'rejected');
  const accessError = rejected.find((result) => result.reason?.status === 401);
  if (contentResult.status === 'fulfilled') studio.content = contentResult.value.items.map(normalizeApiContent);
  if (homeResult.status === 'fulfilled') studio.homeOrder = homeResult.value.items.map((item) => item.id);
  if (commentsResult.status === 'fulfilled') studio.comments = commentsResult.value.items.map(normalizeApiComment);
  if (mediaResult.status === 'fulfilled') {
    remoteMedia = Array.isArray(mediaResult.value.items) ? mediaResult.value.items : [];
    syncRemoteMedia();
  }
  refreshCommentMetadata();
  if (overviewResult.status === 'fulfilled') remoteOverview = overviewResult.value;
  homeHasUnsavedChanges = false;
  if (contentResult.status === 'rejected' && overviewResult.status === 'rejected') {
    apiState = { state: 'error', message: accessError ? 'Studio API · токен недействителен' : 'Studio API · нет связи', loading: false };
    renderConnectionState();
    renderStudio();
    if (!silent) showToast(accessError ? 'Токен не принят. Вставь новый токен или отключи API.' : 'Не удалось загрузить данные Studio API.');
    return false;
  }
  const restricted = rejected.length;
  apiState = { state: 'connected', message: restricted ? 'Studio API · частичный доступ' : 'Studio API · подключено', loading: false };
  renderConnectionState();
  renderStudio();
  if (restricted && !silent) showToast('Часть разделов недоступна для этой роли. Проверь права токена.');
  return true;
}

function renderDashboard() {
  const isRemote = Boolean(remoteOverview && isApiMode() && apiState.state === 'connected');
  const totalViews = isRemote ? remoteOverview.totalViews : studio.content.reduce((sum, item) => sum + item.views, 0);
  const totalLikes = isRemote ? remoteOverview.totalLikes : studio.content.reduce((sum, item) => sum + item.likes, 0);
  const totalComments = isRemote ? remoteOverview.pendingComments : studio.comments.filter((item) => item.status !== 'hidden').length + studio.content.reduce((sum, item) => sum + item.comments, 0);
  const published = isRemote ? remoteOverview.published : studio.content.filter((item) => item.status === 'published').length;
  const pending = isRemote ? remoteOverview.pendingComments : studio.comments.filter((item) => item.status === 'pending').length;
  const metrics = isRemote
    ? [
      { label: 'Просмотры', value: compact(totalViews), delta: 'По данным сервера', neutral: true },
      { label: 'Реакции', value: compact(totalLikes), delta: 'По данным сервера', neutral: true },
      { label: 'На проверке', value: compact(totalComments), delta: `${pending} ждут проверки`, neutral: pending === 0 },
      { label: 'В эфире', value: `${published} карточек`, delta: 'Контент доступен зрителям', neutral: true }
    ]
    : [
      { label: 'Просмотры', value: compact(Math.round(totalViews * .032)), delta: 'Предпросмотр данных', neutral: true },
      { label: 'Реакции', value: compact(totalLikes), delta: 'Предпросмотр данных', neutral: true },
      { label: 'Комментарии', value: compact(totalComments), delta: `${pending} ждут проверки`, neutral: pending === 0 },
      { label: 'В эфире', value: `${published} сериалов`, delta: 'Предпросмотр витрины', neutral: true }
    ];
  document.querySelector('#metrics-grid').innerHTML = metrics.map((metric) => `<article class="metric-card"><p>${metric.label}</p><strong>${metric.value}</strong><small class="${metric.neutral ? 'is-neutral' : ''}">${metric.delta}</small></article>`).join('');
  document.querySelector('#chart-total').textContent = compact(totalViews);
  document.querySelector('#comment-badge').textContent = pending;
  const overviewCard = document.querySelector('#overview-card');
  const note = document.querySelector('#overview-note');
  overviewCard.classList.toggle('is-live', isRemote);
  document.querySelector('#chart-title').textContent = isRemote ? 'Сводка Studio API' : 'Динамика за неделю';
  note.hidden = !isRemote;
  note.textContent = isRemote ? `Первые кадры: ${compact(remoteOverview.firstFrameEvents)} · буферизаций: ${compact(remoteOverview.bufferStartEvents)}. Недельный график появится с аналитическим хранилищем.` : '';
  const attention = studio.comments.filter((item) => item.status === 'pending').slice(0, 3);
  document.querySelector('#attention-list').innerHTML = attention.length ? attention.map((comment) => `<div class="attention-item"><i></i><div><strong>${escapeHTML(comment.author)}</strong><span>${escapeHTML(comment.text)}</span></div><button data-view="comments" type="button">Проверить</button></div>`).join('') : '<div class="attention-item"><i style="background:var(--green)"></i><div><strong>Всё чисто</strong><span>Новых комментариев нет</span></div></div>';
  const top = isRemote ? remoteOverview.topContent.map(normalizeApiContent) : studio.content.filter((item) => item.status === 'published').sort((a, b) => b.views - a.views).slice(0, 3);
  document.querySelector('#top-content-list').innerHTML = top.map((item) => `<article class="top-content-item"><div class="mini-poster ${item.poster}"></div><div><h4>${escapeHTML(item.title)}</h4><p>${escapeHTML(item.genre)} · ${item.episodes} ${item.episodes === 1 ? 'видео' : 'серий'}</p><strong>${compact(item.views)} просмотров</strong></div></article>`).join('') || '<p class="empty-copy">Пока нет опубликованного контента.</p>';
}

function renderContent() {
  const query = document.querySelector('#content-search').value.trim().toLocaleLowerCase();
  const visible = studio.content.filter((item) => {
    const matchesFilter = contentFilter === 'all' || item.status === contentFilter;
    return matchesFilter && `${item.title} ${item.genre} ${item.kind}`.toLocaleLowerCase().includes(query);
  });
  const head = '<div class="table-head"><span>КОНТЕНТ</span><span>СТАТУС</span><span>ДОСТУП</span><span>ПРОСМОТРЫ</span><span>РЕАКЦИИ</span><span>КОММЕНТАРИИ</span><span></span></div>';
  const workflowAction = (item) => {
    if (!isApiMode()) return '';
    const status = item.apiStatus || apiStatusFromStudio(item.status);
    const verification = item.compliance && !item.compliance.verifiedAt
      ? `<button data-action="verify-rights" data-id="${escapeHTML(item.id)}" type="button">Проверить права</button>`
      : '';
    if (status === 'draft' || status === 'unpublished') return `${verification}<button data-action="submit-review" data-id="${escapeHTML(item.id)}" type="button">На проверку</button>`;
    if (status === 'review') return `${verification}<button data-action="publish-content" data-id="${escapeHTML(item.id)}" type="button">Опубликовать</button>`;
    if (status === 'published' || status === 'scheduled') return `${verification}<button data-action="unpublish-content" data-id="${escapeHTML(item.id)}" type="button">Снять с показа</button>`;
    return verification;
  };
  const complianceHint = (item) => item.compliance?.ageRating ? ` · ${escapeHTML(item.compliance.ageRating)}` : isApiMode() ? ' · паспорт публикации не заполнен' : '';
  const rows = visible.map((item) => `<article class="content-row"><div class="content-title"><div class="content-poster ${item.poster}"></div><div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.kind)} · ${escapeHTML(item.genre)} · ${item.episodes} ${item.episodes === 1 ? 'видео' : 'серий'}${complianceHint(item)}</small></div></div><div><span class="status ${item.status}">${statusLabel(item.status)}</span></div><span class="access ${item.access}">${accessLabel(item.access, item.price)}</span><span class="table-value"><strong>${compact(item.views)}</strong>всего</span><span class="table-value"><strong>${compact(item.likes)}</strong>нравится</span><span class="table-value"><strong>${compact(item.comments)}</strong>всего</span><div class="row-menu">${workflowAction(item)}<button data-action="edit-content" data-id="${escapeHTML(item.id)}" type="button">Изменить</button><button data-action="delete-content" data-id="${escapeHTML(item.id)}" type="button">${isApiMode() ? 'В архив' : 'Удалить'}</button></div></article>`).join('');
  contentTable.innerHTML = head + (rows || '<div class="empty-table">Ничего не найдено. Сбрось фильтр или добавь новый контент.</div>');
}

function renderHomeOrder() {
  const items = studio.homeOrder.map(contentById).filter(Boolean);
  homeOrderGrid.innerHTML = items.map((item, index) => `<article class="order-card"><div class="order-poster ${item.poster}"><span class="order-number">${index + 1}</span></div><div class="order-info"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.genre)} · ${accessLabel(item.access, item.price)}</p><div class="reorder-actions"><button data-action="move-home" data-id="${escapeHTML(item.id)}" data-direction="up" type="button" ${index === 0 ? 'disabled' : ''}>↑ Выше</button><button data-action="move-home" data-id="${escapeHTML(item.id)}" data-direction="down" type="button" ${index === items.length - 1 ? 'disabled' : ''}>↓ Ниже</button></div></div></article>`).join('') || '<p class="empty-copy">Добавь сериал, чтобы собрать витрину.</p>';
  const save = document.querySelector('[data-action="save-home"]');
  save.textContent = homeHasUnsavedChanges ? 'Сохранить изменения •' : 'Сохранить изменения';
}

function renderHomePreview() {
  const activeBanners = studio.banners.filter((item) => item.active);
  const banner = activeBanners[0] || studio.banners[0];
  const shelf = studio.homeOrder.map(contentById).filter((item) => item && item.status === 'published').slice(0, 3);
  if (!banner) {
    homeLivePreview.innerHTML = '<div class="preview-empty"><strong>Нет активного баннера</strong><span>Добавь первый баннер справа.</span></div>';
    return;
  }
  homeLivePreview.classList.toggle('is-desktop', previewMode === 'desktop');
  homeLivePreview.innerHTML = `<div class="app-preview-top"><span>Sakha<span>Tube</span></span><i>⌕</i><i>◌</i></div><article class="app-preview-hero ${escapeHTML(banner.tone)}"><div class="preview-shade"></div><div class="preview-copy"><small>${escapeHTML(banner.eyebrow)}</small><h3>${escapeHTML(banner.title)}</h3><p>${escapeHTML(banner.description)}</p><button type="button">▶ ${escapeHTML(banner.cta)}</button></div><span class="preview-position">1 / ${activeBanners.length || 1}</span></article><div class="preview-section-title"><strong>Продолжить смотреть</strong><span>Всё →</span></div><div class="preview-shelf">${shelf.map((item) => `<div><span class="mini-poster ${item.poster}"></span><strong>${escapeHTML(item.title)}</strong></div>`).join('') || '<p>Опубликованный контент появится здесь.</p>'}</div><div class="preview-tabbar"><span class="is-current">⌂<b>Главная</b></span><span>◇<b>Для вас</b></span><span>▤<b>Каталог</b></span><span>◯<b>Профиль</b></span></div>`;
  applyBannerMedia(homeLivePreview.querySelector('.app-preview-hero'), banner.media);
}

function renderBanners() {
  const phaseNotice = isApiMode() ? '<p class="phase-notice">Баннеры и их изображения пока работают только в локальном предпросмотре. Их публикация будет подключена после серверной модели витрины и медиазагрузки.</p>' : '';
  const banners = studio.banners;
  bannerList.innerHTML = phaseNotice + (banners.map((banner, index) => {
    const linked = contentById(banner.contentId);
    return `<article class="banner-card ${banner.active ? '' : 'is-paused'}"><div class="banner-art ${escapeHTML(banner.tone)}" data-banner-art="${escapeHTML(banner.id)}"><span>${index + 1}</span></div><div class="banner-copy"><div><strong>${escapeHTML(banner.title)}</strong><small>${linked ? escapeHTML(linked.title) : 'Без привязанного контента'} · ${banner.active ? 'виден зрителю' : 'скрыт'}</small></div><div class="banner-actions"><button data-action="edit-banner" data-id="${escapeHTML(banner.id)}" type="button" ${isApiMode() ? 'disabled' : ''}>Изменить</button><button data-action="toggle-banner" data-id="${escapeHTML(banner.id)}" type="button" ${isApiMode() ? 'disabled' : ''}>${banner.active ? 'Скрыть' : 'Показать'}</button><button data-action="move-banner" data-id="${escapeHTML(banner.id)}" data-direction="up" type="button" ${index === 0 || isApiMode() ? 'disabled' : ''} aria-label="Поднять баннер">↑</button><button data-action="move-banner" data-id="${escapeHTML(banner.id)}" data-direction="down" type="button" ${index === banners.length - 1 || isApiMode() ? 'disabled' : ''} aria-label="Опустить баннер">↓</button></div></div></article>`;
  }).join('') || '<p class="empty-copy">Добавь первый баннер, чтобы собрать верхний экран.</p>');
  studio.banners.forEach((banner) => applyBannerMedia(bannerList.querySelector(`[data-banner-art="${banner.id}"]`), banner.media));
}

function commentStatusLabel(status) {
  return { pending: 'на проверке', approved: 'опубликован', hidden: 'скрыт', deleted: 'удалён' }[status] || status;
}

function renderComments() {
  const visible = studio.comments.filter((comment) => commentFilter === 'all' || comment.status === commentFilter);
  commentList.innerHTML = visible.map((comment) => `<article class="comment-card ${comment.status === 'deleted' ? 'is-deleted' : ''}"><span class="comment-avatar">${escapeHTML(comment.initials)}</span><div class="comment-copy"><h3>${escapeHTML(comment.author)}<span>${escapeHTML(comment.time)}</span></h3><p>${escapeHTML(comment.text)}</p><small>${escapeHTML(comment.content)} · ${commentStatusLabel(comment.status)}</small></div><div class="comment-actions">${comment.status !== 'approved' && comment.status !== 'deleted' ? `<button data-action="approve-comment" data-id="${escapeHTML(comment.id)}" type="button">Одобрить</button>` : ''}${comment.status !== 'hidden' && comment.status !== 'deleted' ? `<button data-action="hide-comment" data-id="${escapeHTML(comment.id)}" type="button">Скрыть</button>` : ''}${comment.status !== 'deleted' ? `<button class="is-danger" data-action="delete-comment" data-id="${escapeHTML(comment.id)}" type="button">Удалить</button>` : ''}</div></article>`).join('') || '<article class="comment-card"><span class="comment-avatar">✓</span><div class="comment-copy"><h3>Нет комментариев</h3><p>В этой папке пока пусто.</p></div></article>';
}

function renderUploads() {
  const selectedContent = uploadContentSelect.value;
  uploadContentSelect.innerHTML = `<option value="">Привязать позже</option>${studio.content.map((item) => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.title)} · ${escapeHTML(statusLabel(item.status))}</option>`).join('')}`;
  if ([...uploadContentSelect.options].some((option) => option.value === selectedContent)) uploadContentSelect.value = selectedContent;
  const tone = (upload) => {
    if (upload.tone === 'ready') return { className: 'published', label: 'Готово' };
    if (upload.tone === 'queued') return { className: 'queued', label: 'В очереди' };
    if (upload.tone === 'error') return { className: 'error', label: 'Ошибка' };
    if (upload.tone === 'stopped') return { className: 'stopped', label: 'Остановлено' };
    return { className: 'draft', label: 'В работе' };
  };
  uploadList.innerHTML = studio.uploads.map((upload) => {
    const state = tone(upload);
    const hasProgress = Number.isFinite(upload.progress);
    return `<article class="upload-item"><span aria-hidden="true">▶</span><div><strong>${escapeHTML(upload.name)}</strong><small>${escapeHTML(upload.size)} · ${escapeHTML(upload.status)}</small>${hasProgress ? `<progress class="upload-item-progress" aria-label="Передача ${escapeHTML(upload.name)}" max="100" value="${Math.max(0, Math.min(100, Number(upload.progress)))}">${Math.round(Number(upload.progress))}%</progress>` : ''}</div><span class="status ${state.className}">${state.label}</span></article>`;
  }).join('') || '<p class="empty-copy">Файлов пока нет.</p>';
}

function renderStudio() {
  renderDashboard();
  renderContent();
  renderHomeOrder();
  renderHomePreview();
  renderBanners();
  renderComments();
  renderUploads();
  renderConnectionState();
}

function navigate(view) {
  const labels = { dashboard: ['STUDIO', 'Обзор'], content: ['КОНТЕНТ', 'Контент'], home: ['ВИТРИНА', 'Главная'], comments: ['МОДЕРАЦИЯ', 'Комментарии'], uploads: ['МЕДИА', 'Загрузки'] };
  document.querySelectorAll('[data-studio-view]').forEach((section) => section.classList.toggle('is-visible', section.dataset.studioView === view));
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
  document.querySelector('#studio-kicker').textContent = labels[view][0];
  document.querySelector('#studio-page-title').textContent = labels[view][1];
  if (view === 'uploads' && isApiMode() && !activeUpload) {
    void refreshRemoteMedia().catch(() => showToast('Не удалось обновить статусы обработки. Проверь подключение Studio API.'));
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openContentDialog(item = null) {
  contentForm.reset();
  document.querySelector('#content-id').value = item?.id || '';
  document.querySelector('#content-dialog-eyebrow').textContent = item ? 'РЕДАКТИРОВАНИЕ' : 'НОВЫЙ КОНТЕНТ';
  document.querySelector('#content-dialog-title').textContent = item ? 'Изменить карточку' : 'Добавить сериал';
  const statusField = document.querySelector('#content-status');
  const statusHelp = document.querySelector('#content-status-help');
  statusField.disabled = isApiMode();
  statusHelp.hidden = !isApiMode();
  if (item) {
    document.querySelector('#content-title').value = item.title;
    document.querySelector('#content-genre').value = item.genre;
    document.querySelector('#content-kind').value = item.kind;
    document.querySelector('#content-episodes').value = item.episodes;
    document.querySelector('#content-status').value = ['published', 'draft', 'hidden'].includes(item.status) ? item.status : 'draft';
    document.querySelector('#content-access').value = item.access || 'free';
    document.querySelector('#content-price').value = item.price || 0;
  }
  const compliance = item?.compliance || null;
  document.querySelector('#content-age-rating').value = compliance?.ageRating || '';
  document.querySelector('#content-rights-basis').value = compliance?.rightsBasis || '';
  document.querySelector('#content-rights-holder').value = compliance?.rightsHolder || '';
  document.querySelector('#content-license-reference').value = compliance?.licenseReference || '';
  document.querySelector('#content-territories').value = Array.isArray(compliance?.territories) ? compliance.territories.join(', ') : '';
  document.querySelector('#content-audio-languages').value = Array.isArray(compliance?.audioLanguages) ? compliance.audioLanguages.join(', ') : '';
  document.querySelector('#content-subtitle-languages').value = Array.isArray(compliance?.subtitleLanguages) ? compliance.subtitleLanguages.join(', ') : '';
  document.querySelector('#content-rights-starts-at').value = dateTimeLocalValue(compliance?.startsAt);
  document.querySelector('#content-rights-ends-at').value = dateTimeLocalValue(compliance?.endsAt);
  openDialog(contentDialog);
}

function openBannerDialog(banner = null) {
  if (isApiMode()) { showToast('Баннеры нельзя публиковать через текущий Studio API — этот серверный этап ещё не подключён.'); return; }
  bannerForm.reset();
  bannerMediaDraft = isSafeBannerMedia(banner?.media) ? clone(banner.media) : null;
  const contentSelect = document.querySelector('#banner-content');
  contentSelect.innerHTML = studio.content.map((item) => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.title)} · ${statusLabel(item.status)}</option>`).join('');
  document.querySelector('#banner-id').value = banner?.id || '';
  document.querySelector('#banner-dialog-eyebrow').textContent = banner ? 'РЕДАКТИРОВАНИЕ БАННЕРА' : 'НОВЫЙ БАННЕР';
  document.querySelector('#banner-dialog-title').textContent = banner ? 'Изменить баннер' : 'Добавить баннер';
  if (banner) {
    document.querySelector('#banner-content').value = banner.contentId;
    document.querySelector('#banner-eyebrow').value = banner.eyebrow;
    document.querySelector('#banner-title').value = banner.title;
    document.querySelector('#banner-description').value = banner.description;
    document.querySelector('#banner-cta').value = banner.cta;
    document.querySelector('#banner-tone').value = banner.tone;
    document.querySelector('#banner-active').checked = banner.active;
  }
  renderBannerMediaState();
  openDialog(bannerDialog);
}

function askDelete(id) {
  const item = contentById(id);
  if (!item) return;
  pendingDeleteId = id;
  const remote = isApiMode();
  document.querySelector('#confirm-title').textContent = remote ? `Архивировать «${item.title}»?` : `Удалить «${item.title}»?`;
  document.querySelector('#confirm-copy').textContent = remote
    ? 'Карточка будет снята с витрины и помечена архивной на сервере. Файл и аудит сохранятся.'
    : 'Карточка исчезнет из локального предпросмотра и с главной витрины.';
  document.querySelector('#confirm-delete').textContent = remote ? 'Архивировать' : 'Удалить карточку';
  openDialog(confirmDialog);
}

function moveHome(id, direction) {
  const index = studio.homeOrder.indexOf(id);
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= studio.homeOrder.length) return;
  [studio.homeOrder[index], studio.homeOrder[nextIndex]] = [studio.homeOrder[nextIndex], studio.homeOrder[index]];
  homeHasUnsavedChanges = isApiMode();
  if (!isApiMode()) saveStudio();
  renderHomeOrder();
  renderHomePreview();
  showToast(isApiMode() ? 'Порядок изменён. Нажми «Сохранить изменения».': 'Порядок витрины обновлён');
}

async function saveHomeSlots({ silent = false } = {}) {
  if (!isApiMode()) {
    saveStudio();
    homeHasUnsavedChanges = false;
    renderHomeOrder();
    if (!silent) showToast('Порядок главной сохранён локально');
    return true;
  }
  const saveButton = document.querySelector('[data-action="save-home"]');
  saveButton.disabled = true;
  saveButton.textContent = 'Сохраняем…';
  try {
    const result = await apiRequest('/v1/admin/home/slots', { method: 'PATCH', body: { contentIds: studio.homeOrder } });
    studio.homeOrder = result.items.map((item) => item.id);
    homeHasUnsavedChanges = false;
    renderHomeOrder();
    renderHomePreview();
    if (!silent) showToast('Главная витрина опубликована');
    return true;
  } catch (error) {
    showToast(error.message || 'Не удалось сохранить порядок главной.');
    return false;
  } finally {
    saveButton.disabled = false;
    renderHomeOrder();
  }
}

function moveBanner(id, direction) {
  const index = studio.banners.findIndex((item) => item.id === id);
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= studio.banners.length) return;
  [studio.banners[index], studio.banners[nextIndex]] = [studio.banners[nextIndex], studio.banners[index]];
  saveStudio();
  renderHomePreview();
  renderBanners();
  showToast('Порядок баннеров обновлён');
}

async function updateComment(id, status) {
  const comment = studio.comments.find((item) => item.id === id);
  if (!comment) return;
  if (!isApiMode()) {
    comment.status = status;
    saveStudio();
  } else {
    try {
      const result = await apiRequest(`/v1/admin/comments/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
      Object.assign(comment, normalizeApiComment(result.item));
      remoteOverview = null;
      await loadRemoteStudio({ silent: true });
    } catch (error) {
      showToast(error.message || 'Не удалось изменить статус комментария.');
      return;
    }
  }
  renderDashboard();
  renderComments();
  showToast(status === 'approved' ? 'Комментарий опубликован' : status === 'hidden' ? 'Комментарий скрыт' : 'Комментарий удалён');
}

function dateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function commaSeparatedValues(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function complianceFromForm() {
  const raw = {
    ageRating: document.querySelector('#content-age-rating').value,
    rightsBasis: document.querySelector('#content-rights-basis').value,
    rightsHolder: document.querySelector('#content-rights-holder').value.trim(),
    licenseReference: document.querySelector('#content-license-reference').value.trim(),
    territories: commaSeparatedValues(document.querySelector('#content-territories').value),
    startsAt: document.querySelector('#content-rights-starts-at').value,
    endsAt: document.querySelector('#content-rights-ends-at').value,
    audioLanguages: commaSeparatedValues(document.querySelector('#content-audio-languages').value),
    subtitleLanguages: commaSeparatedValues(document.querySelector('#content-subtitle-languages').value)
  };
  const hasAny = raw.ageRating || raw.rightsBasis || raw.rightsHolder || raw.licenseReference || raw.territories.length || raw.startsAt || raw.endsAt || raw.audioLanguages.length || raw.subtitleLanguages.length;
  if (!hasAny) return null;
  const missing = [
    !raw.ageRating && 'возрастной рейтинг',
    !raw.rightsBasis && 'основание прав',
    !raw.rightsHolder && 'правообладатель',
    !raw.licenseReference && 'договор или лицензия',
    !raw.territories.length && 'территории показа',
    !raw.startsAt && 'начало прав',
    !raw.audioLanguages.length && 'язык аудио'
  ].filter(Boolean);
  if (missing.length) throw new Error(`Заполни паспорт публикации: ${missing.join(', ')}.`);
  const startsAt = new Date(raw.startsAt);
  const endsAt = raw.endsAt ? new Date(raw.endsAt) : null;
  if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) throw new Error('Проверь даты действия прав.');
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) throw new Error('Дата окончания прав должна быть позже даты начала.');
  return {
    ageRating: raw.ageRating,
    rightsBasis: raw.rightsBasis,
    rightsHolder: raw.rightsHolder,
    licenseReference: raw.licenseReference,
    territories: raw.territories,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt ? endsAt.toISOString() : null,
    audioLanguages: raw.audioLanguages,
    subtitleLanguages: raw.subtitleLanguages
  };
}

function contentPayloadFromForm(data, existing) {
  return {
    title: data.title,
    genre: data.genre,
    kind: apiKindByStudioKind[data.kind] || 'series',
    episodes: data.episodes,
    access: data.access,
    ...(existing ? {} : { synopsis: '' }),
    ...(data.compliance ? { compliance: data.compliance } : {})
  };
}

async function saveContentFromForm() {
  const id = document.querySelector('#content-id').value;
  const existing = id ? contentById(id) : null;
  const submit = contentForm.querySelector('[type="submit"]');
  const original = submit.textContent;
  submit.disabled = true;
  submit.textContent = 'Сохраняем…';
  try {
    const data = {
      title: document.querySelector('#content-title').value.trim(),
      genre: document.querySelector('#content-genre').value,
      kind: document.querySelector('#content-kind').value,
      episodes: Number(document.querySelector('#content-episodes').value),
      status: document.querySelector('#content-status').value,
      access: document.querySelector('#content-access').value,
      price: Math.max(0, Number(document.querySelector('#content-price').value) || 0),
      compliance: complianceFromForm()
    };
    if (isApiMode()) {
      const result = await apiRequest(id ? `/v1/admin/content/${encodeURIComponent(id)}` : '/v1/admin/content', { method: id ? 'PATCH' : 'POST', body: contentPayloadFromForm(data, existing) });
      const updated = normalizeApiContent(result.item);
      updated.price = data.price;
      if (id) studio.content = studio.content.map((item) => item.id === id ? { ...item, ...updated } : item);
      else {
        studio.content.unshift(updated);
        studio.homeOrder.push(updated.id);
        homeHasUnsavedChanges = true;
      }
      refreshCommentMetadata();
      closeDialog(contentDialog);
      renderStudio();
      showToast(id ? 'Карточка обновлена на сервере' : 'Черновик создан. Сохрани витрину, если хочешь показать его на главной.');
      return;
    }
    if (id) Object.assign(existing, data);
    else {
      const newId = `item-${Date.now()}`;
      studio.content.unshift({ id: newId, ...data, poster: posterFor(newId), views: 0, likes: 0, comments: 0 });
      studio.homeOrder.push(newId);
    }
    saveStudio();
    closeDialog(contentDialog);
    renderStudio();
    showToast(id ? 'Карточка обновлена в предпросмотре' : 'Черновик добавлен в предпросмотр');
  } catch (error) {
    showToast(error.message || 'Не удалось сохранить карточку.');
  } finally {
    submit.disabled = false;
    submit.textContent = original;
  }
}

async function updateContentLifecycle(id, action) {
  if (!isApiMode()) return;
  const item = contentById(id);
  if (!item) return;
  const requests = {
    'submit-review': { path: 'submit-review', body: {}, success: 'Материал отправлен на проверку.' },
    'publish-content': { path: 'publish', body: {}, success: 'Материал опубликован.' }
  };
  if (action === 'verify-rights') {
    const reference = window.prompt('Введи номер юридической проверки, договора или записи в реестре.');
    if (reference === null) return;
    if (reference.trim().length < 3) { showToast('Укажи номер проверки минимум из 3 символов.'); return; }
    request = { path: 'verify-rights', body: { reference: reference.trim() }, success: 'Права подтверждены. Теперь материал можно публиковать.' };
  }
  let request = requests[action];
  if (action === 'unpublish-content') {
    const reason = window.prompt('Почему снимаем материал с показа? Эта причина останется в аудите.');
    if (reason === null) return;
    if (reason.trim().length < 3) { showToast('Укажи причину минимум из 3 символов.'); return; }
    request = { path: 'unpublish', body: { reason: reason.trim() }, success: 'Материал снят с показа.' };
  }
  if (!request) return;
  try {
    const result = await apiRequest(`/v1/admin/content/${encodeURIComponent(id)}/${request.path}`, { method: 'POST', body: request.body });
    const updated = normalizeApiContent(result.item);
    studio.content = studio.content.map((entry) => entry.id === id ? { ...entry, ...updated } : entry);
    refreshCommentMetadata();
    renderStudio();
    showToast(request.success);
  } catch (error) {
    const blocks = Array.isArray(error.payload?.blocks) ? error.payload.blocks : [];
    showToast(blocks.length ? `Публикация заблокирована: ${blocks.join('; ')}.` : (error.message || 'Не удалось изменить статус публикации.'));
  }
}

async function archiveOrDeleteContent() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  const button = document.querySelector('#confirm-delete');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = isApiMode() ? 'Архивируем…' : 'Удаляем…';
  try {
    if (isApiMode()) {
      const result = await apiRequest(`/v1/admin/content/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: 'archived' } });
      const archived = normalizeApiContent(result.item);
      studio.content = studio.content.map((item) => item.id === id ? { ...item, ...archived } : item);
      studio.homeOrder = studio.homeOrder.filter((contentId) => contentId !== id);
      homeHasUnsavedChanges = true;
      const homeSaved = await saveHomeSlots({ silent: true });
      closeDialog(confirmDialog);
      pendingDeleteId = null;
      renderStudio();
      showToast(homeSaved ? 'Карточка архивирована и снята с витрины' : 'Карточка архивирована. Не забудь сохранить витрину.');
      return;
    }
    studio.content = studio.content.filter((item) => item.id !== id);
    studio.homeOrder = studio.homeOrder.filter((contentId) => contentId !== id);
    saveStudio();
    closeDialog(confirmDialog);
    pendingDeleteId = null;
    renderStudio();
    showToast('Карточка удалена из предпросмотра');
  } catch (error) {
    showToast(error.message || 'Не удалось архивировать карточку.');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function connectToApi() {
  const field = document.querySelector('#studio-access-token');
  const token = field.value.trim();
  if (token.length < 16) { setConnectionError('Вставь действующий access token. Он обычно длиннее 16 символов.'); return; }
  const submit = document.querySelector('#connection-submit');
  const original = submit.textContent;
  submit.disabled = true;
  submit.textContent = 'Проверяем…';
  setConnectionError('');
  try {
    setAccessToken(token);
    const connected = await loadRemoteStudio({ silent: true });
    if (!connected) {
      setConnectionError(apiState.state === 'error' ? 'Токен не принят или Studio API недоступен. Токен не показан и хранится только в этой вкладке — можешь заменить или отключить его.' : 'Не удалось подключиться.');
      return;
    }
    field.value = '';
    closeDialog(connectionDialog);
    showToast('Studio API подключён. Контент, витрина и модерация теперь работают с сервером.');
  } catch (error) {
    setConnectionError(error.message || 'Не удалось сохранить сессию Studio.');
  } finally {
    submit.disabled = false;
    submit.textContent = original;
  }
}

function disconnectApi() {
  if (activeUpload || abortingUpload) { showToast('Сначала заверши текущую операцию с загрузкой.'); return; }
  clearAccessToken();
  remoteOverview = null;
  homeHasUnsavedChanges = false;
  studio = loadStudio();
  apiState = { state: 'preview', message: 'Локальный предпросмотр', loading: false };
  updateUploadTransfer({ hidden: true });
  closeDialog(connectionDialog);
  renderStudio();
  showToast('Studio API отключён. Открыт локальный предпросмотр этого браузера.');
}

async function handleAction(name, action) {
  const { id } = action.dataset;
  if (name === 'connect-api') {
    document.querySelector('#studio-access-token').value = '';
    setConnectionError('');
    openDialog(connectionDialog);
    window.setTimeout(() => document.querySelector('#studio-access-token').focus(), 0);
  }
  if (name === 'disconnect-api') disconnectApi();
  if (name === 'new-series') openContentDialog();
  if (name === 'new-banner') openBannerDialog();
  if (name === 'upload') {
    if (activeUpload || abortingUpload) { showToast('Дождись завершения текущей операции с загрузкой.'); return; }
    uploadInput.click();
  }
  if (name === 'select-banner-media') document.querySelector('#banner-media').click();
  if (name === 'remove-banner-media') { bannerMediaDraft = null; document.querySelector('#banner-media').value = ''; renderBannerMediaState(); showToast('Изображение убрано из баннера'); }
  if (name === 'edit-content') openContentDialog(contentById(id));
  if (name === 'submit-review' || name === 'verify-rights' || name === 'publish-content' || name === 'unpublish-content') await updateContentLifecycle(id, name);
  if (name === 'delete-content') askDelete(id);
  if (name === 'move-home') moveHome(id, action.dataset.direction);
  if (name === 'move-banner') moveBanner(id, action.dataset.direction);
  if (name === 'edit-banner') openBannerDialog(bannerById(id));
  if (name === 'toggle-banner') {
    if (isApiMode()) { showToast('Публикация баннеров будет доступна после следующего серверного этапа.'); return; }
    const banner = bannerById(id);
    if (banner) { banner.active = !banner.active; saveStudio(); renderHomePreview(); renderBanners(); showToast(banner.active ? 'Баннер показан в предпросмотре' : 'Баннер скрыт в предпросмотре'); }
  }
  if (name === 'save-home') await saveHomeSlots();
  if (name === 'approve-comment') await updateComment(id, 'approved');
  if (name === 'hide-comment') await updateComment(id, 'hidden');
  if (name === 'delete-comment') await updateComment(id, 'deleted');
  if (name === 'reset-demo') {
    if (isApiMode()) { await loadRemoteStudio(); return; }
    if (window.confirm('Сбросить все локальные изменения Studio на этом устройстве?')) { studio = clone(studioDefaults); saveStudio(); renderStudio(); showToast('Локальные демо-данные восстановлены'); }
  }
}

document.addEventListener('click', (event) => {
  const closeButton = event.target.closest('[data-close-dialog]');
  if (closeButton) { closeDialog(document.querySelector(`#${closeButton.dataset.closeDialog}`)); return; }
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { navigate(viewButton.dataset.view); return; }
  const filterButton = event.target.closest('[data-filter]');
  if (filterButton) { contentFilter = filterButton.dataset.filter; document.querySelectorAll('[data-filter]').forEach((button) => button.classList.toggle('is-active', button.dataset.filter === contentFilter)); renderContent(); return; }
  const commentFilterButton = event.target.closest('[data-comment-filter]');
  if (commentFilterButton) { commentFilter = commentFilterButton.dataset.commentFilter; document.querySelectorAll('[data-comment-filter]').forEach((button) => button.classList.toggle('is-active', button.dataset.commentFilter === commentFilter)); renderComments(); return; }
  const previewButton = event.target.closest('[data-preview-mode]');
  if (previewButton) { previewMode = previewButton.dataset.previewMode; document.querySelectorAll('[data-preview-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.previewMode === previewMode)); renderHomePreview(); return; }
  const action = event.target.closest('[data-action]');
  if (action) void handleAction(action.dataset.action, action);
});

document.querySelector('#confirm-delete').addEventListener('click', () => { void archiveOrDeleteContent(); });
contentForm.addEventListener('submit', (event) => { event.preventDefault(); void saveContentFromForm(); });
connectionForm.addEventListener('submit', (event) => { event.preventDefault(); void connectToApi(); });

bannerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (isApiMode()) { showToast('Баннеры пока не публикуются через Studio API.'); return; }
  const id = document.querySelector('#banner-id').value;
  const data = {
    contentId: document.querySelector('#banner-content').value,
    eyebrow: document.querySelector('#banner-eyebrow').value.trim(),
    title: document.querySelector('#banner-title').value.trim(),
    description: document.querySelector('#banner-description').value.trim(),
    cta: document.querySelector('#banner-cta').value.trim(),
    tone: document.querySelector('#banner-tone').value,
    active: document.querySelector('#banner-active').checked,
    media: bannerMediaDraft
  };
  if (id) Object.assign(bannerById(id), data);
  else studio.banners.push({ id: `banner-${Date.now()}`, ...data });
  saveStudio();
  closeDialog(bannerDialog);
  renderHomePreview();
  renderBanners();
  showToast(id ? 'Баннер обновлён в предпросмотре' : 'Баннер добавлен в предпросмотр');
});

document.querySelector('#content-search').addEventListener('input', renderContent);
document.querySelector('#banner-media').addEventListener('change', async (event) => {
  if (isApiMode()) { event.target.value = ''; showToast('Загрузка изображений будет доступна после серверного медиамодуля.'); return; }
  const [file] = event.target.files;
  if (!file) return;
  const button = document.querySelector('[data-action="select-banner-media"]');
  button.disabled = true;
  button.textContent = 'Готовим…';
  try {
    bannerMediaDraft = await optimizeBannerImage(file);
    renderBannerMediaState();
    showToast('Изображение подготовлено для предпросмотра');
  } catch (error) {
    event.target.value = '';
    showToast(error.message || 'Не удалось добавить изображение');
  } finally {
    button.disabled = false;
    button.textContent = 'Выбрать файл';
  }
});

uploadInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (!file) return;
  if (isApiMode()) {
    void uploadVideoToStudio(file);
    event.target.value = '';
    return;
  }
  const title = file.name.replace(/\.[^.]+$/, '').trim() || 'Новое видео';
  const id = `upload-${Date.now()}`;
  const sizeInMb = file.size / 1024 / 1024;
  const fileSize = sizeInMb >= 1024 ? `${(sizeInMb / 1024).toFixed(1).replace('.', ',')} ГБ` : `${sizeInMb.toFixed(1).replace('.', ',')} МБ`;
  studio.uploads.unshift({ id, name: file.name, size: fileSize, status: 'Файл добавлен в локальную очередь', tone: 'processing' });
  studio.content.unshift({ id, title, kind: 'Короткое видео', genre: 'Драма', episodes: 1, status: 'draft', access: 'free', price: 0, poster: 'poster-four', views: 0, likes: 0, comments: 0 });
  studio.homeOrder.push(id);
  saveStudio();
  renderStudio();
  showToast('Файл добавлен в локальную демо-очередь');
  event.target.value = '';
});

uploadCancelButton.addEventListener('click', abortActiveUpload);

renderStudio();
if (isApiMode()) void loadRemoteStudio({ silent: true });
