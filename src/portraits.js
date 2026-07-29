// ===== BENITO ESCAPE — procedural 2D character portraits (canvas art) =====

function roundHead(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function ear(ctx, x, y, size, angle, color, inner) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, 0);
  ctx.lineTo(size * 0.5, 0);
  ctx.lineTo(0, -size);
  ctx.closePath();
  ctx.fill();
  if (inner) {
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(-size * 0.26, -size * 0.12);
    ctx.lineTo(size * 0.26, -size * 0.12);
    ctx.lineTo(0, -size * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function eye(ctx, x, y, w, h, iris, angry) {
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.12, w * 0.55, h * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.15, w * 0.26, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (angry) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const dir = x < 48 ? 1 : -1;
    ctx.moveTo(x - w * 1.2, y - h * (dir > 0 ? 1.5 : 0.8));
    ctx.lineTo(x + w * 1.2, y - h * (dir > 0 ? 0.8 : 1.5));
    ctx.stroke();
  }
}

const ARTISTS = {
  // Benito: chubby grey tabby, big green eyes
  benito(ctx, s) {
    const grey = '#9aa1ac', dark = '#6b7280';
    ear(ctx, s * 0.28, s * 0.3, s * 0.24, -0.3, grey, '#f2a6b5');
    ear(ctx, s * 0.72, s * 0.3, s * 0.24, 0.3, grey, '#f2a6b5');
    roundHead(ctx, s * 0.5, s * 0.56, s * 0.36, grey);
    // stripes
    ctx.fillStyle = dark;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(s * (0.38 + i * 0.1), s * 0.22, s * 0.045, s * 0.1);
    }
    // cheeks/muzzle
    ctx.fillStyle = '#e8e4d8';
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.7, s * 0.2, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    eye(ctx, s * 0.38, s * 0.52, s * 0.09, s * 0.11, '#3ddc84');
    eye(ctx, s * 0.62, s * 0.52, s * 0.09, s * 0.11, '#3ddc84');
    // nose + smile
    ctx.fillStyle = '#f2a6b5';
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.64, s * 0.045, s * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6b5b4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s * 0.45, s * 0.7, s * 0.06, 0.2, Math.PI - 0.4);
    ctx.arc(s * 0.57, s * 0.7, s * 0.06, 0.2, Math.PI - 0.4);
    ctx.stroke();
    // whiskers
    ctx.strokeStyle = '#d8d4c8';
    ctx.beginPath();
    for (const sy of [-1, 0, 1]) {
      ctx.moveTo(s * 0.2, s * (0.64 + sy * 0.04));
      ctx.lineTo(s * 0.05, s * (0.62 + sy * 0.06));
      ctx.moveTo(s * 0.8, s * (0.64 + sy * 0.04));
      ctx.lineTo(s * 0.95, s * (0.62 + sy * 0.06));
    }
    ctx.stroke();
  },

  // Deedee: tan chihuahua, huge ears, tongue permanently out, tiny angry eyes
  deedee(ctx, s) {
    const tan = '#d29a5b';
    ear(ctx, s * 0.18, s * 0.38, s * 0.34, -0.5, tan, '#e8b98a');
    ear(ctx, s * 0.82, s * 0.38, s * 0.34, 0.5, tan, '#e8b98a');
    roundHead(ctx, s * 0.5, s * 0.58, s * 0.32, tan);
    eye(ctx, s * 0.4, s * 0.52, s * 0.06, s * 0.06, '#3a2a18', true);
    eye(ctx, s * 0.6, s * 0.52, s * 0.06, s * 0.06, '#3a2a18', true);
    // snout
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.72, s * 0.13, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a18';
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.66, s * 0.045, s * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    // the permanent tongue!
    ctx.fillStyle = '#ff7d9c';
    ctx.beginPath();
    ctx.ellipse(s * 0.56, s * 0.84, s * 0.055, s * 0.1, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e05575';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s * 0.56, s * 0.78);
    ctx.lineTo(s * 0.58, s * 0.9);
    ctx.stroke();
    // spiky evil collar
    ctx.fillStyle = '#4c1d95';
    ctx.fillRect(s * 0.3, s * 0.88, s * 0.4, s * 0.08);
  },

  // Silva: slim grey cat, narrow green eyes, smug
  silva(ctx, s) {
    const grey = '#aab4c2';
    ear(ctx, s * 0.3, s * 0.3, s * 0.26, -0.2, grey, '#d8bfd8');
    ear(ctx, s * 0.7, s * 0.3, s * 0.26, 0.2, grey, '#d8bfd8');
    // slimmer head
    ctx.fillStyle = grey;
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.58, s * 0.28, s * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    // narrow feline eyes
    ctx.fillStyle = '#2eb872';
    for (const ex of [0.4, 0.6]) {
      ctx.beginPath();
      ctx.ellipse(s * ex, s * 0.52, s * 0.07, s * 0.035, ex < 0.5 ? 0.25 : -0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#111';
    for (const ex of [0.4, 0.6]) {
      ctx.beginPath();
      ctx.ellipse(s * ex, s * 0.52, s * 0.015, s * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // smirk
    ctx.strokeStyle = '#5a6472';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s * 0.54, s * 0.7, s * 0.08, 0.4, Math.PI * 0.75);
    ctx.stroke();
    ctx.fillStyle = '#f2a6b5';
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.63, s * 0.035, s * 0.025, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // Professor Meow: white cat, big round glasses, lab collar
  prof(ctx, s) {
    const white = '#f2f0ea';
    ear(ctx, s * 0.28, s * 0.28, s * 0.24, -0.3, white, '#f2c6cf');
    ear(ctx, s * 0.72, s * 0.28, s * 0.24, 0.3, white, '#f2c6cf');
    roundHead(ctx, s * 0.5, s * 0.55, s * 0.34, white);
    // glasses
    ctx.strokeStyle = '#4a3b2a';
    ctx.lineWidth = 3;
    for (const ex of [0.38, 0.62]) {
      ctx.beginPath();
      ctx.arc(s * ex, s * 0.52, s * 0.1, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(s * 0.48, s * 0.52);
    ctx.lineTo(s * 0.52, s * 0.52);
    ctx.stroke();
    // eyes behind glasses
    ctx.fillStyle = '#3d7ea6';
    for (const ex of [0.38, 0.62]) {
      ctx.beginPath();
      ctx.ellipse(s * ex, s * 0.53, s * 0.035, s * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // moustache-ish whisker tufts
    ctx.strokeStyle = '#cfcabb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.42, s * 0.68); ctx.lineTo(s * 0.3, s * 0.72);
    ctx.moveTo(s * 0.58, s * 0.68); ctx.lineTo(s * 0.7, s * 0.72);
    ctx.stroke();
    ctx.fillStyle = '#f2a6b5';
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.63, s * 0.04, s * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    // lab coat collar
    ctx.fillStyle = '#e8f4f8';
    ctx.beginPath();
    ctx.moveTo(s * 0.3, s * 0.98);
    ctx.lineTo(s * 0.5, s * 0.84);
    ctx.lineTo(s * 0.7, s * 0.98);
    ctx.closePath();
    ctx.fill();
  },

  narrator(ctx, s) {
    ctx.fillStyle = '#ffd93b';
    ctx.font = `bold ${s * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦', s * 0.5, s * 0.55);
  },
};

const BG = {
  benito: '#2e5a8a', deedee: '#4c1d40', silva: '#3a3a55',
  prof: '#2a6156', narrator: '#1c2b40',
};

export function drawPortrait(canvas, who) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  ctx.clearRect(0, 0, s, canvas.height);
  ctx.fillStyle = BG[who] ?? '#223';
  ctx.fillRect(0, 0, s, canvas.height);
  (ARTISTS[who] ?? ARTISTS.narrator)(ctx, s);
}

/** Big title-screen Benito (full body, waving). */
export function drawTitleBenito(canvas) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  const grey = '#9aa1ac', cream = '#e8e4d8', dark = '#6b7280';
  // fat body
  ctx.fillStyle = grey;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.72, s * 0.26, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cream;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.75, s * 0.17, s * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // legs
  ctx.fillStyle = grey;
  for (const ex of [0.38, 0.62]) {
    ctx.beginPath();
    ctx.ellipse(s * ex, s * 0.93, s * 0.07, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // waving arm
  ctx.strokeStyle = grey;
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.72, s * 0.66);
  ctx.quadraticCurveTo(s * 0.86, s * 0.55, s * 0.84, s * 0.4);
  ctx.stroke();
  // net in the other paw
  ctx.strokeStyle = '#b5651d';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(s * 0.24, s * 0.72);
  ctx.lineTo(s * 0.12, s * 0.42);
  ctx.stroke();
  ctx.strokeStyle = '#ffd93b';
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.arc(s * 0.12, s * 0.33, s * 0.09, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(191,232,255,.9)';
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(s * (0.12 + i * 0.03), s * 0.25);
    ctx.lineTo(s * (0.12 + i * 0.03), s * 0.41);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.04, s * (0.33 + i * 0.03));
    ctx.lineTo(s * 0.2, s * (0.33 + i * 0.03));
    ctx.stroke();
  }
  // tail
  ctx.strokeStyle = grey;
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(s * 0.72, s * 0.8);
  ctx.quadraticCurveTo(s * 0.9, s * 0.78, s * 0.88, s * 0.62);
  ctx.stroke();
  // head
  ear(ctx, s * 0.36, s * 0.3, s * 0.14, -0.3, grey, '#f2a6b5');
  ear(ctx, s * 0.64, s * 0.3, s * 0.14, 0.3, grey, '#f2a6b5');
  roundHead(ctx, s * 0.5, s * 0.42, s * 0.2, grey);
  ctx.fillStyle = dark;
  for (let i = 0; i < 3; i++) ctx.fillRect(s * (0.44 + i * 0.05), s * 0.23, s * 0.02, s * 0.05);
  eye(ctx, s * 0.44, s * 0.4, s * 0.05, s * 0.06, '#3ddc84');
  eye(ctx, s * 0.56, s * 0.4, s * 0.05, s * 0.06, '#3ddc84');
  ctx.fillStyle = cream;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.5, s * 0.1, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2a6b5';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.46, s * 0.025, s * 0.018, 0, 0, Math.PI * 2);
  ctx.fill();
  // big open smile
  ctx.fillStyle = '#8a3324';
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.51, s * 0.04, 0, Math.PI);
  ctx.fill();
}
