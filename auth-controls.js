(() => {
  const style = document.createElement('style');
  style.textContent = `#authButton,#categoryButton{margin-left:26px}@media(max-width:700px){#authButton,#categoryButton{margin-left:14px}}`;
  document.head.append(style);
  const legacyButton = $('#adminButton');
  const authButton = document.createElement('button');
  authButton.className = 'link';
  authButton.id = 'authButton';
  const categoryButton = document.createElement('button');
  categoryButton.className = 'link';
  categoryButton.id = 'categoryButton';
  categoryButton.textContent = 'Admin';
  const passwordButton = document.createElement('button');
  passwordButton.className = 'btn';
  passwordButton.id = 'passwordButton';
  passwordButton.textContent = '비밀번호 변경';
  legacyButton.after(authButton, categoryButton);
  const adminDialog = document.getElementById('taxonomyManager');
  const accountActions = document.createElement('div');
  accountActions.className = 'actions';
  accountActions.append(passwordButton);
  adminDialog.querySelector('.inner').append(accountActions);
  const passwordDialog = document.createElement('dialog');
  passwordDialog.innerHTML = `<form class="inner"><div class="head"><h2>비밀번호 변경</h2><button type="button" class="close">×</button></div><p>새 비밀번호는 10~256자로 입력하세요. 변경하면 다른 기기의 로그인은 해제됩니다.</p><div class="field"><label for="currentPassword">현재 비밀번호</label><input id="currentPassword" type="password" autocomplete="current-password" required maxlength="256"></div><div class="field"><label for="newPassword">새 비밀번호</label><input id="newPassword" type="password" autocomplete="new-password" required minlength="10" maxlength="256"></div><div class="field"><label for="confirmPassword">새 비밀번호 확인</label><input id="confirmPassword" type="password" autocomplete="new-password" required minlength="10" maxlength="256"></div><p class="password-message" role="status" aria-live="polite"></p><div class="actions"><button class="btn primary" type="submit">변경하기</button></div></form>`;
  document.body.append(passwordDialog);
  const passwordForm = passwordDialog.querySelector('form');
  const message = passwordDialog.querySelector('.password-message');
  const resetPassword = () => { passwordForm.reset(); message.textContent = ''; };
  passwordDialog.querySelector('.close').onclick = () => passwordDialog.close();
  passwordDialog.addEventListener('close', resetPassword);
  passwordButton.onclick = () => { resetPassword(); passwordDialog.showModal(); };
  passwordForm.onsubmit = async event => {
    event.preventDefault();
    const submit = passwordForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const response = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: $('#currentPassword').value, newPassword: $('#newPassword').value, confirmPassword: $('#confirmPassword').value }) });
      const result = await response.json();
      if (!response.ok) { message.textContent = result.error || '변경하지 못했습니다.'; return; }
      passwordForm.reset();
      await refresh();
      message.textContent = '비밀번호를 변경했습니다.';
    } catch { message.textContent = '서버에 연결하지 못했습니다. 다시 시도해 주세요.'; }
    finally { submit.disabled = false; }
  };
  legacyButton.hidden = true;

  const syncAuthControls = () => {
    authButton.textContent = auth.authenticated ? 'Logout' : 'Sign in';
    categoryButton.hidden = !auth.authenticated;
    passwordButton.hidden = !auth.authenticated;
    if (!auth.authenticated && passwordDialog.open) passwordDialog.close();
  };
  document.addEventListener('auth-state-changed', syncAuthControls);
  authButton.onclick = async () => {
    if (!auth.authenticated) return legacyButton.click();
    await fetch('/api/auth/logout', { method: 'POST' });
    await refresh();
  };
  categoryButton.onclick = () => openTaxonomyManager();
  syncAuthControls();
})();
