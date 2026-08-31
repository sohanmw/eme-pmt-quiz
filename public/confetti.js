// confetti.js - Zero-dependency HTML5 Canvas Confetti & Particle Celebration Engine

(function (window) {
  let canvas = null;
  let ctx = null;
  let particles = [];
  let animationFrameId = null;

  const COLORS = [
    '#FF6B6B', '#4DB6FF', '#B4E61D', '#FFB84D',
    '#7C5CFC', '#FF5CA8', '#2ECC71', '#F1C40F', '#E74C3C'
  ];

  function ensureCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '9999';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');

      const resize = () => {
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      };
      window.addEventListener('resize', resize);
      resize();
    }
  }

  function createParticle(x, y, isSideBlast = false, dir = 1) {
    const angle = isSideBlast 
      ? (dir > 0 ? -Math.PI / 3 + (Math.random() - 0.5) * 0.5 : -2 * Math.PI / 3 + (Math.random() - 0.5) * 0.5)
      : Math.random() * Math.PI * 2;
    const speed = isSideBlast ? 15 + Math.random() * 15 : 6 + Math.random() * 14;

    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.25,
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
      opacity: 1,
      gravity: 0.35 + Math.random() * 0.15,
      drag: 0.96,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.1 + Math.random() * 0.1,
    };
  }

  function loop() {
    if (!ctx) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx + Math.sin(p.wobble) * 1.5;
      p.y += p.vy;
      p.wobble += p.wobbleSpeed;
      p.rotation += p.vRot;
      p.opacity -= 0.007;

      if (p.opacity <= 0 || p.y > window.innerHeight + 50) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (particles.length > 0) {
      animationFrameId = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  const QuizConfetti = {
    // Burst from center or coordinates
    burst(x = window.innerWidth / 2, y = window.innerHeight / 2, count = 75) {
      ensureCanvas();
      for (let i = 0; i < count; i++) {
        particles.push(createParticle(x, y));
      }
      if (!animationFrameId) loop();
    },

    // Grand side-cannons celebration (perfect for podium)
    celebrate(durationMs = 4000) {
      ensureCanvas();
      const endTime = Date.now() + durationMs;
      const interval = setInterval(() => {
        if (Date.now() > endTime) {
          clearInterval(interval);
          return;
        }
        // Left cannon
        for (let i = 0; i < 12; i++) {
          particles.push(createParticle(50, window.innerHeight - 80, true, 1));
        }
        // Right cannon
        for (let i = 0; i < 12; i++) {
          particles.push(createParticle(window.innerWidth - 50, window.innerHeight - 80, true, -1));
        }
        if (!animationFrameId) loop();
      }, 250);
    },

    clear() {
      particles = [];
      if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  };

  window.QuizConfetti = QuizConfetti;
})(window);
