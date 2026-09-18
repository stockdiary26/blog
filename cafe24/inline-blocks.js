(() => {
  const form = $('#postForm');
  const bodyField = $('#postBody').closest('.field');
  const mediaField = $('#postMedia').closest('.field');
  bodyField.hidden = true;
  mediaField.hidden = true;
  $('#postBody').required = false;

  const styles = document.createElement('style');
  styles.textContent = `
    #postBlocks{display:grid;gap:12px;margin-bottom:17px}.post-block{border:1px solid var(--l);padding:12px;background:#fffdf8}.post-block textarea{height:110px}.post-image{position:relative}.post-image img{display:block;max-width:100%;max-height:220px;object-fit:cover}.block-remove{margin-top:0}.block-tools{display:flex;align-items:center;gap:10px;flex-wrap:nowrap}.post-block>.block-tools{margin-top:10px}.block-tools .btn{white-space:nowrap}@media(max-width:420px){.post-block>.block-tools{gap:8px}.post-block>.block-tools .btn{padding:8px 10px}}.detail-block-image{width:100%;max-height:520px;object-fit:contain;margin:18px 0}.detail-block-text{white-space:pre-wrap;margin:18px 0;color:var(--i)}
  `;
  document.head.append(styles);

  const editor = document.createElement('section');
  editor.id = 'postBlocks';
  const picker = document.createElement('input');
  picker.type = 'file'; picker.accept = 'image/*'; picker.multiple = true; picker.hidden = true;
  form.querySelector('.actions').before(editor, picker);

  let blocks = [];
  let insertAt = null;
  const escapeHtml = value => esc(value);
  const legacyBlocks = post => post.blocks || [
    ...(post.body ? [{ type: 'text', content: post.body }] : []),
    ...(post.mediaUrl ? [{ type: post.mediaType?.startsWith('video') ? 'video' : 'image', mediaUrl: post.mediaUrl, mediaType: post.mediaType }] : [])
  ];

  function drawBlocks() {
    editor.innerHTML = blocks.map((block, index) => {
      if (block.type === 'text') return `<div class="post-block"><label>문단</label><textarea data-text-block="${index}" placeholder="내용을 입력하세요.">${escapeHtml(block.content || '')}</textarea><div class="block-tools"><button type="button" class="btn block-remove" data-remove-block="${index}">삭제</button><button type="button" class="btn" data-insert-text="${index}">아래에 문단</button><button type="button" class="btn" data-insert-image="${index}">아래에 이미지</button></div></div>`;
      return `<div class="post-block post-image"><label>이미지</label>${block.external ? `<input type="text" data-image-url="${index}" aria-label="이미지 주소" placeholder="https://example.com/photo.jpg" value="${escapeHtml(block.mediaUrl || '')}">` : ''}<img src="${escapeHtml(block.preview || block.mediaUrl)}" alt=""><div class="block-tools"><button type="button" class="btn block-remove" data-remove-block="${index}">삭제</button><button type="button" class="btn" data-insert-text="${index}">아래에 문단</button><button type="button" class="btn" data-insert-image="${index}">아래에 이미지</button></div></div>`;
    }).join('') + `<div class="block-tools"><button type="button" class="btn" data-add-text>+ 문단</button><button type="button" class="btn" data-add-image>+ 이미지</button><button type="button" class="btn" data-add-image-url>+ 이미지 주소</button></div>`;
    editor.querySelectorAll('[data-image-url]').forEach(input => {
      input.oninput = () => {
        const block = blocks[Number(input.dataset.imageUrl)];
        block.mediaUrl = input.value.trim();
        const image = input.parentElement.querySelector('img');
        try { image.src = normalizeImageAddress(block.mediaUrl); input.setCustomValidity(''); }
        catch (error) { image.removeAttribute('src'); input.setCustomValidity(error.message); }
      };
    });
    editor.querySelector('[data-add-image-url]').onclick = () => { blocks.push({ type: 'image', external: true, mediaUrl: '' }); drawBlocks(); };
    editor.querySelectorAll('[data-text-block]').forEach(textarea => {
      textarea.oninput = () => { blocks[Number(textarea.dataset.textBlock)].content = textarea.value; };
    });
    editor.querySelectorAll('[data-remove-block]').forEach(button => {
      button.onclick = () => { blocks.splice(Number(button.dataset.removeBlock), 1); drawBlocks(); };
    });
    editor.querySelectorAll('[data-insert-text]').forEach(button => {
      button.onclick = () => { blocks.splice(Number(button.dataset.insertText) + 1, 0, { type: 'text', content: '' }); drawBlocks(); };
    });
    editor.querySelectorAll('[data-insert-image]').forEach(button => {
      button.onclick = () => { insertAt = Number(button.dataset.insertImage) + 1; picker.click(); };
    });
    editor.querySelector('[data-add-text]').onclick = () => { blocks.push({ type: 'text', content: '' }); drawBlocks(); };
    editor.querySelector('[data-add-image]').onclick = () => { insertAt = blocks.length; picker.click(); };
  }

  picker.onchange = async () => {
    const files = [...picker.files];
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) { alert('이미지는 20MB 이하만 첨부할 수 있습니다.'); continue; }
      const media = await fileData(file);
      const position = insertAt ?? blocks.length;
      blocks.splice(position, 0, { type: 'image', media, preview: media.data });
      insertAt = position + 1;
    }
    picker.value = '';
    insertAt = null;
    drawBlocks();
  };

  async function asDataUrl(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
  }

  form.addEventListener('submit', submitBlocks, true);

  openPost = async function (post) {
    let sectionList, categoryList;
    try {
      const responses = await Promise.all([fetch('/api/sections', { cache: 'no-store' }), fetch('/api/categories', { cache: 'no-store' })]);
      if (responses.some(response => !response.ok)) throw new Error('Category load failed');
      [sectionList, categoryList] = await Promise.all(responses.map(response => response.json()));
    } catch (error) {
      alert('카테고리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    cats = categoryList;
    const option = category => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`;
    $('#postCategory').required = true;
    $('#postCategory').innerHTML = sectionList.map(section => {
      const children = categoryList.filter(category => (category.parentId || 'archive') === section.id);
      return children.length
        ? `<optgroup label="${escapeHtml(section.name)}">${children.map(option).join('')}</optgroup>`
        : option(section);
    }).join('');
    $('#postForm').reset();
    $('#postId').value = post?.id || '';
    $('#postFormTitle').textContent = post ? '기록 수정' : '새 기록';
    $('#deletePost').hidden = !post;
    if (post) {
      $('#postTitle').value = post.title;
      $('#postCategory').value = post.category;
      blocks = legacyBlocks(post).filter(block => block.type !== 'image' || block.mediaUrl || block.media?.data).map(block => ({ ...block, preview: block.mediaUrl, external: /^https?:\/\//i.test(block.mediaUrl || '') }));
    } else {
      blocks = [{ type: 'text', content: '' }];
    }
    drawBlocks();
    dialog('editor').showModal();
  };

  async function submitBlocks(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const submitButton = form.querySelector('button.primary');
    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = '저장 중…';
    try {
      editor.querySelectorAll('[data-image-url]').forEach(input => { blocks[Number(input.dataset.imageUrl)].mediaUrl = input.value.trim(); });
      const preparedBlocks = [];
      for (const block of blocks) {
        if (block.type === 'text') {
          if (block.content.trim()) preparedBlocks.push({ type: 'text', content: block.content });
        } else {
          if (block.external) {
            preparedBlocks.push({ type: 'image', mediaUrl: normalizeImageAddress(block.mediaUrl) });
          } else if (block.media?.data) {
            preparedBlocks.push({ type: 'image', media: { data: block.media.data } });
          } else {
            preparedBlocks.push({ type: 'image', mediaUrl: block.mediaUrl });
          }
        }
      }
      if (!preparedBlocks.length) return alert('내용을 입력하거나 이미지를 추가하세요.');
      const id = $('#postId').value;
      const payload = { category: $('#postCategory').value, title: $('#postTitle').value, blocks: preparedBlocks };
      const capabilities = await fetch('/api/capabilities', { cache: 'no-store' });
      if (!capabilities.ok || !(await capabilities.json()).imageUrls) throw new Error('실행 중인 서버가 이전 버전입니다. 최신 PHP 배포 파일을 업로드해주세요. 입력한 내용은 이 창에 유지됩니다.');
      let requestBody = JSON.stringify(payload);
      let requestHeaders = { 'Content-Type': 'application/json' };
      if (preparedBlocks.some(block => block.media?.data)) {
        const formData = new FormData();
        const uploadBlocks = [];
        for (const [index, block] of preparedBlocks.entries()) {
          if (!block.media?.data) { uploadBlocks.push(block); continue; }
          const match = /^data:([^;]+);base64,(.+)$/.exec(block.media.data);
          if (!match) throw new Error('이미지 파일 형식을 확인해주세요.');
          const binary = atob(match[2]);
          const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
          const field = 'image_' + index;
          formData.append(field, new Blob([bytes], { type: match[1] }), field);
          uploadBlocks.push({ type: 'image', uploadField: field });
        }
        formData.append('payload', JSON.stringify({ ...payload, blocks: uploadBlocks }));
        requestBody = formData;
        requestHeaders = {};
      }
      const response = await fetch(id ? '/api/posts/' + id : '/api/posts', { method: requestBody instanceof FormData ? 'POST' : id ? 'PUT' : 'POST', headers: requestHeaders, body: requestBody });
      const responseText = await response.text();
      let saved;
      try { saved = JSON.parse(responseText); } catch {
        const hint = response.status === 413 ? '이미지 용량 또는 요청 크기가 서버 제한을 초과했습니다.'
          : response.status === 403 || response.status === 406 ? '서버가 이미지 저장 요청을 차단했습니다. 호스팅 보안 필터와 요청 크기 제한을 확인해주세요.'
          : response.status >= 500 ? '서버 내부 오류입니다. 카페24 PHP 오류 로그를 확인해주세요.'
          : '서버가 JSON 대신 다른 응답을 반환했습니다.';
        throw new Error(`HTTP ${response.status}: ${hint} 입력한 내용은 이 창에 유지됩니다.`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${saved.error || '저장 요청에 실패했습니다.'}`);
      const expectedImages = preparedBlocks.filter(block => block.type === 'image');
      const savedImages = (saved.blocks || []).filter(block => block.type === 'image' && block.mediaUrl);
      if (savedImages.length !== expectedImages.length) throw new Error('실행 중인 서버가 이미지 주소를 저장하지 못했습니다. 최신 api.php 파일을 업로드한 뒤 이 창에서 다시 저장해주세요.');
      dialog('editor').close();
      refresh();
    } catch (error) {
      alert(`저장 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  }
})();
