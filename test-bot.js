/* Bot test cho Zodiac Arena — client WebSocket thô bằng net + crypto.
 * Dùng: node bot.js coop   |   node bot.js duel
 */
const net = require('net');
const crypto = require('crypto');

const HOST = '127.0.0.1', PORT = Number(process.env.PORT) || 8080;
const MODE = process.argv[2] === 'duel' ? 'duel' : 'coop';
const N = MODE === 'duel' ? 3 : 2;
const RUN_MS = Number(process.argv[3]) || 45000;

function connect(name, cls, z, onMsg) {
  const key = crypto.randomBytes(16).toString('base64');
  const sock = net.connect(PORT, HOST);
  let handshook = false, buf = Buffer.alloc(0);

  sock.on('connect', () => {
    sock.write(
      `GET / HTTP/1.1\r\nHost: ${HOST}:${PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
    );
  });

  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    if (!handshook) {
      const i = buf.indexOf('\r\n\r\n');
      if (i < 0) return;
      const head = buf.slice(0, i).toString();
      if (!/101/.test(head)) { console.error('handshake FAIL:', head.split('\r\n')[0]); process.exit(1); }
      buf = buf.slice(i + 4);
      handshook = true;
      api.send({ t: 'join', nm: name, cls, z, mode: MODE });
    }
    for (;;) {
      if (buf.length < 2) return;
      const op = buf[0] & 0x0f;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (buf.length < off + len) return;
      const payload = buf.slice(off, off + len);
      buf = buf.slice(off + len);
      if (op === 8) { sock.destroy(); return; }
      if (op === 1) { try { onMsg(JSON.parse(payload.toString('utf8')), api); } catch (e) { } }
    }
  });
  sock.on('error', e => console.error('sock', name, e.message));

  const api = {
    name, sock, slot: -1,
    send(o) {
      const p = Buffer.from(JSON.stringify(o), 'utf8');
      const mask = crypto.randomBytes(4);
      let head;
      if (p.length < 126) { head = Buffer.allocUnsafe(2); head[1] = 0x80 | p.length; }
      else { head = Buffer.allocUnsafe(4); head[1] = 0x80 | 126; head.writeUInt16BE(p.length, 2); }
      head[0] = 0x81;
      const out = Buffer.allocUnsafe(p.length);
      for (let i = 0; i < p.length; i++) out[i] = p[i] ^ mask[i & 3];
      sock.write(Buffer.concat([head, mask, out]));
    }
  };
  return api;
}

/* ---------------- kịch bản ---------------- */
const CLS = ['sw', 'ar', 'mk'];
const Z = ['ari', 'pis', 'leo'];
const bots = [];
const stat = { snaps: 0, maxWave: 0, maxLv: 1, allocs: 0, denies: 0, phases: new Set(), scores: null, rk: null, kills: 0, orbs: 0 };
let lastState = null;

for (let i = 0; i < N; i++) {
  const b = connect('Bot' + (i + 1), CLS[i % 3], Z[i % 3], (m, api) => {
    if (m.t === 'joined') { api.slot = m.slot; console.log(`[${api.name}] joined slot=${m.slot} mode=${m.mode}`); }
    if (m.t === 'full') console.log(`[${api.name}] PHÒNG ĐẦY`);
    if (m.t === 'deny') stat.denies++;
    if (m.t === 'state') {
      if (api.slot !== 0) return;         // chỉ bot 0 ghi thống kê
      stat.snaps++; lastState = m;
      stat.maxWave = Math.max(stat.maxWave, m.wave || 0);
      for (const p of m.P) stat.maxLv = Math.max(stat.maxLv, p.lv);
      for (const e of m.ev || []) { if (e.k === 'die') stat.kills++; if (e.k === 'orb') stat.orbs++; }
      if (m.duel) { stat.phases.add(m.duel.ph); stat.scores = m.duel.score; if (m.duel.rk && m.duel.rk.length) stat.rk = m.duel.rk; }
    }
  });
  bots.push(b);
}

/* rải điểm kỹ năng: học theo thứ tự cố định của nhánh A */
function buildOrder(cls) {
  return [cls + '_e', cls + '_p0', cls + '_p1', cls + '_A_root', cls + '_A_4a', cls + '_A_4b',
          cls + '_A_5a', cls + '_A_5b', cls + '_A_key'];
}

let tick = 0;
const loop = setInterval(() => {
  tick++;
  if (!lastState) return;
  const S = lastState;

  bots.forEach((b, i) => {
    const me = S.P.find(p => p.s === b.slot);
    if (!me) return;

    /* rải điểm khi còn điểm */
    if (me.pts > 0 && tick % 6 === i) {
      const order = buildOrder(me.cls);
      const next = order.find(id => !me.nd.includes(id));
      if (next) { b.send({ t: 'alloc', id: next }); stat.allocs++; }
    }

    /* sẵn sàng khi ở màn loadout và hết điểm (hoặc đã rải đủ) */
    if (S.duel && S.duel.ph === 'loadout' && me.pts === 0 && !S.duel.ready[b.slot]) {
      b.send({ t: 'ready', v: true });
    }
    if (S.duel && S.duel.ph === 'matchover' && tick % 30 === 0 && i === 0) {
      b.send({ t: 'rematch' });
    }

    /* tìm mục tiêu: quái gần nhất (coop) hoặc đối thủ gần nhất (duel) */
    let tx = 480, ty = 280, best = 1e9;
    const list = S.mode === 'coop' ? S.E : S.P.filter(p => p.s !== b.slot && p.al && !p.el);
    for (const t of list) {
      const d = Math.hypot(t.x - me.x, t.y - me.y);
      if (d < best) { best = d; tx = t.x; ty = t.y; }
    }
    const aim = Math.atan2(ty - me.y, tx - me.x);
    const want = me.cls === 'sw' ? 30 : 180;         // cận chiến thì áp sát
    const approach = best > want;
    b.send({
      t: 'in',
      rt: approach && tx > me.x ? 1 : 0, lf: approach && tx < me.x ? 1 : 0,
      dn: approach && ty > me.y ? 1 : 0, up: approach && ty < me.y ? 1 : 0,
      aim, fire: list.length ? 1 : 0
    });
    if (tick % 20 === i) b.send({ t: 'sk', s: 'E' });
    if (tick % 45 === i) b.send({ t: 'sk', s: 'R' });
  });
}, 1000 / 30);

setTimeout(() => {
  clearInterval(loop);
  console.log('\n===== KẾT QUẢ =====');
  console.log('mode           :', MODE);
  console.log('snapshots      :', stat.snaps);
  console.log('alloc gửi / bị từ chối:', stat.allocs, '/', stat.denies);
  if (MODE === 'coop') {
    console.log('đợt cao nhất   :', stat.maxWave);
    console.log('cấp cao nhất   :', stat.maxLv);
    console.log('quái bị giết   :', stat.kills);
    console.log('quái còn trên sân:', lastState ? lastState.E.length : '?');
  } else {
    console.log('các pha đã qua :', [...stat.phases].join(' → '));
    console.log('tỉ số          :', JSON.stringify(stat.scores));
    console.log('orb đã nhặt    :', stat.orbs);
    console.log('ELO            :', JSON.stringify(stat.rk));
  }
  if (lastState) console.log('người chơi     :', lastState.P.map(p =>
    `${p.nm}(${p.cls}/${p.br || '-'}) Lv${p.lv} hp${p.hp}/${p.mhp} sh${p.sh} nodes${p.nd.length}`).join(' | '));
  bots.forEach(b => b.sock.destroy());
  process.exit(0);
}, RUN_MS);
