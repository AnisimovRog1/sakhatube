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
