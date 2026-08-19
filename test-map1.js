/* Chạy thử một ván map 1 không cần trình duyệt: mở server thật, nối một client
 * WebSocket thô, bấm sẵn sàng, để 5 bot đánh cho tới hết giờ + di tản.
 * Kiểm tra: bốc được cả hai biến thể, không ai kẹt trong vật cản, bot có đi
 * chuyển thật, quái/rương/cổng đều nằm trên sàn.
 *   node test-map1.js            (mặc định ván 45 giây)
 *   MATCH_TIME=20 node test-map1.js
 */
const net = require('net'), crypto = require('crypto'), cp = require('child_process');

const PORT = 8099;
const MATCH_TIME = Number(process.env.MATCH_TIME || 45);
const LAYOUTS = {
  crypt: require('./assets/map1-layout.js'),
  ruin: require('./assets/map1-ruin-layout.js')
};
/* đúng phép thử va chạm của server: 9 điểm quanh thân bán kính 12 */
function chamTuong(L, x, y) {
  const pad = 12, s = (a, b) => L.solid(a, b);
  return s(x, y) || s(x - pad, y) || s(x + pad, y) || s(x, y - pad) || s(x, y + pad) ||
    s(x - pad, y - pad) || s(x + pad, y - pad) || s(x - pad, y + pad) || s(x + pad, y + pad);
}
/* Kẹt THẬT = không nhúc nhích được theo hướng nào. Không dùng chamTuong() trực
   tiếp làm phép thử: gói state làm tròn x/y về số nguyên, lệch nửa pixel là đủ
   báo nhầm ở chỗ thân chạm chéo một góc đá mà thực ra vẫn đi ra được. */
function kepCung(L, x, y) {
  const sp = 5.2;                       // spd * 2 / 1 frame, cỡ bước thật
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    const nx = x + Math.cos(a) * sp, ny = y + Math.sin(a) * sp;
    if (!chamTuong(L, nx, y)) return false;
    if (!chamTuong(L, x, ny)) return false;
  }
  return true;
}

let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };

const srv = cp.spawn(process.execPath, ['map1-server.js'], {
  env: { ...process.env, PORT: String(PORT), MATCH_TIME: String(MATCH_TIME), BOTS: '5' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let srvErr = '';
srv.stderr.on('data', d => { srvErr += d; process.stderr.write(d); });

function frame(payload) {
  const b = Buffer.from(payload), mask = crypto.randomBytes(4);
  const len = b.length;
  let head;
  if (len < 126) head = Buffer.from([0x81, 0x80 | len]);
  else { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 0xFE; head.writeUInt16BE(len, 2); }
  const out = Buffer.concat([head, mask, b]);
  for (let i = 0; i < len; i++) out[out.length - len + i] = b[i] ^ mask[i & 3];
  return out;
}

setTimeout(run, 900);

function run() {
  const sock = net.connect(PORT, '127.0.0.1');
  let shook = false, buf = Buffer.alloc(0);
  const seen = { skins: new Set(), states: 0, maps: 0 };
  let lastMap = null, lastState = null;
  const trail = {};                                 // các con số gom được trong ván
  const walked = {};                                // slot -> tổng quãng đường đã đi

  sock.on('connect', () => {
    sock.write('GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      'Sec-WebSocket-Key: ' + crypto.randomBytes(16).toString('base64') + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
  });

  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    if (!shook) {
      const i = buf.indexOf('\r\n\r\n');
      if (i < 0) return;
      buf = buf.slice(i + 4); shook = true;
      send({ t: 'join', nm: 'Kiểm Thử', cls: 'sw', sg: 'leo' });
      setTimeout(() => send({ t: 'ready', v: true }), 400);
    }
    for (; ;) {
      if (buf.length < 2) return;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (buf.length < off + len) return;
      const body = buf.slice(off, off + len).toString('utf8');
      buf = buf.slice(off + len);
      try { onMsg(JSON.parse(body)); } catch (e) { }
    }
  });

  function send(o) { sock.write(frame(JSON.stringify(o))); }

  function onMsg(m) {
    if (m.t === 'welcome') { if (m.map) lastMap = m.map; return; }
    if (m.t === 'map') { seen.maps++; lastMap = m; seen.skins.add(m.skin); return; }
    if (m.t !== 'state') return;
    seen.states++; lastState = m;
    if (m.skin) seen.skins.add(m.skin);
    if (m.ph === 'lobby') return;

    const L = LAYOUTS[m.skin];
    if (!L) return;
    for (const p of m.P) {
      if (!p.al || p.es) continue;
      const k = 'p' + p.s;
      if (walked[k]) walked[k].d += Math.hypot(p.x - walked[k].x, p.y - walked[k].y);
      else walked[k] = { d: 0 };
      walked[k].x = p.x; walked[k].y = p.y;
      if (L.solid(p.x, p.y)) trail.stuckP = (trail.stuckP || 0) + 1;
      /* kẹt cứng: tâm trên sàn nhưng thân không lọt -> đứng im vĩnh viễn */
      if (kepCung(L, p.x, p.y)) { trail.kep = (trail.kep || 0) + 1; trail.kepAt = Math.round(p.x) + ',' + Math.round(p.y); }
      /* theo dõi hồi sinh: chết rồi sống lại thì phải sống lại ĐÚNG chỗ chết */
      const k2 = 'd' + p.s;
      if (trail[k2] && trail[k2].dead && p.al) {
        const d = Math.hypot(p.x - trail[k2].x, p.y - trail[k2].y);
        trail.hoiSinh = (trail.hoiSinh || 0) + 1;
        trail.hoiSinhXa = Math.max(trail.hoiSinhXa || 0, Math.round(d));
        trail[k2].dead = false;
      }
    }
    for (const p of m.P) {
      const k2 = 'd' + p.s;
      if (!trail[k2]) trail[k2] = { dead: false, x: p.x, y: p.y };
      if (!p.al && !p.es && !trail[k2].dead) { trail[k2].dead = true; trail[k2].x = p.x; trail[k2].y = p.y; }
    }
    for (const e of m.E) if (L.solid(e.x, e.y)) trail.stuckE = (trail.stuckE || 0) + 1;
    for (const c of m.C) if (L.solid(c.x, c.y)) trail.badChest = (trail.badChest || 0) + 1;
    for (const g of m.G) if (L.solid(g.x, g.y)) trail.badGate = (trail.badGate || 0) + 1;
    trail.maxLv = Math.max(trail.maxLv || 0, ...m.P.map(p => p.lv || 1));
    trail.kills = Math.max(trail.kills || 0, 0);
    if (m.G.length) trail.gates = m.G.length;
    trail.phases = trail.phases || new Set(); trail.phases.add(m.ph);
  }

  setTimeout(() => {
    console.log('\n===== MỘT VÁN MAP 1 (' + MATCH_TIME + 's) =====');
    ok(seen.states > 100, seen.states + ' gói state nhận được');
    ok(seen.maps >= 1, seen.maps + ' gói địa hình (bốc lại mỗi ván)');
    ok(lastMap && LAYOUTS[lastMap.skin], 'biến thể đã bốc: ' + (lastMap && lastMap.skin));
    ok(lastMap && lastMap.rows && lastMap.rows.length === 50, 'lưới 50 hàng gửi kèm');
    ok(lastMap && lastMap.camps.length >= 12, (lastMap ? lastMap.camps.length : 0) + ' bãi quái');
    ok(lastMap && lastMap.chests.length === 16, '16 rương');
    ok(!trail.stuckP, (trail.stuckP || 0) + ' lần người chơi nằm trong vật cản (phải là 0)');
    ok(!trail.kep, (trail.kep || 0) + ' lần người chơi kẹt cứng, thân không lọt (phải là 0)' + (trail.kepAt ? ' @ ' + trail.kepAt : ''));
    ok(trail.hoiSinh > 0, (trail.hoiSinh || 0) + ' lượt hồi sinh quan sát được');
    ok(!trail.hoiSinh || trail.hoiSinhXa <= 40, 'hồi sinh cách chỗ chết xa nhất ' + (trail.hoiSinhXa || 0) + 'px (phải bám chỗ chết)');
    ok(!trail.stuckE, (trail.stuckE || 0) + ' lần quái nằm trong vật cản (phải là 0)');
    ok(!trail.badChest, (trail.badChest || 0) + ' rương nằm trong vật cản (phải là 0)');
    ok(!trail.badGate, (trail.badGate || 0) + ' cổng nằm trong vật cản (phải là 0)');
    const moved = Object.keys(walked).map(k => walked[k].d);
    ok(moved.length >= 5, moved.length + ' người/bot có mặt trên sân');
    ok(moved.filter(d => d > 300).length >= 4, moved.filter(d => d > 300).length + '/' + moved.length + ' đi được hơn 300px (bot không kẹt tường)');
    ok(trail.phases && trail.phases.has('exodus'), 'ván chạy tới pha di tản');
    ok(trail.gates >= 2, (trail.gates || 0) + ' cổng thoát mở ra');
    ok(!/Error|TypeError|ReferenceError/.test(srvErr), 'server không ném lỗi nào');
    console.log(fail ? '\n' + fail + ' TEST HỎNG' : '\nTất cả test đạt');
    srv.kill();
    process.exit(fail ? 1 : 0);
  }, (MATCH_TIME + 34) * 1000);
}
