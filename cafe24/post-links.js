(() => {
  window.youtubeVideos = value => {
    const videos = [], seen = new Set();
    for (const match of String(value || '').matchAll(/https?:\/\/[^\s<>"']+/gi)) {
      const raw = match[0].replace(/[.,!?;:)}\]]+$/, '');
      try {
        const url = new URL(raw), host = url.hostname.toLowerCase();
        let id;
        if (host === 'youtu.be') id = url.pathname.split('/')[1];
        else if (['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)) {
          if (url.pathname === '/watch') id = url.searchParams.get('v');
          else { const parts = url.pathname.split('/'); if (['shorts','embed','live'].includes(parts[1])) id = parts[2]; }
        }
        if (!/^[a-zA-Z0-9_-]{11}$/.test(id || '') || seen.has(id)) continue;
        seen.add(id);
        videos.push({ id, url: url.href, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` });
      } catch {}
    }
    return videos;
  };
  const style = document.createElement('style');
  style.textContent = '.youtube-preview{display:block;position:relative;max-width:640px;margin:20px 0;line-height:0;background:#171717}.youtube-preview img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.youtube-preview .youtube-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#d92020;border-radius:12px;padding:14px 20px;color:white;line-height:1;font-size:24px}.youtube-preview:focus-visible{outline:3px solid var(--y);outline-offset:4px}';
  document.head.append(style);
  window.linkifyPostText = value => {
    const text = String(value || '');
    let html = '', end = 0;
    for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
      const raw = match[0].replace(/[.,!?;:)}\]]+$/, '');
      html += esc(text.slice(end, match.index));
      try {
        const url = new URL(raw);
        html += `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(raw)}</a>`;
      } catch { html += esc(raw); }
      end = match.index + raw.length;
    }
    const previews = youtubeVideos(text).map(video => `<a class="youtube-preview" href="${esc(video.url)}" target="_blank" rel="noopener noreferrer" aria-label="YouTube에서 동영상 보기"><img src="${esc(video.thumbnail)}" alt="YouTube 동영상 썸네일" loading="lazy"><span class="youtube-play" aria-hidden="true">▶</span></a>`).join('');
    return html + esc(text.slice(end)) + previews;
  };
})();
