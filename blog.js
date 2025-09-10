async function loadPost(filename) {
    const container = document.getElementById('post-content') || document.querySelector('main');
    try {
        const response = await fetch(`posts/${filename}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const markdown = await response.text();
        const html = marked.parse(markdown);
        container.innerHTML = html;
    } catch (err) {
        console.error('Error loading post:', err);
        container.innerHTML = `<p>Failed to load post (${filename}): ${err instanceof Error ? err.message : String(err)}</p>`;
        return;
    }
    // Typeset math if MathJax is available; don't fail the post render
    try {
        if (window.MathJax && window.MathJax.typesetPromise) {
            await window.MathJax.typesetPromise([container]);
        }
    } catch (err) {
        console.warn('MathJax typeset error:', err);
    }
}

async function loadPostList() {
    try {
        const response = await fetch('posts/index.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const posts = await response.json();
        // Sort by date descending so latest is first
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        const postList = document.getElementById('post-list');
        if (postList) {
            posts.forEach(post => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                // On the blog page, use in-page anchors
                a.href = `#${post.filename}`;
                a.textContent = post.title;
                li.appendChild(a);
                const date = document.createElement('span');
                date.className = 'date';
                date.textContent = post.date;
                li.appendChild(date);
                postList.appendChild(li);
            });
        }
        return posts;
    } catch (err) {
        console.error('Error loading post list:', err);
        return [];
    }
}

window.addEventListener('hashchange', () => {
    const postFilename = window.location.hash.slice(1);
    if (postFilename) {
        loadPost(postFilename);
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const posts = await loadPostList();
    const initial = window.location.hash.slice(1);
    if (initial) {
        loadPost(initial);
    } else if (posts && posts.length > 0) {
        // Auto-load the first post when no hash is provided
        loadPost(posts[0].filename);
    }
});
