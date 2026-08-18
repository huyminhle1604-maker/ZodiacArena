/* Zodiac Arena — ZAFx (bản pixel)
 * Hiệu ứng riêng cho từng kỹ năng, vẽ hoàn toàn bằng khối pixel.
 * Canvas 2D, không phụ thuộc gì.
 *
 *   ZAFx.spawn('whirl', {x, y, r:96, a:aim})
 *   ZAFx.fromEvent(e)          // map thẳng event của map1-server.js
 *   ZAFx.update(dt)            // dt: giây
 *   ZAFx.draw(ctx)             // toạ độ world (gọi sau khi translate camera)
 *   ZAFx.PX = 2                // cỡ một "hạt pixel" — đổi cho khớp scale sprite
 *
 * Quy ước pixel:
 *  - mọi thứ vẽ bằng fillRect PX×PX bám lưới PX, không stroke, không gradient
 *  - alpha lượng tử hoá 5 bậc; mảng nhạt dùng dither bàn cờ thay vì alpha thấp
 *  - vòng trên mặt đất dẹt YS=0.5 theo góc nhìn 3/4 của bộ sprite
 */
(function () {
  const TAU = Math.PI * 2, YS = 0.5;
  const GOLD = '#C9A961', CREAM = '#ffe9a8', ICE = '#8fd4ff', MINT = '#c8f08a',
        RED = '#ff5c6c', VIOLET = '#c58cff', INK = '#F0E9F4', EMBER = '#E2703A',
        DARK = '#2a1636', SMOKE = '#8a7b96', POISON = '#7bd67b', POISON_2 = '#a8e6a8';

  const API = { PX: 2 };
  const ease = { out: p => 1 - Math.pow(1 - p, 3), in: p => p * p, pop: p => Math.sin(Math.max(0, Math.min(1, p)) * Math.PI) };
  const rnd = (f, i) => { const s = Math.sin(f.seed + i * 12.9898) * 43758.5453; return s - Math.floor(s); };
  /* alpha 5 bậc — hiệu ứng pixel không có nửa tông */
  const qa = a => a <= .06 ? 0 : Math.min(1, Math.ceil(a * 5) / 5);

  let CTX = null, PX = 2;
  function snap(v) { return Math.round(v / PX) * PX; }
  /* một hạt: size tính theo bội số của PX */
  function px(x, y, col, al, size) {
    const a = qa(al); if (!a) return;
    const s = Math.max(1, Math.round(size || 1)) * PX;
    CTX.globalAlpha = a; CTX.fillStyle = col;
    CTX.fillRect(snap(x) - (s - PX) / 2, snap(y) - (s - PX) / 2, s, s);
  }
  /* dither bàn cờ cho vùng nhạt: chỉ vẽ ô chẵn */
  function pxd(x, y, col, al, size) {
    const gx = Math.round(x / PX), gy = Math.round(y / PX);
    if ((gx + gy) & 1) return;
    px(x, y, col, al, size);
  }
  /* vòng trên đất — plot theo pixel, không stroke */
  function ring(x, y, r, col, al, size) {
    if (!(r > 0)) return;
    const steps = Math.max(12, Math.round(TAU * r / PX));
    for (let i = 0; i < steps; i++) {
      const a = i / steps * TAU;
      px(x + Math.cos(a) * r, y + Math.sin(a) * r * YS, col, al, size || 1);
    }
  }
  /* đĩa trên đất — scanline theo hàng PX, dither nếu nhạt */
  function disc(x, y, r, col, al) {
    if (!(r > 0)) return;
    const ry = r * YS, dit = al < .34, plot = dit ? pxd : px;
    for (let dy = -Math.ceil(ry / PX) * PX; dy <= ry; dy += PX) {
      const k = 1 - (dy / ry) * (dy / ry); if (k <= 0) continue;
      const hw = r * Math.sqrt(k);
      for (let dx = -Math.ceil(hw / PX) * PX; dx <= hw; dx += PX) plot(x + dx, y + dy, col, dit ? al * 2 : al, 1);
    }
  }
  /* cung — dùng cho mọi cú vung */
  function arc(x, y, r, a0, a1, col, al, size) {
    if (!(r > 0)) return;
    const steps = Math.max(4, Math.round(Math.abs(a1 - a0) * r / PX));
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      px(x + Math.cos(a) * r, y + Math.sin(a) * r * YS, col, al, size || 1);
    }
  }
  /* vệt thẳng — bước theo PX */
  function line(x1, y1, x2, y2, col, al, size) {
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(d / PX));
    for (let i = 0; i <= n; i++) px(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, col, al, size || 1);
  }
  /* cột dọc pixel: nở theo hàng, không gradient */
  function column(x, yTop, yBot, halfTop, halfBot, col, al) {
    for (let y = snap(yTop); y <= yBot; y += PX) {
      const k = (y - yTop) / Math.max(1, yBot - yTop);
      const hw = halfTop + (halfBot - halfTop) * k;
      const a = al * (.35 + .65 * k);
      const plot = a < .34 ? pxd : px;
      for (let dx = -Math.ceil(hw / PX) * PX; dx <= hw; dx += PX) plot(x + dx, y, col, a < .34 ? a * 2 : a, 1);
    }
  }

  /* ký hiệu cung: vẽ nhỏ rồi phóng to nearest-neighbor cho ra pixel */
  const GCACHE = {};
  function glyph(ch, x, y, col, al) {
    const a = qa(al); if (!a) return;
    const key = ch + col;
    let g = GCACHE[key];
    if (!g) {
      g = document.createElement('canvas'); g.width = 12; g.height = 12;
      const c = g.getContext('2d');
      c.font = '11px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col;
      c.fillText(ch + '\uFE0E', 6, 6.5);   /* FE0E: ép ký hiệu cung vẽ dạng chữ, không thành emoji màu */
      /* ngưỡng alpha → khối đặc, không nửa tông */
      const d = c.getImageData(0, 0, 12, 12); const p4 = d.data;
      for (let i = 3; i < p4.length; i += 4) p4[i] = p4[i] > 90 ? 255 : 0;
      c.putImageData(d, 0, 0);
      GCACHE[key] = g;
    }
    const s = 12 * PX;
    CTX.globalAlpha = a;
    CTX.drawImage(g, snap(x) - s / 2, snap(y) - s / 2, s, s);
  }

  const K = {
    /* ── KIẾM SĨ ───────────────────────────────────────────── */
    /* E · Chém Xoay — hai lưỡi liềm quét quanh thân */
    whirl: {
      dur: .46,
      draw(f, p) {
        const turns = f.twice ? 2 : 1.25, sw = turns * TAU * ease.out(p);
        const r = f.r * (.55 + .45 * ease.out(p)), col = f.col || CREAM, y = f.y - 14;
        for (const off of [0, Math.PI]) {
          const a1 = f.a + off + sw;
          arc(f.x, y, r, a1 - 1.5, a1, col, .9 * (1 - p * .6), 2);
          arc(f.x, y, r - 5 * PX, a1 - .8, a1, INK, .7 * (1 - p), 1);
          px(f.x + Math.cos(a1) * r, y + Math.sin(a1) * r * YS, INK, 1 - p, 2);
        }
        ring(f.x, f.y, r * .8, col, .3 * (1 - p), 1);
        for (let i = 0; i < 8; i++) {
          const a = rnd(f, i) * TAU, d = r * (.5 + rnd(f, i + 9) * .5);
          px(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * YS - p * 9, GOLD, .7 * (1 - p), 1);
        }
      }
    },
    /* R-A · Khiêu Chiến — sóng xung kích + 6 vạch rune */
    taunt: {
      dur: .7,
      draw(f, p) {
        const r = f.r * ease.out(p), col = f.col || CREAM;
        ring(f.x, f.y, r, col, .95 * (1 - p), p < .5 ? 2 : 1);
        ring(f.x, f.y, r * .72, col, .6 * (1 - p), 1);
        disc(f.x, f.y, r * .34, col, .18 * (1 - p));
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU + .3, d = r * .92;
          line(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * YS,
               f.x + Math.cos(a) * (d - 5 * PX), f.y + Math.sin(a) * (d - 5 * PX) * YS, GOLD, .85 * (1 - p), 2);
        }
        for (let i = 0; i < 6; i++) px(f.x + (rnd(f, i) - .5) * r, f.y - 6 - ease.out(p) * 26 * rnd(f, i + 3), col, .8 * (1 - p), 1);
      }
    },
    /* R-B · Cuồng Nộ — lửa đỏ liếm từ chân lên (buff 6s) */
    frenzy: {
      dur: 6,
      draw(f, p) {
        const puls = .6 + .4 * Math.sin(f.t * 9);
        ring(f.x, f.y, 20 + puls * 4, RED, .6 * (1 - p * .6), 1);
        disc(f.x, f.y, 17, RED, .14 * puls);
        for (let i = 0; i < 10; i++) {
          const ph = (f.t * 1.6 + rnd(f, i)) % 1, a = rnd(f, i + 5) * TAU;
          px(f.x + Math.cos(a) * 13, f.y + Math.sin(a) * 13 * YS - ph * 34,
             ph < .45 ? CREAM : RED, (1 - ph) * .95 * (1 - p * .5), ph < .5 ? 2 : 1);
        }
      }
    },

    /* ── XẠ THỦ ───────────────────────────────────────────── */
    /* E · Mũi Xuyên — vệt dài xé không khí */
    pierce: {
      dur: .34,
      draw(f, p) {
        const a = f.a, L = f.r * ease.out(p), y0base = f.y - 12;
        const x0 = f.x + Math.cos(a) * 10, y0 = y0base + Math.sin(a) * 10 * YS;
        const x1 = f.x + Math.cos(a) * L, y1 = y0base + Math.sin(a) * L * YS;
        line(x0, y0, x1, y1, ICE, .9 * (1 - p), 2);
        line(x0, y0, x1, y1, INK, 1 - p, 1);
        for (let i = 0; i < 9; i++) {
          const t = rnd(f, i), n = (rnd(f, i + 7) - .5) * 12 * p;
          px(x0 + (x1 - x0) * t - Math.sin(a) * n, y0 + (y1 - y0) * t + Math.cos(a) * n, ICE, .8 * (1 - p), 1);
        }
        px(x1, y1, INK, 1 - p, p < .5 ? 3 : 2);
      }
    },
    /* Bẫy Nổ — mảnh băng toả + vòng ép đất */
    trapBoom: {
      dur: .45,
      draw(f, p) {
        const r = f.r * ease.out(p);
        ring(f.x, f.y, r, ICE, .95 * (1 - p), p < .45 ? 2 : 1);
        disc(f.x, f.y, r * .5, ICE, .2 * (1 - p));
        for (let i = 0; i < 11; i++) {
          const a = rnd(f, i) * TAU, d = r * (.6 + rnd(f, i + 4) * .55);
          const x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d * YS - ease.out(p) * 12;
          line(x, y, x - Math.cos(a) * 3 * PX, y - Math.sin(a) * 3 * PX * YS, i % 3 ? ICE : INK, .85 * (1 - p), 1);
        }
      }
    },
    /* R-B · Nỏ Liên Thanh — loạt lửa đầu nòng + vỏ đạn */
    volley: {
      dur: .9,
      draw(f, p) {
        const a = f.a, shots = 6, k = Math.floor(p * shots), sub = (p * shots) % 1;
        const mx = f.x + Math.cos(a) * 14, my = f.y - 13 + Math.sin(a) * 14 * YS;
        if (sub < .5) {
          const s = 1 - sub * 2;
          arc(mx, my, 5 * PX * s + PX, a - .55, a + .55, CREAM, .95 * s, 2);
          px(mx + Math.cos(a) * 8, my + Math.sin(a) * 8 * YS, INK, s, s > .5 ? 3 : 2);
        }
        for (let i = 0; i <= k && i < shots; i++) {
          const fall = Math.min(1, (p - i / shots) * 2.6);
          px(mx - Math.cos(a) * 6 + (rnd(f, i) - .5) * 14, my + fall * 22 + rnd(f, i + 3) * 4, GOLD, .9 * (1 - fall), 1);
        }
        for (let i = 0; i < 5; i++) pxd(f.x - Math.cos(a) * (6 + rnd(f, i) * 12), f.y - Math.sin(a) * 4, SMOKE, .5 * (1 - p), 1);
      }
    },
    /* Trừng Phạt / dấu Thợ Săn — khung ngắm quay trên đầu mục tiêu */
    mark: {
      dur: 3,
      draw(f, p) {
        const rot = f.t * 2.2, r = 11 + Math.sin(f.t * 6) * 1.5, y = f.y - (f.h || 34);
        const al = .95 * (1 - ease.in(p)), col = f.col || EMBER;
        for (let i = 0; i < 4; i++) {
          const b = rot + i / 4 * TAU;
          for (let j = 0; j <= 3; j++) {
            const c = b + j * .16;
            px(f.x + Math.cos(c) * r, y + Math.sin(c) * r, col, al, 1);
          }
        }
        px(f.x, y, col, al, 1);
      }
    },

    /* ── NHÀ SƯ ───────────────────────────────────────────── */
    /* E · Ánh Sáng Thiêu — cột sáng dội xuống */
    smite: {
      dur: .55,
      draw(f, p) {
        const w = Math.max(0, (f.r || 34) * (p < .25 ? p / .25 : 1 - (p - .25) / .75 * .55)), col = f.col || MINT;
        column(f.x, f.y - 180, f.y, w * .3, w * .5, col, .55 * (1 - ease.in(p)));
        disc(f.x, f.y, w * .55 + p * 8, col, .32 * (1 - p));
        ring(f.x, f.y, w * .6 + p * 22, col, .9 * (1 - p), p < .4 ? 2 : 1);
        for (let i = 0; i < 9; i++) {
          const a = rnd(f, i) * TAU, d = w * (.3 + rnd(f, i + 2) * .7);
          px(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * YS - (1 - p) * 26 * rnd(f, i + 6), i % 2 ? col : INK, .9 * (1 - p), 1);
        }
      }
    },
    /* R-A · Chữa Lành / Suối Nguồn — vòng hồi đồng tâm + hạt bay lên */
    fountain: {
      dur: .9,
      draw(f, p) {
        const col = f.col || MINT, R = f.r || 110;
        for (let i = 0; i < 3; i++) {
          const q = Math.max(0, Math.min(1, (p - i * .12) / .7));
          if (q > 0) ring(f.x, f.y, R * ease.out(q), col, .8 * (1 - q), q < .5 ? 2 : 1);
        }
        for (let i = 0; i < 16; i++) {
          const a = rnd(f, i) * TAU, d = R * .8 * rnd(f, i + 3), ph = (p * 1.3 + rnd(f, i + 8)) % 1;
          px(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * YS - ph * 40, col, (1 - ph) * .95 * (1 - p * .4), ph < .4 ? 2 : 1);
        }
        if (f.crossCol) {   /* dấu cộng khi máu thừa hoá khiên */
          const s = Math.round(3 * ease.pop(p)) * PX, y = f.y - 30, al = 1 - p;
          for (let d = -s; d <= s; d += PX) { px(f.x + d, y, f.crossCol, al, 1); px(f.x, y + d, f.crossCol, al, 1); }
        }
      }
    },
    /* R-B · Lời Nguyền — vòng tím tối, tua rủ, ký hiệu cung */
    curse: {
      dur: 1,
      draw(f, p) {
        const col = f.col || VIOLET, R = (f.r || 110) * ease.out(Math.min(1, p * 1.6));
        disc(f.x, f.y, R, DARK, .3 * (1 - p));
        ring(f.x, f.y, R, col, .9 * (1 - p), p < .5 ? 2 : 1);
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * TAU + f.t * .6, d = R * (.55 + rnd(f, i) * .45);
          const x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d * YS;
          line(x, y - 16 * (1 - p), x, y, col, .75 * (1 - p), 1);
          px(x, y - 16 * (1 - p), col, .95 * (1 - p), 2);
        }
        if (f.glyph) glyph(f.glyph, f.x, f.y - 26 - p * 16, col, .9 * (1 - p));
      }
    },

    /* ── DÙNG CHUNG ───────────────────────────────────────── */
    dashTrail: {
      dur: .3,
      draw(f, p) {
        for (let i = 0; i < 6; i++) {
          const t = i / 5, x = f.x1 + (f.x2 - f.x1) * t, y = f.y1 + (f.y2 - f.y1) * t;
          ring(x, y, 9 - i, f.col || '#B98BE8', (1 - p) * (1 - t) * .7, 1);
        }
        line(f.x1, f.y1 - 14, f.x2, f.y2 - 14, f.col || '#B98BE8', .45 * (1 - p), 1);
      }
    },
    poison: {
      dur: 6,
      draw(f, p) {
        const R = f.r || 60;
        disc(f.x, f.y, R, POISON, .2 * (1 - ease.in(p)));
        ring(f.x, f.y, R, POISON, .35 * (1 - p), 1);
        for (let i = 0; i < 9; i++) {
          const ph = (f.t * .8 + rnd(f, i)) % 1, a = rnd(f, i + 4) * TAU, d = R * rnd(f, i + 9);
          px(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * YS - ph * 14, POISON_2, (1 - ph) * .7 * (1 - p), ph < .4 ? 2 : 1);
        }
      }
    },
    levelUp: {
      dur: .8,
      draw(f, p) {
        ring(f.x, f.y, 16 + 40 * ease.out(p), GOLD, .95 * (1 - p), p < .4 ? 2 : 1);
        for (let i = 0; i < 3; i++) {
          const q = p - i * .14; if (q <= 0) continue;
          const y = f.y - 8 - q * 52, s = Math.max(0, 4 * (1 - q)) * PX, al = 1 - q;
          for (let d = 0; d <= s; d += PX) { px(f.x - d, y + d * .7, GOLD, al, 1); px(f.x + d, y + d * .7, GOLD, al, 1); }
        }
      }
    },
    crit: {
      dur: .28,
      draw(f, p) {
        const s = 13 * ease.out(p);
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * TAU + .78;
          line(f.x + Math.cos(a) * s * .35, f.y + Math.sin(a) * s * .35, f.x + Math.cos(a) * s, f.y + Math.sin(a) * s, '#ffd479', 1 - p, 1);
        }
      }
    },
    /* ── ĐÒN ĐÁNH THƯỜNG ─ hero ───────────────────── */
    /* Kiếm sĩ — cắt một cung ngắn theo hướng ngắm */
    atkSlash: {
      dur: .18,
      draw(f, p) {
        const r = (f.r || 34) * (.7 + .3 * p), sw = -.9 + 1.8 * ease.out(p), y = f.y - 14;
        arc(f.x, y, r, f.a + sw - .75, f.a + sw + .1, INK, .95 * (1 - p), 2);
        arc(f.x, y, r - 4 * PX, f.a + sw - .5, f.a + sw, f.col || CREAM, .8 * (1 - p), 1);
        px(f.x + Math.cos(f.a + sw) * r, y + Math.sin(f.a + sw) * r * YS, INK, 1 - p, 2);
      }
    },
    /* Xạ thủ — nháy đầu cung + hai hạt giật lùi */
    atkShot: {
      dur: .16,
      draw(f, p) {
        const a = f.a, x = f.x + Math.cos(a) * 13, y = f.y - 13 + Math.sin(a) * 13 * YS;
        arc(x, y, 4 * PX * (1 - p) + PX, a - .6, a + .6, CREAM, .95 * (1 - p), 1);
        px(x + Math.cos(a) * 5, y + Math.sin(a) * 5 * YS, INK, 1 - p, p < .4 ? 2 : 1);
        for (const s of [-1, 1]) px(x - Math.cos(a) * 6 + s * 3, y - Math.sin(a) * 6 * YS, GOLD, .7 * (1 - p), 1);
      }
    },
    /* Nhà sư — vòng phù nhỏ trước người + hạt bay lên */
    atkCast: {
      dur: .22,
      draw(f, p) {
        const a = f.a, x = f.x + Math.cos(a) * 12, y = f.y - 16 + Math.sin(a) * 12 * YS;
        ring(x, y, 5 * PX * (.5 + p), f.col || MINT, .9 * (1 - p), 1);
        for (let i = 0; i < 4; i++) {
          const b = i / 4 * TAU + p * 5;
          px(x + Math.cos(b) * 4 * PX, y + Math.sin(b) * 4 * PX - p * 8, i % 2 ? CREAM : (f.col || MINT), .9 * (1 - p), 1);
        }
      }
    },
    /* Trung đòn — hạt bắn ngược hướng đánh */
    impact: {
      dur: .2,
      draw(f, p) {
        const col = f.crit ? '#ffd479' : (f.col || INK), n = f.crit ? 8 : 5;
        for (let i = 0; i < n; i++) {
          const a = (f.a || 0) + Math.PI + (rnd(f, i) - .5) * 1.6, d = (4 + rnd(f, i + 3) * 9) * ease.out(p);
          px(f.x + Math.cos(a) * d, f.y - 10 + Math.sin(a) * d * YS, i % 2 ? col : CREAM, .95 * (1 - p), i % 3 ? 1 : 2);
        }
        if (f.crit) ring(f.x, f.y - 10, 6 + 10 * ease.out(p), col, .8 * (1 - p), 1);
      }
    },

    /* ── ĐÒN ĐÁNH THƯỜNG ─ quái ──────────────────── */
    /* Sói — hai vệt răng chéo */
    monBite: {
      dur: .22,
      draw(f, p) {
        const a = f.a || 0, R = f.r || 16, y = f.y - 8, q = ease.out(p);
        for (const s of [-1, 1]) {
          const b = a + s * .5;
          line(f.x + Math.cos(b) * R * .5, y + Math.sin(b) * R * .5 * YS,
               f.x + Math.cos(b) * R * (1 + q * .4), y + Math.sin(b) * R * (1 + q * .4) * YS,
               s > 0 ? INK : '#d46a6a', .95 * (1 - p), 1);
        }
      }
    },
    /* Quỷ Chuỳ — vòng bụi ép đất + mảnh đá văng */
    monSmash: {
      dur: .32,
      draw(f, p) {
        const R = (f.r || 22) * (1 + ease.out(p) * 1.4);
        ring(f.x, f.y, R, SMOKE, .85 * (1 - p), p < .4 ? 2 : 1);
        disc(f.x, f.y, R * .55, SMOKE, .2 * (1 - p));
        for (let i = 0; i < 7; i++) {
          const a = rnd(f, i) * TAU, d = R * (.6 + rnd(f, i + 5) * .5);
          px(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * YS - ease.out(p) * 14 * rnd(f, i + 2), '#6b6070', .9 * (1 - p), i % 3 ? 1 : 2);
        }
      }
    },
    /* Slime — keo bắn tung */
    monSplash: {
      dur: .26,
      draw(f, p) {
        const R = (f.r || 14) * (1 + ease.out(p));
        ring(f.x, f.y, R, f.col || '#7fd6e8', .8 * (1 - p), 1);
        for (let i = 0; i < 8; i++) {
          const a = rnd(f, i) * TAU, d = R * rnd(f, i + 4);
          px(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * YS - Math.sin(p * Math.PI) * 9 * rnd(f, i + 7), f.col || '#7fd6e8', .9 * (1 - p), i % 2 ? 1 : 2);
        }
      }
    },
    /* Oán Linh — vòng phù thu lại rồi bắn */
    monBolt: {
      dur: .3,
      draw(f, p) {
        const a = f.a || 0, y = f.y - 14, col = f.col || VIOLET;
        if (p < .6) {
          const q = p / .6;
          ring(f.x, y, 14 * (1 - q) + 3, col, .9 * (1 - q * .4), 1);
          for (let i = 0; i < 5; i++) {
            const b = i / 5 * TAU + q * 4, d = 14 * (1 - q) + 3;
            px(f.x + Math.cos(b) * d, y + Math.sin(b) * d, col, .9, 1);
          }
        } else {
          const q = (p - .6) / .4, L = 26 * q;
          line(f.x, y, f.x + Math.cos(a) * L, y + Math.sin(a) * L * YS, col, .95 * (1 - q), 1);
          px(f.x + Math.cos(a) * L, y + Math.sin(a) * L * YS, INK, 1 - q, 2);
        }
      }
    },

    meteor: {
      dur: 1.4,
      draw(f, p) {
        const W = f.w || 1200, H = f.h || 820;
        for (let i = 0; i < 16; i++) {
          const t = (p * 1.2 + rnd(f, i)) % 1, x = rnd(f, i + 5) * W, y = t * (H + 200) - 120, al = .9 * Math.sin(t * Math.PI);
          line(x, y, x - 26, y - 52, i % 4 ? EMBER : CREAM, al, 1);
          px(x, y, CREAM, al, 2);
        }
      }
    }
  };

  /* ── 12 CUNG HOÀNG ĐẠO ─────────────────────────────────────
     Server đã gửi ev({k:'proc', x, y, sign}) mỗi khi blessing kích hoạt.
     Mỗi cung một dấu hiệu riêng: đọc được vừa ăn hiệu ứng gì mà không cần toast. */
  const SIGNS = {
    ari: { nm: 'Bạch Dương', g: '♈', theme: 'Bùng nổ', col: '#e2703a', dur: .55,
      sig(f, p) {   /* nổ AoE nhỏ + cặp sừng cong */
        const r = 34 * ease.out(p);
        ring(f.x, f.y, r, f.col, .95 * (1 - p), p < .4 ? 2 : 1);
        disc(f.x, f.y, r * .5, f.col, .22 * (1 - p));
        for (const s of [-1, 1]) arc(f.x + s * 12, f.y - 26, 9 + p * 4, s > 0 ? -1.9 : 1.2, s > 0 ? .5 : 3.6, CREAM, .9 * (1 - p), 1);
      } },
    tau: { nm: 'Kim Ngưu', g: '♉', theme: 'Kiên cố', col: '#9aa8b8', dur: .8,
      sig(f, p) {   /* 5 tấm khiên dựng quanh thân + đất lún */
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * TAU + .3, q = Math.max(0, Math.min(1, p * 3 - i * .18));
          if (!q) continue;
          const x = f.x + Math.cos(a) * 19, y = f.y - 12 + Math.sin(a) * 19 * YS;
          for (let d = 0; d <= 4 * PX; d += PX) px(x, y - d * q, f.col, .95 * (1 - p * .7), 2);
        }
        ring(f.x, f.y, 22, f.col, .5 * (1 - p), 1);
        for (let i = 0; i < 6; i++) pxd(f.x + (rnd(f, i) - .5) * 40, f.y + 2 + rnd(f, i + 3) * 4, SMOKE, .6 * (1 - p), 1);
      } },
    gem: { nm: 'Song Tử', g: '♊', theme: 'Nhân đôi', col: '#a78fd4', dur: .5,
      sig(f, p) {   /* hai bóng ảnh tách rồi hợp lại */
        const off = 16 * ease.pop(p);
        for (const s of [-1, 1]) {
          for (let dy = 0; dy <= 15 * PX; dy += PX) pxd(f.x + s * off, f.y - dy, f.col, .85 * (1 - p), 1);
          ring(f.x + s * off, f.y, 7, f.col, .7 * (1 - p), 1);
        }
      } },
    can: { nm: 'Cự Giải', g: '♋', theme: 'Vỏ giáp', col: '#7FD4E8', dur: .7,
      sig(f, p) {   /* vảy giáp nước xếp vòng + hai càng kẹp */
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * TAU, q = Math.max(0, Math.min(1, p * 2.2 - i * .06));
          if (!q) continue;
          arc(f.x, f.y - 12, 18, a - .22, a + .22, f.col, .9 * q * (1 - p * .8), 1);
        }
        for (const s of [-1, 1]) arc(f.x + s * 22, f.y - 14, 8, s > 0 ? -.8 : 2.3, s > 0 ? .8 : 3.9, CREAM, .8 * (1 - p), 1);
      } },
    leo: { nm: 'Sư Tử', g: '♌', theme: 'Uy vũ', col: '#C9A961', dur: .65,
      sig(f, p) {   /* bờm toả tia dài ngắn xen kẽ */
        const R = 30 * ease.out(p);
        for (let i = 0; i < 14; i++) {
          const a = i / 14 * TAU, len = i % 2 ? R : R * .66;
          line(f.x + Math.cos(a) * len * .45, f.y - 12 + Math.sin(a) * len * .45 * YS,
               f.x + Math.cos(a) * len, f.y - 12 + Math.sin(a) * len * YS, i % 2 ? f.col : CREAM, .9 * (1 - p), 1);
        }
      } },
    vir: { nm: 'Xử Nữ', g: '♍', theme: 'Chuẩn xác', col: '#8FC98A', dur: .6,
      sig(f, p) {   /* 4 mốc góc siết vào tâm + chữ thập ngắm */
        const d = 26 * (1 - ease.out(p)) + 8, y = f.y - 16;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          for (let k = 0; k <= 3 * PX; k += PX) {
            px(f.x + sx * d + sx * k, y + sy * d * YS, f.col, .95 * (1 - p), 1);
            px(f.x + sx * d, y + sy * d * YS + sy * k * YS, f.col, .95 * (1 - p), 1);
          }
        }
        if (p > .55) { line(f.x - 5 * PX, y, f.x + 5 * PX, y, CREAM, 1 - p, 1); line(f.x, y - 5 * PX, f.x, y + 5 * PX, CREAM, 1 - p, 1); }
      } },
    lib: { nm: 'Thiên Bình', g: '♎', theme: 'Cân bằng', col: '#E08FB4', dur: .8,
      sig(f, p) {   /* hai đĩa cân đu rồi về ngang */
        const y = f.y - 30, sw = Math.cos(p * 9) * 9 * (1 - p);
        line(f.x - 20, y - sw, f.x + 20, y + sw, f.col, .95 * (1 - p * .6), 1);
        for (const s of [-1, 1]) {
          const py = y + s * sw;
          line(f.x + s * 20, py, f.x + s * 20, py + 6 * PX, f.col, .8 * (1 - p), 1);
          arc(f.x + s * 20, py + 7 * PX, 6, .2, Math.PI - .2, CREAM, .9 * (1 - p), 1);
        }
        line(f.x, y, f.x, f.y - 10, f.col, .5 * (1 - p), 1);
      } },
    sco: { nm: 'Bọ Cạp', g: '♏', theme: 'Nọc độc', col: '#7bd67b', dur: .7,
      sig(f, p) {   /* kim chọc xuống rồi độc lan */
        const drop = ease.out(Math.min(1, p * 2)) * 26, y = f.y - 44 + drop;
        line(f.x, y - 8 * PX, f.x, y, CREAM, .95 * (1 - p * .5), 1);
        px(f.x, y, CREAM, 1 - p * .6, 2);
        if (p > .45) {
          const r = 22 * ease.out((p - .45) / .55);
          ring(f.x, f.y, r, f.col, .85 * (1 - p), 1);
          for (let i = 0; i < 7; i++) {
            const a = rnd(f, i) * TAU, d = r * rnd(f, i + 4);
            px(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * YS - (p - .45) * 12, POISON_2, .8 * (1 - p), 1);
          }
        }
      } },
    sag: { nm: 'Nhân Mã', g: '♐', theme: 'Viễn xạ', col: '#ffb74d', dur: .6,
      sig(f, p) {   /* mũi tên bay xa + vòng ngắm ở đầu */
        const a = f.a || -.4, L = 74 * ease.out(p), y0 = f.y - 16;
        const hx = f.x + Math.cos(a) * L, hy = y0 + Math.sin(a) * L * YS;
        line(f.x + Math.cos(a) * 10, y0 + Math.sin(a) * 10 * YS, hx, hy, f.col, .95 * (1 - p * .7), 1);
        for (const s of [-1, 1]) line(hx, hy, hx - Math.cos(a + s * .5) * 6 * PX, hy - Math.sin(a + s * .5) * 6 * PX * YS, CREAM, .9 * (1 - p), 1);
        ring(hx, hy, 5 + p * 6, f.col, .7 * (1 - p), 1);
      } },
    cap: { nm: 'Ma Kết', g: '♑', theme: 'Trường kỳ', col: '#b8ab94', dur: .85,
      sig(f, p) {   /* xếp tầng đá lên dần — mỗi tầng một mốc sống sót */
        for (let i = 0; i < 5; i++) {
          const q = Math.max(0, Math.min(1, p * 2.4 - i * .3)); if (!q) continue;
          const w = (5 - i) * 2 * PX, y = f.y - 4 - i * 3 * PX;
          for (let dx = -w; dx <= w; dx += PX) px(f.x + dx, y, i % 2 ? f.col : SMOKE, .9 * q * (1 - p * .5), 1);
        }
        ring(f.x, f.y, 20, f.col, .45 * (1 - p), 1);
      } },
    aqu: { nm: 'Bảo Bình', g: '♒', theme: 'Hỗn nguyên', col: '#8fd4ff', dur: .8,
      sig(f, p) {   /* ba dòng hạt xoáy, mỗi dòng một màu cung khác */
        const cols = [f.col, VIOLET, MINT];
        for (let s = 0; s < 3; s++) {
          for (let i = 0; i < 9; i++) {
            const t = (p * 1.4 + i / 9) % 1, a = t * TAU * 1.2 + s * 2.1, r = 8 + t * 22;
            px(f.x + Math.cos(a) * r, f.y - 12 + Math.sin(a) * r * YS - t * 10, cols[s], .9 * (1 - t) * (1 - p * .5), 1);
          }
        }
      } },
    pis: { nm: 'Song Ngư', g: '♓', theme: 'Thuỷ triều', col: '#5fa8dc', dur: .85,
      sig(f, p) {   /* hai xoáy nước ngược chiều */
        for (const s of [-1, 1]) {
          for (let i = 0; i < 16; i++) {
            const t = i / 16, a = s * (p * 7 + t * 4.2), r = 6 + t * 20;
            px(f.x + Math.cos(a) * r, f.y - 10 + Math.sin(a) * r * YS + s * 4, t < .5 ? CREAM : f.col, .85 * (1 - t) * (1 - p * .6), 1);
          }
        }
        ring(f.x, f.y, 24 * ease.out(p), f.col, .5 * (1 - p), 1);
      } }
  };

  /* mỗi cung thành một kind: z_ari … z_pis — glyph pixel nảy lên kèm dấu hiệu riêng */
  Object.keys(SIGNS).forEach(function (code) {
    const S = SIGNS[code];
    K['z_' + code] = {
      dur: S.dur,
      draw(f, p) {
        if (!f.col) f.col = S.col;
        S.sig(f, p);
        glyph(S.g, f.x, f.y - 40 - ease.out(p) * 14, S.col, .95 * (1 - ease.in(p)));
      }
    };
  });

  const list = [];
  function spawn(kind, o) {
    const def = K[kind]; if (!def) return null;
    const f = Object.assign({ kind: kind, x: 0, y: 0, a: 0, r: 70, t: 0, seed: Math.random() * 999 }, o);
    f.dur = (o && o.dur) || def.dur;
    list.push(f); if (list.length > 120) list.shift();
    return f;
  }
  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      f.t = Math.max(0, f.t + dt);
      if (f.t >= f.dur) list.splice(i, 1);
    }
  }
  function draw(ctx) {
    CTX = ctx; PX = Math.max(1, API.PX);
    ctx.save();
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    for (const f of list) K[f.kind].draw(f, Math.max(0, Math.min(1, f.t / f.dur)));
    ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = sm; ctx.restore();
  }

  /* Map event server → hiệu ứng. Ưu tiên e.sk, chưa có thì suy từ màu server đang gửi. */
  const BY_SK = {
    whirl: e => spawn('whirl', { x: e.x, y: e.y, a: e.a || 0, r: e.r || 96, twice: !!e.x2 }),
    taunt: e => spawn('taunt', { x: e.x, y: e.y, r: e.r || 200 }),
    frenzy: e => spawn('frenzy', { x: e.x, y: e.y, dur: e.dur || 6 }),
    pierce: e => spawn('pierce', { x: e.x, y: e.y, a: e.a || 0, r: e.r || 150 }),
    trap: e => spawn('trapBoom', { x: e.x, y: e.y, r: e.r || 90 }),
    volley: e => spawn('volley', { x: e.x, y: e.y, a: e.a || 0 }),
    smite: e => spawn('smite', { x: e.x, y: e.y, r: e.r || 70 }),
    heal: e => spawn('fountain', { x: e.x, y: e.y, r: e.r || 110, crossCol: e.sh ? '#E6D8C4' : MINT }),
    curse: e => spawn('curse', { x: e.x, y: e.y, r: e.r || 110, glyph: e.g }),
    mark: e => spawn('mark', { x: e.x, y: e.y, h: e.h || 34, dur: e.dur || 3 }),
    poison: e => spawn('poison', { x: e.x, y: e.y, r: e.r || 60 })
  };
  const BY_COL = { '#ffd479': 'whirl', '#ffe9a8': 'taunt', '#ff5c6c': 'frenzy', '#8fd4ff': 'trapBoom', '#c58cff': 'curse', '#c8f08a': 'smite', '#7bd67b': 'poison' };

  function fromEvent(e) {
    if (e.sk && BY_SK[e.sk]) return BY_SK[e.sk](e);
    if (e.k === 'ring' && BY_COL[(e.c || '').toLowerCase()]) return spawn(BY_COL[(e.c || '').toLowerCase()], { x: e.x, y: e.y, r: e.r, a: e.a || 0 });
    if (e.k === 'slash') return spawn('atkSlash', { x: e.x, y: e.y, a: e.a || 0, r: e.r || 34 });
    if (e.k === 'proc' && K['z_' + e.sign]) return spawn('z_' + e.sign, { x: e.x, y: e.y, a: e.a || -.4 });
    if (e.k === 'crit') return spawn('crit', { x: e.x, y: e.y });
    if (e.k === 'lvl') return spawn('levelUp', { x: e.x, y: e.y });
    if (e.k === 'heal') return spawn('fountain', { x: e.x, y: e.y, r: 70 });
    if (e.k === 'dash') return spawn('dashTrail', { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 });
    if (e.k === 'boom') return spawn('trapBoom', { x: e.x, y: e.y, r: e.r });
    if (e.k === 'exodus') return spawn('meteor', { w: e.w, h: e.h });
    return null;
  }

  /* ── ĐẠN BAY ────────────────────────────────────────
     Đạn là thực thể của server, vẽ lại mọi frame — không qua danh sách fx.
     ZAFx.drawProj(ctx, { ty, x, y, a, t }) — ty: arrow | pierce | orbp | eball */
  const PROJ = {
    /* mũi tên / đạn thường: thân + mũi nhọn + đuôi, vệt mờ sau */
    arrow(o) {
      const a = o.a, c = Math.cos(a), s = Math.sin(a);
      for (let i = -3; i <= 3; i++) px(o.x + c * i * PX, o.y + s * i * PX, '#e8e0c0', .95, 1);
      px(o.x + c * 4 * PX, o.y + s * 4 * PX, INK, 1, 2);
      for (const sd of [-1, 1]) px(o.x - c * 4 * PX - s * sd * PX, o.y - s * 4 * PX + c * sd * PX, GOLD, .9, 1);
      for (let i = 1; i <= 3; i++) pxd(o.x - c * (5 + i * 2) * PX, o.y - s * (5 + i * 2) * PX, '#c9bfa0', .5 - i * .12, 1);
    },
    /* Mũi Xuyên: giáo băng dài, lõi sáng, vệt dài */
    pierce(o) {
      const a = o.a, c = Math.cos(a), s = Math.sin(a);
      for (let i = -6; i <= 6; i++) {
        px(o.x + c * i * PX, o.y + s * i * PX, Math.abs(i) < 3 ? INK : ICE, .95, 2);
      }
      px(o.x + c * 7 * PX, o.y + s * 7 * PX, INK, 1, 3);
      for (let i = 1; i <= 5; i++) pxd(o.x - c * (7 + i * 2) * PX, o.y - s * (7 + i * 2) * PX, ICE, .6 - i * .1, i < 3 ? 2 : 1);
    },
    /* orb / đạn phép: lõi sáng + 4 hạt quay */
    orbp(o) {
      const t = (o.t || 0) / 120;
      px(o.x, o.y, INK, 1, 2);
      ring(o.x, o.y, 3 * PX, ICE, .8, 1);
      for (let i = 0; i < 4; i++) {
        const b = t + i / 4 * TAU;
        px(o.x + Math.cos(b) * 4 * PX, o.y + Math.sin(b) * 4 * PX, ICE, .9, 1);
      }
      const c = Math.cos(o.a), s = Math.sin(o.a);
      for (let i = 1; i <= 3; i++) pxd(o.x - c * i * 3 * PX, o.y - s * i * 3 * PX, ICE, .45 - i * .1, 1);
    },
    /* đạn quái: nhân đỏ, than hồng rịn ra sau */
    eball(o) {
      const t = (o.t || 0) / 90, c = Math.cos(o.a), s = Math.sin(o.a);
      px(o.x, o.y, CREAM, 1, 2);
      for (let i = 0; i < 5; i++) {
        const b = t + i / 5 * TAU;
        px(o.x + Math.cos(b) * 3 * PX, o.y + Math.sin(b) * 3 * PX * .9, '#d46a6a', .9, 1);
      }
      for (let i = 1; i <= 4; i++) {
        const w = Math.sin(t * 2 + i) * PX;
        pxd(o.x - c * i * 3 * PX - s * w, o.y - s * i * 3 * PX + c * w, i < 3 ? EMBER : '#8a4a3a', .6 - i * .11, 1);
      }
    }
  };
  function drawProj(ctx, o) {
    CTX = ctx; PX = Math.max(1, API.PX);
    const fn = PROJ[o.ty] || PROJ.arrow;
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    fn(o);
    ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = sm;
  }

  const BASIC = { sw: 'atkSlash', ar: 'atkShot', mk: 'atkCast' };
  const MON_ATK = { slime: 'monSplash', runner: 'monBite', brute: 'monSmash', caster: 'monBolt' };

  API.spawn = spawn; API.update = update; API.draw = draw; API.fromEvent = fromEvent;
  API.sign = (code, o) => spawn('z_' + code, o || {});
  /* đòn thường: cls 'sw'|'ar'|'mk' · quái 'slime'|'runner'|'brute'|'caster' */
  API.basic = (cls, o) => spawn(BASIC[cls] || 'atkSlash', o || {});
  API.monAtk = (ty, o) => spawn(MON_ATK[ty] || 'monBite', o || {});
  API.BASIC = BASIC; API.MON_ATK = MON_ATK;
  API.drawProj = drawProj; API.PROJ = Object.keys(PROJ);
  API.SIGNS = SIGNS;
  API.clear = () => list.splice(0); API.count = () => list.length; API.KINDS = Object.keys(K);
  window.ZAFx = API;
})();
