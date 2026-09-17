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
  legacyButton.after(authButton, categoryButton);
  legacyButton.hidden = true;

  const syncAuthControls = () => {
    authButton.textContent = auth.authenticated ? 'Logout' : 'Sign in';
    categoryButton.hidden = !auth.authenticated;
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
