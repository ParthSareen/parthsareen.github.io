let postsCache = [];

const toSlug = (post) => post.slug || post.filename.replace(/\.html$/, '');

function renderPostList() {
    const postList = document.getElementById('post-list');
    if (!postList) return;
    postList.innerHTML = '';
    postsCache.forEach((post) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        const slug = toSlug(post);
        link.href = `/writings/${slug}`;
        link.textContent = post.title;
        li.appendChild(link);

        if (post.date) {
            const date = document.createElement('span');
            date.className = 'date';
            date.textContent = post.date;
            li.appendChild(date);
        }

        if (post.excerpt) {
            const excerpt = document.createElement('p');
            excerpt.className = 'excerpt';
            excerpt.textContent = post.excerpt;
            li.appendChild(excerpt);
        }

        postList.appendChild(li);
    });
}

function renderLatestHighlight() {
    const container = document.getElementById('post-content');
    if (!container || postsCache.length === 0) return;
    const latest = postsCache[0];
    const slug = toSlug(latest);
    container.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Latest writing';
    container.appendChild(heading);

    const titleLink = document.createElement('a');
    titleLink.href = `/writings/${slug}`;
    titleLink.textContent = latest.title;
    container.appendChild(titleLink);

    if (latest.date) {
        const date = document.createElement('p');
        date.className = 'date';
        date.textContent = latest.date;
        container.appendChild(date);
    }

    if (latest.excerpt) {
        const teaser = document.createElement('p');
        teaser.textContent = latest.excerpt;
        container.appendChild(teaser);
    }
}

async function loadPostList() {
    try {
        const response = await fetch('posts/index.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const posts = await response.json();
        postsCache = Array.isArray(posts) ? posts : [];
        renderPostList();
        renderLatestHighlight();
    } catch (err) {
        console.error('Error loading post list:', err);
        postsCache = [];
    }
}

function redirectLegacyHash() {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const slug = hash.replace(/\.md$/, '').replace(/\.html$/, '');
    if (!slug) return;
    const target = `/writings/${slug}`;
    window.location.replace(target);
}

document.addEventListener('DOMContentLoaded', () => {
    redirectLegacyHash();
    loadPostList();
});
