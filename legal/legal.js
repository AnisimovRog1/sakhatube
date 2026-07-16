const form = document.querySelector('[data-public-request-form]');
const developmentVerification = document.querySelector('[data-development-verification]');
let developmentVerificationData = null;

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const status = form.querySelector('[data-form-status]');
    const type = form.dataset.publicRequestForm;
    const payload = {
      email: form.elements.email.value.trim(),
      accountEmail: form.elements.accountEmail.value.trim() || undefined,
      message: form.elements.message.value.trim() || undefined,
      confirmation: form.elements.confirmation.checked
    };
    status.className = 'form-status';
    status.textContent = '';
    if (!payload.confirmation) {
      status.classList.add('error');
      status.textContent = 'Подтверди, что это твой адрес и запрос относится к твоим данным.';
      return;
    }
    submit.disabled = true;
    try {
      const response = await fetch(type === 'deletion' ? '/v1/privacy/deletion-requests' : '/v1/support/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Не удалось принять обращение. Попробуй ещё раз позже.');
      form.reset();
      status.classList.add('success');
      if (type === 'deletion') {
        status.textContent = 'Запрос принят. Подтверди его по ссылке из письма — до подтверждения удаление не начнётся.';
        if (body.developmentVerification && developmentVerification) {
          developmentVerificationData = body.developmentVerification;
          developmentVerification.hidden = false;
        }
      } else {
        status.textContent = `Обращение принято. Номер: ${body.requestId}.`;
      }
    } catch (error) {
      status.classList.add('error');
      status.textContent = error.message || 'Не удалось отправить обращение.';
    } finally {
      submit.disabled = false;
    }
  });
}

const developmentVerifyButton = document.querySelector('[data-development-verify]');
if (developmentVerifyButton) {
  developmentVerifyButton.addEventListener('click', async () => {
    if (!developmentVerificationData) return;
    developmentVerifyButton.disabled = true;
    try {
      const response = await fetch(developmentVerificationData.verifyPath, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ token: developmentVerificationData.token })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Не удалось подтвердить запрос.');
      developmentVerification.hidden = true;
      developmentVerificationData = null;
      const status = form?.querySelector('[data-form-status]');
      if (status) {
        status.className = 'form-status success';
        status.textContent = 'Тестовый запрос подтверждён. Теперь он доступен сотруднику для безопасного исполнения.';
      }
    } catch (error) {
      const status = form?.querySelector('[data-form-status]');
      if (status) {
        status.className = 'form-status error';
        status.textContent = error.message || 'Не удалось подтвердить запрос.';
      }
    } finally {
      developmentVerifyButton.disabled = false;
    }
  });
}

const emailVerification = document.querySelector('[data-email-verification]');
const emailVerifyButton = document.querySelector('[data-email-verify]');
const emailVerifyStatus = document.querySelector('[data-email-verify-status]');
const verificationRequestId = new URLSearchParams(window.location.search).get('request');
const verificationToken = new URLSearchParams(window.location.search).get('token');

if (emailVerification && emailVerifyButton && verificationRequestId && verificationToken) {
  emailVerification.hidden = false;
  emailVerifyButton.addEventListener('click', async () => {
    emailVerifyButton.disabled = true;
    emailVerifyStatus.className = 'form-status';
    try {
      const response = await fetch(`/v1/privacy/deletion-requests/${encodeURIComponent(verificationRequestId)}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ token: verificationToken })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Ссылка недействительна или истекла.');
      emailVerifyStatus.classList.add('success');
      emailVerifyStatus.textContent = 'Запрос подтверждён. Мы начнём безопасное удаление данных.';
      emailVerifyButton.hidden = true;
      window.history.replaceState({}, document.title, '/delete-account');
    } catch (error) {
      emailVerifyStatus.classList.add('error');
      emailVerifyStatus.textContent = error.message || 'Не удалось подтвердить запрос.';
      emailVerifyButton.disabled = false;
    }
  });
}

const accountVerification = document.querySelector('[data-account-email-verification]');
const accountVerifyButton = document.querySelector('[data-account-email-verify]');
const accountVerifyStatus = document.querySelector('[data-account-email-status]');
const accountId = new URLSearchParams(window.location.search).get('account');
const accountToken = new URLSearchParams(window.location.search).get('token');

if (accountVerification && accountVerifyButton && accountVerifyStatus) {
  if (!accountId || !accountToken) {
    accountVerifyButton.disabled = true;
    accountVerifyStatus.className = 'form-status error';
    accountVerifyStatus.textContent = 'Ссылка подтверждения неполная или устарела. Создай аккаунт заново.';
  } else {
    accountVerifyButton.addEventListener('click', async () => {
      accountVerifyButton.disabled = true;
      accountVerifyStatus.className = 'form-status';
      try {
        const response = await fetch('/v1/auth/verify-email', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ accountId, token: accountToken })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || 'Ссылка недействительна или уже использована.');
        accountVerifyStatus.classList.add('success');
        accountVerifyStatus.textContent = 'E-mail подтверждён. Теперь можно войти в приложение.';
        accountVerifyButton.hidden = true;
        window.history.replaceState({}, document.title, '/verify-email');
      } catch (error) {
        accountVerifyStatus.classList.add('error');
        accountVerifyStatus.textContent = error.message || 'Не удалось подтвердить e-mail.';
        accountVerifyButton.disabled = false;
      }
    });
  }
}
