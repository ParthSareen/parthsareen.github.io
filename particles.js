const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];
const numberOfParticles = 15; // Reduced number of particles

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 2 + 0.5; // Smaller size range
        this.speedX = Math.random() * 1 - 0.5; // Reduced speed range
        this.speedY = Math.random() * 1 - 0.5; // Reduced speed range
        this.color = `hsl(${Math.random() * 60 + 300}, 100%, 70%)`; // Lighter color
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.size > 0.1) this.size -= 0.05; // Slower shrinking
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function createParticles(x, y) {
    for (let i = 0; i < numberOfParticles; i++) {
        particles.push(new Particle(x, y));
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].size <= 0.1) {
            particles.splice(i, 1);
            i--;
        }
    }
    requestAnimationFrame(animateParticles);
}

// Existing mouse event for desktop
window.addEventListener('mousemove', function(event) {
    createParticles(event.x, event.y);
});

// New touch events for mobile
let isCreatingParticles = false;
let longPressTimer;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    longPressTimer = setTimeout(() => {
        isCreatingParticles = true;
        createParticles(touch.clientX, touch.clientY);
    }, 100); // Start after 100ms of holding
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isCreatingParticles) {
        const touch = e.touches[0];
        createParticles(touch.clientX, touch.clientY);
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    clearTimeout(longPressTimer);
    isCreatingParticles = false;
});

window.addEventListener('resize', function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

animateParticles();
