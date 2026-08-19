/* Test sảnh (biến thể NGÔI LÀNG): mốc gameplay đứng được, đi bộ từ chỗ xuất
 * hiện tới được cả 2 NPC lẫn cổng, và sảnh không dính luật của map đấu.
 * Chạy: node test-lobby.js
 */
const fs = require('fs'), path = require('path');
const WALLS = require('./assets/lobby-village-walls.js');
const SRV = fs.readFileSync(path.join(__dirname, 'map1-server.js'), 'utf8');
const HTML = fs.readFileSync(path.join(__dirname, 'map1.html'), 'utf8');

const LW = 1200, LH = 820, PAD = 12;
const inWall = (x, y, pad) => WALLS.some(w =>
  x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad);

let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };

/* Toạ độ gameplay phải giữ nguyên như bản cũ — handoff nói rõ chỉ đổi art và walls. */
const MOC = {
  'chỗ xuất hiện': [600, 690],
  'NPC Giáo Trưởng': [380, 430],
  'NPC Thợ Rèn': [820, 430],
  'cổng ra map 1': [600, 300]
};

console.log('toạ độ gameplay giữ nguyên:');
ok(/spawn: \{ x: 600, y: 690 \}/.test(SRV), 'chỗ xuất hiện (600,690)');
ok(/x: 380, y: 430/.test(SRV), 'Giáo Trưởng (380,430)');
ok(/x: 820, y: 430/.test(SRV), 'Thợ Rèn (820,430)');
ok(/gate: \{ x: 600, y: 300, r: 58 \}/.test(SRV), 'cổng (600,300) r58');
ok(/W: 1200, H: 820/.test(SRV), 'sảnh vẫn 1200x820');

console.log('\ntường làng:');
ok(WALLS.length === 16, WALLS.length + ' khối tường');
for (const k of Object.keys(MOC)) ok(!inWall(MOC[k][0], MOC[k][1], PAD), k + ' đứng được');

/* liên thông trên lưới 4px, đã trừ bán kính thân */
const S = 4, GW = LW / S, GH = LH / S;
const free = (gx, gy) => !inWall(gx * S + S / 2, gy * S + S / 2, PAD);
let tong = 0;
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) if (free(gx, gy)) tong++;
const seen = new Uint8Array(GW * GH);
const s0 = ((690 / S) | 0) * GW + ((600 / S) | 0);
const st = [s0]; seen[s0] = 1; let toi = 1;
while (st.length) {
  const k = st.pop(), x = k % GW, y = (k / GW) | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
    const nk = ny * GW + nx;
    if (seen[nk] || !free(nx, ny)) continue;
    seen[nk] = 1; toi++; st.push(nk);
  }
}
console.log('\nđi lại:');
for (const k of Object.keys(MOC)) {
  const gx = (MOC[k][0] / S) | 0, gy = (MOC[k][1] / S) | 0;
  ok(!!seen[gy * GW + gx], 'đi bộ từ chỗ xuất hiện tới ' + k);
}
/* Còn một túi nhỏ sau hồ nước ở góc phải dưới không lách vào được — chỗ trang
   trí, không có mốc gameplay nào nằm trong đó. Chỉ chặn khi nó phình to. */
const ket = tong - toi;
ok(ket / tong < 0.01, 'túi không tới được chỉ ' + ket + '/' + tong + ' ô (' +
  (100 * ket / tong).toFixed(1) + '%, ngưỡng 1%)');

console.log('\nsảnh không dính luật map đấu:');
ok(/function doDash\(p\) \{[\s\S]{0,400}?ROOM\.ph === 'lobby'\) return;/.test(SRV),
  'lướt bị chặn trong sảnh (doDash dùng lưới map đấu, không chặn là lướt xuyên nhà)');
ok(/function useSkill\(p, s\) \{[\s\S]{0,200}?ROOM\.ph === 'lobby'\) return;/.test(SRV),
  'kỹ năng bị chặn trong sảnh');
ok(/walls: LOBBY_WALLS/.test(SRV), 'server dùng mảng tường của làng');

console.log('\nclient:');
ok(/assets\/lobby-village\.png/.test(HTML), 'vẽ nền làng bằng ảnh 1:1');
ok(!/ctx\.fillStyle='#181220'/.test(HTML), 'bỏ nền hộp đá tím của bản cũ');
ok(!/for\(var x=0;x<=L\.W;x\+=80\)/.test(HTML), 'bỏ lưới 80px của bản cũ');
ok(/'\.png': 'image\/png'/.test(SRV), 'server khai báo MIME cho .png');
ok(fs.existsSync(path.join(__dirname, 'assets/lobby-village.png')), 'ảnh nền có trong assets/');

console.log(fail ? '\n' + fail + ' TEST HỎNG' : '\nTất cả test đạt');
process.exit(fail ? 1 : 0);
