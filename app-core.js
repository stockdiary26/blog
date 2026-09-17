// Shared state and the only list renderer / refresh / navigation entry points.
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
function normalizeImageAddress(value) {
  let address = String(value || '').trim();
  if (!address) throw new Error('이미지 주소를 입력하거나 빈 이미지 블록을 삭제하세요.');
  if (/^(?:[a-z]:[\\/]|file:)/i.test(address)) throw new Error('컴퓨터의 이미지 파일은 + 이미지 버튼으로 업로드하세요.');
  if (address.startsWith('//')) address = 'https:' + address;
  else if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(address)) address = 'https://' + address;
  let url;
  try { url = new URL(address); } catch { throw new Error('이미지 주소를 확인하세요. https://로 시작하는 이미지 주소를 입력하세요.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('http 또는 https 이미지 주소를 입력하세요.');
  return url.href;
}
let posts = [], cats = [], sections = [], selected = null;
let auth = { configured: false, authenticated: false };
let openPost;
const dialog = id => $('#' + id);
const fileData = file => new Promise((resolve, reject) => {
  if (!file) return resolve(null);
  const reader = new FileReader();
  reader.onload = () => resolve({ data: reader.result });
  reader.onerror = reject;
  reader.readAsDataURL(file);
});
function name(id) {
  return cats.find(category => category.id === id)?.name || sections.find(section => section.id === id)?.name || id;
}
const introDescriptions = Object.freeze({
  diary: '일상에서 건져 올린 생각과 감정의 조각들.',
  archive: '관심 가는 것을 모으고, 오래 바라볼 자료를 저장합니다.'
});
function currentRoute() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.has('post')) return { type: 'post', postId: params.get('post') };
  const section = sections.find(item => item.id === params.get('section'));
  if (!section) return { type: 'home' };
  const category = cats.find(item => item.id === params.get('category') && item.parentId === section.id);
  return { type: 'section', section, category };
}
function navigate(route) {
  const params = new URLSearchParams();
  if (route.postId) params.set('post', route.postId);
  else if (route.sectionId) {
    params.set('section', route.sectionId);
    if (route.categoryId) params.set('category', route.categoryId);
  }
  const hash = params.size ? '#' + params.toString() : '';
  if (location.hash !== hash) history.pushState({}, '', location.pathname + location.search + hash);
  render();
}
function openDetail(postId) { navigate({ postId }); }
function openCategory(id) {
  const category = cats.find(item => item.id === id);
  navigate(category ? { sectionId: category.parentId, categoryId: id } : { sectionId: id });
}
function renderCards(items, home = false) {
  return items.map(post => {
    const body = String(post.body || '');
    const summary = home && body.length > 50 ? body.slice(0, 50) + '…' : body;
    const image = post.mediaUrl && post.mediaType?.startsWith('image')
      ? `<img src="${esc(post.mediaUrl)}" alt="">` : '<div class="thumb-empty"></div>';
    return `<article class="card post" data-id="${esc(post.id)}">${image}<div class="card-body"><div class="meta"><span class="tag">${esc(name(post.category))}</span><span>${esc(post.date)}</span></div><h3>${esc(post.title)}</h3><p>${esc(summary)}</p></div></article>`;
  }).join('') || '<p class="empty">아직 기록이 없습니다.</p>';
}
function render() {
  const route = currentRoute();
  const post = route.type === 'post' ? posts.find(item => item.id === route.postId) : null;
  const activeSection = route.section?.id || (post && (cats.find(item => item.id === post.category)?.parentId || post.category));
  $('#nav').innerHTML = sections.map(section => `<button data-section="${esc(section.id)}" class="${activeSection === section.id ? 'on' : ''}">${esc(section.name)}</button>`).join('');
  if (post) { window.renderPostDetail(post.id); return; }
  if (route.type === 'post') history.replaceState({}, '', location.pathname + location.search);
  let eyebrow = 'recent notes';
  let heading = '<h1 style="line-height:1.2">그물에 걸리지 않는<br>바람처럼</h1>';
  let description = '다이어리와 아카이브의 최신 기록을 한곳에서 살펴보세요.';
  let tabs = '', items = posts, label = 'ALL RECORDS';
  if (route.type === 'section') {
    const { section, category } = route;
    const children = cats.filter(item => item.parentId === section.id);
    const ids = new Set([section.id, ...children.map(item => item.id)]);
    items = posts.filter(item => ids.has(item.category) && (!category || item.category === category.id));
    eyebrow = section.name;
    heading = `<h1>${esc(section.name)}<span class="category-title-suffix"><br>기록.</span></h1>`;
    description = introDescriptions[section.id] || `${section.name}에 관한 이야기와 자료를 모읍니다.`;
    label = section.name.toUpperCase();
    tabs = children.length ? `<div class="category-tabs">${children.map(item => `<button class="category-tab${category?.id === item.id ? ' is-active' : ''}" aria-pressed="${category?.id === item.id}" data-taxonomy-category="${esc(item.id)}">${esc(item.name)}</button>`).join('')}</div>` : '';
  }
  $('#app').innerHTML = `<section class="intro"><div><span class="ey">${esc(eyebrow)}</span>${heading}</div><div><div class="yellow"></div><p>${esc(description)}</p>${tabs}</div></section><section><div class="toolbar"><h2>${esc(label)} (${items.length})</h2></div><div class="cards">${renderCards(items, route.type === 'home')}</div></section>`;
}
let refreshVersion = 0;
async function refresh() {
  const version = ++refreshVersion;
  const results = await Promise.all(['/api/posts','/api/categories','/api/sections','/api/auth/status'].map(async url => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw Error('사이트 정보를 불러오지 못했습니다.');
    return response.json();
  }));
  if (version !== refreshVersion) return;
  [posts, cats, sections, auth] = results;
  cats = cats.map(category => ({ ...category, parentId: category.parentId || 'archive' }));
  $('#write').hidden = !auth.authenticated;
  document.dispatchEvent(new Event('auth-state-changed'));
  render();
}
document.addEventListener('click', event => {
  const target = event.target.closest('button, .post, .brand');
  if (!target) return;
  if (target.matches('.brand')) navigate({});
  else if (target.dataset.section) navigate({ sectionId: target.dataset.section });
  else if (target.dataset.taxonomyCategory) openCategory(target.dataset.taxonomyCategory);
  else if (target.dataset.openCategory) openCategory(target.dataset.openCategory);
  else if (target.dataset.openPost) openDetail(target.dataset.openPost);
  else if (target.matches('.post')) openDetail(target.dataset.id);
});
window.addEventListener('popstate', render);
$('#write').onclick = () => openPost();
$('#editPost').onclick = () => { dialog('detail').close(); openPost(posts.find(post => post.id === selected)); };
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => dialog(button.dataset.close).close());
$('#deletePost').onclick = async () => {
  if (!confirm('이 기록을 삭제할까요?')) return;
  const response = await fetch('/api/posts/' + $('#postId').value, { method: 'DELETE' });
  if (!response.ok) return alert((await response.json()).error);
  dialog('editor').close();
  await refresh();
};
$('#adminButton').onclick = () => {
  if (auth.authenticated) return window.openTaxonomyManager();
  $('#authForm').reset();
  $('#authError').textContent = '';
  $('#authTitle').textContent = auth.configured ? '관리자 로그인' : '관리자 계정 만들기';
  $('#authHelp').textContent = auth.configured ? '글과 카테고리를 관리하려면 로그인하세요.' : '처음 한 번만 관리자 계정을 생성합니다. 비밀번호는 10자 이상입니다.';
  $('#authSubmit').textContent = auth.configured ? '로그인' : '계정 만들기';
  dialog('auth').showModal();
};
$('#authForm').onsubmit = async event => {
  event.preventDefault();
  const response = await fetch(auth.configured ? '/api/auth/login' : '/api/auth/setup', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:$('#authUser').value,password:$('#authPassword').value}) });
  if (!response.ok) return $('#authError').textContent = (await response.json()).error;
  dialog('auth').close();
  await refresh();
};
