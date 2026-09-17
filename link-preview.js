const https = require('node:https');
const http = require('node:http');
const dns = require('node:dns');
const net = require('node:net');

function publicAddress(address) {
  if (net.isIP(address) !== 4) return false;
  const [a,b] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19)));
}
function safeUrl(value, base) {
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw Error('Unsupported URL');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !publicAddress(host)) throw Error('Private address');
  return url;
}
function download(value, limit, deadline, redirects = 0) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = safeUrl(value); } catch (error) { reject(error); return; }
    const remaining = deadline - Date.now();
    if (remaining <= 0 || redirects > 3) return reject(Error('Preview timeout'));
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      headers: { 'User-Agent': 'PersonalBlog-LinkPreview/1.0', 'Accept-Encoding': 'identity' },
      family: 4,
      lookup(hostname, options, callback) {
        dns.lookup(hostname, { family: 4 }, (error, address, family) => {
          if (error) return callback(error);
          if (!publicAddress(address)) return callback(Error('Private address'));
          callback(null, address, family);
        });
      },
    }, response => {
      if ([301,302,303,307,308].includes(response.statusCode)) {
        response.resume();
        try { download(safeUrl(response.headers.location, url).href, limit, deadline, redirects + 1).then(resolve, reject); } catch (error) { reject(error); }
        return;
      }
      if (response.statusCode !== 200) { response.resume(); reject(Error('No preview')); return; }
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > limit) { request.destroy(Error('Preview too large')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ bytes: Buffer.concat(chunks), type: String(response.headers['content-type'] || '').split(';')[0], url: url.href }));
    });
    const timer = setTimeout(() => request.destroy(Error('Preview timeout')), remaining);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
  });
}
function decode(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
    const named = { '&amp;':'&', '&quot;':'"', '&apos;':"'", '&lt;':'<', '&gt;':'>' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const number = entity.toLowerCase().startsWith('&#x') ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '';
  });
}
function imageFromHtml(html, base) {
  const tags = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = {};
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4]);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (attrs.content && !tags[key]) tags[key] = attrs.content;
  }
  const source = tags['og:image'] || tags['twitter:image'] || tags['twitter:image:src'];
  return source ? safeUrl(source, base).href : null;
}
async function previewImage(body) {
  const first = String(body).match(/https?:\/\/[^\s<>"']+/i)?.[0]?.replace(/[.,!?;:)}\]]+$/, '');
  if (!first) return null;
  try {
    const deadline = Date.now() + 7000;
    const page = await download(first, 1500000, deadline);
    if (!['text/html','application/xhtml+xml'].includes(page.type)) return null;
    const imageUrl = imageFromHtml(page.bytes.toString('utf8'), page.url);
    if (!imageUrl) return null;
    const image = await download(imageUrl, 5000000, deadline);
    const bytes = image.bytes;
    const type = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
      : /^GIF8[79]a/.test(bytes.subarray(0,6).toString()) ? 'image/gif'
      : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP' ? 'image/webp' : null;
    return type ? { data: `data:${type};base64,${bytes.toString('base64')}` } : null;
  } catch { return null; }
}
module.exports = { previewImage, publicAddress, safeUrl, imageFromHtml };
