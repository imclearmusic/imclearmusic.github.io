/* iMCleAr_ : navigation, pistes de lecture, matrice du hero. Aucune dépendance. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);

  /* ---------------------------------------------------------------- navigation */
  const nav = document.getElementById('nav');
  if (nav) {
    const toggle = nav.querySelector('.nav__toggle');
    let openingFrame = 0;
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      root.classList.toggle('html-lock', open);
    };
    const cancelPendingOpen = () => {
      if (openingFrame) cancelAnimationFrame(openingFrame);
      openingFrame = 0;
    };
    const openAtTop = () => {
      if (scrollY <= 0) {
        openingFrame = 0;
        setOpen(true);
        return;
      }
      openingFrame = requestAnimationFrame(openAtTop);
    };
    toggle.addEventListener('click', () => {
      if (toggle.getAttribute('aria-expanded') === 'true') {
        cancelPendingOpen();
        setOpen(false);
      } else if (openingFrame) {
        cancelPendingOpen();
      } else if (scrollY <= 0) {
        setOpen(true);
      } else {
        scrollTo({ top: 0, behavior: 'smooth' });
        openingFrame = requestAnimationFrame(openAtTop);
      }
    });
    nav.querySelectorAll('.nav__links a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    nav.querySelector('.nav__mark').addEventListener('click', () => {
      cancelPendingOpen();
      setOpen(false);
    });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cancelPendingOpen();
        setOpen(false);
      }
    });
    matchMedia('(min-width: 861px)').addEventListener('change', () => {
      cancelPendingOpen();
      setOpen(false);
    });

    const solid = () => nav.classList.toggle('is-solid', scrollY > 24);
    addEventListener('scroll', solid, { passive: true });
    solid();

    // lien actif selon la section visible
    const links = new Map();
    nav.querySelectorAll('[data-sec]').forEach((a) => links.set(a.dataset.sec, a));
    const targets = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    if (targets.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          const a = links.get(en.target.id);
          if (!a) return;
          if (en.isIntersecting) {
            links.forEach((l) => l.removeAttribute('aria-current'));
            a.setAttribute('aria-current', 'true');
          } else if (a.getAttribute('aria-current')) {
            a.removeAttribute('aria-current');
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      targets.forEach((t) => io.observe(t));
    }
  }

  /* ---------------------------------------------------------------- pistes de l'album */
  document.querySelectorAll('.rel__toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const li = btn.closest('.rel');
      const open = li.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------------------------------------------------------------- hero */
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const svg = hero.querySelector('.matrix');
  const rows = [...svg.querySelectorAll('.mrow')];
  const grid = rows.map((r) => [...r.querySelectorAll('.cell')]);
  const P = 100;          // pas de la grille (unités du viewBox)
  const SHADOW = 14;      // longueur du décalage de l'ombre
  let step = 2;           // décalage de chaque octet dans l'escalier, en cellules
  let progress = 0;       // 0 = carré, 1 = escalier
  let visible = true;

  /* -- lumière : le curseur est la source, l'ombre tombe à l'opposé */
  const FAR = { x: -4000, y: -4000 };           // lumière par défaut : haut-gauche, comme le logo
  const target = { ...FAR };
  const light = { ...FAR };
  let dirty = true;
  addEventListener('pointermove', (e) => { target.x = e.clientX; target.y = e.clientY; dirty = true; }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { target.x = FAR.x; target.y = FAR.y; dirty = true; });

  function applyLayout() {
    const e = smooth(progress);
    rows.forEach((g, i) => g.setAttribute('transform', `translate(${(e * step * i * P).toFixed(2)} 0)`));
    svg.setAttribute('viewBox', `0 0 ${(8 * P + 7 * step * P * e).toFixed(2)} ${8 * P}`);
  }

  function applyLight() {
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const inv = ctm.inverse();
    const pt = new DOMPoint(light.x, light.y).matrixTransform(inv);
    const e = smooth(progress);
    for (let r = 0; r < 8; r++) {
      const ox = e * step * r * P;
      for (let c = 0; c < 8; c++) {
        const vx = ox + (c + 0.5) * P - pt.x;
        const vy = (r + 0.5) * P - pt.y;
        const len = Math.hypot(vx, vy) || 1;
        const s = grid[r][c].style;
        s.setProperty('--dx', ((vx / len) * SHADOW).toFixed(2) + 'px');
        s.setProperty('--dy', ((vy / len) * SHADOW).toFixed(2) + 'px');
      }
    }
  }

  function readScroll() {
    const rect = hero.getBoundingClientRect();
    const run = Math.max(1, rect.height - innerHeight);
    const t = clamp(-rect.top / run);
    progress = reduce ? 0 : clamp((t - 0.05) / 0.72);
  }

  function chooseStep() {
    const b = svg.getBoundingClientRect();
    step = b.width / Math.max(1, b.height) > 1.3 ? 2 : 1;
  }

  let ticking = false;
  function frame() {
    ticking = false;
    if (!visible) return;
    const dx = target.x - light.x, dy = target.y - light.y;
    const far = Math.abs(dx) + Math.abs(dy) > 0.5;
    if (far) {
      const k = reduce ? 1 : 0.14;
      light.x += dx * k; light.y += dy * k;
    }
    readScroll();
    applyLayout();
    applyLight();
    if (far) request();
    dirty = false;
  }
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', request, { passive: true });
  addEventListener('pointermove', request, { passive: true });
  addEventListener('resize', () => { chooseStep(); request(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) request(); }).observe(hero);
  }

  /* -- séquence d'écriture : les 8 octets se fixent un à un, de haut en bas */
  function boot() {
    const final = grid.map((row) => row.map((c) => Number(c.dataset.b)));
    svg.classList.add('is-boot');
    const setBit = (cell, b) => cell.style.setProperty('--k', b ? 0 : 1);
    grid.flat().forEach((c) => setBit(c, Math.random() < 0.5 ? 1 : 0));
    requestAnimationFrame(() => svg.classList.add('is-on'));
    const FLICKER = 70, FLICKS = 4, ROW = 150, START = 380;
    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        const t0 = START + r * ROW + c * 16;
        for (let i = 1; i <= FLICKS; i++) setTimeout(() => setBit(cell, Math.random() < 0.5 ? 1 : 0), t0 + i * FLICKER * 0.8 - FLICKS * FLICKER * 0.8 + FLICKS * FLICKER);
        setTimeout(() => setBit(cell, final[r][c]), t0 + FLICKS * FLICKER + FLICKER);
      });
    });
    const end = START + 7 * ROW + 7 * 16 + FLICKS * FLICKER + FLICKER + 200;
    setTimeout(() => { svg.classList.remove('is-boot'); hero.classList.add('is-live'); }, end);
  }

  chooseStep();
  readScroll();
  applyLayout();
  applyLight();
  if (reduce) {
    svg.classList.add('is-on');
  } else {
    boot();
  }
})();
