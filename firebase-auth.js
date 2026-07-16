/* global window */
/*
 * Firebase is loaded only after a public runtime configuration enables it.
 * A loading or configuration error is intentionally non-fatal: app.js keeps
 * using the existing SakhaTube server account flow.
 */
(() => {
  const runtime = window.__SAKHATUBE_RUNTIME_CONFIG__ || {};
  const firebase = runtime.firebase || {};
  const config = firebase.config || {};
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const enabled = runtime.auth?.provider === 'firebase'
    && firebase.enabled === true
    && required.every((key) => typeof config[key] === 'string' && config[key].trim());

  let sdk;
  let sdkPromise;

  const providerError = (error) => {
    const code = String(error?.code || '');
    if (code === 'auth/email-already-in-use') return 'Этот логин уже занят.';
    if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') return 'Неверный логин или пароль.';
    if (code === 'auth/weak-password') return 'Выберите более надёжный пароль.';
    if (code === 'auth/invalid-email') return 'Введите корректный e-mail.';
    if (code === 'auth/too-many-requests') return 'Слишком много попыток. Попробуйте немного позже.';
    return 'Не удалось выполнить вход. Попробуйте ещё раз.';
  };

  const load = async () => {
    if (!enabled) return null;
    if (!sdkPromise) {
      sdkPromise = Promise.all([
        import('https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js')
      ]).then(([app, auth]) => {
        const appInstance = app.getApps().find((item) => item.name === '[DEFAULT]') || app.initializeApp(config);
        sdk = { auth, instance: auth.getAuth(appInstance) };
        return sdk;
      });
    }
    return sdkPromise;
  };

  // Firebase proves the identity. The SakhaTube server exchanges this
  // short-lived ID token for its own access/refresh session; no Firebase
  // refresh credential is copied into app storage.
  const identity = async (user, forceRefresh = false) => ({
    // A verification link can be opened seconds after the first token was
    // issued. Refresh during login/restore so `email_verified` is not stale.
    idToken: await user.getIdToken(forceRefresh),
    email: user.email || '',
    uid: user.uid,
    displayName: user.displayName || user.email?.split('@')[0] || 'Пользователь',
    emailVerified: user.emailVerified === true
  });

  window.SakhaTubeFirebaseAuth = Object.freeze({
    enabled,
    async register({ email, password, displayName }) {
      const current = await load();
      if (!current) throw new Error('Firebase не настроен.');
      try {
        const created = await current.auth.createUserWithEmailAndPassword(current.instance, email, password);
        if (displayName) await current.auth.updateProfile(created.user, { displayName });
        await current.auth.sendEmailVerification(created.user);
        return identity(created.user);
      } catch (error) {
        throw new Error(providerError(error));
      }
    },
    async login({ email, password }) {
      const current = await load();
      if (!current) throw new Error('Firebase не настроен.');
      try {
        const result = await current.auth.signInWithEmailAndPassword(current.instance, email, password);
        return identity(result.user, true);
      } catch (error) {
        throw new Error(providerError(error));
      }
    },
    async restore() {
      const current = await load();
      if (!current) return null;
      return new Promise((resolve) => {
        const stop = current.auth.onAuthStateChanged(current.instance, async (user) => {
          stop();
          resolve(user ? identity(user, true) : null);
        }, () => resolve(null));
      });
    },
    async logout() {
      const current = await load();
      if (current) await current.auth.signOut(current.instance);
    }
  });
})();
