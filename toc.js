(function () {
  const article = document.querySelector('article.post-content, article.prose');
  if (!article) return;
  const headings = Array.from(article.querySelectorAll('h2[id], h3[id]'));
  if (headings.length < 2) return;

  const toc = document.createElement('aside');
  toc.className = 'toc';
  toc.setAttribute('aria-label', 'On this page');

  const title = document.createElement('p');
  title.className = 'toc-title';
  title.textContent = 'On this page';
  toc.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'toc-list';
  const linkMap = new Map();

  headings.forEach((h) => {
    const li = document.createElement('li');
    li.className = 'toc-item toc-item--' + h.tagName.toLowerCase();
    const a = document.createElement('a');
    a.className = 'toc-link';
    a.href = '#' + h.id;
    a.textContent = h.textContent.trim();
    li.appendChild(a);
    list.appendChild(li);
    linkMap.set(h.id, a);
  });
  toc.appendChild(list);
  document.body.appendChild(toc);

  let activeId = null;
  const setActive = (id) => {
    if (activeId === id) return;
    if (activeId && linkMap.get(activeId)) linkMap.get(activeId).classList.remove('active');
    activeId = id;
    if (id && linkMap.get(id)) linkMap.get(id).classList.add('active');
  };

  const updateActive = () => {
    const threshold = window.scrollY + 120;
    let current = headings[0];
    for (const h of headings) {
      if (h.offsetTop <= threshold) current = h;
      else break;
    }
    setActive(current.id);
  };

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => { updateActive(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  updateActive();
})();
