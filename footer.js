(() => {
  const style = document.createElement('style');
  style.textContent = `.site-footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--l);padding:22px 0 30px;margin-top:20px;color:var(--m);font-size:13px;letter-spacing:.02em}.site-footer span:last-child{color:var(--i)}@media(max-width:700px){.site-footer{padding:18px 0 26px;flex-direction:column;align-items:flex-start;gap:4px}}`;
  document.head.append(style);
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = '<span>© 2026 parkmikyoung. All rights reserved.</span><span>Personal archive</span>';
  document.querySelector('.w').append(footer);
})();
