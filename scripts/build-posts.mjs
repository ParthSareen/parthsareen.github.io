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
const CONTENT_DIR = resolve(ROOT, 'content', 'posts');
const WIP_CONTENT_DIR = resolve(ROOT, 'content', 'posts', 'wip');
const OUTPUT_DIR = resolve(ROOT, 'posts');
const WRITINGS_DIR = resolve(ROOT, 'writings');
const WIP_WRITINGS_DIR = resolve(ROOT, 'writings', 'wip');
const INDEX_PATH = join(OUTPUT_DIR, 'index.json');

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

const renderInlineMarkdown = (value = '') => md.renderInline(String(value));

const stripLeadingH1 = (html) =>
  html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, '');

const escapeAttribute = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const toISODate = (value) => {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const siteHead = ({ title, excerpt, math = true }) => `  <title>${escapeAttribute(title)} | Writings</title>
  <meta name="description" content="${escapeAttribute(excerpt)}" />
  <link rel="icon" href="/assets/favicon.ico" sizes="any" />
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/style.css?v=readable" />
  <script src="/theme-toggle.js"></script>${math ? `
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
        displayMath: [['$$','$$'], ['\\\\[','\\\\]']]
      },
      svg: { fontCache: 'global' }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>` : ''}`;

const navMarkup = `    <nav class="nav" aria-label="Primary">
      <span class="nav-links">
        <a href="/">home</a>
        <a href="/writings/" class="active">writings</a>
        <a href="/#work">work</a>
        <a href="/#elsewhere">elsewhere</a>
      </span>
    </nav>`;

const footerMarkup = `    <footer class="site-foot">
      <span>© 2026 parth sareen</span>
      <span class="site-foot-right">
        <a href="/">Home</a>
        <a href="https://x.com/parthsareen">X</a>
        <a href="https://github.com/parthsareen">GitHub</a>
        <a href="https://www.linkedin.com/in/parthsareen">LinkedIn</a>
      </span>
    </footer>`;

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

const getReadTime = (html) => {
  const words = stripTags(html).match(/\S+/g) ?? [];
  return Math.max(1, Math.ceil(words.length / 225));
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

function tagFirstParagraph(html) {
  return html.replace(/<p>/, '<p class="first-paragraph">');
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
  html = tagFirstParagraph(html);

  const stat = await fs.stat(sourcePath);
  const title = (typeof data.title === 'string' && data.title.trim())
    ? data.title.trim()
    : extractTitleFromContent(content) ?? slug;
  const date = toISODate(data.date) ?? toISODate(stat.mtime);
  const excerpt = (typeof data.excerpt === 'string' && data.excerpt.trim())
    ? data.excerpt.trim()
    : getExcerptFromHtml(html);
  const readTime = getReadTime(html);

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
    isProtected,
    readTime,
    math: data.math !== false  // defaults to true
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

async function removeStaleWritings(validSlugs) {
  const entries = await fs.readdir(WRITINGS_DIR, { withFileTypes: true });
  const keep = new Set(validSlugs);
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !keep.has(entry.name))
      .map((entry) => fs.rm(join(WRITINGS_DIR, entry.name), { recursive: true, force: true }))
  );
}

const writingTemplate = ({ slug, title, date, html, excerpt, readTime, math = true }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
${siteHead({ title: stripTags(renderInlineMarkdown(title)), excerpt, math })}
</head>
<body>
  <main class="page page--prose">
${navMarkup}

    <p class="crumb"><a href="/writings/">Writings</a>${date ? ` · ${date.slice(0, 4)}` : ''}</p>

    <header class="essay-masthead">
      <h1 class="essay-title">${renderInlineMarkdown(title)}</h1>
      <div class="essay-meta">
        ${date ? `<span><time datetime="${date}">${date}</time></span>` : ''}
        ${readTime ? `<span>${readTime} min read</span>` : ''}
      </div>
    </header>

    <article class="post-content">
${stripLeadingH1(html)}
    </article>

    <section class="post-navigation">
      <a href="/writings/">← writings</a>
    </section>

${footerMarkup}
  </main>
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

const wipTemplate = ({ slug, title, date, html, excerpt, readTime, math = true }) => {
  // YOU FOUND ME AHHHHH!
  const password = process.env.WIP_PASSWORD || 'BleuSph!nxC0y234#';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
${siteHead({ title: stripTags(renderInlineMarkdown(title)), excerpt, math })}
</head>
<body>
  <div id="password-overlay" class="password-overlay">
    <div class="password-box">
      <h2>This post is password protected</h2>
      <input type="password" id="password-input" placeholder="Enter password" />
      <br />
      <button type="button" id="password-submit">Submit</button>
      <div id="error" class="error"></div>
    </div>
  </div>
  <div id="content" class="content-hidden">
    <main class="page page--prose">
${navMarkup}

      <p class="crumb"><a href="/writings/">Writings</a>${date ? ` · ${date.slice(0, 4)}` : ''}</p>

      <header class="essay-masthead">
        <h1 class="essay-title">${renderInlineMarkdown(title)}</h1>
        <div class="essay-meta">
          ${date ? `<span><time datetime="${date}">${date}</time></span>` : ''}
          ${readTime ? `<span>${readTime} min read</span>` : ''}
        </div>
      </header>

      <article class="post-content">
${stripLeadingH1(html)}
      </article>

      <section class="post-navigation">
        <a href="/writings/">← writings</a>
      </section>

${footerMarkup}
    </main>
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
    document.getElementById('password-submit').addEventListener('click', checkPassword);
    
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
  return sorted.map((entry) => entry.filename);
}

async function main() {
  await ensureDirs();
  const markdownFiles = await readMarkdownFiles();
  const wipMarkdownFiles = await readWipMarkdownFiles();
  
  if (markdownFiles.length === 0 && wipMarkdownFiles.length === 0) {
    await fs.writeFile(INDEX_PATH, '[]\n', 'utf8');
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
  const filenames = await writeIndex(publicPosts);
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
