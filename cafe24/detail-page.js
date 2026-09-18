(() => {
  const style = document.createElement('style');
  style.textContent = `
    .detail-page{display:grid;grid-template-columns:250px minmax(0,840px);gap:64px;max-width:1154px;margin:0 auto;padding:22px 0 72px}.detail-sidebar{border-right:1px solid var(--l);padding-right:24px}.detail-category{padding:16px 0;border-bottom:1px solid var(--l)}.detail-category-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.detail-category-name{padding:0;border:0;background:transparent;color:var(--i);font-size:16px;font-weight:600;text-align:left}.detail-category-count{font-size:13px;color:var(--m);white-space:nowrap}.detail-recent{list-style:none;margin:11px 0 0;padding:0;display:grid;gap:8px}.detail-recent button{border:0;background:transparent;padding:0;color:var(--m);font-size:13px;text-align:left;display:grid;gap:2px}.detail-recent strong{font-size:14px;font-weight:400;color:var(--i);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.detail-more{display:inline-block;margin-top:11px;padding:0;border:0;background:transparent;color:var(--m);font-size:13px;text-decoration:underline;text-underline-offset:3px}.detail-article{max-width:760px}.detail-article h1{font-size:clamp(34px,5vw,58px);line-height:1.02;letter-spacing:-.065em;font-weight:500;margin:10px 0 20px}.detail-meta{font-size:12px;color:var(--m);letter-spacing:.03em}.detail-page .detail-block-text{font-size:16px;line-height:1.9;margin:28px 0}.detail-page .detail-block-image{display:block;width:100%;max-height:640px;object-fit:contain;margin:32px 0}.detail-page .detail-block-video{width:100%;max-height:640px;margin:32px 0}.detail-edit{margin-top:32px}@media(max-width:850px){.detail-page{display:block;padding-top:8px}.detail-sidebar{border-right:0;border-bottom:1px solid var(--l);padding:0 0 22px;margin-bottom:36px}.detail-sidebar-list{display:flex;gap:16px;overflow-x:auto}.detail-category{min-width:190px;border-bottom:0;border-right:1px solid var(--l);padding:0 16px 0 0}.detail-page .detail-block-text{font-size:15px}}
  `;
  document.head.append(style);

  const dateValue = value => {
    const parts = String(value || '').match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    return parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : new Date(0);
  };
  const escapeHtml = value => esc(value);
  const postBlocks = post => post.blocks || [
    ...(post.body ? [{ type: 'text', content: post.body }] : []),
    ...(post.mediaUrl ? [{ type: post.mediaType?.startsWith('video') ? 'video' : 'image', mediaUrl: post.mediaUrl }] : [])
  ];

  function categorySidebar() {
    const categories = [...sections.filter(section => !cats.some(category => category.parentId === section.id)), ...cats];
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    return categories.map(category => {
      const categoryPosts = posts.filter(post => post.category === category.id);
      const recentPosts = categoryPosts.filter(post => dateValue(post.date) >= monthAgo).slice(0, 5);
      const recentList = recentPosts.length ? `<ul class="detail-recent">${recentPosts.map(post => `<li><button data-open-post="${post.id}"><strong>${escapeHtml(post.title)}</strong><span>${post.date}</span></button></li>`).join('')}</ul>` : '<p class="detail-recent" style="font-size:13px;color:var(--m)">최근 한 달 글이 없습니다.</p>';
      const more = categoryPosts.length > recentPosts.length ? `<button class="detail-more" data-open-category="${category.id}">전체 보기 (${categoryPosts.length})</button>` : '';
      return `<section class="detail-category"><div class="detail-category-head"><button class="detail-category-name" data-open-category="${category.id}">${escapeHtml(category.name)}</button><span class="detail-category-count">${categoryPosts.length} posts</span></div>${recentList}${more}</section>`;
    }).join('');
  }

  function renderPostDetail(postId) {
    const post = posts.find(item => item.id === postId);
    if (!post) return;
    selected = postId;
    const body = postBlocks(post).map(block => {
      if (block.type === 'text') return `<p class="detail-block-text">${linkifyPostText(block.content)}</p>`;
      if (block.type === 'video') return `<video class="detail-block-video" controls src="${escapeHtml(block.mediaUrl)}"></video>`;
      return `<img class="detail-block-image" src="${escapeHtml(block.mediaUrl)}" alt="">`;
    }).join('');
    $('#app').innerHTML = `<div class="detail-page"><aside class="detail-sidebar"><div class="detail-sidebar-list">${categorySidebar()}</div></aside><article class="detail-article"><div class="detail-meta">${escapeHtml(name(post.category))} · ${post.date}</div><h1>${escapeHtml(post.title)}</h1>${body}${auth.authenticated ? '<button class="btn detail-edit" data-detail-edit>수정</button>' : ''}</article></div>`;
    const edit = $('[data-detail-edit]');
    if (edit) edit.onclick = () => openPost(post);
  }

  window.renderPostDetail = renderPostDetail;
})();
