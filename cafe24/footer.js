(() => {
  const style = document.createElement('style');
  style.textContent = `.site-footer{display:flex;justify-content:center;align-items:center;text-align:center;border-top:1px solid var(--l);padding:22px 0 30px;margin-top:20px;color:var(--m);font-size:13px;letter-spacing:.02em}@media(max-width:700px){.site-footer{padding:18px 0 26px}}`;
  document.head.append(style);
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = '<span>© 2026 parkmikyoung. All rights reserved.</span>';
  document.querySelector('.w').append(footer);
})();
