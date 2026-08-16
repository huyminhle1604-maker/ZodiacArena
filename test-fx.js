/* Test dây nối hiệu ứng kỹ năng: map1-server.js -> effects.js -> map1.html.
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

/* --- trích nhãn bằng text, không chạy --- */
const cut = (a, b) => { const i = FX.indexOf(a), j = FX.indexOf(b, i); return FX.slice(i, j); };
const BY_SK_SRC = cut('const BY_SK = {', '\n  };');
const BY_COL_SRC = FX.match(/const BY_COL = \{[^}]*\}/)[0];
const FROM_EV_SRC = cut('function fromEvent(e)', '\n  }\n');

/* {sk: 'kind spawn'} khai báo trong BY_SK */
const BY_SK = {};
for (const m of BY_SK_SRC.matchAll(/^\s{4}(\w+):.*?spawn\('(\w+)'/gm)) BY_SK[m[1]] = m[2];
const BY_COL = {};
for (const m of BY_COL_SRC.matchAll(/'(#[0-9a-fA-F]{6})':\s*'(\w+)'/g)) BY_COL[m[1].toLowerCase()] = m[2];

/* mọi ev(...) trong server có gắn sk, kèm màu vòng nếu có */
const SRV_EV = [];
for (const m of SRV.matchAll(/ev\(\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\s*\)/g)) {
  const body = m[1];
  const sk = (body.match(/\bsk:\s*'(\w+)'/) || [])[1];
  const k = (body.match(/\bk:\s*'(\w+)'/) || [])[1];
  const c = (body.match(/\bc:\s*'(#[0-9a-fA-F]{6})'/) || [])[1];
  SRV_EV.push({ sk, k, c: c && c.toLowerCase() });
}

let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  ✗ ' + m); fail++; } else console.log('  ✓ ' + m); };
const uniq = a => [...new Set(a.filter(Boolean))].sort();

console.log('nạp effects.js:');
ok(!!ZAFx, 'effects.js tự gán window.ZAFx');
ok(KINDS.size >= 27, KINDS.size + ' kind hiệu ứng');
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
/* 'z_' là ghép động: spawn('z_' + e.sign) — kiểm riêng ở mục 12 cung */
const evSpawns = uniq([...FROM_EV_SRC.matchAll(/spawn\('(\w+)'/g)].map(x => x[1])).filter(k => k !== 'z_');
for (const m of evSpawns) ok(KINDS.has(m), "fromEvent spawn('" + m + "')");

console.log('\n12 cung:');
const signs = Object.keys(ZAFx.SIGNS);
ok(signs.length === 12, signs.length + ' cung trong effects.js');
ok(signs.every(s => KINDS.has('z_' + s)), 'cung nào cũng có kind z_*');
const srvSigns = Object.keys(vm.runInNewContext('(' + SRV.match(/const SIGN_G = \{[\s\S]*?\};/)[0].replace(/^const SIGN_G = /, '').replace(/;$/, '') + ')', {}));
ok(srvSigns.length === 12 && srvSigns.every(s => signs.includes(s)), 'SIGN_G của server khớp 12 mã cung');
const htmlGlyph = HTML.match(/var SIGN_GLYPH=\{[^}]*\}/)[0];
ok(signs.every(s => htmlGlyph.includes(s + ":'")), 'SIGN_GLYPH của map1.html khớp 12 mã cung');

console.log('\nkhông còn chiêu nào rơi vào đoán theo màu:');
for (const e of SRV_EV) {
  if (!e.c || e.sk) continue;
  ok(!BY_COL[e.c], 'ev màu ' + e.c + ' không có sk và cũng không bị BY_COL bắt nhầm');
}

console.log('\nkind chưa ai gọi (chỉ để biết):');
const used = new Set([...Object.values(BY_SK), ...Object.values(BY_COL),
  ...evSpawns,
  ...signs.map(s => 'z_' + s)]);
const idle = [...KINDS].filter(k => !used.has(k));
console.log('  ' + (idle.length ? idle.join(', ') : '(không có)'));

console.log(fail ? '\n' + fail + ' test HỎNG' : '\nTất cả test đạt');
process.exit(fail ? 1 : 0);
