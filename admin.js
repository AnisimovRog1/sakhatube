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
let studio = loadStudio();
let contentFilter = 'all';
let commentFilter = 'pending';
let pendingDeleteId = null;
let previewMode = 'phone';
let bannerMediaDraft = null;
let toastTimer;

const contentTable = document.querySelector('#content-table');
const homeOrderGrid = document.querySelector('#home-order-grid');
const commentList = document.querySelector('#comment-list');
const uploadList = document.querySelector('#upload-list');
const bannerList = document.querySelector('#banner-list');
const homeLivePreview = document.querySelector('#home-live-preview');
const contentDialog = document.querySelector('#content-dialog');
const bannerDialog = document.querySelector('#banner-dialog');
const confirmDialog = document.querySelector('#confirm-dialog');
const contentForm = document.querySelector('#content-form');
const bannerForm = document.querySelector('#banner-form');
const studioToast = document.querySelector('#studio-toast');

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

function saveStudio() {
  localStorage.setItem(storageKey, JSON.stringify(studio));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function compact(value) {
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function statusLabel(status) {
  return { published: 'Опубликовано', draft: 'Черновик', hidden: 'Скрыто' }[status] || status;
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
    meta.textContent = `Готово для витрины · ${formatBytes(bannerMediaDraft.size)}`;
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
  toastTimer = window.setTimeout(() => studioToast.classList.remove('is-visible'), 2800);
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

function renderDashboard() {
  const totalViews = studio.content.reduce((sum, item) => sum + item.views, 0);
  const totalLikes = studio.content.reduce((sum, item) => sum + item.likes, 0);
  const totalComments = studio.comments.filter((item) => item.status !== 'hidden').length + studio.content.reduce((sum, item) => sum + item.comments, 0);
  const published = studio.content.filter((item) => item.status === 'published').length;
  const pending = studio.comments.filter((item) => item.status === 'pending').length;
  document.querySelector('#metrics-grid').innerHTML = [
    { label: 'Просмотры', value: compact(Math.round(totalViews * .032)), delta: '+12,4% к прошлой неделе' },
    { label: 'Реакции', value: compact(totalLikes), delta: '+8,1% к прошлой неделе' },
    { label: 'Комментарии', value: compact(totalComments), delta: `${pending} ждут проверки`, neutral: pending === 0 },
    { label: 'В эфире', value: `${published} сериалов`, delta: 'Контент доступен зрителям', neutral: true }
  ].map((metric) => `<article class="metric-card"><p>${metric.label}</p><strong>${metric.value}</strong><small class="${metric.neutral ? 'is-neutral' : ''}">${metric.delta}</small></article>`).join('');
  document.querySelector('#chart-total').textContent = compact(totalViews);
  document.querySelector('#comment-badge').textContent = pending;
  const attention = studio.comments.filter((item) => item.status === 'pending').slice(0, 3);
  document.querySelector('#attention-list').innerHTML = attention.length ? attention.map((comment) => `<div class="attention-item"><i></i><div><strong>${escapeHTML(comment.author)}</strong><span>${escapeHTML(comment.text)}</span></div><button data-view="comments" type="button">Проверить</button></div>`).join('') : '<div class="attention-item"><i style="background:var(--green)"></i><div><strong>Всё чисто</strong><span>Новых комментариев нет</span></div></div>';
  const top = studio.content.filter((item) => item.status === 'published').sort((a, b) => b.views - a.views).slice(0, 3);
  document.querySelector('#top-content-list').innerHTML = top.map((item) => `<article class="top-content-item"><div class="mini-poster ${item.poster}"></div><div><h4>${escapeHTML(item.title)}</h4><p>${item.genre} · ${item.episodes} ${item.episodes === 1 ? 'видео' : 'серий'}</p><strong>${compact(item.views)} просмотров</strong></div></article>`).join('') || '<p class="empty-copy">Пока нет опубликованного контента.</p>';
}

function renderContent() {
  const query = document.querySelector('#content-search').value.trim().toLocaleLowerCase();
  const visible = studio.content.filter((item) => {
    const matchesFilter = contentFilter === 'all' || item.status === contentFilter;
    return matchesFilter && `${item.title} ${item.genre} ${item.kind}`.toLocaleLowerCase().includes(query);
  });
  const head = '<div class="table-head"><span>КОНТЕНТ</span><span>СТАТУС</span><span>ДОСТУП</span><span>ПРОСМОТРЫ</span><span>РЕАКЦИИ</span><span>КОММЕНТАРИИ</span><span></span></div>';
  const rows = visible.map((item) => `<article class="content-row"><div class="content-title"><div class="content-poster ${item.poster}"></div><div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.kind)} · ${escapeHTML(item.genre)} · ${item.episodes} ${item.episodes === 1 ? 'видео' : 'серий'}</small></div></div><div><span class="status ${item.status}">${statusLabel(item.status)}</span></div><span class="access ${item.access}">${accessLabel(item.access, item.price)}</span><span class="table-value"><strong>${compact(item.views)}</strong>всего</span><span class="table-value"><strong>${compact(item.likes)}</strong>нравится</span><span class="table-value"><strong>${compact(item.comments)}</strong>всего</span><div class="row-menu"><button data-action="edit-content" data-id="${item.id}" type="button">Изменить</button><button data-action="delete-content" data-id="${item.id}" type="button">Удалить</button></div></article>`).join('');
  contentTable.innerHTML = head + (rows || '<div class="empty-table">Ничего не найдено. Сбрось фильтр или добавь новый контент.</div>');
}

function renderHomeOrder() {
  const items = studio.homeOrder.map(contentById).filter(Boolean);
  homeOrderGrid.innerHTML = items.map((item, index) => `<article class="order-card"><div class="order-poster ${item.poster}"><span class="order-number">${index + 1}</span></div><div class="order-info"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.genre)} · ${accessLabel(item.access, item.price)}</p><div class="reorder-actions"><button data-action="move-home" data-id="${item.id}" data-direction="up" type="button" ${index === 0 ? 'disabled' : ''}>↑ Выше</button><button data-action="move-home" data-id="${item.id}" data-direction="down" type="button" ${index === items.length - 1 ? 'disabled' : ''}>↓ Ниже</button></div></div></article>`).join('') || '<p class="empty-copy">Добавь сериал, чтобы собрать витрину.</p>';
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
  const banners = studio.banners;
  bannerList.innerHTML = banners.map((banner, index) => {
    const linked = contentById(banner.contentId);
    return `<article class="banner-card ${banner.active ? '' : 'is-paused'}"><div class="banner-art ${escapeHTML(banner.tone)}" data-banner-art="${escapeHTML(banner.id)}"><span>${index + 1}</span></div><div class="banner-copy"><div><strong>${escapeHTML(banner.title)}</strong><small>${linked ? escapeHTML(linked.title) : 'Без привязанного контента'} · ${banner.active ? 'виден зрителю' : 'скрыт'}</small></div><div class="banner-actions"><button data-action="edit-banner" data-id="${banner.id}" type="button">Изменить</button><button data-action="toggle-banner" data-id="${banner.id}" type="button">${banner.active ? 'Скрыть' : 'Показать'}</button><button data-action="move-banner" data-id="${banner.id}" data-direction="up" type="button" ${index === 0 ? 'disabled' : ''} aria-label="Поднять баннер">↑</button><button data-action="move-banner" data-id="${banner.id}" data-direction="down" type="button" ${index === banners.length - 1 ? 'disabled' : ''} aria-label="Опустить баннер">↓</button></div></div></article>`;
  }).join('') || '<p class="empty-copy">Добавь первый баннер, чтобы собрать верхний экран.</p>';
  studio.banners.forEach((banner) => applyBannerMedia(bannerList.querySelector(`[data-banner-art="${banner.id}"]`), banner.media));
}

function renderComments() {
  const visible = studio.comments.filter((comment) => commentFilter === 'all' || comment.status === commentFilter);
  commentList.innerHTML = visible.map((comment) => `<article class="comment-card"><span class="comment-avatar">${escapeHTML(comment.initials)}</span><div class="comment-copy"><h3>${escapeHTML(comment.author)}<span>${escapeHTML(comment.time)}</span></h3><p>${escapeHTML(comment.text)}</p><small>${escapeHTML(comment.content)} · ${comment.status === 'pending' ? 'на проверке' : comment.status === 'hidden' ? 'скрыт' : 'опубликован'}</small></div><div class="comment-actions">${comment.status !== 'approved' ? `<button data-action="approve-comment" data-id="${comment.id}" type="button">Одобрить</button>` : ''}${comment.status !== 'hidden' ? `<button data-action="hide-comment" data-id="${comment.id}" type="button">Скрыть</button>` : ''}<button class="is-danger" data-action="delete-comment" data-id="${comment.id}" type="button">Удалить</button></div></article>`).join('') || '<article class="comment-card"><span class="comment-avatar">✓</span><div class="comment-copy"><h3>Нет комментариев</h3><p>В этой папке пока пусто.</p></div></article>';
}

function renderUploads() {
  uploadList.innerHTML = studio.uploads.map((upload) => `<article class="upload-item"><span>▶</span><div><strong>${escapeHTML(upload.name)}</strong><small>${escapeHTML(upload.size)} · ${escapeHTML(upload.status)}</small></div><span class="status ${upload.tone === 'ready' ? 'published' : 'draft'}">${upload.tone === 'ready' ? 'Готово' : 'В работе'}</span></article>`).join('') || '<p class="empty-copy">Файлов пока нет.</p>';
}

function renderStudio() {
  renderDashboard();
  renderContent();
  renderHomeOrder();
  renderHomePreview();
  renderBanners();
  renderComments();
  renderUploads();
}

function navigate(view) {
  const labels = { dashboard: ['STUDIO', 'Обзор'], content: ['КОНТЕНТ', 'Контент'], home: ['ВИТРИНА', 'Главная'], comments: ['МОДЕРАЦИЯ', 'Комментарии'], uploads: ['МЕДИА', 'Загрузки'] };
  document.querySelectorAll('[data-studio-view]').forEach((section) => section.classList.toggle('is-visible', section.dataset.studioView === view));
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
  document.querySelector('#studio-kicker').textContent = labels[view][0];
  document.querySelector('#studio-page-title').textContent = labels[view][1];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openContentDialog(item = null) {
  contentForm.reset();
  document.querySelector('#content-id').value = item?.id || '';
  document.querySelector('#content-dialog-eyebrow').textContent = item ? 'РЕДАКТИРОВАНИЕ' : 'НОВЫЙ КОНТЕНТ';
  document.querySelector('#content-dialog-title').textContent = item ? 'Изменить карточку' : 'Добавить сериал';
  if (item) {
    document.querySelector('#content-title').value = item.title;
    document.querySelector('#content-genre').value = item.genre;
    document.querySelector('#content-kind').value = item.kind;
    document.querySelector('#content-episodes').value = item.episodes;
    document.querySelector('#content-status').value = item.status;
    document.querySelector('#content-access').value = item.access || 'free';
    document.querySelector('#content-price').value = item.price || 0;
  }
  openDialog(contentDialog);
}

function openBannerDialog(banner = null) {
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
  document.querySelector('#confirm-title').textContent = `Удалить «${item.title}»?`;
  document.querySelector('#confirm-copy').textContent = 'Карточка исчезнет из Studio и с главной витрины. В настоящем сервисе удаление видео потребует отдельного подтверждения прав.';
  openDialog(confirmDialog);
}

function moveHome(id, direction) {
  const index = studio.homeOrder.indexOf(id);
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= studio.homeOrder.length) return;
  [studio.homeOrder[index], studio.homeOrder[nextIndex]] = [studio.homeOrder[nextIndex], studio.homeOrder[index]];
  saveStudio();
  renderHomeOrder();
  renderHomePreview();
  showToast('Порядок витрины обновлён');
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

function updateComment(id, status) {
  const comment = studio.comments.find((item) => item.id === id);
  if (!comment) return;
  comment.status = status;
  saveStudio();
  renderDashboard();
  renderComments();
  showToast(status === 'approved' ? 'Комментарий опубликован' : 'Комментарий скрыт');
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
  if (!action) return;
  const { action: name, id } = action.dataset;
  if (name === 'new-series') openContentDialog();
  if (name === 'new-banner') openBannerDialog();
  if (name === 'upload') document.querySelector('#video-upload').click();
  if (name === 'select-banner-media') document.querySelector('#banner-media').click();
  if (name === 'remove-banner-media') { bannerMediaDraft = null; document.querySelector('#banner-media').value = ''; renderBannerMediaState(); showToast('Изображение убрано из баннера'); }
  if (name === 'edit-content') openContentDialog(contentById(id));
  if (name === 'delete-content') askDelete(id);
  if (name === 'move-home') moveHome(id, action.dataset.direction);
  if (name === 'move-banner') moveBanner(id, action.dataset.direction);
  if (name === 'edit-banner') openBannerDialog(bannerById(id));
  if (name === 'toggle-banner') { const banner = bannerById(id); if (banner) { banner.active = !banner.active; saveStudio(); renderHomePreview(); renderBanners(); showToast(banner.active ? 'Баннер показан зрителю' : 'Баннер скрыт'); } }
  if (name === 'save-home') showToast('Порядок главной сохранён');
  if (name === 'approve-comment') updateComment(id, 'approved');
  if (name === 'hide-comment') updateComment(id, 'hidden');
  if (name === 'delete-comment') { studio.comments = studio.comments.filter((comment) => comment.id !== id); saveStudio(); renderDashboard(); renderComments(); showToast('Комментарий удалён'); }
  if (name === 'reset-demo') {
    if (window.confirm('Сбросить все демо-изменения Studio на этом устройстве?')) { studio = clone(studioDefaults); saveStudio(); renderStudio(); showToast('Демо-данные восстановлены'); }
  }
});

document.querySelector('#confirm-delete').addEventListener('click', () => {
  if (!pendingDeleteId) return;
  studio.content = studio.content.filter((item) => item.id !== pendingDeleteId);
  studio.homeOrder = studio.homeOrder.filter((id) => id !== pendingDeleteId);
  saveStudio();
  closeDialog(confirmDialog);
  pendingDeleteId = null;
  renderStudio();
  showToast('Карточка удалена из Studio');
});

contentForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const id = document.querySelector('#content-id').value;
  const data = {
    title: document.querySelector('#content-title').value.trim(),
    genre: document.querySelector('#content-genre').value,
    kind: document.querySelector('#content-kind').value,
    episodes: Number(document.querySelector('#content-episodes').value),
    status: document.querySelector('#content-status').value,
    access: document.querySelector('#content-access').value,
    price: Math.max(0, Number(document.querySelector('#content-price').value) || 0)
  };
  if (id) {
    Object.assign(contentById(id), data);
    showToast('Карточка обновлена');
  } else {
    const newId = `item-${Date.now()}`;
    const posters = ['poster-one', 'poster-two', 'poster-three', 'poster-four', 'poster-five'];
    studio.content.unshift({ id: newId, ...data, poster: posters[studio.content.length % posters.length], views: 0, likes: 0, comments: 0 });
    studio.homeOrder.push(newId);
    showToast('Черновик добавлен в Studio');
  }
  saveStudio();
  closeDialog(contentDialog);
  renderStudio();
});

bannerForm.addEventListener('submit', (event) => {
  event.preventDefault();
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
  if (id) {
    Object.assign(bannerById(id), data);
    showToast('Баннер обновлён');
  } else {
    studio.banners.push({ id: `banner-${Date.now()}`, ...data });
    showToast('Баннер добавлен в главную');
  }
  saveStudio();
  closeDialog(bannerDialog);
  renderHomePreview();
  renderBanners();
});

document.querySelector('#content-search').addEventListener('input', renderContent);
document.querySelector('#banner-media').addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const button = document.querySelector('[data-action="select-banner-media"]');
  button.disabled = true;
  button.textContent = 'Готовим…';
  try {
    bannerMediaDraft = await optimizeBannerImage(file);
    renderBannerMediaState();
    showToast('Изображение подготовлено для баннера');
  } catch (error) {
    event.target.value = '';
    showToast(error.message || 'Не удалось добавить изображение');
  } finally {
    button.disabled = false;
    button.textContent = 'Выбрать файл';
  }
});
document.querySelector('#video-upload').addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const title = file.name.replace(/\.[^.]+$/, '').trim() || 'Новое видео';
  const id = `upload-${Date.now()}`;
  const sizeInMb = file.size / 1024 / 1024;
  const fileSize = sizeInMb >= 1024
    ? `${(sizeInMb / 1024).toFixed(1).replace('.', ',')} ГБ`
    : `${sizeInMb.toFixed(1).replace('.', ',')} МБ`;
  studio.uploads.unshift({ id, name: file.name, size: fileSize, status: 'Файл добавлен в демо', tone: 'processing' });
  studio.content.unshift({ id, title, kind: 'Короткое видео', genre: 'Драма', episodes: 1, status: 'draft', access: 'free', price: 0, poster: 'poster-four', views: 0, likes: 0, comments: 0 });
  studio.homeOrder.push(id);
  saveStudio();
  renderStudio();
  showToast('Файл добавлен в демо-очередь');
  event.target.value = '';
});

renderStudio();
