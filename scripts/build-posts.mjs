import { promises as fs } from 'fs';
import { dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import hljs from 'highlight.js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE_URL = (process.env.SITE_URL || 'https://parthsareen.com').replace(/\/$/, '');

const FONT_HEAD = `  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,200;0,400;0,600;1,400&family=Merriweather:wght@300;400;700&display=swap" />`;
const CONTENT_DIR = resolve(ROOT, 'content', 'posts');
const WIP_CONTENT_DIR = resolve(ROOT, 'content', 'posts', 'wip');
const OUTPUT_DIR = resolve(ROOT, 'posts');
const WRITINGS_DIR = resolve(ROOT, 'writings');
const WIP_WRITINGS_DIR = resolve(ROOT, 'writings', 'wip');
const INDEX_PATH = join(OUTPUT_DIR, 'index.json');
const FEED_PATH = join(ROOT, 'feed.xml');
const SITEMAP_PATH = join(ROOT, 'sitemap.xml');

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    // Skip mermaid blocks - they need special handling
    if (lang === 'mermaid') {
      return '<pre><code class="language-mermaid">' + md.utils.escapeHtml(str) + '</code></pre>';
    }
    // Apply syntax highlighting for all other code blocks
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code class="language-' + lang + '">' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>';
      } catch (__) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
}).use(markdownItAnchor, {
  slugify: (s) =>
    s
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
});

const mathPattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;

const stripTags = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const escapeAttribute = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeXml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toAtomDate = (dateStr) => {
  if (!dateStr) return new Date().toISOString();
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

function articleHeadBlock({ slug, title, date, excerpt, isProtected, includeJsonLd }) {
  const pageUrl = `${SITE_URL}/writings/${slug}/`;
  const published = date ? `${date}T12:00:00.000Z` : null;
  const ogDesc = escapeAttribute(excerpt);
  const lines = [
    ...(isProtected ? ['  <meta name="robots" content="noindex,nofollow" />'] : []),
    `  <link rel="canonical" href="${escapeAttribute(pageUrl)}" />`,
    `  <meta property="og:type" content="article" />`,
    `  <meta property="og:title" content="${escapeAttribute(title)}" />`,
    `  <meta property="og:description" content="${ogDesc}" />`,
    `  <meta property="og:url" content="${escapeAttribute(pageUrl)}" />`,
    `  <meta property="og:site_name" content="Parth Sareen" />`,
    ...(published
      ? [`  <meta property="article:published_time" content="${escapeAttribute(published)}" />`]
      : []),
    `  <meta name="twitter:card" content="summary" />`,
    `  <meta name="twitter:title" content="${escapeAttribute(title)}" />`,
    `  <meta name="twitter:description" content="${ogDesc}" />`
  ];
  if (includeJsonLd && published) {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      datePublished: published,
      author: {
        '@type': 'Person',
        name: 'Parth Sareen',
        url: `${SITE_URL}/`
      },
      url: pageUrl,
      description: excerpt
    };
    const raw = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
    lines.push(`  <script type="application/ld+json">${raw}</script>`);
  }
  return lines.join('\n');
}

const toISODate = (value) => {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const extractTitleFromContent = (content) => {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.replace(/^#\s+/, '').trim();
    }
  }
  return null;
};

const getExcerptFromHtml = (html) => {
  const match = html.match(/<p>([\s\S]*?)<\/p>/i);
  return match ? stripTags(match[0]) : '';
};

async function ensureDirs() {
  await fs.mkdir(CONTENT_DIR, { recursive: true });
  await fs.mkdir(WIP_CONTENT_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(WRITINGS_DIR, { recursive: true });
  await fs.mkdir(WIP_WRITINGS_DIR, { recursive: true });
}

async function readMarkdownFiles() {
  const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.md')
    .map((entry) => entry.name)
    .sort();
}

async function readWipMarkdownFiles() {
  try {
    const entries = await fs.readdir(WIP_CONTENT_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.md')
      .map((entry) => entry.name)
      .sort();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function protectMathSegments(source) {
  const placeholders = [];
  const protectedSource = source.replace(mathPattern, (match) => {
    const id = `§§MATH${placeholders.length}§§`;
    placeholders.push({ id, content: match });
    return id;
  });
  return { protectedSource, placeholders };
}

function restoreMathSegments(html, placeholders) {
  let result = html;
  for (const { id, content } of placeholders) {
    result = result.split(id).join(content);
  }
  return result;
}

function convertMermaidBlocks(html) {
  // Convert <pre><code class="language-mermaid">...</code></pre> to <pre class="mermaid">...</pre>
  return html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (match, content) => {
      // Decode HTML entities
      const decoded = content
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      return `<pre class="mermaid">${decoded}</pre>`;
    }
  );
}

async function renderPost(filename, isWip = false) {
  const sourcePath = isWip ? join(WIP_CONTENT_DIR, filename) : join(CONTENT_DIR, filename);
  const raw = await fs.readFile(sourcePath, 'utf8');
  if (!raw.trim()) {
    console.warn(`⚠️  Skipping ${filename} (empty file)`);
    return null;
  }

  const { data, content } = matter(raw);
  const slug = filename.replace(/\.md$/, '');
  
  // Check if post is protected via frontmatter
  const isProtected = data.protected === true || isWip;

  const { protectedSource, placeholders } = protectMathSegments(content);
  const htmlWithPlaceholders = md.render(protectedSource);
  let html = restoreMathSegments(htmlWithPlaceholders, placeholders);
  html = convertMermaidBlocks(html);

  const stat = await fs.stat(sourcePath);
  const title = (typeof data.title === 'string' && data.title.trim())
    ? data.title.trim()
    : extractTitleFromContent(content) ?? slug;
  const date = toISODate(data.date) ?? toISODate(stat.mtime);
  const excerpt = (typeof data.excerpt === 'string' && data.excerpt.trim())
    ? data.excerpt.trim()
    : getExcerptFromHtml(html);

  // Only write to OUTPUT_DIR for non-protected posts
  if (!isProtected) {
    const outputPath = join(OUTPUT_DIR, `${slug}.html`);
    await fs.writeFile(outputPath, html, 'utf8');
  }

  return {
    slug,
    filename: `${slug}.html`,
    title,
    date,
    excerpt,
    html,
    isProtected
  };
}

async function removeStaleFiles(validFilenames) {
  const existing = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
  const keeps = new Set(validFilenames);
  await Promise.all(
    existing
      .filter((entry) => entry.isFile() && entry.name.endsWith('.html') && !keeps.has(entry.name))
      .map((entry) => fs.unlink(join(OUTPUT_DIR, entry.name)))
  );
}

/** writings/<slug>/ kept without a matching markdown file (legacy). */
const PRESERVE_WRITING_SLUGS = new Set(['the-feeling-of-the-thing']);

async function removeStaleWritings(validSlugs) {
  const entries = await fs.readdir(WRITINGS_DIR, { withFileTypes: true });
  const keep = new Set([...validSlugs, ...PRESERVE_WRITING_SLUGS]);
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !keep.has(entry.name))
      .map((entry) => fs.rm(join(WRITINGS_DIR, entry.name), { recursive: true, force: true }))
  );
}

const writingTemplate = ({ slug, title, date, html, excerpt }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | Writings</title>
  <meta name="description" content="${escapeAttribute(excerpt)}" />
${FONT_HEAD}
${articleHeadBlock({ slug, title, date, excerpt, isProtected: false, includeJsonLd: true })}
  <link rel="alternate" type="application/atom+xml" title="Parth Sareen" href="/feed.xml" />
  <link rel="stylesheet" href="/style.css" />
  <script src="/theme.js"></script>
  <script src="/vim-nav.js"></script>
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
        displayMath: [['$$','$$'], ['\\\\[','\\\\]']]
      },
      svg: { fontCache: 'global' }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
</head>
<body>
  <div class="container">
    <header>
      <h1><a href="/index.html">Writings</a></h1>
      ${date ? `<p class="post-meta"><time datetime="${date}">${date}</time></p>` : ''}
    </header>
    <main>
      <article class="post-content">
${html}
      </article>
      <section class="post-navigation">
        <a href="/index.html#writings">← All writings</a>
      </section>
    </main>
    <footer>
      <a href="https://github.com/parthsareen" class="icon">GitHub</a>
      <a href="https://x.com/parthsareen" class="icon">X</a>
      <a href="https://www.linkedin.com/in/parthsareen" class="icon">LinkedIn</a>
    </footer>
  </div>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    
    mermaid.initialize({ 
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#e2d9c9',
        primaryTextColor: '#463a2e',
        primaryBorderColor: '#744c24',
        lineColor: '#463a2e',
        secondaryColor: '#f6f2e8',
        tertiaryColor: '#e2d9c9',
        mainBkg: '#e2d9c9',
        secondBkg: '#f6f2e8',
        tertiaryBkg: '#e2d9c9',
        nodeBorder: '#744c24',
        clusterBkg: '#f6f2e8',
        clusterBorder: '#744c24',
        defaultLinkColor: '#463a2e',
        titleColor: '#463a2e',
        edgeLabelBackground: '#f6f2e8',
        fontSize: '15px',
        fontFamily: 'Spectral, serif'
      }
    });
    
    await mermaid.run({nodes: [...document.querySelectorAll('pre[class~="mermaid"]')]});
  </script>
</body>
</html>`;

const wipTemplate = ({ slug, title, date, html, excerpt }) => {
  // YOU FOUND ME AHHHHH!
  const password = process.env.WIP_PASSWORD || 'BleuSph!nxC0y234#';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | Writings</title>
  <meta name="description" content="${escapeAttribute(excerpt)}" />
${FONT_HEAD}
${articleHeadBlock({ slug, title, date, excerpt, isProtected: true, includeJsonLd: false })}
  <link rel="alternate" type="application/atom+xml" title="Parth Sareen" href="/feed.xml" />
  <link rel="stylesheet" href="/style.css" />
  <script src="/theme.js"></script>
  <script src="/vim-nav.js"></script>
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
        displayMath: [['$$','$$'], ['\\\\[','\\\\]']]
      },
      svg: { fontCache: 'global' }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
  <style>
    .password-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--bg-color, #fff);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    .password-box {
      text-align: center;
      padding: 2rem;
    }
    .password-box input {
      padding: 0.5rem;
      font-size: 1rem;
      margin: 1rem 0;
      border: 1px solid var(--text-color, #333);
      background: var(--bg-color, #fff);
      color: var(--text-color, #333);
    }
    .password-box button {
      padding: 0.5rem 1rem;
      font-size: 1rem;
      cursor: pointer;
      background: var(--text-color, #333);
      color: var(--bg-color, #fff);
      border: none;
    }
    .error {
      color: #e74c3c;
      margin-top: 0.5rem;
    }
    .content-hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div id="password-overlay" class="password-overlay">
    <div class="password-box">
      <h2>This post is password protected</h2>
      <input type="password" id="password-input" placeholder="Enter password" />
      <br />
      <button onclick="checkPassword()">Submit</button>
      <div id="error" class="error"></div>
    </div>
  </div>
  <div id="content" class="content-hidden">
    <div class="container">
      <header>
        <h1><a href="/index.html">Writings</a></h1>
        ${date ? `<p class="post-meta"><time datetime="${date}">${date}</time></p>` : ''}
      </header>
      <main>
        <article class="post-content">
${html}
        </article>
        <section class="post-navigation">
          <a href="/index.html#writings">← All writings</a>
        </section>
      </main>
      <footer>
        <a href="https://github.com/parthsareen" class="icon">GitHub</a>
        <a href="https://x.com/parthsareen" class="icon">X</a>
        <a href="https://www.linkedin.com/in/parthsareen" class="icon">LinkedIn</a>
      </footer>
    </div>
  </div>
  <script type="module">
    const PASSWORD = '${password}';
    
    async function initMermaid() {
      const mermaid = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
      mermaid.default.initialize({ 
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          primaryColor: '#e2d9c9',
          primaryTextColor: '#463a2e',
          primaryBorderColor: '#744c24',
          lineColor: '#463a2e',
          secondaryColor: '#f6f2e8',
          tertiaryColor: '#e2d9c9',
          mainBkg: '#e2d9c9',
          secondBkg: '#f6f2e8',
          tertiaryBkg: '#e2d9c9',
          nodeBorder: '#744c24',
          clusterBkg: '#f6f2e8',
          clusterBorder: '#744c24',
          defaultLinkColor: '#463a2e',
          titleColor: '#463a2e',
          edgeLabelBackground: '#f6f2e8',
          fontSize: '15px',
          fontFamily: 'Spectral, serif'
        }
      });
      await mermaid.default.run({nodes: [...document.querySelectorAll('pre[class~="mermaid"]')]});
    }
    
    function checkPassword() {
      const input = document.getElementById('password-input').value;
      if (input === PASSWORD) {
        document.getElementById('password-overlay').style.display = 'none';
        document.getElementById('content').classList.remove('content-hidden');
        localStorage.setItem('wip-auth', 'true');
        setTimeout(initMermaid, 100);
      } else {
        document.getElementById('error').textContent = 'Incorrect password';
      }
    }
    
    if (localStorage.getItem('wip-auth') === 'true') {
      document.getElementById('password-overlay').style.display = 'none';
      document.getElementById('content').classList.remove('content-hidden');
      setTimeout(initMermaid, 100);
    }
    
    document.getElementById('password-input').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        checkPassword();
      }
    });
  </script>
</body>
</html>`;
};

async function writeWritingsPage(entry) {
  const dir = join(WRITINGS_DIR, entry.slug);
  await fs.mkdir(dir, { recursive: true });
  const page = entry.isProtected ? wipTemplate(entry) : writingTemplate(entry);
  await fs.writeFile(join(dir, 'index.html'), page, 'utf8');
}

async function writeIndex(entries) {
  const sorted = entries
    .filter((entry) => entry)
    .sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    })
    .map(({ slug, filename, title, date, excerpt }) => ({ slug, filename, title, date, excerpt }));
  await fs.writeFile(INDEX_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  return sorted;
}

async function writeFeedAtom(sortedPublic) {
  // Deterministic updated time so `npm run build:posts` is idempotent (CI checks git diff).
  const feedUpdated =
    sortedPublic[0]?.date != null ? toAtomDate(sortedPublic[0].date) : '2020-01-01T12:00:00.000Z';
  const entryXml = sortedPublic
    .map((post) => {
      const url = `${SITE_URL}/writings/${post.slug}/`;
      const updated = post.date ? toAtomDate(post.date) : feedUpdated;
      return `  <entry>
    <title>${escapeXml(post.title)}</title>
    <link href="${escapeXml(url)}" rel="alternate" />
    <id>${escapeXml(url)}</id>
    <updated>${escapeXml(updated)}</updated>
    <summary>${escapeXml(post.excerpt)}</summary>
  </entry>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Parth Sareen — Writings</title>
  <link href="${escapeXml(`${SITE_URL}/feed.xml`)}" rel="self" />
  <link href="${escapeXml(`${SITE_URL}/`)}" />
  <id>${escapeXml(`${SITE_URL}/`)}</id>
  <updated>${escapeXml(feedUpdated)}</updated>
${entryXml}
</feed>
`;
  await fs.writeFile(FEED_PATH, xml, 'utf8');
}

async function writeSitemap(sortedPublic) {
  const staticPaths = ['/', '/blog.html', '/latte-art.html', '/fragrances.html', '/reading.html', '/glossary.html'];
  const staticLastMod = sortedPublic[0]?.date ?? '2020-01-01';
  const urlLines = [
    ...staticPaths.map(
      (path) =>
        `  <url><loc>${escapeXml(`${SITE_URL}${path === '/' ? '/' : path}`)}</loc><lastmod>${escapeXml(staticLastMod)}</lastmod></url>`
    ),
    ...sortedPublic.map((post) => {
      const loc = `${SITE_URL}/writings/${post.slug}/`;
      const mod = post.date ?? staticLastMod;
      return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${escapeXml(mod)}</lastmod></url>`;
    })
  ].join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlLines}
</urlset>
`;
  await fs.writeFile(SITEMAP_PATH, xml, 'utf8');
}

async function main() {
  await ensureDirs();
  const markdownFiles = await readMarkdownFiles();
  const wipMarkdownFiles = await readWipMarkdownFiles();
  
  if (markdownFiles.length === 0 && wipMarkdownFiles.length === 0) {
    await fs.writeFile(INDEX_PATH, '[]\n', 'utf8');
    await writeFeedAtom([]);
    await writeSitemap([]);
    console.warn('⚠️  No markdown files found.');
    return;
  }

  const publicPosts = [];
  const protectedPosts = [];
  
  // Process regular posts
  for (const file of markdownFiles) {
    const entry = await renderPost(file, false);
    if (entry) {
      if (entry.isProtected) {
        protectedPosts.push(entry);
      } else {
        publicPosts.push(entry);
      }
      await writeWritingsPage(entry);
    }
  }
  
  // Process WIP directory posts (automatically protected)
  for (const file of wipMarkdownFiles) {
    const entry = await renderPost(file, true);
    if (entry) {
      protectedPosts.push(entry);
      await writeWritingsPage(entry);
    }
  }

  // Only add public posts to the index
  const sortedPublic = await writeIndex(publicPosts);
  const filenames = sortedPublic.map((entry) => entry.filename);
  await writeFeedAtom(sortedPublic);
  await writeSitemap(sortedPublic);
  await removeStaleFiles(filenames);
  await removeStaleWritings([...publicPosts, ...protectedPosts].map((entry) => entry.slug));
  
  console.log(`✅ Generated ${publicPosts.length} public post${publicPosts.length === 1 ? '' : 's'}.`);
  if (protectedPosts.length > 0) {
    console.log(`🔒 Generated ${protectedPosts.length} password-protected post${protectedPosts.length === 1 ? '' : 's'}.`);
  }
}

main().catch((err) => {
  console.error('Failed to build posts:', err);
  process.exitCode = 1;
});
