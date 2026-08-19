/* Test tìm đường của bot — trích thẳng từ map1-server.js.
 * Địa hình giờ là lưới 32px của assets/map1-layout.js (hầm mộ) và
 * assets/map1-ruin-layout.js (phế tích), nên test chạy cả hai biến thể.
 * Chạy: node test-nav.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, 'map1-server.js'), 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => { const i = SRC.indexOf(a), j = SRC.indexOf(b, i); return SRC.slice(i, j); };

const LAYOUTS = {
  crypt: require('./assets/map1-layout.js'),
  ruin: require('./assets/map1-ruin-layout.js')
};

const core = [
  'const MW = 2400, MH = 1600, MAXP = 6;',
  'const clamp = (v, a, b) => v < a ? a : v > b ? b : v;',
  'let MAP = LAYOUTS.ruin, BOSS_POS = { x: 1200, y: 800 };',
  cut('function inWall(x, y, pad)', '\nfunction ev(e)'),
  cut('const NAV_PAD = 14;', '/* ============================ PHÒNG'),
  'function useLayout(k){ MAP = LAYOUTS[k]; BOSS_POS = { x: MAP.BOSS_POS[0], y: MAP.BOSS_POS[1] }; buildNav(); }'
].join('\n');

const T = {};
vm.runInNewContext(
  core + '\nObject.assign(exports,{inWall,losClear,findPath,buildNav,pickSpawns,useLayout,MW,MH});',
  { exports: T, LAYOUTS, Math, Array, Infinity, console, Uint8Array, Int32Array, Float32Array }
);
const { inWall, losClear, findPath, pickSpawns, useLayout, MW, MH } = T;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };

for (const key of ['crypt', 'ruin']) {
  const L = LAYOUTS[key];
  useLayout(key);
  console.log('\n===== biến thể ' + key.toUpperCase() + ' =====');

  console.log('va chạm theo lưới:');
  ok(inWall(0, 0, 0), 'góc bản đồ là vật cản');
  ok(inWall(-50, 800, 0) && inWall(MW + 50, 800, 0), 'ngoài rìa bản đồ tính là vật cản');
  ok(!inWall(L.BOSS_POS[0], L.BOSS_POS[1], 14), 'bệ boss đứng được');
  ok(L.CHEST_SPOTS.every(c => !inWall(c[0], c[1], 12)), '16 rương đều nằm trên sàn');
  ok(L.MERCHANTS.every(m => !inWall(m[0], m[1], 12)), 'merchant đều nằm trên sàn');
  ok(L.GATES.every(g => !inWall(g[0], g[1], 12)), 'cổng đều nằm trên sàn');

  console.log('\nđường thẳng thông:');
  const near = { x: L.BOSS_POS[0], y: L.BOSS_POS[1] }, near2 = { x: L.BOSS_POS[0] + 60, y: L.BOSS_POS[1] };
  ok(findPath(near, near2).length === 1, 'thông thì trả về đúng 1 điểm (đích)');

  console.log('\nnối mọi cặp điểm quan trọng:');
  const spots = []
    .concat(L.CHEST_SPOTS.map(c => ({ x: c[0], y: c[1] })))
    .concat(L.MERCHANTS.map(c => ({ x: c[0], y: c[1] })))
    .concat(L.GATES.map(c => ({ x: c[0], y: c[1] })))
    .concat(L.CAMPS.map(c => ({ x: c.x, y: c.y })))
    .concat([{ x: L.BOSS_POS[0], y: L.BOSS_POS[1] }]);
  let tried = 0, solved = 0, bad = 0, maxLegs = 0;
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
    const a = spots[i], b = spots[j];
    if (losClear(a.x, a.y, b.x, b.y)) continue;
    tried++;
    const P = findPath(a, b);
    if (!P.length) continue;
    solved++;
    maxLegs = Math.max(maxLegs, P.length);
    let c = a, legs = true;
    for (const w of P) { if (!losClear(c.x, c.y, w.x, w.y)) legs = false; c = w; }
    if (!legs) bad++;
  }
  ok(tried > 0, tried + ' cặp điểm bị vật cản chắn');
  ok(solved === tried, 'tìm được đường cho ' + solved + '/' + tried + ' cặp');
  ok(bad === 0, bad + ' đường có chặng xuyên vật cản (phải là 0)');
  ok(maxLegs <= 24, 'đường dài nhất ' + maxLegs + ' waypoint (đã rút gọn, không bò từng ô)');

  console.log('\nchỗ đứng đầu ván:');
  const sp = pickSpawns();
  ok(sp.length === 6, sp.length + ' chỗ đứng');
  ok(sp.every(s => !inWall(s.x, s.y, 16)), 'chỗ nào cũng đứng được');
  ok(sp.every(s => Math.hypot(s.x - L.BOSS_POS[0], s.y - L.BOSS_POS[1]) >= 520), 'không ai vào ván cạnh bệ boss');
  let minGap = 1e9;
  for (let i = 0; i < sp.length; i++) for (let j = i + 1; j < sp.length; j++)
    minGap = Math.min(minGap, Math.hypot(sp[i].x - sp[j].x, sp[i].y - sp[j].y));
  ok(minGap > 300, 'hai chỗ gần nhau nhất cách ' + Math.round(minGap) + 'px');

  console.log('\nhiệu năng:');
  const far = spots[0], far2 = spots[spots.length - 1];
  const t0 = Date.now();
  for (let k = 0; k < 300; k++) findPath(far, far2);
  const ms = (Date.now() - t0) / 300;
  ok(ms < 4, 'findPath khi bị chắn: ' + ms.toFixed(2) + ' ms/lần (6 bot × 2.5 lần/giây là thoải mái)');
}

console.log(fail ? '\n' + fail + ' TEST HỎNG' : '\nTất cả test đạt');
process.exit(fail ? 1 : 0);
