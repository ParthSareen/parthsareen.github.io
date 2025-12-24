# Build Documentation

## Setup

Install dependencies:
```bash
npm install
```

## Environment Configuration

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` and set your password for protected posts:
```
WIP_PASSWORD=your_password_here
```

**Note:** The `.env` file is gitignored and should never be committed.

## Building Posts

### Build all posts
```bash
npm run build:posts
```

This will:
- Process markdown files from `content/posts/` 
- Process protected/WIP markdown files from `content/posts/wip/`
- Generate HTML files in `writings/`
- Update `posts/index.json` with public posts only

### Preview locally
```bash
npm run preview
```

Server will be available at http://127.0.0.1:8080

## Post Types

### Public Posts
Place markdown files in `content/posts/` and they will:
- Be built to `writings/<slug>/index.html`
- Appear in `posts/index.json` 
- Be listed on the site

### Protected Posts
Two ways to create protected posts:

1. **Add frontmatter** to any post in `content/posts/`:
```markdown
---
protected: true
---

# Your Post Title
...
```

2. **Place in WIP folder** - any file in `content/posts/wip/` is automatically protected

Protected posts:
- Are built to `writings/<slug>/index.html` (or `writings/wip/<slug>/index.html`)
- **Do NOT** appear in `posts/index.json`
- Require password to view (password from `.env`)
- Are only accessible via direct URL

## Workflow

1. Edit markdown files in `content/posts/`
2. Run `npm run build:posts` to generate HTML
3. Preview with `npm run preview`
4. Commit both markdown and generated HTML
5. Push to GitHub

## File Structure

```
content/posts/           # Public markdown posts
  ├── post1.md
  └── wip/              # Protected/WIP posts
      └── draft.md

writings/               # Generated HTML (commit these!)
  ├── post1/
  │   └── index.html
  └── wip/
      └── draft/
          └── index.html

posts/
  └── index.json       # Public posts metadata
```

## Notes

- Images go in `/images/` and are referenced as `/images/filename.png`
- The password is embedded in the generated HTML at build time
- Protected posts use client-side password protection (not highly secure, but keeps casual visitors out)

