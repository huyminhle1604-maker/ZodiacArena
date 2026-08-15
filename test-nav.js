/* Test tìm đường của bot — trích thẳng từ map1-server.js.
 * Chạy: node test-nav.js
 */
const fs=require('fs'),path=require('path'),vm=require('vm');
const SRC=fs.readFileSync(path.join(__dirname,'map1-server.js'),'utf8').replace(/\r\n/g,'\n');
const cut=(a,b)=>{const i=SRC.indexOf(a),j=SRC.indexOf(b,i);return SRC.slice(i,j);};
const core=[
  'const MW = 2400, MH = 1600;',
  cut('const WALLS = [','/* ============================ TIỆN ÍCH'),
  cut('function inWall(x, y, pad)','function ev(e)'),
  cut('const NAV_PAD = 26;','/* ============================ PHÒNG'),
].join('\n');
const T={};
vm.runInNewContext(core+'\nObject.assign(exports,{WALLS,inWall,losClear,NAVPTS,NAVLINK,findPath,MW,MH});',{exports:T,Math,Array,Infinity,console});
const {WALLS,inWall,losClear,NAVPTS,findPath,MW,MH}=T;

let fail=0; const ok=(c,m)=>{ if(!c){console.log('  ✗ '+m);fail++;} else console.log('  ✓ '+m); };
console.log('đồ thị tầm nhìn:');
ok(NAVPTS.length>0, NAVPTS.length+' nút góc tường');
ok(NAVPTS.every(q=>!inWall(q.x,q.y,16)), 'không nút nào nằm trong tường');

console.log('\nđường thẳng thông:');
let pth=findPath({x:100,y:100},{x:200,y:120});
ok(pth.length===1, 'thông thì trả về đúng 1 điểm (đích)');

console.log('\nđi vòng qua tường:');
/* tường {x:900,y:500,w:300,h:40} — đi từ trên xuống dưới xuyên qua nó */
const A={x:1050,y:440}, B={x:1050,y:600};
ok(!losClear(A.x,A.y,B.x,B.y), 'đường thẳng A->B bị tường chắn');
pth=findPath(A,B);
ok(pth.length>1, 'tìm được đường vòng ('+pth.length+' waypoint)');
let legsClear=true, cur=A;
for(const w of pth){ if(!losClear(cur.x,cur.y,w.x,w.y)) legsClear=false; cur=w; }
ok(legsClear, 'mọi chặng của đường đi đều không xuyên tường');

console.log('\nquét nhiều cặp điểm quanh tường:');
let tried=0, solved=0, bad=0;
const spots=[];
for(const w of WALLS){
  spots.push({x:w.x+w.w/2, y:w.y-45},{x:w.x+w.w/2, y:w.y+w.h+45},
             {x:w.x-45, y:w.y+w.h/2},{x:w.x+w.w+45, y:w.y+w.h/2});
}
for(let i=0;i<spots.length;i++) for(let j=i+1;j<spots.length;j++){
  const a=spots[i], b=spots[j];
  if(inWall(a.x,a.y,14)||inWall(b.x,b.y,14)) continue;
  if(a.x<40||a.y<40||a.x>MW-40||a.y>MH-40) continue;
  if(b.x<40||b.y<40||b.x>MW-40||b.y>MH-40) continue;
  if(losClear(a.x,a.y,b.x,b.y)) continue;
  tried++;
  const P=findPath(a,b);
  if(!P.length){ continue; }
  solved++;
  let c=a, okLegs=true;
  for(const w of P){ if(!losClear(c.x,c.y,w.x,w.y)) okLegs=false; c=w; }
  if(!okLegs) bad++;
}
ok(tried>0, tried+' cặp điểm bị tường chắn');
ok(solved/tried>0.95, 'tìm được đường cho '+solved+'/'+tried+' cặp ('+(100*solved/tried).toFixed(0)+'%)');
ok(bad===0, bad+' đường có chặng xuyên tường (phải là 0)');

console.log('\nhiệu năng:');
const t0=Date.now();
for(let k=0;k<300;k++) findPath({x:1050,y:440},{x:1050,y:600});
const ms=(Date.now()-t0)/300;
ok(ms<3, 'findPath khi bị chắn: '+ms.toFixed(2)+' ms/lần (6 bot × 2.5 lần/giây là thoải mái)');

console.log(fail? '\n'+fail+' TEST HỎNG':'\nTất cả test đạt');
process.exit(fail?1:0);
