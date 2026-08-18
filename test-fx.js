/* Test dây nối hiệu ứng: map1-server.js -> effects.js -> map1.html.
 * Không vẽ gì, chỉ đối chiếu nhãn — đổi tên một bên là test đỏ ngay.
 * Chạy: node test-fx.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const rd = f => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\r\n/g, '\n');
const SRV = rd('map1-server.js'), FX = rd('effects.js'), HTML = rd('map1.html');

/* nạp effects.js thật (chỉ cần window; document dùng lười trong glyph) */
const W = {};
vm.runInNewContext(FX, { window: W, document: undefined, Math, Object, console });
const ZAFx = W.ZAFx;
const KINDS = new Set(ZAFx.KINDS);
const BASIC = ZAFx.BASIC, MON_ATK = ZAFx.MON_ATK, PROJ = new Set(ZAFx.PROJ);

let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };
const uniq = a => [...new Set(a.filter(Boolean))].sort();
const all = (src, re) => uniq([...src.matchAll(re)].map(m => m[1]));
/* đọc một object literal trong nguồn mà không chạy cả file */
const litKeys = (src, name) => {
  const head = 'const ' + name + ' = ';
  const i = src.indexOf(head + '{'), j = src.indexOf('};', i);
  return Object.keys(vm.runInNewContext('(' + src.slice(i + head.length, j + 1) + ')', { Math }));
};

/* --- trích nhãn bằng text, không chạy --- */
const cut = (a, b) => { const i = FX.indexOf(a), j = FX.indexOf(b, i); return FX.slice(i, j); };
const BY_SK_SRC = cut('const BY_SK = {', '\n  };');
const BY_COL_SRC = FX.match(/const BY_COL = \{[^}]*\}/)[0];
const FROM_EV_SRC = cut('function fromEvent(e)', '\n  }\n');

const BY_SK = {};
for (const m of BY_SK_SRC.matchAll(/^\s{4}(\w+):.*?spawn\('(\w+)'/gm)) BY_SK[m[1]] = m[2];
const BY_COL = {};
for (const m of BY_COL_SRC.matchAll(/'(#[0-9a-fA-F]{6})':\s*'(\w+)'/g)) BY_COL[m[1].toLowerCase()] = m[2];
/* 'z_' là ghép động: spawn('z_' + e.sign) — kiểm riêng ở mục 12 cung */
const evSpawns = all(FROM_EV_SRC, /spawn\('(\w+)'/g).filter(k => k !== 'z_');
/* kind map1.html gọi thẳng, không qua fromEvent */
const htmlSpawns = all(HTML, /ZAFx\.spawn\('(\w+)'/g);

/* mọi ev(...) trong server, kèm sk và màu vòng nếu có */
const SRV_EV = [];
for (const m of SRV.matchAll(/ev\(\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\s*\)/g)) {
  const b = m[1];
  SRV_EV.push({
    sk: (b.match(/\bsk:\s*'(\w+)'/) || [])[1],
    k: (b.match(/\bk:\s*'(\w+)'/) || [])[1],
    c: ((b.match(/\bc:\s*'(#[0-9a-fA-F]{6})'/) || [])[1] || '').toLowerCase() || undefined
  });
}

console.log('nạp effects.js:');
ok(!!ZAFx, 'effects.js tự gán window.ZAFx');
ok(KINDS.size >= 35, KINDS.size + ' kind hiệu ứng');
ok(/<script src="effects\.js"><\/script>/.test(HTML), 'map1.html có nạp effects.js');
ok(HTML.indexOf('src="sprites.js"') < HTML.indexOf('src="effects.js"'), 'nạp sau sprites.js');
ok(/ZAFx\.draw\(ctx\)/.test(HTML) && /ZAFx\.update\(/.test(HTML), 'map1.html có gọi draw + update');
ok(/ZAFx\.fromEvent\(e\)/.test(HTML), 'handleEv có định tuyến qua fromEvent');

console.log('\nnhãn sk server gửi đều có người nhận:');
const srvSk = uniq(SRV_EV.map(e => e.sk));
ok(srvSk.length > 0, 'server gắn sk cho ' + srvSk.length + ' loại chiêu');
for (const sk of srvSk) ok(!!BY_SK[sk], "sk '" + sk + "' -> BY_SK." + (BY_SK[sk] || '(THIẾU)'));

console.log('\nmọi handler trỏ tới kind có thật:');
for (const [sk, kind] of Object.entries(BY_SK)) ok(KINDS.has(kind), 'BY_SK.' + sk + " -> '" + kind + "'");
for (const [c, kind] of Object.entries(BY_COL)) ok(KINDS.has(kind), 'BY_COL ' + c + " -> '" + kind + "'");
for (const k of evSpawns) ok(KINDS.has(k), "fromEvent spawn('" + k + "')");
for (const k of htmlSpawns) ok(KINDS.has(k), "map1.html spawn('" + k + "')");

console.log('\nđòn đánh thường:');
const srvCls = litKeys(SRV, 'CLASSES');
ok(srvCls.every(c => BASIC[c]), 'mã class server (' + srvCls.join(',') + ') đều có đòn thường');
for (const [c, kind] of Object.entries(BASIC)) ok(KINDS.has(kind), 'BASIC.' + c + " -> '" + kind + "'");
ok(/ZAFx\.basic\(p\.cls/.test(HTML), 'map1.html gọi ZAFx.basic theo cls người chơi');
ok(/ZAFx\.spawn\('atkSlash'/.test(HTML), 'kiếm sĩ đi đường event slash, không gọi basic hai lần');

console.log('\nđòn quái:');
const srvMon = all(SRV, /ty: '(slime|runner|brute|caster|boss)'/g);
for (const t of srvMon) {
  if (t === 'boss') ok(/best\.bs\s*\?\s*'brute'/.test(HTML), "loại 'boss' quy về brute trong map1.html");
  else ok(!!MON_ATK[t], "loại quái '" + t + "' có trong MON_ATK");
}
for (const [t, kind] of Object.entries(MON_ATK)) ok(KINDS.has(kind), 'MON_ATK.' + t + " -> '" + kind + "'");
ok(/ZAFx\.monAtk\(ty/.test(HTML), 'map1.html gọi ZAFx.monAtk theo loại quái');

console.log('\nđạn bay:');
ok(PROJ.has('arrow'), "PROJ có 'arrow' làm bản dự phòng");
ok(/ZAFx\.drawProj\(ctx/.test(HTML), 'drawProjs vẽ đạn qua ZAFx.drawProj');
/* gộp mọi vế phải của `ty:` rồi mới quét, để bắt cả nhánh ternary */
const tySeg = [...SRV.matchAll(/ty:([^,\n]*)/g)].map(m => m[1]).join(' ');
const srvProj = all(tySeg, /'(arrow|orbp|pierce|eball|bolt)'/g);
for (const t of srvProj) ok(PROJ.has(t) || t === 'bolt',
  "kiểu đạn '" + t + "' " + (PROJ.has(t) ? 'có hình riêng' : 'rơi về mũi tên (có chủ ý)'));

console.log('\n12 cung:');
const signs = Object.keys(ZAFx.SIGNS);
ok(signs.length === 12, signs.length + ' cung trong effects.js');
ok(signs.every(s => KINDS.has('z_' + s)), 'cung nào cũng có kind z_*');
const srvSigns = litKeys(SRV, 'SIGN_G');
ok(srvSigns.length === 12 && srvSigns.every(s => signs.includes(s)), 'SIGN_G của server khớp 12 mã cung');
const htmlGlyph = HTML.match(/var SIGN_GLYPH=\{[^}]*\}/)[0];
ok(signs.every(s => htmlGlyph.includes(s + ":'")), 'SIGN_GLYPH của map1.html khớp 12 mã cung');

console.log('\nkhông còn chiêu nào rơi vào đoán theo màu:');
for (const e of SRV_EV) {
  if (!e.c || e.sk) continue;
  ok(!BY_COL[e.c], 'ev màu ' + e.c + ' không có sk và cũng không bị BY_COL bắt nhầm');
}

console.log('\nkind chưa ai gọi (chỉ để biết):');
const used = new Set([...Object.values(BY_SK), ...Object.values(BY_COL), ...evSpawns, ...htmlSpawns,
  ...Object.values(BASIC), ...Object.values(MON_ATK), ...signs.map(s => 'z_' + s)]);
const idle = [...KINDS].filter(k => !used.has(k));
console.log('  ' + (idle.length ? idle.join(', ') : '(không có)'));

console.log(fail ? '\n' + fail + ' test HỎNG' : '\nTất cả test đạt');
process.exit(fail ? 1 : 0);
