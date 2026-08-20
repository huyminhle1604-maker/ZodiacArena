/* Test cơ chế nhặt blessing kiểu Hades — trích thẳng rollSign / rollSlots từ
 * map1-server.js nên không thể lệch bản.
 *   node test-bless.js
 *
 * Câu hỏi cần trả lời: gom đủ 5 slot CÙNG MỘT CUNG (Bộ Hợp Cung) có còn là
 * chuyện bất khả thi như bản bốc đều không.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, 'map1-server.js'), 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => { const i = SRC.indexOf(a), j = SRC.indexOf(b, i); return SRC.slice(i, j); };
const pick1 = re => SRC.match(re)[0];

const core = [
  pick1(/const SIGNS = .*\n/),
  pick1(/const SLOTS = .*\n/),
  pick1(/const PULL_W = .*\n/),
  pick1(/const OFFER_N = .*\n/),
  pick1(/const BL_MAXLV = .*\n/),
  cut('function signCount(p, s)', '/* Bảng chọn blessing'),
].join('\n');

const T = {};
vm.runInNewContext(core + '\nObject.assign(exports,{SIGNS,SLOTS,PULL_W,OFFER_N,BL_MAXLV,signCount,rollSign,rollSlots});',
                   { exports: T, Math, Object });
const { SIGNS, SLOTS, OFFER_N, BL_MAXLV, signCount, rollSign, rollSlots } = T;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };
const mk = () => ({ bl: { atk: null, e: null, r: null, pas: null, dash: null }, blLv: { atk: 1, e: 1, r: 1, pas: 1, dash: 1 } });

/* Người chơi "chơi tối ưu": mỗi lần mở bảng thì chọn hàng nào tiến gần bộ nhất
   (slot trống của cung đang gom > nâng cấp > đè lên slot cung khác). */
function chooseBest(p, sign, slots) {
  const rank = sl => {
    const cur = p.bl[sl];
    if (!cur) return 0;                                   // trống: tốt nhất
    if (cur === sign) return p.blLv[sl] < BL_MAXLV ? 1 : 3;
    return 2;                                             // đè lên cung khác
  };
  return slots.slice().sort((a, b) => rank(a) - rank(b))[0];
}
function apply(p, sign, slot) {
  if (p.bl[slot] === sign) { p.blLv[slot] = Math.min(BL_MAXLV, p.blLv[slot] + 1); return; }
  p.bl[slot] = sign; p.blLv[slot] = 1;
}
const comboOf = p => { const v = SLOTS.map(s => p.bl[s]); return v[0] && v.every(x => x === v[0]) ? v[0] : null; };

/* --- Bản bốc ĐỀU của trước đây, để so --- */
function rollFlat() { return SIGNS[Math.floor(Math.random() * SIGNS.length)]; }

function run(rollFn, offerFn, picks, N) {
  let done = 0, tong = 0;
  for (let i = 0; i < N; i++) {
    const p = mk();
    for (let k = 0; k < picks; k++) {
      const sign = rollFn(p);
      apply(p, sign, chooseBest(p, sign, offerFn(p, sign)));
    }
    /* số slot nhiều nhất của một cung — đo tiến độ, không chỉ đủ/không đủ */
    let best = 0; for (const s of SIGNS) best = Math.max(best, signCount(p, s));
    tong += best;
    if (comboOf(p)) done++;
  }
  return { ty: done / N, sau: tong / N };
}

const N = 4000, PICKS = 12;      // 12 lượt nhặt ~ một ván 10 phút

console.log('\n===== TRỌNG SỐ BỐC CUNG =====');
{
  const p = mk();
  p.bl.atk = 'leo'; p.bl.e = 'leo';                 // đang giữ 2 slot Sư Tử
  let leo = 0; const M = 20000;
  for (let i = 0; i < M; i++) if (rollSign(p, null) === 'leo') leo++;
  const deu = 1 / SIGNS.length;
  ok(leo / M > deu * 3, 'giữ 2 slot Sư Tử → ra Sư Tử ' + (leo / M * 100).toFixed(1) + '% (bốc đều là ' + (deu * 100).toFixed(1) + '%)');

  const q = mk();
  let bias = 0;
  for (let i = 0; i < M; i++) if (rollSign(q, 'sco') === 'sco') bias++;
  ok(bias / M > deu * 2, 'quái mang buff Bọ Cạp → nghiêng về Bọ Cạp ' + (bias / M * 100).toFixed(1) + '%');

  const r = mk();
  ok(rollSign(r, null, ['ari']) !== 'ari' && rollSign(r, null, ['ari']) !== 'ari',
     'exclude loại được cung đang giữ (merchant reroll không ra lại chính nó)');
}

console.log('\n===== BẢNG CHỌN =====');
{
  const p = mk();
  for (let i = 0; i < 300; i++) {
    const sl = rollSlots(p, 'leo', OFFER_N);
    if (sl.length !== OFFER_N || new Set(sl).size !== OFFER_N) { ok(false, 'bảng chọn phải có ' + OFFER_N + ' slot khác nhau'); break; }
    if (i === 299) ok(true, 'luôn bày đúng ' + OFFER_N + ' slot, không trùng slot');
  }
  /* Song Tử bị động = 4 lựa chọn */
  ok(rollSlots(p, 'leo', OFFER_N + 1).length === OFFER_N + 1, 'bị động Song Tử bày được ' + (OFFER_N + 1) + ' slot');

  /* slot trống và slot cùng cung phải được ưu ái hơn slot đang giữ cung khác */
  const q = mk();
  q.bl.atk = 'leo'; q.bl.e = 'tau'; q.bl.r = 'vir'; q.bl.pas = 'sco';   // chỉ dash còn trống
  let coDash = 0, coE = 0; const M = 20000;
  for (let i = 0; i < M; i++) { const sl = rollSlots(q, 'leo', OFFER_N); if (sl.includes('dash')) coDash++; if (sl.includes('e')) coE++; }
  ok(coDash / M > coE / M * 1.5, 'slot trống hiện thường xuyên hơn slot đang giữ cung khác (' +
     (coDash / M * 100).toFixed(0) + '% vs ' + (coE / M * 100).toFixed(0) + '%)');
}

console.log('\n===== GOM ĐỦ BỘ HỢP CUNG (' + PICKS + ' lượt nhặt/ván) =====');
{
  /* bản cũ: cung bốc đều, bảng bày CẢ 5 slot */
  const cu = run(() => rollFlat(), () => SLOTS.slice(), PICKS, N);
  /* bản mới: cung theo trọng số, bảng bày 3 slot */
  const moi = run(p => rollSign(p, null), (p, s) => rollSlots(p, s, OFFER_N), PICKS, N);

  console.log('  cũ : đủ bộ ' + (cu.ty * 100).toFixed(2) + '% · cung gom nhất ' + cu.sau.toFixed(2) + '/5');
  console.log('  mới: đủ bộ ' + (moi.ty * 100).toFixed(2) + '% · cung gom nhất ' + moi.sau.toFixed(2) + '/5');
  ok(cu.ty < 0.05, 'bản cũ gần như không bao giờ đủ bộ (' + (cu.ty * 100).toFixed(2) + '%)');
  ok(moi.ty > 0.15, 'bản mới đủ bộ được ' + (moi.ty * 100).toFixed(1) + '% — có thật là mục tiêu chơi được');
  ok(moi.ty < 0.9, 'nhưng không phải cho không (' + (moi.ty * 100).toFixed(1) + '% < 90%)');
  ok(moi.sau > cu.sau + 0.8, 'tiến độ gom bộ hơn bản cũ gần 1 slot');
}

console.log('\n===== NÂNG CẤP =====');
{
  /* Đủ bộ rồi thì lượt nhặt tiếp không còn chỗ mới — phải chảy vào nâng cấp. */
  const p = mk();
  SLOTS.forEach(s => { p.bl[s] = 'leo'; });
  let up = 0;
  for (let i = 0; i < 200; i++) {
    const sl = rollSlots(p, 'leo', OFFER_N);
    const before = p.blLv[sl[0]];
    apply(p, 'leo', sl[0]);
    if (p.blLv[sl[0]] > before) up++;
  }
  ok(up > 0, 'đủ bộ rồi thì lượt nhặt tiếp nâng cấp slot (' + up + '/200 lượt còn dưới trần)');
  ok(SLOTS.every(s => p.blLv[s] <= BL_MAXLV), 'cấp không vượt trần ' + BL_MAXLV);
}

console.log('\n' + (fail ? fail + ' test KHÔNG đạt' : 'Tất cả test đạt'));
process.exit(fail ? 1 : 0);
