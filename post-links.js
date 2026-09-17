(() => {
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
    return html + esc(text.slice(end));
  };
})();
