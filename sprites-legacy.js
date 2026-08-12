/* ============================================================
   Zodiac Arena — Chibi NES sprite set (16x16, vẽ bằng code)
   Dùng: <script src="sprites.js"></script> trước phần render,
   rồi gọi:  ZASprites.draw(ctx, {key:'knight_A', x, y, state:'move', t:performance.now(), scale:1.25});
   - y là ĐÁY chân (đặt bằng toạ độ nhân vật + r).
   - state: 'idle' | 'move' | 'attack' | 'hit' | 'die'
   - stateT: ms đã trôi trong state (bắt buộc cho attack/hit/die; idle/move dùng t).
   - facing: 1 phải, -1 trái.
   ============================================================ */
(function () {
  const BASE_ROWS = {
    knight: [
      "................", ".....oooooo.....", "....occcccco....", "....ocmmmmco..m.",
      "....osseesso..m.", ".....ossso....m.", "...oaaccccaao.m.", ".osoaabbbbaaosm.",
      "...oaabbbbaaommm", "...ocbbbbbbco.w.", "....oaaooaao..w.", "....obboobbo....",
      "....ommoommo....", "....oooooooo....", "................", "................"],
    archer: [
      "................", "......oooo......", ".....occcco.....", "....occcccco....",
      "..w.ocseesco....", ".w..ocssssco....", ".w.occaaaacco...", ".wsoaaccccaaos..",
      ".w.oaabbbbaao...", ".w.obbbbbbbbo...", "..w.oaaooaao....", "....obboobbo....",
      "....ommoommo....", "....oooooooo....", "................", "................"],
    monk: [
      "................", "......oooo......", ".....osssso.....", "....osssssso..g.",
      "....osesseso..g.", ".....ossso....w.", "...occaaaacco.w.", "..osaaccccaaosw.",
      "...oaabbbbaao.w.", "...obbbbbbbbo.w.", "...oaaaaaaaao.w.", "...oaaaaaaaao.w.",
      "..obbbbbbbbbbow.", "..oooooooooooo..", "................", "................"],
    slime: [
      "................", "................", "................", "................",
      "................", "................", ".....oooooo.....", "....oaaaaaao....",
      "...oaaeaaeaao...", "...oaaaaaaaao...", "..oaaaaaaaaaao..", "..oabbbbbbbbao..",
      "..obbbbbbbbbbo..", "...oooooooooo...", "................", "................"],
    runner: [
      "................", "................", "................", "................",
      "................", ".....o....o.....", "....ooaaaaoo....", "....oaeaaeao....",
      "....oaaaaaao....", ".....obbbbo.....", ".....obbbbo.....", ".....b...b......",
      ".....b...b......", "....oo...oo.....", "................", "................"],
    brute: [
      "................", "................", "................", "....oooooooo....",
      "...oaaaaaaaao...", "...oaeaaaaeao...", "...oamaaaamao...", ".ooaaaaaaaaaaoo.",
      ".oaaaaaaaaaaaao.", ".oaabbbbbbbbaao.", ".obbbbbbbbbbbbo.", "..obbbbbbbbbbo..",
      "..obboooooobbo..", "..oooo....oooo..", "................", "................"],
    caster: [
      "................", "................", ".......g........", "......ggg.......",
      ".....occcco.....", "....occcccco....", "....occeecco....", "...occcccccco...",
      "...oaaaaaaaao...", "..oaaaaaaaaaao..", "..oaabbbbbbaao..", "...obbbbbbbbo...",
      "....obbbbbbo....", ".....obbbbo.....", "......oooo......", "................"]
  };

  /* biến thể: patch pixel [x, y, ký tự] + bảng màu riêng */
  const VARIANTS = {
    knight_A: { base: 'knight', nm: 'Kiếm sĩ · Vệ Binh', atk: 'melee',
      pal: { a: '#7d8fc4', b: '#46527f', c: '#4fc3f7' },
      patch: [[1,6,'o'],[2,6,'o'],[1,7,'o'],[2,7,'c'],[1,8,'o'],[2,8,'c'],[1,9,'o'],[2,9,'c'],[1,10,'o'],[2,10,'o'],[3,7,'m'],[3,8,'m'],[3,9,'m']] },
    knight_B: { base: 'knight', nm: 'Kiếm sĩ · Cuồng Chiến', atk: 'melee',
      pal: { a: '#a35a55', b: '#5e2f2d', c: '#ff5c6c' },
      patch: [[1,3,'m'],[1,4,'m'],[1,5,'m'],[1,6,'m'],[1,7,'m'],[0,8,'m'],[1,8,'m'],[2,8,'m'],[1,9,'w'],[1,10,'w']] },
    archer_A: { base: 'archer', nm: 'Xạ thủ · Cung Thủ', atk: 'shoot',
      pal: { a: '#4e7f57', b: '#2f5138', c: '#ffd76a' },
      patch: [[13,3,'m'],[13,4,'m'],[14,4,'m'],[13,5,'w'],[14,5,'w'],[12,4,'m']] },
    archer_B: { base: 'archer', nm: 'Xạ thủ · Nỏ Thủ', atk: 'shoot',
      pal: { a: '#57606e', b: '#333a48', c: '#ffb74d' },
      patch: [[1,6,'.'],[1,5,'.'],[2,4,'.'],[1,7,'m'],[0,7,'m'],[2,7,'m'],[1,6,'w'],[1,8,'w'],[2,6,'m'],[2,8,'m']] },
    monk_A: { base: 'monk', nm: 'Nhà sư · Trị Liệu', atk: 'cast',
      pal: { a: '#efe7d0', b: '#a89a76', c: '#6ee7a0' },
      patch: [[5,0,'g'],[6,0,'g'],[9,0,'g'],[10,0,'g'],[4,1,'g'],[11,1,'g'],[14,2,'g']] },
    monk_B: { base: 'monk', nm: 'Nhà sư · Cầu Nguyện', atk: 'cast',
      pal: { a: '#6b5a86', b: '#3b3055', c: '#ba68c8' },
      patch: [[14,2,'g'],[13,3,'g'],[15,3,'g'],[6,6,'c'],[9,6,'c'],[4,12,'c'],[11,12,'c']] },
    slime:  { base: 'slime',  nm: 'Slime',  atk: 'lunge', pal: { a: '#7fdc7f', b: '#4a9455', c: '#bff5bf' }, patch: [] },
    runner: { base: 'runner', nm: 'Runner', atk: 'lunge', pal: { a: '#ffd76a', b: '#c1913a', c: '#fff0b8' }, patch: [] },
    brute:  { base: 'brute',  nm: 'Brute',  atk: 'melee', pal: { a: '#ff8a72', b: '#b04d3e', c: '#ffd0c0' }, patch: [] },
    caster: { base: 'caster', nm: 'Caster', atk: 'cast',  pal: { a: '#a56ae0', b: '#5f3a96', c: '#c58cff' }, patch: [] }
  };

  const FIXED = { o: '#0a0c14', s: '#f2c39a', e: '#131a2e', m: '#e6ecff', w: '#8a6a3a', g: '#ffe9a8' };
  const DUR = { attack: 620, hit: 520, die: 1500 };

  const rowCache = {};
  function rowsOf(key) {
    if (rowCache[key]) return rowCache[key];
    const v = VARIANTS[key];
    const grid = BASE_ROWS[v.base].map(r => (r + '................').slice(0, 16).split(''));
    for (const p of v.patch) grid[p[1]][p[0]] = p[2];
    rowCache[key] = grid.map(r => r.join(''));
    return rowCache[key];
  }
  function palOf(key) {
    const v = VARIANTS[key];
    return Object.assign({ a: v.pal.a, b: v.pal.b, c: v.pal.c }, FIXED);
  }

  function hx(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(c1, c2, t) {
    if (c1.charAt(0) !== '#') return c1;
    const A = hx(c1), B = hx(c2);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }

  function pose(state, u, key, t) {
    const v = VARIANTS[key], base = v.base;
    const p = { dx: 0, dy: 0, flipLegs: false, alpha: 1, flash: 0, tint: null, collapse: 0, lean: 0, squash: 0, weapon: 0, fx: null };
    if (state === 'move') {
      const f = Math.floor(t / 110) % 4;
      p.dy = (f === 1 || f === 3) ? -1 : 0;
      p.flipLegs = f >= 2; p.lean = 1;
      if (base === 'slime') { p.squash = f < 2 ? 1 : 0; p.dy = f < 2 ? 0 : -1; }
      if (base === 'caster') p.dy = -1 + (f % 2);
      p.fx = { kind: 'dust', f: f };
      return p;
    }
    if (state === 'attack') {
      if (u < 0.22) { p.dx = -1; p.weapon = -1; }
      else if (u < 0.45) { p.dx = 2; p.dy = -1; p.weapon = 3; p.fx = { kind: v.atk, u: (u - 0.22) / 0.23 }; }
      else if (u < 0.7) { p.dx = 1; p.weapon = 1; p.fx = { kind: v.atk, u: 1 }; }
      return p;
    }
    if (state === 'hit') {
      const e = 1 - u;
      p.dx = -Math.round(3 * e * e);
      p.flash = u < 0.18 ? 1 : (u < 0.34 ? 0.45 : 0);
      p.tint = '#ff5c6c';
      p.alpha = (u > 0.34 && Math.floor(u * 22) % 2) ? 0.55 : 1;
      return p;
    }
    if (state === 'die') {
      if (u < 0.12) { p.flash = 1; p.dy = -1; return p; }
      const d = Math.min(1, (u - 0.12) / 0.52);
      p.collapse = d; p.tint = '#4a5070';
      p.alpha = u > 0.72 ? Math.max(0, 1 - (u - 0.72) / 0.2) : 1;
      p.fx = { kind: 'burst', u: d };
      return p;
    }
    const ph = Math.floor(t / 380 + base.length % 3) % 2;
    p.dy = ph ? -1 : 0;
    if (base === 'slime' && ph) p.squash = 1;
    if (base === 'caster') p.dy = Math.floor(t / 300) % 4 > 1 ? -1 : 0;
    return p;
  }

  function fx(ctx, f, s, pal, key) {
    const P = v => v * s;
    ctx.save();
    if (f.kind === 'dust') {
      ctx.fillStyle = 'rgba(190,200,230,0.35)';
      const n = f.f % 2 ? 2 : 3;
      for (let i = 0; i < n; i++) ctx.fillRect(P(3 - i * 1.2), P(13 - (i % 2)), s, s);
    } else if (f.kind === 'melee') {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, s * 0.55);
      ctx.globalAlpha = 0.85 * (1 - f.u * 0.6);
      ctx.beginPath(); ctx.arc(P(9), P(8), P(5.5), -1.1 + f.u * 0.9, 0.9 + f.u * 0.9); ctx.stroke();
    } else if (f.kind === 'shoot') {
      ctx.fillStyle = pal.c;
      const x = 11 + f.u * 5;
      ctx.fillRect(P(x), P(7), P(2.4), Math.max(2, s * 0.5));
      ctx.globalAlpha = 0.5; ctx.fillRect(P(x - 1.4), P(7), P(1), Math.max(1, s * 0.4));
    } else if (f.kind === 'cast') {
      ctx.strokeStyle = pal.c; ctx.lineWidth = Math.max(1.5, s * 0.4);
      ctx.globalAlpha = 0.75 * (1 - f.u * 0.5);
      ctx.beginPath(); ctx.arc(P(14), P(4), P(1.6 + f.u * 2.6), 0, 6.283); ctx.stroke();
    } else if (f.kind === 'lunge') {
      ctx.strokeStyle = pal.c; ctx.lineWidth = Math.max(1.5, s * 0.4);
      ctx.globalAlpha = 0.6 * (1 - f.u);
      ctx.beginPath(); ctx.arc(P(8), P(10), P(6 + f.u * 2), 0, 6.283); ctx.stroke();
    } else if (f.kind === 'burst') {
      ctx.fillStyle = mix(pal.a, '#ffffff', 0.3);
      ctx.globalAlpha = Math.max(0, 1 - f.u);
      const r = 2 + f.u * 6;
      for (let i = 0; i < 7; i++) ctx.fillRect(P(8 + Math.cos(i * 0.9) * r), P(9 + Math.sin(i * 0.9) * r * 0.7), s, s);
    }
    ctx.restore();
  }

  /* opts: key, x, y (đáy chân), state, t, stateT, scale, facing, shadow */
  function draw(ctx, opts) {
    const key = opts.key;
    if (!VARIANTS[key]) return;
    const s = opts.scale || 1, state = opts.state || 'idle';
    const t = opts.t || 0;
    const dur = DUR[state];
    const u = dur ? Math.min(1, ((opts.stateT != null ? opts.stateT : t) % dur) / dur) : 0;
    const rows = rowsOf(key), pal = palOf(key), p = pose(state, u, key, t);
    const float = VARIANTS[key].base === 'caster';

    ctx.save();
    ctx.translate(Math.round(opts.x), Math.round(opts.y));
    ctx.scale((opts.facing === -1 ? -1 : 1) * s, s);
    ctx.translate(-8, -14);                       // gốc: chân ở hàng 14
    ctx.globalAlpha = p.alpha;

    if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,' + (0.34 * (1 - p.collapse * 0.5)) + ')';
      ctx.beginPath();
      ctx.ellipse(8, float ? 15.4 : 14.1, (VARIANTS[key].base === 'brute' ? 5.6 : 3.9) * (1 + p.collapse * 0.35), float ? 0.7 : 1.05, 0, 0, 6.283);
      ctx.fill();
    }

    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const sx = (p.flipLegs && y >= 10) ? 15 - x : x;
        const ch = rows[y][sx];
        if (ch === '.') continue;
        let col = pal[ch];
        if (!col) continue;
        let dx = p.dx, dy = p.dy;
        if (p.lean && y < 8) dx += 1;
        if (p.weapon && (ch === 'm' || ch === 'w' || ch === 'g') && !p.squash) dx += p.weapon;
        if (p.squash) dy = y > 9 ? 0 : 1;
        if (p.collapse > 0) { dy += Math.round((13 - y) * p.collapse); dx += Math.round((x - 8) * p.collapse * 0.8); }
        if (p.tint) col = mix(col, p.tint, 0.5);
        if (p.flash) col = mix(col, '#ffffff', p.flash);
        ctx.fillStyle = col;
        ctx.fillRect(x + dx, y + dy, 1, 1);
      }
    }
    if (p.fx) fx(ctx, p.fx, 1, pal, key);
    ctx.restore();
  }

  const API = { draw: draw, keys: Object.keys(VARIANTS), meta: VARIANTS, DUR: DUR, rowsOf: rowsOf, palOf: palOf };
  if (typeof globalThis !== 'undefined') globalThis.ZASprites = API;
})();
