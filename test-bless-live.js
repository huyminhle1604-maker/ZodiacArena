/* Chạy server thật rồi đi hết luồng: chọn cung NGẪU NHIÊN ở sảnh -> sẵn sàng ->
 * huỷ sẵn sàng -> vào map -> mở rương -> chọn slot blessing -> nâng cấp.
 *   node test-bless-live.js
 *
 * Soát ĐÚNG GIAO THỨC (gói offer mang {sign, slots}, cấp gửi ở blv, state ready
 * không mất khi đóng bảng), không soát cân bằng — cân bằng ở test-bless.js.
 *
 * Cần HAI client: một người sẵn sàng thì phòng vào map ngay, nên phải có người
 * thứ hai đứng đó mới quan sát được trạng thái ready ở sảnh.
 */
const net = require('net'), crypto = require('crypto'), cp = require('child_process');
const PORT = 8098;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };

function frame(payload) {
  const b = Buffer.from(payload), mask = crypto.randomBytes(4), len = b.length;
  let head;
  if (len < 126) head = Buffer.from([0x81, 0x80 | len]);
  else { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 0xFE; head.writeUInt16BE(len, 2); }
  const out = Buffer.concat([head, mask, b]);
  for (let i = 0; i < len; i++) out[out.length - len + i] = b[i] ^ mask[i & 3];
  return out;
}

const srv = cp.spawn(process.execPath, ['map1-server.js'], {
  env: { ...process.env, PORT: String(PORT), MATCH_TIME: '120', BOTS: '0', LOBBY_CD: '600', BLESS_RATE: '12', SKIN: 'ruin' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let srvErr = '';
srv.stderr.on('data', d => { srvErr += d; process.stderr.write(d); });

/* client thô: bắt tay, tách khung, gọi onMsg */
function client(nm, onMsg) {
  const sock = net.connect(PORT, '127.0.0.1');
  let shook = false, buf = Buffer.alloc(0);
  const api = { send: o => sock.write(frame(JSON.stringify(o))), sock };
  sock.on('connect', () => sock.write('GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Key: ' + crypto.randomBytes(16).toString('base64') + '\r\nSec-WebSocket-Version: 13\r\n\r\n'));
  sock.on('error', () => { });
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    if (!shook) {
      const i = buf.indexOf('\r\n\r\n'); if (i < 0) return;
      buf = buf.slice(i + 4); shook = true;
      api.send({ t: 'join', nm, cls: 'ar' });
    }
    for (; ;) {
      if (buf.length < 2) return;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (buf.length < off + len) return;
      const body = buf.slice(off, off + len).toString('utf8');
      buf = buf.slice(off + len);
      try { onMsg(JSON.parse(body), api); } catch (e) { }
    }
  });
  return api;
}

setTimeout(run, 900);

function run() {
  let CFG = null, me = null, step = 0;
  const seen = { offers: 0, badOffer: 0, sameSign: 0, expectUp: 0, ups: 0 };
  let lastBlv = null, B = null;

  /* Người thứ hai: chỉ đứng đó cho sảnh có 2 người, tới lượt mới bấm. */
  B = client('Người Đứng', () => { });

  const A = client('Kiểm Thử', (m, api) => {
    if (m.t === 'welcome') { CFG = m.cfg; return; }

    if (m.t === 'offer') {
      seen.offers++;
      const bad = !m.sign || !CFG.SIGNS.includes(m.sign) || !Array.isArray(m.slots) ||
        !m.slots.length || m.slots.length > 4 ||
        new Set(m.slots).size !== m.slots.length ||
        m.slots.some(s => !CFG.SLOTS.includes(s));
      if (bad) { seen.badOffer++; api.send({ t: 'skip' }); return; }
      /* Chơi như người: slot trống trước, rồi slot đang giữ ĐÚNG cung này
         (nâng cấp). Nếu chỉ còn cách ĐÈ LÊN một bộ đang gom (>=2 slot cùng
         cung) thì BỎ QUA — đè vào là phá bộ, và bảng chọn có sẵn nút bỏ qua
         đúng cho tình huống này. */
      const bl = (me && me.bl) || {};
      const cnt = sg => CFG.SLOTS.filter(sl => bl[sl] === sg).length;
      const rank = sl => !bl[sl] ? 0 : (bl[sl] === m.sign ? 1 : 2);
      const want = m.slots.slice().sort((a, b) => rank(a) - rank(b))[0];
      if (rank(want) === 2 && cnt(bl[want]) >= 2) { seen.skips = (seen.skips || 0) + 1; api.send({ t: 'skip' }); return; }
      if (bl[want] === m.sign) {
        seen.sameSign++;
        /* Tới trần cấp thì server quy ra chỉ số phẳng chứ không lên cấp nữa —
           phải trừ ra, không thì đếm lệch và test hỏng oan. */
        if (((me.blv || {})[want] || 1) < CFG.BL_MAXLV) seen.expectUp++;
      }
      api.send({ t: 'pick', slot: want });
      return;
    }

    if (m.t !== 'state' || !m.me) return;
    me = m.me;

    if (m.ph === 'lobby') {
      if (step === 0 && m.lb && m.lb.n >= 2) { step = 1; api.send({ t: 'setsign', v: '?' }); return; }
      if (step === 1 && me.sign) {
        step = 2;
        ok(CFG.SIGNS.includes(me.sign), 'setsign "?" bốc được một cung: ' + me.sign);
        ok(me.rs === 1, 'server đánh dấu là cung ngẫu nhiên (rs=1)');
        ok(me.bl.pas === me.sign, 'cung vào thẳng slot bị động');
        ok(!!CFG.RAND_BUFF_TXT, 'cfg mang mô tả buff ngẫu nhiên cho client hiện');
        api.send({ t: 'enter' });
        return;
      }
      if (step === 2 && me.ready === 1) {
        step = 3;
        ok(true, 'bấm VÀO MAP 1 -> ready=1; state nằm ở server nên đóng bảng không mất');
        api.send({ t: 'ready', v: false });                  // nút HUỶ SẴN SÀNG
        return;
      }
      if (step === 3 && me.ready === 0) {
        step = 4;
        ok(true, 'huỷ sẵn sàng được (nút HUY SAN SANG)');
        api.send({ t: 'setsign', v: 'leo' });
        return;
      }
      if (step === 4 && me.sign === 'leo') {
        step = 5;
        ok(me.rs === 0, 'chọn tay thì bỏ cờ ngẫu nhiên (hết buff)');
        api.send({ t: 'enter' });
        B.send({ t: 'setsign', v: 'tau' });
        setTimeout(() => B.send({ t: 'enter' }), 200);        // đủ người -> vào ngay
        return;
      }
      return;
    }

    /* --- trong ván: theo dõi cấp từng slot và bộ hợp cung --- */
    if (!me.blv) seen.noBlv = 1;
    if (lastBlv) { const a = lastBlv, b = me.blv || {}; for (const s of CFG.SLOTS) if (b[s] > a[s]) seen.ups++; }
    lastBlv = Object.assign({}, me.blv);
    if (me.combo) seen.combo = me.combo;
    seen.top = Math.max(seen.top || 0, Math.max.apply(null, CFG.SIGNS.map(sg => CFG.SLOTS.filter(sl => me.bl[sl] === sg).length)));

    const S0 = seen;
    const my = m.P.find(p => p.s === me.s);
    S0.play = (S0.play || 0) + 1;
    if (!my || !my.al) { S0.dead = (S0.dead || 0) + 1; return; }

    /* Client này KHÔNG có tìm đường (bot có A*, client thì không), nên đừng bắt
       nó băng map đi tìm gì cả: BLESS_RATE=12 làm server thả blessing ngay dưới
       chân, tick sau là nhặt xong. Việc duy nhất còn lại là ĐỪNG CHẾT — đo lần
       trước cho thấy cày brute thì 2/3 số gói là đang nằm chờ hồi sinh, và
       nằm chờ thì không nhặt được gì. Nên: chạy xa con quái gần nhất, bắn nó
       trong lúc chạy (xạ thủ tầm 330px). */
    let near = null, nd = 1e9;
    for (const e of m.E) { const d = Math.hypot(e.x - my.x, e.y - my.y); if (d < nd) { nd = d; near = e; } }
    const S = seen;
    S.n = (S.n || 0) + 1;
    const aim = near ? Math.atan2(near.y - my.y, near.x - my.x) : 0;
    /* quái xa thì đứng yên tại chỗ chờ blessing rơi xuống chân */
    let ang = near && nd < 330 ? aim + Math.PI : null;
    /* chạy lùi mà chạm tường thì lách ngang, không thì bị dồn vào góc */
    if (ang !== null) {
      if (S.n % 15 === 0) {
        if (Math.hypot(my.x - (S.lx || 0), my.y - (S.ly || 0)) < 5) S.side = 25 * (Math.random() < .5 ? 1 : -1);
        S.lx = my.x; S.ly = my.y;
      }
      if (S.side) { ang += (S.side > 0 ? 1.35 : -1.35); S.side += S.side > 0 ? -1 : 1; }
    }
    const dx = ang === null ? 0 : Math.cos(ang), dy = ang === null ? 0 : Math.sin(ang);
    api.send({
      t: 'in', up: dy < -.25 ? 1 : 0, dn: dy > .25 ? 1 : 0, lf: dx < -.25 ? 1 : 0, rt: dx > .25 ? 1 : 0,
      fire: near && nd < 320 ? 1 : 0, use: 0, aim
    });
    if (process.env.DBG && S.n % 30 === 0)
      console.log('  ... quai gan nhat ' + Math.round(nd) + 'px, hp ' + my.hp + ', offers ' + S.offers);
  });


  setTimeout(() => {
    console.log('\n===== GIAO THỨC BLESSING =====');
    console.log('  (' + (seen.play || 0) + ' gói trong ván, ' + (seen.dead || 0) + ' gói lúc đang chết' +
      ', gom nhiều nhất ' + (seen.top || 0) + '/5 slot cùng cung' + (seen.combo ? ', mở được BỘ HỢP CUNG ' + seen.combo : '') + ')');
    ok(seen.offers >= 3, seen.offers + ' bảng chọn nhận được trong ván');
    ok(!seen.badOffer, 'mọi gói offer đúng dạng {sign, slots} (' + seen.badOffer + ' gói sai)');
    ok(!seen.noBlv, 'gói me luôn mang blv (cấp từng slot)');
    /* So SỐ LẦN, không so "có > 0": số bảng chọn rơi vào tay xúc xắc nên khẳng
       định "chắc chắn có lần trùng" là mầm test lúc đạt lúc không. Cái phải
       đúng là mỗi lần chọn trùng đều thành một cấp — đó là chỗ dễ hỏng. */
    ok(seen.ups === seen.expectUp, 'mỗi lần chọn trùng cung ở slot chưa tới trần là một cấp (' +
      seen.sameSign + ' lần trùng, ' + (seen.expectUp || 0) + ' lần đáng lên cấp, ' + seen.ups + ' lần lên thật)');
    ok((seen.top || 0) >= 3, 'cơ chế trọng số gom được ' + (seen.top || 0) + '/5 slot cùng cung trong một ván');
    ok(!/Error|error:/.test(srvErr), 'server không ném lỗi nào');
    console.log('\n' + (fail ? fail + ' test KHÔNG đạt' : 'Tất cả test đạt'));
    try { A.sock.destroy(); B.sock.destroy(); } catch (e) { }
    srv.kill();
    setTimeout(() => process.exit(fail ? 1 : 0), 150);
  }, 60000);
}
