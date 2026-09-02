/* ============================================================
   TIDEPINE — main.js
   Scroll engine: lerped scrub (hero + gallery rail), pointer
   parallax, IO reveals w/ dynamic stagger, focus-managed menu,
   draggable area slider, FAQ accordion, cancellable eased
   anchor scrolling. Vanilla, no dependencies.
   ============================================================ */
(() => {
  const docEl = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (e0, e1, v) => {
    const x = clamp((v - e0) / (e1 - e0));
    return x * x * (3 - 2 * x);
  };

  /* ---------- Elements ---------- */
  const nav = document.getElementById('nav');
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  const hero = document.getElementById('hero');
  const heroStage = hero.querySelector('.hero-stage');
  const heroMedia = document.getElementById('heroMedia');
  const heroFg = document.getElementById('heroFg');
  const heroCopy = document.getElementById('heroCopy');
  const heroKicker = document.getElementById('heroKicker');
  const heroTitle = document.getElementById('heroTitle');
  const heroTagline = document.getElementById('heroTagline');
  const heroCue = document.getElementById('heroCue');
  const gallery = document.getElementById('gallery');
  const galleryPin = gallery.querySelector('.gallery-pin');
  const galleryTrack = document.getElementById('galleryTrack');
  const galleryCount = document.getElementById('galleryCount');
  const galleryCards = galleryTrack.children.length;
  const footer = document.querySelector('.footer');
  const footerMark = document.querySelector('.footer-mark');

  /* Mobile treats the wordmark as individual letters so they can fall away
     one after another on scroll. */
  const isMobile = () => matchMedia('(max-width: 900px)').matches;
  const heroLetters = [];
  (() => {
    const text = heroTitle.textContent.trim();
    heroTitle.setAttribute('aria-label', text);
    heroTitle.textContent = '';
    for (const ch of text) {
      const s = document.createElement('span');
      s.className = 'hero-letter';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = ch;
      heroTitle.appendChild(s);
      heroLetters.push(s);
    }
  })();

  /* ---------- Fullscreen menu (focus-managed) ---------- */
  let menuOpen = false;
  let lastFocus = null;
  const menuLinks = () => Array.from(menu.querySelectorAll('a'));
  const setMenu = (open) => {
    if (open === menuOpen) return;
    menuOpen = open;
    docEl.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      lastFocus = document.activeElement;
      const first = menuLinks()[0];
      if (first) first.focus();
    } else if (lastFocus && lastFocus.isConnected) {
      lastFocus.focus();
      lastFocus = null;
    }
  };
  burger.addEventListener('click', () => setMenu(!menuOpen));
  menuLinks().forEach((a) => a.addEventListener('click', () => setMenu(false)));
  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !menuOpen) return;
    const links = menuLinks();
    const first = links[0];
    const last = links[links.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  /* ---------- Reveals (dynamic stagger, self-cleaning) ---------- */
  const revealTargets = document.querySelectorAll('.reveal, .headline');
  const finishReveal = (el) => {
    el.style.transitionDelay = '';
    /* Drop reveal classes once done so component transitions/hover
       states (e.g. .amenity lift) regain control of transform. */
    if (el.classList.contains('reveal')) el.classList.remove('reveal', 'in');
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const entering = entries.filter((e) => e.isIntersecting);
        entering.forEach((entry, i) => {
          const el = entry.target;
          el.style.transitionDelay = i * 80 + 'ms';
          el.classList.add('in');
          io.unobserve(el);
          setTimeout(() => finishReveal(el), 1400 + i * 80);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('in'));
  }

  /* ---------- Pointer parallax (hero) ---------- */
  let tmx = 0, tmy = 0, mx = 0, my = 0;
  addEventListener(
    'pointermove',
    (e) => {
      tmx = e.clientX / innerWidth - 0.5;
      tmy = e.clientY / innerHeight - 0.5;
    },
    { passive: true }
  );

  /* ---------- Layout metrics (cached, threshold re-measure) ---------- */
  let heroScrub = 1, galleryTop = 0, galleryScrub = 1, galleryShift = 0, footerTop = 0;
  const measure = () => {
    /* Scrub ranges derive from the actual pinned-stage heights, so
       min-height:600px stages release exactly at p = 1. */
    heroScrub = Math.max(1, hero.offsetHeight - heroStage.offsetHeight);
    galleryTop = gallery.offsetTop;
    galleryScrub = Math.max(1, gallery.offsetHeight - galleryPin.offsetHeight);
    galleryShift = Math.max(0, galleryTrack.scrollWidth - innerWidth + 24);
    footerTop = footer.offsetTop;
  };
  let lastW = innerWidth, lastH = innerHeight;
  addEventListener(
    'resize',
    () => {
      if (menuOpen && innerWidth > 900) setMenu(false);
      /* Ignore mobile URL-bar height jitter; re-measure on real changes. */
      const wChanged = innerWidth !== lastW;
      const hChanged = Math.abs(innerHeight - lastH) > 150;
      if (wChanged || hChanged) {
        lastW = innerWidth;
        lastH = innerHeight;
        measure();
        updateArea();
        schedulePlacement();
      }
    },
    { passive: true }
  );
  addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => measure());

  /* ---------- Gallery counter ---------- */
  const setCount = (idx) => {
    const label = String(idx).padStart(2, '0');
    if (galleryCount.textContent !== label) galleryCount.textContent = label;
  };
  /* Reduced-motion mode: rail is a native horizontal scroller. */
  galleryTrack.addEventListener(
    'scroll',
    () => {
      if (!reduceMotion.matches) return;
      const max = galleryTrack.scrollWidth - galleryTrack.clientWidth;
      const p = max > 0 ? galleryTrack.scrollLeft / max : 0;
      setCount(Math.min(galleryCards, Math.floor(p * galleryCards) + 1));
    },
    { passive: true }
  );

  /* ---------- Reduced-motion switching ---------- */
  const applyReduced = (on) => {
    docEl.classList.toggle('reduced', on);
    if (on) {
      [heroMedia, heroFg, heroCopy, heroTitle, heroKicker, heroTagline, heroCue, galleryTrack, footerMark]
        .concat(heroLetters).forEach((el) => { el.style.cssText = ''; });
      setCount(1);
    }
    measure();
    updateArea();
  };
  reduceMotion.addEventListener('change', (e) => applyReduced(e.matches));

  /* ---------- Main scrub loop ---------- */
  let sy = scrollY;
  const frame = () => {
    const target = scrollY;
    sy = lerp(sy, target, 0.14);
    if (Math.abs(sy - target) < 0.1) sy = target;
    mx = lerp(mx, tmx, 0.08);
    my = lerp(my, tmy, 0.08);

    nav.classList.toggle('scrolled', target > 40);

    if (!reduceMotion.matches) {
      /* Hero choreography — active across the whole pin. */
      const p = clamp(sy / heroScrub);
      const exit = smoothstep(0.05, 0.8, p);
      /* bg and cabin-cutout layers share one transform so the matte
         stays pixel-aligned; the title rides between them. */
      const mediaT =
        'translate3d(' + (mx * -16).toFixed(2) + 'px,' + (my * -8).toFixed(2) + 'px,0)' +
        ' scale(' + (1.02 + p * 0.14).toFixed(4) + ')';
      const mediaF = 'brightness(' + (1 - smoothstep(0.1, 0.95, p) * 0.55).toFixed(3) + ')';
      heroMedia.style.transform = mediaT;
      heroMedia.style.filter = mediaF;
      heroFg.style.transform = mediaT;
      heroFg.style.filter = mediaF;
      heroTagline.style.transform = 'translate3d(0,' + (exit * -60).toFixed(1) + 'px,0)';

      if (isMobile()) {
        /* letters drop away in sequence as the hero scrolls past */
        heroCopy.style.transform = 'none';
        heroTitle.style.transform = 'none';
        heroTitle.style.opacity = '1';
        const n = heroLetters.length;
        const SPREAD = 0.42;   /* how far apart the first and last letter start */
        const SPAN = 0.28;     /* scroll distance each letter takes to fall */
        for (let i = 0; i < n; i++) {
          const delay = (i / n) * SPREAD;
          const lp = clamp((p - delay) / SPAN);
          const e = lp * lp;                      /* ease-in: hangs, then drops */
          const L = heroLetters[i];
          L.style.transform = 'translate3d(0,' + (e * 190).toFixed(1) + 'px,0)';
          L.style.opacity = (1 - e).toFixed(3);
        }
      } else {
        heroCopy.style.transform = 'translate3d(0,' + (exit * -140).toFixed(1) + 'px,0)';
        heroTitle.style.transform = 'scale(' + (1 - exit * 0.08).toFixed(4) + ')';
        heroTitle.style.opacity = (1 - smoothstep(0.2, 0.82, p)).toFixed(3);
        for (let i = 0; i < heroLetters.length; i++) {
          heroLetters[i].style.transform = '';
          heroLetters[i].style.opacity = '';
        }
      }
      const early = 1 - smoothstep(0.03, 0.45, p);
      heroKicker.style.opacity = early.toFixed(3);
      heroTagline.style.opacity = early.toFixed(3);
      heroCue.style.opacity = (1 - smoothstep(0, 0.12, p)).toFixed(3);

      /* Gallery rail scrub — linear; the lerped sy supplies the ease. */
      const gp = clamp((sy - galleryTop) / galleryScrub);
      galleryTrack.style.transform = 'translate3d(' + (-gp * galleryShift).toFixed(1) + 'px,0,0)';
      setCount(Math.min(galleryCards, Math.floor(gp * galleryCards) + 1));

      /* Footer wordmark settles down into the treeline as the footer arrives.
         Driven off the lerped sy so it inherits the same easing as the rest. */
      const fTop = footerTop - sy;
      const fp = clamp((innerHeight - fTop) / (innerHeight * 0.72));
      const fe = fp * fp * (3 - 2 * fp);
      footerMark.style.transform = 'translate3d(0,' + ((1 - fe) * -110).toFixed(1) + 'px,0)';
      footerMark.style.opacity = (0.18 + fe * 0.82).toFixed(3);
    }

    requestAnimationFrame(frame);
  };

  /* ---------- Silhouette-aware wordmark placement ----------
     The hero cutout and the footer treeline are photographs, so where the
     roofline / treetops fall depends on how `object-fit: cover` crops them
     at the current viewport. Hard-coded percentages only hold for the exact
     sizes they were measured at, so instead we read the alpha channel and
     place each wordmark against the real silhouette. */
  const edgeCache = new Map();

  const silhouetteTops = (img, box, objPosY, xFrom, xTo) => {
    if (!img.complete || !img.naturalWidth) return null;
    const bw = box.offsetWidth, bh = box.offsetHeight;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!bw || !bh) return null;

    const key = img.src + '|' + iw + 'x' + ih;
    let tops = edgeCache.get(key);
    if (!tops) {
      /* topmost opaque row per image column — computed once per image */
      const cv = document.createElement('canvas');
      cv.width = iw; cv.height = ih;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0);
      let data;
      try { data = cx.getImageData(0, 0, iw, ih).data; } catch (e) { return null; }
      tops = new Int32Array(iw).fill(-1);
      for (let x = 0; x < iw; x++) {
        for (let y = 0; y < ih; y++) {
          if (data[(y * iw + x) * 4 + 3] > 128) { tops[x] = y; break; }
        }
      }
      edgeCache.set(key, tops);
    }

    const scale = Math.max(bw / iw, bh / ih);
    const offX = (bw - iw * scale) * 0.5;
    const offY = (bh - ih * scale) * objPosY;
    const boxRect = box.getBoundingClientRect();
    const out = [];
    for (let sx = Math.floor(xFrom); sx <= Math.ceil(xTo); sx += 3) {
      const ix = Math.round((sx - boxRect.left - offX) / scale);
      if (ix < 0 || ix >= iw) continue;
      const iy = tops[ix];
      if (iy < 0) continue;                       /* open sky in this column */
      out.push(boxRect.top + offY + iy * scale);
    }
    return out.length ? out.sort((a, b) => a - b) : null;
  };

  const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

  /* Shift a wordmark's container so the GLYPHS land at a target Y. */
  const placeMark = (container, textEl, img, imgBox, objPosY, pick, bury, minTopY, tailGuard) => {
    if (!img || !imgBox) return;
    const savedT = container.style.transform;
    const savedO = container.style.opacity;
    container.style.transform = 'none';
    container.style.opacity = '0';

    const range = document.createRange();
    range.selectNodeContents(textEl);
    const g = range.getBoundingClientRect();
    if (!g.width || !g.height) {
      container.style.transform = savedT; container.style.opacity = savedO; return;
    }

    const tops = silhouetteTops(img, imgBox, objPosY, g.left, g.right);
    if (tops) {
      const edge = pct(tops, pick);
      let desiredGlyphBottom = edge + g.height * bury;

      /* Hero only: the roof is a solid mass, so where it climbs steeply the last
         letters would vanish entirely. Treetops are thin, so the footer wants the
         opposite — letters sinking into the silhouette stay perfectly readable. */
      if (tailGuard) {
        const tail = silhouetteTops(img, imgBox, objPosY, g.right - g.width * 0.3, g.right);
        if (tail) desiredGlyphBottom = Math.min(desiredGlyphBottom, tail[0] + g.height * 0.5);
      }

      /* never let the wordmark ride up under the header */
      if (typeof minTopY === 'number') {
        desiredGlyphBottom = Math.max(desiredGlyphBottom, minTopY + g.height);
      }
      const delta = desiredGlyphBottom - g.bottom;
      const parentH = container.offsetParent ? container.offsetParent.offsetHeight : innerHeight;
      const curBottom = parentH - (container.getBoundingClientRect().bottom -
        (container.offsetParent ? container.offsetParent.getBoundingClientRect().top : 0));
      container.style.bottom = Math.round(curBottom - delta) + 'px';
    }

    container.style.transform = savedT;
    container.style.opacity = savedO;
  };

  const placeWordmarks = () => {
    if (docEl.classList.contains('reduced')) return;
    /* hero: sit just above the roofline, gable tip biting into the letters */
    if (!isMobile()) {
      const navBottom = nav.getBoundingClientRect().bottom;
      const clearance = navBottom + Math.max(26, innerHeight * 0.045);
      placeMark(heroCopy, heroTitle, heroFg.querySelector('img'), heroFg, 0.38, 0.55, 0.24, clearance, true);
    } else {
      heroCopy.style.bottom = '';   /* let the mobile flex centring govern */
    }
    /* footer: treetops crossing well into the word on desktop; mobile centres
       it in the open sky instead, so leave that placement to CSS */
    const trees = document.querySelector('.footer-trees');
    if (trees && !isMobile()) {
      placeMark(footerMark, footerMark, trees, trees, 0.58, 0.5, 0.45, null, false);
    } else if (trees) {
      footerMark.style.bottom = '';
    }
  };

  const schedulePlacement = () => requestAnimationFrame(() => requestAnimationFrame(placeWordmarks));
  addEventListener('load', schedulePlacement);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedulePlacement);
  [heroFg.querySelector('img'), document.querySelector('.footer-trees')].forEach((im) => {
    if (im && !im.complete) im.addEventListener('load', schedulePlacement, { once: true });
  });
  schedulePlacement();
  /* Archivo Black can swap in after fonts.ready resolves, which changes the
     glyph metrics the placement was measured from — re-run as a safety net. */
  setTimeout(schedulePlacement, 400);
  setTimeout(schedulePlacement, 1400);

  /* ---------- Eased anchor scrolling (cancellable) ---------- */
  let scrollAnim = 0;
  const cancelKeys = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ']);
  const easeScrollTo = (targetY) => {
    const myId = ++scrollAnim;
    if (reduceMotion.matches) { scrollTo(0, targetY); return; }
    const startY = scrollY;
    const dist = targetY - startY;
    if (Math.abs(dist) < 2) return;
    const dur = clamp(Math.abs(dist) / 3, 500, 1400);
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const cleanup = () => {
      removeEventListener('wheel', cancel);
      removeEventListener('touchstart', cancel);
      removeEventListener('keydown', onKey);
    };
    const cancel = () => {
      if (scrollAnim === myId) scrollAnim++;
      cleanup();
    };
    const onKey = (e) => { if (cancelKeys.has(e.key)) cancel(); };
    addEventListener('wheel', cancel, { passive: true });
    addEventListener('touchstart', cancel, { passive: true });
    addEventListener('keydown', onKey);
    const step = (now) => {
      if (scrollAnim !== myId) { cleanup(); return; }
      const t = clamp((now - t0) / dur);
      scrollTo(0, startY + dist * ease(t));
      if (t < 1) requestAnimationFrame(step);
      else cleanup();
    };
    requestAnimationFrame(step);
  };
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      if (!id) { e.preventDefault(); return; } /* bare "#" placeholder — no-op */
      const target = document.getElementById(id);
      if (!target && id !== 'top') return;
      e.preventDefault();
      setMenu(false);
      const y = target && id !== 'top' ? target.offsetTop - 64 : 0;
      easeScrollTo(Math.max(0, y));
    });
  });

  /* ---------- Area slider (buttons + drag + keyboard) ---------- */
  const areaSlider = document.querySelector('.area-slider');
  const areaViewport = areaSlider.querySelector('.area-viewport');
  const areaTrack = document.getElementById('areaTrack');
  const areaPrev = document.getElementById('areaPrev');
  const areaNext = document.getElementById('areaNext');
  let areaIndex = 0;

  const areaMetrics = () => {
    const card = areaTrack.children[0];
    const gap = parseFloat(getComputedStyle(areaTrack).columnGap || '20') || 20;
    const step = card.offsetWidth + gap;
    const maxShift = Math.max(0, areaTrack.scrollWidth - areaViewport.clientWidth);
    return { step, maxShift, maxIndex: step > 0 ? Math.ceil(maxShift / step) : 0 };
  };
  const currentShift = () => {
    const { step, maxShift } = areaMetrics();
    return Math.min(areaIndex * step, maxShift);
  };
  const updateArea = () => {
    const { maxIndex } = areaMetrics();
    areaIndex = Math.max(0, Math.min(areaIndex, maxIndex));
    areaTrack.style.transform = 'translate3d(' + -currentShift() + 'px,0,0)';
    /* aria-disabled (not disabled) keeps the buttons focusable. */
    areaPrev.setAttribute('aria-disabled', String(areaIndex <= 0));
    areaNext.setAttribute('aria-disabled', String(areaIndex >= maxIndex));
  };
  const areaMove = (d) => { areaIndex += d; updateArea(); };
  areaPrev.addEventListener('click', () => { if (areaPrev.getAttribute('aria-disabled') !== 'true') areaMove(-1); });
  areaNext.addEventListener('click', () => { if (areaNext.getAttribute('aria-disabled') !== 'true') areaMove(1); });
  areaSlider.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); areaMove(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); areaMove(1); }
  });
  let dragX = null, dragShift = 0, dragging = false;
  areaViewport.addEventListener('pointerdown', (e) => {
    dragX = e.clientX;
    dragShift = currentShift();
    dragging = false;
  });
  addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    const dx = e.clientX - dragX;
    if (Math.abs(dx) > 6) dragging = true;
    if (!dragging) return;
    const { maxShift } = areaMetrics();
    const s = clamp(dragShift - dx, 0, maxShift);
    areaTrack.style.transition = 'none';
    areaTrack.style.transform = 'translate3d(' + -s + 'px,0,0)';
  });
  const endDrag = (e) => {
    if (dragX === null) return;
    const dx = e.clientX - dragX;
    dragX = null;
    areaTrack.style.transition = '';
    if (!dragging) return;
    dragging = false;
    const { step, maxShift } = areaMetrics();
    if (step > 0) areaIndex = Math.round(clamp(dragShift - dx, 0, maxShift) / step);
    updateArea();
  };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item').forEach((item, i) => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    a.id = 'faq-a-' + i;
    q.setAttribute('aria-controls', a.id);
    q.addEventListener('click', () => {
      const open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Init ---------- */
  measure();
  updateArea();
  if (reduceMotion.matches) applyReduced(true);
  requestAnimationFrame(frame);
})();
