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

window.addEventListener('mousemove', function(event) {
    createParticles(event.x, event.y);
});

window.addEventListener('resize', function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

animateParticles();
