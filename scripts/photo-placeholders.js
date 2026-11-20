(function () {
  const selector = '.match-image-grid img, .gallery-thumb, .resultPhotoList img';
  const photos = new WeakMap();
  function loading(image) {
    const state = photos.get(image);
    if (!state) return;
    state.frame.classList.remove('photo-loaded', 'photo-failed');
    state.frame.classList.add('photo-loading');
    state.label.querySelector('span').textContent = 'Loading photo…';
  }
  function finish(image) {
    const state = photos.get(image);
    if (!state || !image.complete) return;
    const loaded = image.naturalWidth > 0;
    state.frame.classList.remove('photo-loading');
    state.frame.classList.toggle('photo-loaded', loaded);
    state.frame.classList.toggle('photo-failed', !loaded);
    state.label.querySelector('span').textContent = loaded ? '' : 'Photo unavailable';
  }
  function prepare(image) {
    if (photos.has(image) || !image.matches(selector)) return;
    let frame = image.parentElement;
    if (!frame.matches('.photo-slot')) {
      frame = document.createElement('span');
      frame.className = 'photo-loading-frame photo-loading-frame-fixed';
      image.before(frame);
      frame.appendChild(image);
    } else frame.classList.add('photo-loading-frame');
    const label = document.createElement('span');
    label.className = 'photo-loading-label';
    label.setAttribute('aria-hidden', 'true');
    label.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 4 4-5 5 6"/></svg><span>Loading photo…</span>';
    frame.appendChild(label);
    photos.set(image, { frame, label });
    loading(image);
    if (image.complete) finish(image);
  }
  document.addEventListener('load', event => { if (event.target instanceof HTMLImageElement) finish(event.target); }, true);
  document.addEventListener('error', event => {
    if (!(event.target instanceof HTMLImageElement)) return;
    // Existing Drive fallbacks may have started another request during this event.
    queueMicrotask(() => finish(event.target));
  }, true);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') {
        const image = record.target;
        if (!photos.has(image)) continue;
        loading(image);
        if (image.complete) finish(image);
      } else for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches(selector)) prepare(node);
        node.querySelectorAll(selector).forEach(prepare);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  document.querySelectorAll(selector).forEach(prepare);
})();
