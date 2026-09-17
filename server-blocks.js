const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { previewImage } = require('./link-preview');

const root = __dirname;
const data = path.join(root, 'data');
const uploads = path.join(data, 'uploads');
const postsFile = path.join(data, 'posts.json');
const categoriesFile = path.join(data, 'categories.json');
const sectionsFile = path.join(data, 'sections.json');
const adminFile = path.join(data, 'admin.json');
const sessions = new Map();

fs.mkdirSync(uploads, { recursive: true });
if (!fs.existsSync(postsFile)) fs.writeFileSync(postsFile, '[]');
if (!fs.existsSync(categoriesFile)) fs.writeFileSync(categoriesFile, JSON.stringify([
  { id: 'sewing', name: 'Sewing' }, { id: 'travel', name: 'Travel' },
  { id: 'book', name: 'Book' }, { id: 'design', name: 'Design' }
], null, 2));
if (!fs.existsSync(sectionsFile)) fs.writeFileSync(sectionsFile, JSON.stringify([
  { id: 'diary', name: 'Diary', locked: true },
  { id: 'archive', name: 'Archive', locked: true }
], null, 2));

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2));
const send = (res, code, value, type = 'application/json; charset=utf-8', headers = {}) => {
  res.writeHead(code, { 'Content-Type': type, ...headers });
  res.end(typeof value === 'string' ? value : JSON.stringify(value));
};
const readBody = req => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; if (raw.length > 29e6) reject(Error('File too large')); });
  req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(Error('Invalid JSON')); } });
  req.on('error', reject);
});
const getAdmin = () => fs.existsSync(adminFile) ? read(adminFile) : null;
const cookie = (req, name) => (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.split('=')[1];
const authenticated = req => sessions.has(cookie(req, 'memoir_session'));
const guard = (req, res) => authenticated(req) || !(send(res, 401, { error: 'Admin login required' }));
const hash = password => { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') }; };
const verify = (password, account) => crypto.timingSafeEqual(Buffer.from(account.hash, 'hex'), crypto.scryptSync(password, account.salt, 64));
const beginSession = res => {
  const id = crypto.randomUUID();
  sessions.set(id, 1);
  send(res, 200, { authenticated: true }, undefined, { 'Set-Cookie': `memoir_session=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` });
};
const mime = file => ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm' }[path.extname(file)] || 'application/octet-stream');
const categoryExists = id => read(sectionsFile).some(section => section.id === id) || read(categoriesFile).some(category => category.id === id);

function storeMedia(media) {
  if (!media?.data) return {};
  const match = /^data:([^;]+);base64,(.+)$/.exec(media.data);
  const type = match?.[1];
  const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm' }[type];
  if (!ext) throw Error('Unsupported media type');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 20 * 1024 * 1024) throw Error('File too large');
  const name = crypto.randomUUID() + ext;
  fs.writeFileSync(path.join(uploads, name), bytes);
  return { mediaUrl: '/uploads/' + name, mediaType: type };
}

function removeMedia(item) {
  if (!item?.mediaUrl) return;
  const file = path.join(uploads, path.basename(item.mediaUrl));
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function removePostMedia(post) {
  const urls = new Set([post.mediaUrl, ...(post.blocks || []).filter(block => block.type === 'image').map(block => block.mediaUrl)]);
  urls.forEach(mediaUrl => removeMedia({ mediaUrl }));
}

async function makePost(input, existing = {}) {
  if (!categoryExists(input.category)) throw Error('제목, 내용, 카테고리를 확인하세요.');
  const title = String(input.title || '').trim().slice(0, 160);
  if (!title) throw Error('제목, 내용, 카테고리를 확인하세요.');
  let blocks;
  if (Array.isArray(input.blocks)) {
    blocks = input.blocks.map(block => {
      if (block.type === 'image') return { type: 'image', ...storeMedia(block.media) };
      const content = String(block.content || '');
      return content.trim() ? { type: 'text', content } : null;
    }).filter(Boolean);
    if (!blocks.length) throw Error('내용을 입력하거나 이미지를 추가하세요.');
  } else {
    const content = String(input.body || '');
    if (!content.trim()) throw Error('제목, 내용, 카테고리를 확인하세요.');
    const media = storeMedia(input.media);
    blocks = [{ type: 'text', content }, ...(media.mediaUrl ? [{ type: 'image', ...media }] : [])];
  }
  const firstImage = blocks.find(block => block.type === 'image');
  const body = blocks.filter(block => block.type === 'text').map(block => block.content).join('\n');
  const preview = firstImage ? null : await previewImage(body);
  const thumbnail = firstImage || (preview ? storeMedia(preview) : {});
  return { ...existing, category: input.category, title, body, blocks, mediaUrl: thumbnail.mediaUrl, mediaType: thumbnail.mediaType };
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    const postMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
    const categoryMatch = url.pathname.match(/^\/api\/categories\/([^/]+)$/);
    const sectionMatch = url.pathname.match(/^\/api\/sections\/([^/]+)$/);

    if (req.method === 'GET' && url.pathname === '/api/auth/status') return send(res, 200, { configured: Boolean(getAdmin()), authenticated: authenticated(req) });
    if (req.method === 'POST' && url.pathname === '/api/auth/setup') {
      if (getAdmin()) return send(res, 409, { error: 'Admin already configured' });
      const input = await readBody(req);
      if (!/^[a-zA-Z0-9_-]{3,32}$/.test(input.username || '') || String(input.password || '').length < 10) return send(res, 400, { error: 'ID는 3~32자, 비밀번호는 10자 이상이어야 합니다.' });
      write(adminFile, { username: input.username, ...hash(input.password) });
      return beginSession(res);
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const input = await readBody(req), account = getAdmin();
      if (!account || input.username !== account.username || !verify(String(input.password || ''), account)) return send(res, 401, { error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      return beginSession(res);
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      sessions.delete(cookie(req, 'memoir_session'));
      return send(res, 200, { authenticated: false }, undefined, { 'Set-Cookie': 'memoir_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
    }

    if (req.method === 'GET' && url.pathname === '/api/sections') return send(res, 200, read(sectionsFile));
    if (req.method === 'POST' && url.pathname === '/api/sections') {
      if (!guard(req, res)) return;
      const input = await readBody(req), name = String(input.name || '').trim();
      if (!name || name.length > 40) return send(res, 400, { error: '메뉴 이름은 1~40자로 입력하세요.' });
      const sections = read(sectionsFile); let base = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'menu'; let id = base, suffix = 2;
      while (sections.some(section => section.id === id) || read(categoriesFile).some(category => category.id === id)) id = base + '-' + suffix++;
      const section = { id, name }; sections.push(section); write(sectionsFile, sections); return send(res, 201, section);
    }
    if (sectionMatch && req.method === 'DELETE') {
      if (!guard(req, res)) return;
      const sections = read(sectionsFile), section = sections.find(item => item.id === sectionMatch[1]);
      if (!section) return send(res, 404, {});
      if (section.locked) return send(res, 409, { error: '기본 메뉴는 삭제할 수 없습니다.' });
      const children = read(categoriesFile).filter(category => (category.parentId || 'archive') === section.id);
      const hasPosts = read(postsFile).some(post => post.category === section.id || post.sectionId === section.id || children.some(category => category.id === post.category));
      if (children.length || hasPosts) return send(res, 409, { error: '하위 카테고리나 글이 남아 있습니다. 먼저 이동하거나 삭제한 후 메뉴를 삭제해 주세요.' });
      write(sectionsFile, sections.filter(item => item.id !== section.id)); return send(res, 204, '');
    }
    if (sectionMatch && req.method === 'PUT') {
      if (!guard(req, res)) return;
      const input = await readBody(req), sections = read(sectionsFile), index = sections.findIndex(item => item.id === sectionMatch[1]), name = String(input.name || '').trim();
      if (index < 0) return send(res, 404, {}); if (!name || name.length > 40) return send(res, 400, { error: '메뉴 이름은 1~40자로 입력하세요.' });
      sections[index] = { ...sections[index], name }; write(sectionsFile, sections); return send(res, 200, sections[index]);
    }

    if (req.method === 'GET' && url.pathname === '/api/categories') return send(res, 200, read(categoriesFile).map(category => ({ ...category, parentId: category.parentId || 'archive' })));
    if (req.method === 'POST' && url.pathname === '/api/categories') {
      if (!guard(req, res)) return;
      const input = await readBody(req), name = String(input.name || '').trim();
      if (!name || name.length > 40) return send(res, 400, { error: '카테고리 이름은 1~40자로 입력하세요.' });
      const categories = read(categoriesFile); let base = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'archive'; let id = base, suffix = 2;
      while (categories.some(category => category.id === id) || read(sectionsFile).some(section => section.id === id)) id = base + '-' + suffix++;
      const parentId = input.parentId || 'archive'; if (!read(sectionsFile).some(section => section.id === parentId)) return send(res, 400, { error: '상위 메뉴를 확인하세요.' });
      const category = { id, name, parentId, ...storeMedia(input.media) }; categories.push(category); write(categoriesFile, categories); return send(res, 201, category);
    }
    if (categoryMatch && req.method === 'PUT') {
      if (!guard(req, res)) return;
      const input = await readBody(req), categories = read(categoriesFile), index = categories.findIndex(category => category.id === categoryMatch[1]), name = String(input.name || '').trim();
      if (index < 0) return send(res, 404, {}); if (!name || name.length > 40) return send(res, 400, { error: '카테고리 이름은 1~40자로 입력하세요.' });
      const parentId = input.parentId || categories[index].parentId || 'archive'; if (!read(sectionsFile).some(section => section.id === parentId)) return send(res, 400, { error: '상위 메뉴를 확인하세요.' });
      let category = { ...categories[index], name, parentId }; if (input.media) { removeMedia(categories[index]); category = { ...category, ...storeMedia(input.media) }; }
      categories[index] = category; write(categoriesFile, categories); return send(res, 200, category);
    }
    if (categoryMatch && req.method === 'DELETE') {
      if (!guard(req, res)) return;
      const categories = read(categoriesFile), category = categories.find(item => item.id === categoryMatch[1]);
      if (!category) return send(res, 404, {});
      if (read(postsFile).some(post => post.category === category.id)) return send(res, 409, { error: '이 카테고리에 글이 있습니다. 글을 먼저 이동하거나 삭제해 주세요.' });
      removeMedia(category); write(categoriesFile, categories.filter(item => item.id !== category.id)); return send(res, 204, '');
    }

    if (req.method === 'GET' && url.pathname === '/api/posts') return send(res, 200, read(postsFile));
    if (req.method === 'POST' && url.pathname === '/api/posts') {
      if (!guard(req, res)) return;
      console.log('[posts] create request received');
      const input = await readBody(req); const post = { id: crypto.randomUUID(), date: new Date().toLocaleDateString('ko-KR').replace(/\. /g, '.'), ...await makePost(input) }; const posts = read(postsFile); posts.unshift(post); write(postsFile, posts); return send(res, 201, post);
    }
    if (postMatch && req.method === 'PUT') {
      if (!guard(req, res)) return;
      const input = await readBody(req), posts = read(postsFile), index = posts.findIndex(post => post.id === postMatch[1]); if (index < 0) return send(res, 404, {});
      const previous = posts[index]; const post = await makePost(input, { ...previous }); posts[index] = post; write(postsFile, posts); removePostMedia(previous); return send(res, 200, post);
    }
    if (postMatch && req.method === 'DELETE') {
      if (!guard(req, res)) return;
      const posts = read(postsFile), post = posts.find(item => item.id === postMatch[1]); if (!post) return send(res, 404, {});
      removePostMedia(post); write(postsFile, posts.filter(item => item.id !== post.id)); return send(res, 204, '');
    }

    const file = url.pathname.startsWith('/uploads/') ? path.join(uploads, path.basename(url.pathname)) : path.join(root, url.pathname === '/' ? 'index.html' : path.basename(url.pathname));
    if (!file.startsWith(root) || !fs.existsSync(file)) return send(res, 404, 'Not found', 'text/plain');
    res.writeHead(200, { 'Content-Type': mime(file) }); fs.createReadStream(file).pipe(res);
  } catch (error) {
    console.error('[server] request failed', { method: req.method, url: req.url, error: error.message });
    send(res, error.message === 'File too large' ? 413 : 400, { error: error.message });
  }
}).listen(Number(process.env.PORT || 3002), () => console.log('memoir: http://localhost:' + (process.env.PORT || 3002)));
