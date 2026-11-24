(function () {
  let current = null, photos = [], revision = 0, viewer, viewerIndex = 0;
  const escape = value => String(value || "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  function render(partial = false, loading = false) {
    const container = document.getElementById('fixtureMatchPhotos');
    if (!container || !current) return;
    const id = current.resultRow?._resultId;
    const extra = Math.max(0, photos.length - 8);
    container.innerHTML = `<h4>Match photos</h4><div class="fixturePhotoGrid match-image-grid" data-photo-count="${photos.length}">${photos.slice(0,8).map((url,index)=>`<button type="button" class="photo-slot ${index===7&&extra?'image-count-overlay':''}" data-photo-index="${index}" data-fixture-photo="${index}" data-extra="${index===7&&extra?'+'+extra:''}" aria-label="View match photo ${index+1} of ${photos.length}"><img src="${escape(window.ONMResultPhotos.thumbnail(url)||url)}" data-drive-thumb="1" alt="Match photo ${index+1}" loading="lazy" decoding="async"></button>`).join('')}${id ? `<button type="button" class="addResultPhotos result-photo-frame" data-add-result-photos="${encodeURIComponent(id)}" hidden><span class="result-photo-plus" aria-hidden="true">+</span><span>${photos.length?'Add more':'Add photos'}</span></button>` : ''}</div>${loading?'<p class="fixturePhotosNotice fixturePhotosLoading" role="status"><span class="fixturePhotosSpinner" aria-hidden="true"></span>Loading photos…</p>':partial?'<p class="fixturePhotosNotice" role="status">Some photos could not be loaded. <button type="button" data-retry-fixture-photos>Retry</button></p>':!photos.length?'<p class="fixturePhotosNotice">No photos added yet.</p>':''}`;
  }
  async function show(fixture, force = false) {
    current = fixture;
    photos = [];
    const token = ++revision;
    if (!fixture?.completed || !fixture.resultRow) return;
    render(false, true);
    let timer;
    try {
      const result = await Promise.race([
        window.ONMResultPhotos.loadMatchPhotos(fixture.resultRow, force),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Photo loading timed out")), 12000); })
      ]);
      if (token !== revision) return;
      photos = result.urls; render(result.partial);
    } catch (_) { if (token === revision) render(true); }
    finally { clearTimeout(timer); }
  }
  function updateViewer() {
    viewer.querySelector('img').src = photos[viewerIndex];
    viewer.querySelector('img').alt = `Match photo ${viewerIndex+1} of ${photos.length}`;
    viewer.querySelector('[data-photo-position]').textContent = `${viewerIndex+1} / ${photos.length}`;
    viewer.querySelector('[data-photo-prev]').disabled = viewerIndex === 0;
    viewer.querySelector('[data-photo-next]').disabled = viewerIndex === photos.length-1;
  }
  function openViewer(index) {
    if (!photos[index]) return;
    if (!viewer) {
      viewer = document.createElement('dialog');
      viewer.className = 'fixturePhotoViewer';
      viewer.setAttribute('aria-label','Match photo viewer');
      viewer.innerHTML = '<button type="button" class="fixturePhotoViewerClose" aria-label="Close photo"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="m4 4 8 8m0-8-8 8"/></svg></button><img alt="Match photo"><div><button type="button" data-photo-prev aria-label="Previous photo">←</button><span data-photo-position></span><button type="button" data-photo-next aria-label="Next photo">→</button></div>';
      document.body.appendChild(viewer);
      viewer.querySelector('.fixturePhotoViewerClose').addEventListener('click',()=>viewer.close());
      function onBackdrop(event) {
        if (event.target !== viewer) return false;
        const { left, right, top, bottom } = viewer.getBoundingClientRect();
        return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom;
      }
      let pressedBackdrop = false;
      viewer.addEventListener('pointerdown', event => { pressedBackdrop = onBackdrop(event); });
      viewer.addEventListener('pointercancel', () => { pressedBackdrop = false; });
      viewer.addEventListener('click', event => {
        if (pressedBackdrop && onBackdrop(event)) viewer.close();
        pressedBackdrop = false;
      });
      viewer.querySelector('[data-photo-prev]').addEventListener('click',()=>{if(viewerIndex>0){viewerIndex--;updateViewer();}});
      viewer.querySelector('[data-photo-next]').addEventListener('click',()=>{if(viewerIndex<photos.length-1){viewerIndex++;updateViewer();}});
      viewer.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'&&viewerIndex>0){event.preventDefault();viewerIndex--;updateViewer();}if(event.key==='ArrowRight'&&viewerIndex<photos.length-1){event.preventDefault();viewerIndex++;updateViewer();}});
    }
    viewerIndex = index; updateViewer();
    if (!viewer.open) viewer.showModal();
  }
  document.addEventListener('click',event=>{
    const button = event.target.closest('[data-fixture-photo], [data-retry-fixture-photos]');
    if (!button) return;
    event.preventDefault();
    if (button.hasAttribute('data-retry-fixture-photos')) show(current,true);
    else openViewer(Number(button.dataset.fixturePhoto));
  });
  document.addEventListener('onm-result-photos-changed',event=>{
    if (current?.resultRow?._resultId === event.detail?.resultId) show(current,true);
  });
  window.ONMFixturePhotos = { show };
})();
