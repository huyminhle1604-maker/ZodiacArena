/* Test logic cây kỹ năng — trích thẳng từ map1-server.js nên không lệch bản.
 * Chạy: node test-tree.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, 'map1-server.js'), 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => { const i = SRC.indexOf(a), j = SRC.indexOf(b, i); return SRC.slice(i, j); };
const pick1 = re => SRC.match(re)[0];

const core = [
  pick1(/const CLASSES = \{[\s\S]*?\n\};/),
  pick1(/const ESKILL = .*\n/),
  pick1(/const RSKILL = .*\n/),
  pick1(/const SIGNS = .*\n/),
  pick1(/const SLOTS = .*\n/),
  cut('const MINLV = {', '/* Node ch'),
  cut('function applyFx(p, id)', 'function canAlloc'),
  cut('function canAlloc(p, id)', '/* ============================ QU'),
].join('\n');

const T = {};
/* Đoạn trích trùm luôn khối LOBBY, mà tường sảnh giờ nằm ở assets/ chứ không
   viết thẳng trong file nữa — cấp cho sandbox để đoạn mã còn dịch được. */
vm.runInNewContext(core + '\nObject.assign(exports,{META,MINLV,applyFx,canAlloc,CLASSES});',
                   { exports: T, Math, Object, LOBBY_WALLS: require('./assets/lobby-village-walls.js') });
const { META, MINLV, applyFx, canAlloc } = T;

function mk(cls){ return { cls, lv:1, pts:0, nodes:[cls+'_root'], br:null, fx:{} }; }
function recompute(p){
  const c = T.CLASSES[p.cls];
  p.mhp=c.hp; p.mmp=c.mp; p.spd=c.spd; p.atk=c.atk;
  p.dmgM=1; p.critC=0.05; p.critD=1.8; p.fx={}; p.br=null;
  p.dr=0; p.ls=0; p.reg=0; p.mreg=0; p.rateM=1; p.rngM=1; p.projN=1;
  for(const id of p.nodes) applyFx(p,id);
  for(const id of p.nodes){ const m=META[id]; if(m&&m.br&&m.t===3) p.br=m.br; }
}
function buy(p,id){
  if(!canAlloc(p,id)) return false;
  p.pts-=META[id].cost; p.nodes.push(id); recompute(p); return true;
}
let fail=0;
const ok=(c,m)=>{ if(!c){ console.log('  ✗ '+m); fail++; } else console.log('  ✓ '+m); };

console.log('48 node, 3 class:');
ok(Object.keys(META).length===48, 'META có đúng 48 node');

console.log('\ngate theo cấp:');
let p=mk('sw'); p.pts=5;
ok(!buy(p,'sw_e'), 'cấp 1 không mua được node tier 1 (cần cấp 2)');
p.lv=2; ok(buy(p,'sw_e'), 'cấp 2 mua được sw_e');

console.log('\nnode phải theo thứ tự:');
ok(!buy(p,'sw_A_root'), 'chưa có p0+p1 thì không vào được nhánh');
buy(p,'sw_p0');
ok(!buy(p,'sw_A_root'), 'mới có p0, thiếu p1 -> vẫn chặn (mode all)');
buy(p,'sw_p1'); p.lv=3;
ok(buy(p,'sw_A_root'), 'đủ p0+p1 và cấp 3 -> vào nhánh A');
ok(p.br==='A', 'p.br = A sau khi chốt nhánh');

console.log('\nhai nhánh loại trừ nhau:');
ok(!canAlloc(p,'sw_B_root'), 'đã theo A thì không mở được B');
ok(!canAlloc(p,'sw_B_4a'), 'node con của nhánh B cũng bị khoá');

console.log('\nkeystone:');
p.lv=12; p.pts=9;
buy(p,'sw_A_4a'); buy(p,'sw_A_4b'); buy(p,'sw_A_5a'); buy(p,'sw_A_5b');
ok(META['sw_A_key'].cost===2, 'keystone giá 2 điểm');
p.pts=1; ok(!canAlloc(p,'sw_A_key'), '1 điểm không đủ mua keystone');
p.pts=2; ok(buy(p,'sw_A_key'), '2 điểm mua được keystone');
ok(p.fx.bulwark===1, 'Bất Hoại Thành đặt cờ bulwark');

console.log('\nkhông mua được node của class khác:');
ok(!canAlloc(p,'ar_root'), 'kiếm sĩ không đụng được node xạ thủ');

console.log('\nchỉ số cộng dồn đúng:');
let q=mk('ar'); q.lv=12; q.pts=20;
['ar_e','ar_p0','ar_p1','ar_A_root','ar_A_4a','ar_A_5a'].forEach(id=>buy(q,id));
ok(Math.abs(q.critC-(0.05+0.05+0.05+0.12))<1e-9, 'chí mạng cộng dồn: 5%+5%+5%+12% = 27% ('+(q.critC*100).toFixed(0)+'%)');
ok(Math.abs(q.critD-(1.8+0.45))<1e-9, 'sát thương chí mạng 1.8 -> 2.25 ('+q.critD+')');
ok(Math.abs(q.rngM-1.05)<1e-9, 'tầm +5%');

let r=mk('ar'); r.lv=12; r.pts=20;
['ar_e','ar_p0','ar_p1','ar_B_root','ar_B_4a','ar_B_5a'].forEach(id=>buy(r,id));
ok(r.br==='B', 'nhánh B của xạ thủ');
ok(r.fx.rcdCut===0.35, 'Nạp Nhanh giảm 35% hồi chiêu R');
ok(r.fx.heavyBolt===1, 'Bu-lông Nặng đặt cờ');

console.log('\nrecompute không cộng dồn lặp:');
let before=q.critC; recompute(q); recompute(q);
ok(Math.abs(q.critC-before)<1e-9, 'gọi recompute nhiều lần vẫn ra cùng chỉ số');

console.log(fail? '\n'+fail+' TEST HỎNG' : '\nTất cả test đạt');
process.exit(fail?1:0);
