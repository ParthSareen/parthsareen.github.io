import { promises as fs } from 'fs';
import { dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONTENT_DIR = resolve(ROOT, 'content', 'posts');
const OUTPUT_DIR = resolve(ROOT, 'posts');
const WRITINGS_DIR = resolve(ROOT, 'writings');
const INDEX_PATH = join(OUTPUT_DIR, 'index.json');

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
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
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(WRITINGS_DIR, { recursive: true });
}

async function readMarkdownFiles() {
  const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.md')
    .map((entry) => entry.name)
    .sort();
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

async function renderPost(filename) {
  const sourcePath = join(CONTENT_DIR, filename);
  const raw = await fs.readFile(sourcePath, 'utf8');
  if (!raw.trim()) {
    console.warn(`⚠️  Skipping ${filename} (empty file)`);
    return null;
  }

  const { data, content } = matter(raw);
  const slug = filename.replace(/\.md$/, '');

  const { protectedSource, placeholders } = protectMathSegments(content);
  const htmlWithPlaceholders = md.render(protectedSource);
  const html = restoreMathSegments(htmlWithPlaceholders, placeholders);

  const stat = await fs.stat(sourcePath);
  const title = (typeof data.title === 'string' && data.title.trim())
    ? data.title.trim()
    : extractTitleFromContent(content) ?? slug;
  const date = toISODate(data.date) ?? toISODate(stat.mtime);
  const excerpt = (typeof data.excerpt === 'string' && data.excerpt.trim())
    ? data.excerpt.trim()
    : getExcerptFromHtml(html);

  const outputPath = join(OUTPUT_DIR, `${slug}.html`);
  await fs.writeFile(outputPath, html, 'utf8');

  return {
    slug,
    filename: `${slug}.html`,
    title,
    date,
    excerpt,
    html
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

const writingTemplate = ({ slug, title, date, html, excerpt }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | Writings</title>
  <meta name="description" content="${escapeAttribute(excerpt)}" />
  <link rel="icon" href="/zukohere.png" type="image/png" />
  <link rel="stylesheet" href="/style.css" />
  <script src="/theme.js"></script>
  <script src="/vim-nav.js"></script>
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$','$$'], ['\\[','\\]']]
      },
      svg: { fontCache: 'global' }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
</head>
<body>
  <div class="container">
    <header>
      <a href="/index.html">
        <img src="/zukohere.png" alt="Profile Image" class="profile-image" />
      </a>
      <h1><a href="/blog.html">Writings</a></h1>
      ${date ? `<p class="post-meta"><time datetime="${date}">${date}</time></p>` : ''}
    </header>
    <main>
      <article class="post-content">
${html}
      </article>
      <section class="post-navigation">
        <a href="/blog.html">← All writings</a>
      </section>
    </main>
    <footer>
      <a href="https://github.com/parthsareen" class="icon">GitHub</a>
      <a href="https://x.com/thanosthinking" class="icon">X</a>
      <a href="https://www.linkedin.com/in/parthsareen" class="icon">LinkedIn</a>
    </footer>
  </div>
</body>
</html>`;

async function writeWritingsPage(entry) {
  const dir = join(WRITINGS_DIR, entry.slug);
  await fs.mkdir(dir, { recursive: true });
  const page = writingTemplate(entry);
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
  if (markdownFiles.length === 0) {
    await fs.writeFile(INDEX_PATH, '[]\n', 'utf8');
    console.warn('⚠️  No markdown files found.');
    return;
  }

  const rendered = [];
  for (const file of markdownFiles) {
    const entry = await renderPost(file);
    if (entry) {
      rendered.push(entry);
      await writeWritingsPage(entry);
    }
  }

  const filenames = await writeIndex(rendered);
  await removeStaleFiles(filenames);
  await removeStaleWritings(rendered.map((entry) => entry.slug));
  console.log(`✅ Generated ${rendered.length} post${rendered.length === 1 ? '' : 's'}.`);
}

main().catch((err) => {
  console.error('Failed to build posts:', err);
  process.exitCode = 1;
});
