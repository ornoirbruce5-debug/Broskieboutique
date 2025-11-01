/* main.js
   Imikorere yose ya front-end (vanilla JS)
   - Render products (products.js)
   - Testimonials static
   - Daily joke spinner (jokes.js) idasubiramo ukoreshe localStorage
   - Dark mode toggle (persisted)
   - Smooth scrolling / small animations
   - Tawk.to online detection => nyuma yaho erekana fallback contact form (localStorage)
   - Service Worker registration (service-worker.js) + PWA helpers
   Ibisobanuro byose mu Kinyarwanda
*/

/* -------------------------
   Helper functions
   ------------------------- */

// Element creation helper (alias)
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  children.flat().forEach(c => {
    if (c == null) return;
    if (typeof c === 'string' || typeof c === 'number') e.appendChild(document.createTextNode(String(c)));
    else e.appendChild(c);
  });
  return e;
}

// Inject small CSS from JS (used for animation timing)
function addCss(css) {
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
}

/* -------------------------
   On DOM ready
   ------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  renderTestimonials();
  setupJokeSpinner();
  setupDarkToggle();
  setupSmoothScroll();
  setupContactFallback();
  initYear();
  registerServiceWorker();
});

/* -------------------------
   Products rendering
   ------------------------- */
/* products.js igomba kuba iri ku rubuga kandi ikazana constant PRODUCTS */
function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  // Clear any existing children
  grid.innerHTML = '';

  if (!window.PRODUCTS || !Array.isArray(PRODUCTS)) {
    grid.appendChild(el('p', { class: 'muted' }, 'Nta bicuruzwa bibonetse.'));
    return;
  }

  PRODUCTS.forEach((p, i) => {
    // Card a simple layout: image + meta
    const img = el('img', { src: p.image || 'placeholder-product-1.jpg', alt: p.name });
    const name = el('div', { class: 'p-name' }, p.name);
    const cat = el('div', { class: 'p-cat' }, `${p.category} • Imbika: ${p.stock}`);
    const price = el('div', { class: 'p-price' }, `FBu ${Number(p.price).toLocaleString()}`);
    const desc = el('div', { class: 'p-desc' }, p.description);
    const meta = el('div', { class: 'p-meta' }, name, cat, price, desc);

    const card = el('article', { class: 'card', role: 'article', 'aria-label': p.name });
    card.appendChild(img);
    card.appendChild(meta);

    // Add a quick CTA overlay on click to open WhatsApp with prefilled message
    card.addEventListener('click', () => {
      const phone = '25700000000'; // replace with real phone in repo
      const text = encodeURIComponent(`Muraho, ndashaka ${p.name} (id: ${p.id}). Mumbwire uko nayibona.`);
      const url = `https://wa.me/${phone}?text=${text}`;
      window.open(url, '_blank', 'noopener');
    });

    // Add staggered animation
    card.style.animation = `fadeUp .45s ease ${i * 80}ms both`;

    grid.appendChild(card);
  });

  // Ensure fadeUp keyframes exist
  addCss(`@keyframes fadeUp { from{ opacity:0; transform:translateY(8px);} to{opacity:1; transform:translateY(0);} }`);
}

/* -------------------------
   Testimonials (static)
   ------------------------- */
function renderTestimonials() {
  const container = document.getElementById('testi-grid');
  if (!container) return;
  const samples = [
    { name: 'Aline', text: 'Serivisi nziza kandi byoroshye gukoresha!', rating: 5, emoji: '😄' },
    { name: 'Jean', text: 'Ibyo naguzemo byageze ku gihe, ibiciro byiza.', rating: 4, emoji: '👍' },
    { name: 'Marie', text: 'Ubufasha bwa WhatsApp bwadufashije cyane.', rating: 5, emoji: '🎉' }
  ];
  samples.forEach(s => {
    const stars = el('div', { class: 'muted' }, '★'.repeat(s.rating) + '☆'.repeat(5 - s.rating));
    const card = el('div', { class: 'testimonial', role: 'listitem' },
      el('strong', {}, `${s.name} ${s.emoji}`),
      stars,
      el('p', {}, s.text)
    );
    container.appendChild(card);
  });
}

/* -------------------------
   Daily Joke Spinner (localStorage dedupe)
   ------------------------- */
function setupJokeSpinner() {
  const btn = document.getElementById('joke-spin');
  const txt = document.getElementById('joke-text');
  if (!btn || !txt) return;

  const KEY = 'bdm_seen_jokes_v1';
  const seenRaw = localStorage.getItem(KEY);
  let seen = new Set();
  if (seenRaw) {
    try { JSON.parse(seenRaw).forEach(i => seen.add(String(i))); } catch(e){ seen = new Set(); }
  }

  const jokes = Array.isArray(window.JOKES) ? window.JOKES.slice() : [];
  if (jokes.length === 0) {
    txt.textContent = 'Nta rwenya ribonetse.';
    btn.disabled = true;
    return;
  }

  function pick() {
    // Build indexes not yet seen
    const indexes = jokes.map((_, i) => String(i)).filter(i => !seen.has(i));
    if (indexes.length === 0) {
      // reset when exhausted
      seen = new Set();
    }
    // pick random index among all jokes but prefer unseen
    let pickIndex;
    const unseen = jokes.map((_, i) => i).filter(i => !seen.has(String(i)));
    if (unseen.length > 0) {
      pickIndex = unseen[Math.floor(Math.random() * unseen.length)];
    } else {
      pickIndex = Math.floor(Math.random() * jokes.length);
    }
    txt.textContent = jokes[pickIndex] || 'Hehe.';
    // mark seen and persist
    seen.add(String(pickIndex));
    localStorage.setItem(KEY, JSON.stringify(Array.from(seen)));
    // animate subtle
    txt.animate([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 300, easing: 'ease-out' });
  }

  // initial pick
  pick();
  btn.addEventListener('click', pick);
}

/* -------------------------
   Dark mode (persist) - mobile first
   ------------------------- */
function setupDarkToggle() {
  const btn = document.getElementById('dark-toggle');
  const root = document.documentElement;
  const KEY = 'bdm_theme_v1';
  if (!btn) return;

  // Load saved or prefer system dark
  const saved = localStorage.getItem(KEY);
  if (saved) apply(saved);
  else {
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    apply(prefersLight ? 'light' : 'dark');
  }

  btn.addEventListener('click', () => {
    const now = root.classList.contains('light') ? 'dark' : 'light';
    apply(now);
  });

  function apply(mode) {
    if (mode === 'light') root.classList.add('light');
    else root.classList.remove('light');
    btn.textContent = mode === 'light' ? 'Light' : 'Dark';
    btn.setAttribute('aria-pressed', mode === 'light' ? 'true' : 'false');
    localStorage.setItem(KEY, mode);
  }
}

/* -------------------------
   Smooth scrolling (basic)
   ------------------------- */
function setupSmoothScroll() {
  // Native smooth scrolling via CSS was set; add anchor handling fallback
  document.documentElement.style.scrollBehavior = 'smooth';
  // Delegate anchor clicks for internal links to ensure smoothness on older browsers
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const elTarget = document.getElementById(id);
    if (elTarget) {
      e.preventDefault();
      elTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${id}`);
    }
  });
}

/* -------------------------
   Tawk.to offline fallback / contact form
   ------------------------- */
function setupContactFallback() {
  const fallback = document.getElementById('offline-contact');
  const form = document.getElementById('contact-form');
  const savedNote = document.getElementById('contact-saved');

  if (!fallback || !form) return;

  // Show fallback if Tawk doesn't load or reports offline
  let decided = false;
  function showFallback() {
    if (decided) return;
    decided = true;
    fallback.classList.remove('hidden');
    fallback.setAttribute('aria-hidden', 'false');
  }

  // Wait for Tawk to appear; if not present after TIMEOUT, show fallback
  const TIMEOUT = 3500;
  const interval = setInterval(() => {
    if (window.Tawk_API && typeof window.Tawk_API === 'object') {
      clearInterval(interval);
      // Try to call getStatus if present
      try {
        if (typeof window.Tawk_API.getStatus === 'function') {
          window.Tawk_API.getStatus(function(status) {
            // status could be 'online' | 'away' | 'offline'
            if (status === 'online' || status === 'away') {
              // Tawk active: do nothing (live chat will be available)
            } else {
              showFallback();
            }
          });
        } else {
          // Could not determine status reliably -> show fallback to ensure contact path
          showFallback();
        }
      } catch (e) {
        showFallback();
      }
    }
  }, 300);

  // If never loaded, show fallback after timeout
  setTimeout(() => { if (!decided) { clearInterval(interval); showFallback(); } }, TIMEOUT);

  // Local-only contact storage (no backend) - store to localStorage with timestamp
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const msg = {
      name: fd.get('name'),
      email: fd.get('email'),
      message: fd.get('message'),
      ts: new Date().toISOString()
    };
    const KEY = 'bdm_local_messages_v1';
    const existing = JSON.parse(localStorage.getItem(KEY) || '[]');
    existing.push(msg);
    localStorage.setItem(KEY, JSON.stringify(existing));
    savedNote.classList.remove('hidden');
    form.reset();
    setTimeout(() => savedNote.classList.add('hidden'), 3000);
  });
}

/* -------------------------
   Service Worker registration (PWA)
   ------------------------- */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // On GitHub Pages, service worker path must be root-level to control pages - ensure file is at project root
  navigator.serviceWorker.register('/service-worker.js')
    .then(reg => {
      // Optional: listen for updates
      reg.addEventListener && reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available; you could prompt user to refresh
              console.log('New content available; consider refreshing.');
            }
          });
        }
      });
      console.log('ServiceWorker registered', reg.scope);
    })
    .catch(err => {
      console.warn('ServiceWorker registration failed:', err);
    });
}

/* -------------------------
   Misc utilities
   ------------------------- */
function initYear() {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
}
