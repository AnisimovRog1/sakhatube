const studioDefaults = {
  content: [
    { id: 'midnight', title: 'После полуночи', kind: 'Сериал', genre: 'Драма', episodes: 8, status: 'published', poster: 'poster-one', views: 128430, likes: 18320, comments: 846 },
    { id: 'signal', title: 'Тихий сигнал', kind: 'Сериал', genre: 'Мистика', episodes: 10, status: 'published', poster: 'poster-two', views: 96420, likes: 12180, comments: 593 },
    { id: 'one', title: 'Один на один', kind: 'Сериал', genre: 'Мелодрама', episodes: 12, status: 'published', poster: 'poster-three', views: 81210, likes: 10440, comments: 466 },
    { id: 'floor', title: 'Пятый этаж', kind: 'Сериал', genre: 'Триллер', episodes: 6, status: 'draft', poster: 'poster-four', views: 0, likes: 0, comments: 0 },
    { id: 'chance', title: 'Второй шанс', kind: 'Трейлер', genre: 'Семейный', episodes: 1, status: 'hidden', poster: 'poster-five', views: 15370, likes: 1150, comments: 88 }
  ],
  homeOrder: ['midnight', 'signal', 'one', 'floor'],
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
let toastTimer;

const contentTable = document.querySelector('#content-table');
const homeOrderGrid = document.querySelector('#home-order-grid');
const commentList = document.querySelector('#comment-list');
const uploadList = document.querySelector('#upload-list');
const contentDialog = document.querySelector('#content-dialog');
const confirmDialog = document.querySelector('#confirm-dialog');
const contentForm = document.querySelector('#content-form');
const studioToast = document.querySelector('#studio-toast');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadStudio() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!saved?.content || !saved?.homeOrder || !saved?.comments || !saved?.uploads) return clone(studioDefaults);
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

function contentById(id) {
  return studio.content.find((item) => item.id === id);
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
  const head = '<div class="table-head"><span>КОНТЕНТ</span><span>СТАТУС</span><span>ПРОСМОТРЫ</span><span>РЕАКЦИИ</span><span>КОММЕНТАРИИ</span><span></span></div>';
  const rows = visible.map((item) => `<article class="content-row"><div class="content-title"><div class="content-poster ${item.poster}"></div><div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.kind)} · ${escapeHTML(item.genre)} · ${item.episodes} ${item.episodes === 1 ? 'видео' : 'серий'}</small></div></div><div><span class="status ${item.status}">${statusLabel(item.status)}</span></div><span class="table-value"><strong>${compact(item.views)}</strong>всего</span><span class="table-value"><strong>${compact(item.likes)}</strong>нравится</span><span class="table-value"><strong>${compact(item.comments)}</strong>всего</span><div class="row-menu"><button data-action="edit-content" data-id="${item.id}" type="button">Изменить</button><button data-action="delete-content" data-id="${item.id}" type="button">Удалить</button></div></article>`).join('');
  contentTable.innerHTML = head + (rows || '<div class="empty-table">Ничего не найдено. Сбрось фильтр или добавь новый контент.</div>');
}

function renderHomeOrder() {
  const items = studio.homeOrder.map(contentById).filter(Boolean);
  homeOrderGrid.innerHTML = items.map((item, index) => `<article class="order-card"><div class="order-poster ${item.poster}"><span class="order-number">${index + 1}</span></div><div class="order-info"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.genre)} · ${statusLabel(item.status)}</p><div class="reorder-actions"><button data-action="move-home" data-id="${item.id}" data-direction="up" type="button" ${index === 0 ? 'disabled' : ''}>↑ Выше</button><button data-action="move-home" data-id="${item.id}" data-direction="down" type="button" ${index === items.length - 1 ? 'disabled' : ''}>↓ Ниже</button></div></div></article>`).join('') || '<p class="empty-copy">Добавь сериал, чтобы собрать витрину.</p>';
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
  }
  openDialog(contentDialog);
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
  showToast('Порядок витрины обновлён');
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
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const { action: name, id } = action.dataset;
  if (name === 'new-series') openContentDialog();
  if (name === 'upload') document.querySelector('#video-upload').click();
  if (name === 'edit-content') openContentDialog(contentById(id));
  if (name === 'delete-content') askDelete(id);
  if (name === 'move-home') moveHome(id, action.dataset.direction);
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
    status: document.querySelector('#content-status').value
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

document.querySelector('#content-search').addEventListener('input', renderContent);
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
  studio.content.unshift({ id, title, kind: 'Короткое видео', genre: 'Драма', episodes: 1, status: 'draft', poster: 'poster-four', views: 0, likes: 0, comments: 0 });
  studio.homeOrder.push(id);
  saveStudio();
  renderStudio();
  showToast('Файл добавлен в демо-очередь');
  event.target.value = '';
});

renderStudio();
