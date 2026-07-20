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
    if (code === 'auth/email-already-in-use') return 'Этот e-mail уже зарегистрирован.';
    if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') return 'Неверный логин или пароль.';
    if (code === 'auth/weak-password') return 'Выберите более надёжный пароль.';
    if (code === 'auth/invalid-email') return 'Введите корректный e-mail.';
    if (code === 'auth/too-many-requests') return 'Слишком много попыток. Попробуйте немного позже.';
    if (code === 'auth/operation-not-allowed') return 'Вход через Apple ещё не подключён.';
    if (code === 'auth/account-exists-with-different-credential') return 'Для этого e-mail уже выбран другой способ входа.';
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
    async loginWithApple() {
      const current = await load();
      if (!current) throw new Error('Firebase не настроен.');
      const provider = new current.auth.OAuthProvider('apple.com');
      provider.setCustomParameters({ locale: 'ru' });
      try {
        const result = await current.auth.signInWithPopup(current.instance, provider);
        return identity(result.user, true);
      } catch (error) {
        // Mobile Safari can reject a popup. Firebase restores the credential
        // after the redirect; app.js then exchanges it on page start.
        if (String(error?.code || '') === 'auth/popup-blocked') {
          await current.auth.signInWithRedirect(current.instance, provider);
          return null;
        }
        throw new Error(providerError(error));
      }
    },
    async sendPasswordReset(email) {
      const current = await load();
      if (!current) throw new Error('Firebase не настроен.');
      try {
        await current.auth.sendPasswordResetEmail(current.instance, email.trim());
      } catch (error) {
        // Do not reveal whether an address exists: this avoids account
        // enumeration and matches Firebase's recommended recovery flow.
        if (String(error?.code || '') === 'auth/invalid-email') throw new Error('Введите корректный e-mail.');
        if (String(error?.code || '') === 'auth/too-many-requests') throw new Error('Слишком много попыток. Попробуйте немного позже.');
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
    },
    // register() creates the Firebase Auth account and sends the
    // verification e-mail before the SakhaTube server is ever consulted. If
    // the server then rejects registration (e.g. the chosen username is
    // taken), that Firebase account used to be left behind -- app.js only
    // signed the browser out, never deleted it -- permanently stranding the
    // e-mail: any retry throws auth/email-already-in-use even though no
    // SakhaTube account exists for it. Call this from that failure path
    // instead of logout() so the e-mail is free to register again.
    async discardUnregisteredAccount() {
      const current = await load();
      if (!current) return;
      const user = current.instance.currentUser;
      if (!user) return;
      try {
        await current.auth.deleteUser(user);
      } catch {
        // requires-recent-login or similar edge case -- deleting failed, but
        // at least drop the local session so a retry doesn't immediately
        // fail with a stale "already signed in" state.
        await current.auth.signOut(current.instance).catch(() => {});
      }
    }
  });
})();
