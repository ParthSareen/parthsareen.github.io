async function loadPost(filename) {
    const response = await fetch(`posts/${filename}`);
    const markdown = await response.text();
    const html = marked.parse(markdown);
    console.log('Markdown:', markdown);
    console.log('HTML:', html);
    document.querySelector('main').innerHTML = html;
}

async function loadPostList() {
    const response = await fetch('posts/index.json');
    const posts = await response.json();
    const postList = document.getElementById('post-list');
    
    posts.forEach(post => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#${post.filename}`;
        a.textContent = post.title;
        li.appendChild(a);
        const date = document.createElement('span');
        date.className = 'date';
        date.textContent = post.date;
        li.appendChild(date);
        postList.appendChild(li);
    });
    console.log('Posts:', posts);
}

window.addEventListener('hashchange', () => {
    const postFilename = window.location.hash.slice(1);
    if (postFilename) {
        loadPost(postFilename);
    }
});

loadPostList();
