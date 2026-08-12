/* ============================================================
   Zodiac Arena — bộ sprite "Hero's Quest" 3/4 top-down (vẽ bằng code)
   9 skin hero (3 nhánh nâng cấp / class) + 4 quái. Không import/export.

   <script src="sprites.js"></script>
   ZASprites.draw(ctx, { key:'knight_3a', x, y, state:'move',
                         t:performance.now(), stateT:120, scale:1, facing:1 });

   - x, y  : TÂM CHÂN nhân vật (đáy sprite), giống toạ độ server gửi về.
   - key   : xem ZASprites.keys / ZASprites.branches.
   - state : 'idle' | 'move' | 'attack' | 'hit' | 'die'
   - stateT: ms đã trôi trong state (bắt buộc cho attack/hit/die).
   - facing: 1 quay phải (mặc định), -1 lật ngang.
   - scale : 1 = sprite cao ~76px màn hình (grid mịn 2px/ô).
   ============================================================ */
(function(){
'use strict';
/* ===== Hero's Quest style builder — 32x32, 3/4 top-down ===== */
const R = 2, OFX = 4, OFY = 2, W = 46*R, H = 38*R;
const GEO = { headTop:3, headH:9, headW:10, shY:13, torsoTop:13, torsoH:8, hipY:21, feetY:29, armLen:8, armW:3, legW:4 };
const DURH = { attack:660, hit:520, die:1500 };

const VAR = [
  { id:'3a', cls:'knight', nm:'Kỵ Sĩ Bạch Kim', note:'giáp trắng viền vàng, đại thuẫn có huy hiệu, mũ trụ có mào',
    body:'plate', helm:'greathelm', crest:'plume', weapon:'sword', off:'tower', cape:true,
    pal:{A:'#e6eaf6',B:'#9aa4c2',C:'#5b6480',D:'#ffd76a',E:'#b0812c',F:'#4fc3f7',G:'#2b7fa8',S:'#f2c39a',K:'#c48f6a',H:'#2d2a3a',M:'#dfe6f5',N:'#7d879e',X:'#141a2c',Y:'#9fe6ff',Z:'#4a3f31',o:'#0a0c14'} },
  { id:'3b', cls:'knight', nm:'Kỵ Sĩ Thân Tín', note:'thép xám trơn, khiên diều, mũ kín mặt — bản gọn nhất, đọc rõ khi đông',
    body:'plate', helm:'visor', crest:'none', weapon:'sword', off:'kite', cape:false,
    pal:{A:'#c3cbdd',B:'#8e97b0',C:'#565e78',D:'#8fd3f5',E:'#3f6d8c',F:'#7f8aa8',G:'#4d5570',S:'#f2c39a',K:'#c48f6a',H:'#2d2a3a',M:'#e8eefb',N:'#767f97',X:'#101626',Y:'#8fd3f5',Z:'#3b3546',o:'#0a0c14'} },
  { id:'3c', cls:'knight', nm:'Kỵ Sĩ Huyết Thệ', note:'giáp tối, áo choàng đỏ, mũ sừng, búa chiến — dáng cho nhánh Cuồng Chiến',
    body:'plate', helm:'horned', crest:'none', weapon:'axe', off:'kite', cape:true,
    pal:{A:'#6d7286',B:'#4a4e5f',C:'#2c2f3c',D:'#ff8a72',E:'#9c3b31',F:'#c0392f',G:'#7a2320',S:'#e8b088',K:'#b07a55',H:'#221f2c',M:'#d9dcea',N:'#6b7488',X:'#0e1220',Y:'#ff5c6c',Z:'#3a2f2a',o:'#08090f'} },

  { id:'4a', cls:'archer', nm:'Xạ Thủ Hoa Hồng', note:'khăn đỏ bay, băng đô, cung dài thân xanh mũi vàng',
    body:'light', helm:'headband', crest:'none', weapon:'bow', off:'quiver', cape:'scarf',
    pal:{A:'#8e9aa8',B:'#5e6878',C:'#3a4250',D:'#ffd76a',E:'#b0812c',F:'#e0413a',G:'#8e2420',S:'#f2c39a',K:'#c48f6a',H:'#1f1c26',M:'#4aa06a',N:'#2c6742',X:'#141a2c',Y:'#ffd76a',Z:'#4a3f31',o:'#0a0c14'} },
  { id:'4b', cls:'archer', nm:'Thợ Săn Trùm Đầu', note:'áo choàng trùm đầu xanh rêu, bao mũi tên, chỉ thấy mắt sáng',
    body:'cloak', helm:'hood', crest:'none', weapon:'bow', off:'quiver', cape:true,
    pal:{A:'#4e7f57',B:'#33573b',C:'#1f3626',D:'#ffb74d',E:'#a8702a',F:'#6b8f5a',G:'#3f5c38',S:'#e8b088',K:'#a8734e',H:'#241f1a',M:'#8a6a3a',N:'#54402a',X:'#0d1a12',Y:'#ffe08a',Z:'#3b3026',o:'#080c0a'} },
  { id:'4c', cls:'archer', nm:'Nỏ Thủ Bịt Mặt', note:'hakama chàm, mặt bịt kín, hai nỏ tay — dáng cho nhánh Nỏ Thủ',
    body:'robe', helm:'mask', crest:'none', weapon:'crossbow', off:'crossbow', cape:'scarf',
    pal:{A:'#3f4a6b',B:'#2b3350',C:'#1a2036',D:'#ffb74d',E:'#a8702a',F:'#7d8aa8',G:'#4d5878',S:'#e8b088',K:'#a8734e',H:'#1a1a24',M:'#c9a97a',N:'#7a6142',X:'#0b0f1c',Y:'#8fd3f5',Z:'#2a2636',o:'#080a12'} },

  { id:'5a', cls:'monk', nm:'Tăng Nhân Khổ Hạnh', note:'cà sa xanh viền vàng, mặt nạ chàm, vòng nước quanh người',
    body:'robe', helm:'mask', crest:'none', weapon:'fist', off:'none', cape:false, aura:'water',
    pal:{A:'#5f8f5e',B:'#3f6741',C:'#28422b',D:'#ffd76a',E:'#b0812c',F:'#e8dcae',G:'#b3a173',S:'#f2c39a',K:'#c48f6a',H:'#2b2a34',M:'#7fd6e8',N:'#3f8fa8',X:'#122036',Y:'#9fe6ff',Z:'#4a3f31',o:'#0a0f12'} },
  { id:'5b', cls:'monk', nm:'Trưởng Lão Áo Đỏ', note:'cà sa đỏ, cổ lông trắng, tích trượng đầu vòng phát sáng',
    body:'robe', helm:'bald', crest:'none', weapon:'staff', off:'beads', cape:false, aura:'none',
    pal:{A:'#c0392f',B:'#8e2420',C:'#5c1614',D:'#ffd76a',E:'#b0812c',F:'#efe6d6',G:'#b8ab94',S:'#f2c39a',K:'#c48f6a',H:'#efe6d6',M:'#ffd76a',N:'#a8702a',X:'#1a1420',Y:'#ffe9a8',Z:'#4a3f31',o:'#12090a'} },
  { id:'5c', cls:'monk', nm:'Tăng Nhân Tịch Diệt', note:'cà sa tím trùm đầu, tràng hạt, ấn phù nổi trước mặt',
    body:'robe', helm:'hood', crest:'none', weapon:'fist', off:'beads', cape:true, aura:'sigil',
    pal:{A:'#6b4f96',B:'#4a3470',C:'#2c1f48',D:'#ba68c8',E:'#7a3d90',F:'#d9c8ef',G:'#9c86bf',S:'#e8c0a0',K:'#b58a68',H:'#241a34',M:'#c58cff',N:'#6b3f96',X:'#160f26',Y:'#e0b0ff',Z:'#332845',o:'#0b0714'} }
];

const MON = [
  { id:'M1', cls:'mon', mon:'slime', nm:'Slime Lam Ngọc', note:'khối keo trong, nhân sáng bên trong — phình dẹt khi nảy, tan chảy khi chết',
    pal:{A:'#4fa8d8',B:'#2f6f9c',C:'#1d4a6b',D:'#9fe6ff',M:'#d6f4ff',X:'#0d2438',Y:'#ffffff',o:'#08131f'} },
  { id:'M2', cls:'mon', mon:'runner', nm:'Sói Hoang Tốc Kích', note:'thú bốn chân gầy, bờm dựng, lao tới cắn — nhanh nhất trong bầy',
    pal:{A:'#8a6a4a',B:'#5e4630',C:'#3a2b1d',D:'#ffb74d',M:'#c9a97a',X:'#1a120c',Y:'#ff5c6c',o:'#0a0705'} },
  { id:'M3', cls:'mon', mon:'brute', nm:'Quỷ Chuỳ Đá', note:'thân to vai rộng, một sừng gãy, vác chuỳ đá — đập chậm mà nặng',
    pal:{A:'#6f8f5a',B:'#4c6a3c',C:'#2f4526',D:'#c9a97a',M:'#8d97ad',X:'#14200f',Y:'#ffd76a',o:'#070d05'} },
  { id:'M4', cls:'mon', mon:'caster', nm:'Oán Linh Trượng Phù', note:'áo choàng lơ lửng không chân, cầu phù chú trước ngực — bắn phép từ xa',
    pal:{A:'#6b4f96',B:'#4a3470',C:'#2c1f48',D:'#c58cff',M:'#e0b0ff',X:'#160f26',Y:'#efd9ff',o:'#0b0714'} }
];


function hx(c){ return [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)]; }
function mix(c1, c2, t){
  if(!c1 || c1.charAt(0) !== '#') return c1;
  const A = hx(c1), B = hx(c2);
  return 'rgb(' + Math.round(A[0]+(B[0]-A[0])*t) + ',' + Math.round(A[1]+(B[1]-A[1])*t) + ',' + Math.round(A[2]+(B[2]-A[2])*t) + ')';
}

function poseOf(st, u, t, v){
  const p = { dx:0, dy:0, lean:0, armF:0, armB:0, legF:0, legB:0, hem:0, alpha:1, flash:0, tint:null, rot:0, fx:null, ph:'idle', q:0 };
  const wp = v ? v.weapon : 'sword';
  const ranged = wp === 'bow' || wp === 'crossbow' || wp === 'staff';
  if(st === 'move'){
    const f = Math.floor(t/115) % 4, s = [3,0,-3,0][f];
    p.legF = s; p.legB = -s;
    p.armB = Math.round(s*0.6);
    if(!ranged) p.armF = -Math.round(s*0.6);
    p.dy = (f === 1 || f === 3) ? -1 : 0;
    p.lean = 1; p.hem = (f < 2 ? 1 : -1);
    p.fx = { kind:'dust', f:f };
    return p;
  }
  if(st === 'attack'){
    if(u < 0.34){ p.ph = 'wind'; p.q = u/0.34; }
    else if(u < 0.54){ p.ph = 'strike'; p.q = (u-0.34)/0.20; }
    else if(u < 0.82){ p.ph = 'rec'; p.q = (u-0.54)/0.28; }
    if(ranged){
      if(p.ph === 'wind'){ p.dx = -1; p.legB = -1; }
      else if(p.ph === 'strike'){ p.dx = 1; p.dy = -1; p.legF = 1; }
      else if(p.ph === 'rec'){ p.dx = 0; }
    } else {
      if(p.ph === 'wind'){ p.armF = -3; p.dx = -1; p.legB = -1; }
      else if(p.ph === 'strike'){ p.armF = 4; p.dx = 2; p.dy = -1; p.lean = 1; p.legF = 2; p.hem = -1; }
      else if(p.ph === 'rec'){ p.armF = 2; p.dx = 1; p.legF = 1; }
    }
    if(p.ph === 'strike' || p.ph === 'rec') p.fx = { kind:'swing', u: p.ph === 'strike' ? p.q : 1 };
    return p;
  }
  if(st === 'hit'){
    const e = 1 - u;
    p.dx = -Math.round(4*e*e);
    p.armF = -2; p.armB = 2; p.legB = -1; p.hem = 1;
    p.flash = u < 0.18 ? 1 : (u < 0.34 ? 0.45 : 0);
    p.tint = '#ff5c6c';
    p.alpha = (u > 0.34 && Math.floor(u*22)%2) ? 0.55 : 1;
    return p;
  }
  if(st === 'die'){
    if(u < 0.12){ p.flash = 1; p.dy = -1; p.armF = -3; p.armB = 3; return p; }
    const d = Math.min(1, (u-0.12)/0.5);
    p.rot = -1.5*d*d; p.armF = -4; p.armB = 4; p.legF = 3; p.legB = -2;
    p.tint = '#3f4560';
    p.alpha = u > 0.74 ? Math.max(0, 1-(u-0.74)/0.2) : 1;
    return p;
  }
  const ph = Math.floor(t/460) % 2;
  p.dy = ph ? -1 : 0; p.armF = ph ? 1 : 0; p.armB = ph ? -1 : 0;
  p.hem = ph ? 1 : 0;
  return p;
}

const ez = q => q*q*(3-2*q);

/* pose cho quái: nảy / lao / đập / co giật / tan */
function monPose(kind, st, u, t){
  const p = { dx:0, dy:0, sq:0, alpha:1, flash:0, tint:null, rot:0, fx:null, ph:'idle', q:0, extra:0 };
  if(st === 'idle'){
    const b = Math.sin(t/430);
    p.sq = b*0.5;
    p.dy = kind === 'caster' ? Math.round(Math.sin(t/620)*1.4) : (b > 0.55 ? -1 : 0);
    p.extra = Math.sin(t/700);
    return p;
  }
  if(st === 'move'){
    const f = Math.floor(t/110) % 4;
    if(kind === 'slime'){ p.sq = [1.6,-0.4,1.2,-0.6][f]; p.dy = [0,-3,-1,0][f]; }
    else if(kind === 'caster'){ p.dy = Math.round(Math.sin(t/300)*2) - 1; p.extra = 1; }
    else { p.dy = (f===1||f===3) ? -1 : 0; p.extra = [1,0,-1,0][f]; }
    p.fx = { kind:'dust', f:f };
    return p;
  }
  if(st === 'attack'){
    if(u < 0.34){ p.ph='wind'; p.q = u/0.34; }
    else if(u < 0.54){ p.ph='strike'; p.q = (u-0.34)/0.20; }
    else if(u < 0.82){ p.ph='rec'; p.q = (u-0.54)/0.28; }
    if(p.ph === 'wind'){ p.dx = -2*ez(p.q); p.sq = 2*ez(p.q); p.extra = -ez(p.q); }
    else if(p.ph === 'strike'){ p.dx = 4*ez(p.q); p.sq = -1.6; p.dy = kind==='runner' ? -2 : 0; p.extra = 1; }
    else if(p.ph === 'rec'){ p.dx = 2*(1-ez(p.q)); p.extra = 0.4; }
    if(p.ph === 'strike' || p.ph === 'rec') p.fx = { kind:'mon-'+kind, u: p.ph==='strike' ? p.q : 1 };
    return p;
  }
  if(st === 'hit'){
    const e = 1-u;
    p.dx = -Math.round(5*e*e); p.sq = 1.4*e;
    p.flash = u < 0.18 ? 1 : (u < 0.34 ? 0.45 : 0);
    p.tint = '#ff5c6c';
    p.alpha = (u > 0.34 && Math.floor(u*22)%2) ? 0.55 : 1;
    return p;
  }
  if(u < 0.12){ p.flash = 1; p.dy = -2; p.sq = -1; return p; }
  const d = Math.min(1, (u-0.12)/0.55);
  if(kind === 'slime'){ p.sq = 6*d; p.dy = Math.round(2*d); }
  else if(kind === 'caster'){ p.dy = Math.round(6*d); p.sq = 2*d; }
  else { p.rot = -1.4*d*d; p.sq = 1.5*d; }
  p.tint = '#3f4560';
  p.alpha = u > 0.7 ? Math.max(0, 1-(u-0.7)/0.24) : 1;
  return p;
}

/* hình học vũ khí theo pha đánh: góc kiếm/trượng, độ kéo dây cung, giật nỏ */
function weaponGeom(v, p, st){
  const g = { ang:-78, prev:-78, pull:0, pullC:0, orb:0.35, recoil:0, arrow:false };
  const wp = v.weapon;
  if(st === 'hit'){ g.ang = -48; g.prev = -48; return g; }
  if(st === 'die'){ g.ang = -14; g.prev = -14; return g; }
  if(wp === 'sword' || wp === 'axe'){
    const base = -78;
    if(p.ph === 'wind') g.ang = base - 88*ez(p.q);
    else if(p.ph === 'strike'){
      g.ang = -166 + 208*ez(p.q);
      g.prev = -166 + 208*ez(Math.max(0, p.q - 0.3));
    } else if(p.ph === 'rec') g.ang = 42 - 120*ez(p.q);
    else g.ang = base;
    if(p.ph !== 'strike') g.prev = g.ang;
    return g;
  }
  if(wp === 'staff'){
    const base = -86;
    if(p.ph === 'wind'){ g.ang = base - 32*ez(p.q); g.orb = 0.35 + 0.65*p.q; }
    else if(p.ph === 'strike'){ g.ang = -118 + 76*ez(p.q); g.orb = 1 - 0.5*p.q; }
    else if(p.ph === 'rec'){ g.ang = -42 - 44*ez(p.q); g.orb = 0.5 - 0.15*p.q; }
    else g.ang = base;
    g.prev = g.ang;
    return g;
  }
  if(wp === 'bow'){
    if(p.ph === 'wind') g.pull = 8*ez(p.q);
    else if(p.ph === 'strike') g.pull = 8*(1 - ez(Math.min(1, p.q*2.6)));
    g.arrow = p.ph === 'wind' || (p.ph === 'strike' && p.q < 0.25);
    g.pullC = Math.round(g.pull/R);
    return g;
  }
  if(wp === 'crossbow'){
    if(p.ph === 'wind') g.recoil = -2*ez(p.q);
    else if(p.ph === 'strike') g.recoil = 5*(1 - ez(p.q));
    g.arrow = p.ph === 'wind';
    return g;
  }
  return g;
}

function build(v, pz, st){
  const g = [];
  for(let y=0;y<H;y++) g.push(new Array(W).fill('.'));
  const setF = (x,y,ch) => { x=Math.round(x)+OFX*R; y=Math.round(y)+OFY*R; if(x>=0&&x<W&&y>=0&&y<H) g[y][x]=ch; };
  const rectF = (x,y,w,h,ch) => { for(let j=0;j<h;j++) for(let i=0;i<w;i++) setF(x+i,y+j,ch); };
  const set = (x,y,ch) => rectF(Math.round(x)*R, Math.round(y)*R, R, R, ch);
  const rect = (x,y,w,h,ch) => rectF(Math.round(x)*R, Math.round(y)*R, Math.round(w)*R, Math.round(h)*R, ch);
  const limb = (x0,y0,x1,y1,w,ch) => {
    const n = (Math.max(Math.abs(x1-x0), Math.abs(y1-y0)) + 1) * R;
    for(let i=0;i<n;i++){
      const q = n>1 ? i/(n-1) : 0;
      rectF(Math.round((x0+(x1-x0)*q - (w-1)/2)*R), Math.round((y0+(y1-y0)*q)*R), w*R, 1, ch);
    }
  };
  const disc = (cx,cy,rx,ry,ch) => {
    const fx = cx*R + R/2, fy = cy*R + R/2, fr = rx*R + R/2, fv = ry*R + R/2;
    for(let y=Math.floor(fy-fv); y<=Math.ceil(fy+fv); y++)
      for(let x=Math.floor(fx-fr); x<=Math.ceil(fx+fr); x++){
        const dx = (x+0.5-fx)/fr, dy = (y+0.5-fy)/fv;
        if(dx*dx + dy*dy <= 1) setF(x, y, ch);
      }
  };

  const lineF = (x0,y0,x1,y1,th,ch) => {
    const n = Math.ceil(Math.max(Math.abs(x1-x0), Math.abs(y1-y0))) + 1;
    for(let i=0;i<n;i++){
      const q = n>1 ? i/(n-1) : 0;
      rectF(Math.round(x0+(x1-x0)*q - (th-1)/2), Math.round(y0+(y1-y0)*q - (th-1)/2), th, th, ch);
    }
  };
  const wg = weaponGeom(v, pz, st);
  const cx = 16, G = GEO, robe = v.body === 'robe' || v.body === 'cloak';
  const shY = G.shY, hipY = G.hipY, feetY = G.feetY;
  const lean = pz.lean;

  /* áo choàng phía sau */
  if(v.cape === true){
    for(let j=0;j<hipY+5-shY;j++){
      const y = shY - 1 + j, w = Math.round(12 + j*0.55);
      if(y > feetY) break;
      rect(cx - Math.floor(w/2) + Math.round(pz.hem*0.6), y, w, 1, j % 3 === 2 ? 'G' : 'F');
    }
  }

  /* tay sau + chân sau */
  const shBx = cx - 6;
  const bowMode = v.weapon === 'bow';
  const bHandY = bowMode ? shY + 5 : shY + 1 + G.armLen;
  const bHandX = shBx - 1 + pz.armB + (bowMode ? 5 - wg.pullC : 0);
  limb(shBx, shY+1, bHandX, bHandY, G.armW, 'C');
  rect(bHandX - 1, bHandY, 3, 2, v.body === 'plate' ? 'B' : 'S');
  if(!robe){
    limb(cx - 3, hipY, cx - 3 + pz.legB, feetY, G.legW, 'C');
    rect(cx - 4 + pz.legB, feetY - 2, G.legW + 1, 3, 'Z');
  }

  /* thân */
  for(let j=0;j<G.torsoH;j++){
    const w = Math.round(16 - j*0.85);
    rect(cx - Math.floor(w/2) + (j < 3 ? lean : 0), G.torsoTop + j, w, 1, 'A');
    set(cx + Math.floor(w/2) - 1 + (j < 3 ? lean : 0), G.torsoTop + j, 'B');
  }
  if(v.body === 'plate'){
    rect(cx - 2, G.torsoTop + 1, 4, 5, 'F');
    rect(cx - 1, G.torsoTop + 2, 2, 2, 'D');
    disc(cx - 7 + lean, shY, 3, 2, 'B');
    disc(cx + 7 + lean, shY, 3, 2, 'B');
    rect(cx - 9 + lean, shY - 1, 5, 1, 'D');
    rect(cx + 5 + lean, shY - 1, 5, 1, 'D');
  }
  rect(cx - 6, hipY - 2, 12, 2, 'E');
  rect(cx - 1, hipY - 2, 3, 2, 'D');

  /* váy áo hoặc chân trước */
  if(robe){
    const hemTop = hipY - 1, hemBot = feetY - 3;
    rect(cx - 4 + pz.legB, feetY - 2, 4, 3, 'Z');
    rect(cx + 1 + pz.legF, feetY - 2, 4, 3, 'Z');
    for(let j=0;j<=hemBot-hemTop;j++){
      const y = hemTop + j, half = 4 + Math.round(j*0.34);
      const off = Math.round(pz.hem * (j/6));
      rect(cx - half + off, y, half*2 + 1, 1, j % 4 === 3 ? 'B' : 'A');
      if(j > 1 && j % 4 === 1) set(cx - half + off, y, 'D');
    }
    const bh = 4 + Math.round((hemBot-hemTop)*0.34);
    rect(cx - bh + Math.round(pz.hem*0.5), hemBot + 1, bh*2 + 1, 1, 'C');
    if(v.body === 'cloak'){
      for(let j=0;j<7;j++) rect(cx - 5, G.torsoTop + j, 10, 1, j % 3 === 2 ? 'B' : 'A');
      rect(cx - 6, G.torsoTop, 2, 6, 'B'); rect(cx + 4, G.torsoTop, 2, 6, 'B');
    }
  } else {
    const lfx = cx + 2;
    limb(lfx, hipY, lfx + pz.legF, feetY, G.legW, 'A');
    rect(lfx + pz.legF - 1, feetY - 2, G.legW + 1, 3, 'Z');
  }

  /* đầu */
  const hw = G.headW, hx0 = cx - Math.floor(hw/2) + lean, ht = G.headTop, hh = G.headH;
  for(let j=0;j<hh;j++){
    const inset = (j === 0 || j === hh-1) ? 2 : (j === 1 || j === hh-2 ? 1 : 0);
    rect(hx0 + inset, ht + j, hw - inset*2, 1, 'S');
  }
  rect(cx - 2 + lean, ht + hh, 4, 1, 'K');
  const ey = ht + Math.round(hh*0.55);

  if(v.helm === 'greathelm' || v.helm === 'visor' || v.helm === 'horned'){
    for(let j=0;j<hh;j++){
      const inset = (j === 0 || j === hh-1) ? 2 : (j === 1 || j === hh-2 ? 1 : 0);
      rect(hx0 + inset, ht + j, hw - inset*2, 1, j < 2 ? 'A' : (j > hh-3 ? 'C' : 'B'));
    }
    rect(hx0 + 1, ey, hw - 2, 2, 'X');
    rect(hx0 + 2, ey, 2, 1, 'M'); rect(hx0 + hw - 4, ey, 2, 1, 'M');
    rect(cx - 1 + lean, ht + 1, 2, hh - 3, 'A');
    if(v.helm === 'horned'){
      rect(hx0 - 2, ht + 1, 2, 1, 'M'); rect(hx0 - 3, ht + 2, 2, 2, 'M');
      rect(hx0 + hw, ht + 1, 2, 1, 'M'); rect(hx0 + hw + 1, ht + 2, 2, 2, 'M');
    }
    if(v.crest === 'plume'){
      rect(cx - 1 + lean, ht - 3, 2, 3, 'D');
      rect(cx - 2 + lean, ht - 2, 1, 2, 'E'); rect(cx + 1 + lean, ht - 2, 1, 2, 'E');
    }
  } else if(v.helm === 'hood'){
    for(let j=0;j<hh;j++){
      const inset = (j === 0 || j === hh-1) ? 2 : (j === 1 ? 1 : 0);
      rect(hx0 + inset - 1, ht + j, hw - inset*2 + 2, 1, j < 2 ? 'A' : 'B');
    }
    rect(hx0 + 1, ey - 2, hw - 2, 4, 'X');
    rect(hx0 + 2, ey + 1, hw - 4, 1, 'K');
    set(hx0 + 2, ey, 'Y'); set(hx0 + hw - 3, ey, 'Y');
    rect(hx0 - 1, ht + hh - 1, hw + 2, 2, 'C');
  } else if(v.helm === 'mask'){
    rect(hx0, ht, hw, 3, 'H');
    rect(hx0, ey - 1, hw, 3, 'X');
    set(hx0 + 2, ey, 'M'); set(hx0 + hw - 3, ey, 'M');
    rect(hx0 + 1, ht + 2, hw - 2, 1, 'D');
  } else if(v.helm === 'headband'){
    rect(hx0, ht, hw, 3, 'H');
    rect(hx0 - 1, ht + 2, hw + 2, 1, 'F');
    rect(hx0 - 2, ht + 3, 2, 4, 'F');
    set(hx0 + 2, ey, 'X'); set(hx0 + hw - 3, ey, 'X');
    rect(hx0 - 1, ht + 3, 2, 3, 'H'); rect(hx0 + hw - 1, ht + 3, 2, 3, 'H');
  } else {
    rect(hx0 + 1, ht, hw - 2, 1, 'K');
    set(hx0 + 2, ey, 'X'); set(hx0 + hw - 3, ey, 'X');
    rect(hx0 - 1, ht + hh - 2, hw + 2, 3, 'F');
    rect(hx0 + 1, ey + 2, hw - 2, 2, 'F');
  }
  if(v.cape === 'scarf'){
    rect(cx - 5 + lean, ht + hh, 10, 2, 'F');
    rect(cx - 9, ht + hh + 1, 5, 2, 'F');
    rect(cx - 11, ht + hh + 2, 3, 2, 'G');
  }

  /* tay trước + vũ khí */
  const shFx = cx + 6;
  const handX = shFx + pz.armF, handY = bowMode ? shY + 5 : shY + 1 + G.armLen;
  limb(shFx, shY + 1, handX, handY, G.armW, 'A');
  rect(handX - 1, handY, 3, 2, v.body === 'plate' ? 'A' : 'S');

  const hfx = (handX + 1)*R, hfy = (handY + 0.5)*R;
  const rad = wg.ang * Math.PI/180, ux = Math.cos(rad), uy = Math.sin(rad), px2 = -uy, py2 = ux;
  const P1 = (d,s) => [hfx + ux*d + px2*s, hfy + uy*d + py2*s];

  if(v.weapon === 'sword'){
    const a = P1(3,0), b = P1(24,0), c = P1(28,0);
    lineF(a[0], a[1], b[0], b[1], 3, 'M');
    lineF(b[0], b[1], c[0], c[1], 2, 'M');
    const gl = P1(4,-5), gr = P1(4,5);
    lineF(gl[0], gl[1], gr[0], gr[1], 2, 'D');
    const pm = P1(-3,0);
    rectF(Math.round(pm[0]-1), Math.round(pm[1]-1), 3, 3, 'E');
  } else if(v.weapon === 'axe'){
    const a = P1(-4,0), b = P1(22,0);
    lineF(a[0], a[1], b[0], b[1], 3, 'N');
    const hc = P1(20,0);
    for(let j=-6;j<=6;j++){
      const w = Math.round(7 - Math.abs(j)*0.7);
      const q = P1(20 - Math.abs(j)*0.35, j);
      lineF(q[0], q[1], q[0] + ux*w, q[1] + uy*w, 2, Math.abs(j) > 4 ? 'D' : 'M');
    }
    rectF(Math.round(hc[0]-1), Math.round(hc[1]-1), 2, 2, 'D');
  } else if(v.weapon === 'bow'){
    const bx = hfx + 4, by = hfy, span = 11*R;
    const tips = [];
    for(let i=-span;i<=span;i++){
      const q = Math.abs(i)/span;
      const dx = Math.round(3.6*R*(1 - q*q));
      rectF(bx + dx, by + i, R, 1, q > 0.84 ? 'D' : 'M');
      if(i === -span) tips.push([bx + dx, by + i]);
      if(i === span) tips.push([bx + dx, by + i]);
    }
    const nk = [bx - wg.pull - 1, by];
    lineF(tips[0][0], tips[0][1], nk[0], nk[1], 1, 'F');
    lineF(tips[1][0], tips[1][1], nk[0], nk[1], 1, 'F');
    if(wg.arrow){
      lineF(nk[0], by, bx + 6*R, by, 1, 'N');
      lineF(bx + 5*R, by, bx + 7*R, by, 2, 'D');
      setF(nk[0] + 1, by - 1, 'F'); setF(nk[0] + 1, by + 1, 'F');
    }
    rectF(bx - R, by - R, R*2, R*2, 'D');
  } else if(v.weapon === 'crossbow'){
    const ox = Math.round(wg.recoil);
    rectF(hfx - 2 - ox, hfy - 5*R, 5*R, 3, 'N');
    rectF(hfx - 4 - ox, hfy - 5*R - 3, 2*R, 3, 'M');
    rectF(hfx + 3*R - ox, hfy - 5*R - 3, 2*R, 3, 'M');
    rectF(hfx - 1 - ox, hfy - 5*R + 3, 3, 4*R, 'N');
    if(wg.arrow) lineF(hfx - 2 - ox, hfy - 5*R + 1, hfx + 5*R, hfy - 5*R + 1, 1, 'D');
  } else if(v.weapon === 'staff'){
    const a = P1(-7,0), b = P1(26,0);
    lineF(a[0], a[1], b[0], b[1], 3, 'N');
    const g1 = P1(6,0);
    rectF(Math.round(g1[0]-2), Math.round(g1[1]-2), 4, 4, 'D');
    const tip = P1(32,0);
    const rr = Math.round(3 + wg.orb*3);
    for(let y=-rr;y<=rr;y++) for(let x=-rr;x<=rr;x++)
      if(x*x + y*y <= rr*rr) setF(tip[0]+x, tip[1]+y, (x*x+y*y) <= (rr-1)*(rr-1) ? 'Y' : 'D');
  }

  /* tay phụ / đồ phụ */
  if(v.off === 'tower' || v.off === 'kite'){
    const sx = cx - 15, sy = shY - 3, sh = v.off === 'tower' ? 16 : 14;
    for(let j=0;j<sh;j++){
      let w = 8;
      if(v.off === 'kite' && j > sh - 6) w = 8 - (j - (sh - 6))*1.4;
      if(j === 0) w -= 2;
      w = Math.max(1, Math.round(w));
      rect(sx + Math.floor((8-w)/2) + Math.round(pz.armB*0.4), sy + j, w, 1, j % 7 === 3 ? 'B' : 'C');
    }
    rect(sx + 1 + Math.round(pz.armB*0.4), sy + 1, 6, 1, 'D');
    rect(sx + 3 + Math.round(pz.armB*0.4), sy + 3, 2, 7, 'D');
    rect(sx + 1 + Math.round(pz.armB*0.4), sy + 5, 6, 2, 'D');
  } else if(v.off === 'quiver'){
    rect(cx - 10, shY + 1, 4, 8, 'Z');
    rect(cx - 10, shY, 4, 1, 'N');
    for(let i=0;i<3;i++) rect(cx - 10 + i*1.4, shY - 3, 1, 3, 'D');
  } else if(v.off === 'beads'){
    const bx = shBx - 1 + pz.armB;
    for(let i=0;i<6;i++){
      const a = i*1.05;
      set(bx + Math.round(Math.cos(a)*3), handY - 2 + Math.round(Math.sin(a)*2), 'D');
    }
  } else if(v.off === 'crossbow'){
    const bx = shBx - 1 + pz.armB;
    rect(bx - 2, handY - 3, 5, 2, 'N');
    rect(bx - 4, handY - 5, 3, 1, 'M'); rect(bx + 2, handY - 5, 3, 1, 'M');
  }

  return g;
}

function buildMon(v, pz, st){
  const g = [];
  for(let y=0;y<H;y++) g.push(new Array(W).fill('.'));
  const setF = (x,y,ch) => { x=Math.round(x)+OFX*R; y=Math.round(y)+OFY*R; if(x>=0&&x<W&&y>=0&&y<H) g[y][x]=ch; };
  const rectF = (x,y,w,h,ch) => { for(let j=0;j<h;j++) for(let i=0;i<w;i++) setF(x+i,y+j,ch); };
  const rect = (x,y,w,h,ch) => rectF(Math.round(x)*R, Math.round(y)*R, Math.round(w)*R, Math.round(h)*R, ch);
  const set = (x,y,ch) => rect(x,y,1,1,ch);
  const el = (cx,cy,rx,ry,ch) => {
    const fx = cx*R, fy = cy*R, fr = Math.max(0.6, rx*R), fv = Math.max(0.6, ry*R);
    for(let y=Math.floor(fy-fv); y<=Math.ceil(fy+fv); y++)
      for(let x=Math.floor(fx-fr); x<=Math.ceil(fx+fr); x++){
        const dx = (x-fx)/fr, dy = (y-fy)/fv;
        if(dx*dx + dy*dy <= 1.02) setF(x, y, ch);
      }
  };
  const bar = (x0,y0,x1,y1,th,ch) => {
    const n = Math.ceil(Math.max(Math.abs(x1-x0), Math.abs(y1-y0))*R) + 1;
    for(let i=0;i<n;i++){
      const q = n>1 ? i/(n-1) : 0;
      el(x0+(x1-x0)*q, y0+(y1-y0)*q, th, th, ch);
    }
  };
  const cx = 16, feet = GEO.feetY, sq = pz.sq, e = pz.extra;

  if(v.mon === 'slime'){
    const rx = 9 + sq*0.9, ry = 7.5 - sq*0.9;
    el(cx, feet - ry, rx, ry, 'A');
    rect(cx - Math.round(rx) + 1, feet - 1, Math.round(rx)*2 - 1, 2, 'B');
    el(cx, feet - ry - 1, rx - 3, ry - 2.6, 'D');
    el(cx - 3, feet - ry - 3, 2.4, 1.6, 'M');
    el(cx - 3.4, feet - ry - 0.5, 1.6, 1.9, 'X');
    el(cx + 3.4, feet - ry - 0.5, 1.6, 1.9, 'X');
    set(cx - 4, feet - ry - 1, 'Y'); set(cx + 3, feet - ry - 1, 'Y');
    for(let i=0;i<3;i++) el(cx - 6 + i*5.5, feet - 1.5, 1.2 + (i%2)*0.5, 0.9, 'B');
    return g;
  }

  if(v.mon === 'runner'){
    const bodyY = feet - 9;
    bar(cx - 6, bodyY + 1, cx + 4, bodyY - 1 - e*0.6, 4.2, 'A');
    el(cx - 1, bodyY + 1, 6.5, 3.6, 'B');
    /* chân */
    const ph = e;
    bar(cx + 2, bodyY + 1, cx + 4 + ph*2, feet - 1, 1.5, 'C');
    bar(cx + 1, bodyY + 1, cx - 1 - ph*2, feet - 1, 1.5, 'B');
    bar(cx - 4, bodyY + 2, cx - 2 - ph*2, feet - 1, 1.5, 'C');
    bar(cx - 5, bodyY + 2, cx - 7 + ph*2, feet - 1, 1.5, 'B');
    rect(cx + 3 + ph*2, feet - 1, 3, 2, 'X'); rect(cx - 2 - ph*2, feet - 1, 3, 2, 'X');
    rect(cx - 3 - ph*2, feet - 1, 3, 2, 'X'); rect(cx - 8 + ph*2, feet - 1, 3, 2, 'X');
    /* đầu + bờm + đuôi */
    el(cx + 7, bodyY - 2, 4.4, 3.4, 'M');
    el(cx + 6, bodyY - 1, 3.4, 2.4, 'A');
    el(cx + 10.4, bodyY - 0.6, 2.8, 1.8, 'C');
    el(cx + 11.6, bodyY - 0.8, 1, 0.9, 'X');
    el(cx + 7.4, bodyY - 2.2, 1.3, 1.2, 'X');
    el(cx + 7.6, bodyY - 2.4, 0.6, 0.6, 'D');
    rect(cx + 5, bodyY - 6, 2, 3, 'D'); rect(cx + 8, bodyY - 6, 2, 3, 'D');
    set(cx + 5, bodyY - 6, 'C'); set(cx + 9, bodyY - 6, 'C');
    for(let i=0;i<5;i++) el(cx + 3 - i*1.8, bodyY - 4 + i*0.5, 1.4, 2 - i*0.2, 'M');
    bar(cx - 7, bodyY, cx - 12, bodyY - 4 - e*2, 1.6, 'M');
    return g;
  }

  if(v.mon === 'brute'){
    const hipY = feet - 9;
    bar(cx - 4, hipY, cx - 5, feet - 2, 3, 'B'); bar(cx + 3, hipY, cx + 4, feet - 2, 3, 'B');
    rect(cx - 8, feet - 2, 6, 3, 'X'); rect(cx + 2, feet - 2, 6, 3, 'X');
    el(cx, hipY - 5, 9.5 + sq*0.5, 7 - sq*0.4, 'A');
    el(cx, hipY - 2, 8, 3.6, 'B');
    el(cx, hipY - 8, 7, 3.4, 'A');
    /* đầu */
    const hy = hipY - 13;
    el(cx + 1, hy, 5, 4.4, 'A');
    el(cx - 1.6, hy + 0.6, 1.4, 1.6, 'X'); el(cx + 3.4, hy + 0.6, 1.4, 1.6, 'X');
    set(cx - 2, hy, 'Y'); set(cx + 3, hy, 'Y');
    rect(cx - 1, hy + 3, 4, 1, 'X');
    set(cx, hy + 2, 'M'); set(cx + 2, hy + 2, 'M');
    rect(cx + 5, hy - 4, 2, 3, 'D'); rect(cx - 4, hy - 3, 2, 2, 'D');
    /* tay + chuỳ */
    const hx1 = cx + 9 + e*3, hy1 = hipY - 7 - e*4;
    bar(cx + 7, hipY - 9, hx1, hy1, 2.6, 'A');
    bar(cx - 7, hipY - 9, cx - 10, hipY - 3, 2.6, 'B');
    el(cx - 10, hipY - 2, 2.4, 2.2, 'A');
    bar(hx1, hy1, hx1 + 3, hy1 - 6, 1.6, 'D');
    el(hx1 + 4, hy1 - 8, 4, 4, 'M');
    el(hx1 + 4, hy1 - 8, 2.2, 2.2, 'C');
    return g;
  }

  /* caster: oán linh lơ lửng */
  const top = feet - 22 + Math.round(sq*0.4);
  for(let j=0;j<16;j++){
    const q = j/15;
    const w = 4 + q*7 + Math.sin(q*6 + e*2)*0.7;
    el(cx, top + 3 + j, w, 1.1, j > 12 ? 'C' : (j % 4 === 3 ? 'B' : 'A'));
  }
  for(let i=0;i<4;i++){
    const q = i/3;
    bar(cx - 8 + i*5.4, feet - 6, cx - 9 + i*5.4 + Math.sin(e*3 + i)*2, feet - 1 + q*0.5, 1.4 - q*0.3, 'C');
  }
  el(cx, top + 2, 6.4, 5.4, 'A');
  el(cx, top + 3, 4.6, 3.6, 'X');
  el(cx - 2, top + 3, 1.2, 1.2, 'Y'); el(cx + 2, top + 3, 1.2, 1.2, 'Y');
  el(cx, top - 1.5, 5.2, 2.6, 'B');
  bar(cx - 6, top + 9, cx - 9 - e, top + 12, 1.6, 'B');
  bar(cx + 6, top + 9, cx + 9 + e, top + 12, 1.6, 'B');
  const orbR = 2.4 + (pz.ph === 'wind' ? pz.q*2 : (pz.ph === 'strike' ? 2 - pz.q*1.4 : 0.6));
  el(cx + 8 + e, top + 13, orbR, orbR, 'D');
  el(cx + 8 + e, top + 13, orbR - 1, orbR - 1, 'Y');
  return g;
}

/* bo góc bậc thang + viền mảnh + đổ khối 5 tông */
function refine(g){
  const solid = (x,y) => x>=0 && x<W && y>=0 && y<H && g[y][x] !== '.';
  const cut = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(!solid(x,y)) continue;
    const u = solid(x,y-1), d = solid(x,y+1), l = solid(x-1,y), r = solid(x+1,y);
    if((!u && !l && d && r) || (!u && !r && d && l) || (!d && !l && u && r) || (!d && !r && u && l)) cut.push([x,y]);
  }
  for(const c of cut) g[c[1]][c[0]] = '.';
  return g;
}

function paintHero(cv, v, scale, t, st, local){
  const w = W*scale, h = H*scale;
  if(cv.width !== w){ cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d');
  ctx.clearRect(0,0,w,h);
  const u = DURH[st] ? local/DURH[st] : 0;
  const isMon = !!v.mon;
  const pz = isMon ? monPose(v.mon, st, u, t) : poseOf(st, u, t, v);
  const wg = isMon ? null : weaponGeom(v, pz, st);
  const g = refine(isMon ? buildMon(v, pz, st) : build(v, pz, st));
  const P = v.pal;
  const SX = q => (q + OFX)*R*scale, SY = q => (q + OFY)*R*scale, S = q => q*R*scale;
  const midX = SX(16);

  ctx.save();
  ctx.globalAlpha = pz.alpha;

  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(midX, SY(GEO.feetY + 2), S(isMon ? (v.mon === 'runner' ? 9 : 8) : 6.5), S(1.8), 0, 0, 6.283);
  ctx.fill();

  if(v.aura && st !== 'die'){
    ctx.save();
    ctx.strokeStyle = P.Y; ctx.globalAlpha = 0.5 * pz.alpha;
    ctx.lineWidth = Math.max(2, scale*0.7);
    const a = t/420;
    if(v.aura === 'water'){
      ctx.beginPath(); ctx.ellipse(midX, SY(20), S(11), S(3.4), Math.sin(a)*0.25, 0, 6.283); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(midX, SY(13), S(8.5), S(2.6), -Math.sin(a)*0.25, 0, 6.283); ctx.stroke();
    } else {
      ctx.beginPath();
      for(let i=0;i<6;i++){
        const q = a*0.4 + i*1.047;
        const px = midX + Math.cos(q)*S(11), py = SY(16) + Math.sin(q)*S(4);
        i ? ctx.lineTo(px,py) : ctx.moveTo(px,py);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }

  ctx.translate(midX + S(pz.dx || 0), SY(GEO.feetY));
  if(pz.rot) ctx.rotate(pz.rot);
  ctx.translate(-midX, -SY(GEO.feetY));

  const solid = (x,y) => x>=0 && x<W && y>=0 && y<H && g[y][x] !== '.';
  const dy0 = pz.dy * R;
  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      const ch = g[y][x];
      let col;
      if(ch === '.'){
        if(solid(x,y-1) || solid(x,y+1) || solid(x-1,y) || solid(x+1,y)) col = P.o;
        else continue;
      } else {
        col = P[ch] || P.A;
        const u = solid(x,y-1), d = solid(x,y+1);
        let k = 0;
        if(!u) k += 0.30; else if(!solid(x,y-2)) k += 0.14;
        if(!d) k -= 0.32; else if(!solid(x,y+2)) k -= 0.15;
        if(!solid(x-1,y)) k += 0.10; else if(!solid(x-2,y)) k += 0.05;
        if(!solid(x+1,y)) k -= 0.10;
        if(k > 0) col = mix(col, '#ffffff', Math.min(0.42, k));
        else if(k < 0) col = mix(col, '#000000', Math.min(0.44, -k));
      }
      if(pz.tint) col = mix(col, pz.tint, 0.5);
      if(pz.flash) col = mix(col, '#ffffff', pz.flash);
      ctx.fillStyle = col;
      ctx.fillRect(x*scale, (y + dy0)*scale, scale, scale);
    }
  }

  if(pz.fx){
    const F = pz.fx;
    ctx.save();
    if(F.kind === 'dust'){
      ctx.fillStyle = 'rgba(200,208,236,0.32)';
      for(let i=0;i<(F.f%2?2:3);i++) ctx.fillRect(SX(9 - i*1.6), SY(GEO.feetY - (i%2)), scale, scale);
    } else if(isMon){
      ctx.globalAlpha = 0.85*(1 - F.u*0.5);
      if(v.mon === 'caster'){
        ctx.strokeStyle = P.D; ctx.lineWidth = Math.max(2, scale);
        ctx.beginPath(); ctx.arc(SX(26 + F.u*8), SY(GEO.feetY - 9), S(2.5 + F.u*3), 0, 6.283); ctx.stroke();
      } else if(v.mon === 'slime'){
        ctx.fillStyle = P.D;
        for(let i=0;i<4;i++) ctx.fillRect(SX(24 + i*2.4 + F.u*6), SY(GEO.feetY - 6 - (i%2)*3), scale*1.6, scale*1.6);
      } else {
        const a0 = (v.mon === 'runner' ? -50 : -70)*Math.PI/180, a1 = (v.mon === 'runner' ? 20 : 40)*Math.PI/180;
        ctx.strokeStyle = v.mon === 'runner' ? P.Y : '#ffffff';
        ctx.lineWidth = Math.max(2, scale*1.1);
        ctx.beginPath(); ctx.arc(SX(24), SY(GEO.feetY - 12), S(10), a0, a1); ctx.stroke();
        ctx.globalAlpha *= 0.4; ctx.lineWidth = Math.max(1, scale*0.6);
        ctx.beginPath(); ctx.arc(SX(24), SY(GEO.feetY - 12), S(7), a0, a1); ctx.stroke();
      }
    } else {
      const hcx = 16 + 6 + pz.armF + 1, hcy = (v.weapon === 'bow' ? GEO.shY + 5 : GEO.shY + 1 + GEO.armLen) + pz.dy;
      ctx.globalAlpha = 0.9 * (1 - F.u*0.55);
      if(v.weapon === 'sword' || v.weapon === 'axe' || v.weapon === 'fist'){
        const a0 = (v.weapon === 'fist' ? -60 : wg.prev) * Math.PI/180;
        const a1 = (v.weapon === 'fist' ? 30 : wg.ang) * Math.PI/180;
        ctx.strokeStyle = v.weapon === 'fist' ? P.Y : '#ffffff';
        ctx.lineWidth = Math.max(2, scale*1.1);
        ctx.beginPath(); ctx.arc(SX(hcx), SY(hcy), S(v.weapon === 'fist' ? 8 : 13), Math.min(a0,a1), Math.max(a0,a1)); ctx.stroke();
        ctx.globalAlpha *= 0.4;
        ctx.lineWidth = Math.max(1, scale*0.6);
        ctx.beginPath(); ctx.arc(SX(hcx), SY(hcy), S(v.weapon === 'fist' ? 6 : 10), Math.min(a0,a1), Math.max(a0,a1)); ctx.stroke();
      } else if(v.weapon === 'bow' || v.weapon === 'crossbow'){
        const ay = v.weapon === 'bow' ? hcy : hcy - 5;
        ctx.fillStyle = P.D;
        ctx.fillRect(SX(hcx + 6 + F.u*5), SY(ay) - scale, S(4), scale*2);
        ctx.globalAlpha *= 0.45;
        ctx.fillRect(SX(hcx + 2 + F.u*5), SY(ay), S(4), scale);
      } else {
        const rad = wg.ang * Math.PI/180;
        const tx = hcx + Math.cos(rad)*13, ty = hcy + Math.sin(rad)*13;
        ctx.strokeStyle = P.Y; ctx.lineWidth = Math.max(2, scale*0.8);
        ctx.beginPath(); ctx.arc(SX(tx + F.u*3), SY(ty), S(2.5 + F.u*2.5), 0, 6.283); ctx.stroke();
        ctx.globalAlpha *= 0.5;
        ctx.beginPath(); ctx.arc(SX(tx + F.u*3), SY(ty), S(1 + F.u*1.5), 0, 6.283); ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}
/* ==================== API ==================== */
const ALL = {};
for(const v of VAR) ALL[v.cls + '_' + v.id] = v;
for(const v of MON) ALL['mon_' + v.mon] = v;

const BRANCHES = {
  knight: [
    { key:'knight_3a', tier:1, nm:'Kỵ Sĩ Bạch Kim',  branch:'Vệ Binh' },
    { key:'knight_3b', tier:1, nm:'Kỵ Sĩ Thân Tín',  branch:'Tiêu Chuẩn' },
    { key:'knight_3c', tier:2, nm:'Kỵ Sĩ Huyết Thệ', branch:'Cuồng Chiến' }
  ],
  archer: [
    { key:'archer_4a', tier:1, nm:'Xạ Thủ Hoa Hồng',  branch:'Cung Thủ' },
    { key:'archer_4b', tier:2, nm:'Thợ Săn Trùm Đầu', branch:'Thợ Săn' },
    { key:'archer_4c', tier:2, nm:'Nỏ Thủ Bịt Mặt',   branch:'Nỏ Thủ' }
  ],
  monk: [
    { key:'monk_5a', tier:1, nm:'Tăng Nhân Khổ Hạnh',  branch:'Thuỷ Ấn' },
    { key:'monk_5b', tier:2, nm:'Trưởng Lão Áo Đỏ',    branch:'Tích Trượng' },
    { key:'monk_5c', tier:2, nm:'Tăng Nhân Tịch Diệt', branch:'Tịch Diệt' }
  ]
};

const CACHE = new Map();
const FRAME_MS = 60;

function frameKey(key, state, t, stateT, facing){
  const dur = DURH[state];
  const slot = dur ? Math.floor(Math.min(stateT, dur - 1) / FRAME_MS) : Math.floor((t % 1840) / FRAME_MS);
  return key + '|' + state + '|' + slot + '|' + (facing < 0 ? 'L' : 'R');
}

function render(v, state, t, stateT, facing){
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  paintHero(cv, v, 1, t, state, stateT);
  if(facing >= 0) return cv;
  const fl = document.createElement('canvas');
  fl.width = W; fl.height = H;
  const c = fl.getContext('2d');
  c.translate(W, 0); c.scale(-1, 1); c.drawImage(cv, 0, 0);
  return fl;
}

const ZASprites = {
  W: W, H: H,
  ANCHOR_X: (16 + OFX) * R,
  ANCHOR_Y: (GEO.feetY + OFY) * R,
  keys: Object.keys(ALL),
  branches: BRANCHES,
  info: function(key){
    const v = ALL[key];
    return v ? { key:key, nm:v.nm, cls:v.cls, note:v.note, weapon:v.weapon || null, mon:v.mon || null } : null;
  },
  skinFor: function(cls, branch){
    const list = BRANCHES[cls] || [];
    const hit = list.filter(function(b){ return b.branch === branch; })[0];
    return hit ? hit.key : (list[0] ? list[0].key : null);
  },
  draw: function(ctx, o){
    const v = ALL[o.key];
    if(!v) return;
    const state = o.state || 'idle';
    const t = o.t || 0;
    const dur = DURH[state];
    let stateT = o.stateT || 0;
    if(dur) stateT = state === 'die' ? Math.min(stateT, dur - 1) : stateT % dur;
    const facing = o.facing < 0 ? -1 : 1;
    const ck = frameKey(o.key, state, t, stateT, facing);
    let img = CACHE.get(ck);
    if(!img){
      img = render(v, state, t, stateT, facing);
      if(CACHE.size > 900) CACHE.clear();
      CACHE.set(ck, img);
    }
    const s = o.scale || 1;
    const ax = facing < 0 ? (W - ZASprites.ANCHOR_X) : ZASprites.ANCHOR_X;
    ctx.save();
    if(o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(o.x - ax*s), Math.round(o.y - ZASprites.ANCHOR_Y*s), W*s, H*s);
    ctx.restore();
  },
  sheet: function(key, state, cols){
    const dur = DURH[state] || 960;
    const n = Math.ceil(dur / FRAME_MS);
    const c = cols || n;
    const rows = Math.ceil(n / c);
    const cv = document.createElement('canvas');
    cv.width = W * c; cv.height = H * rows;
    const ctx = cv.getContext('2d');
    for(let i=0;i<n;i++){
      const f = render(ALL[key], state, i*FRAME_MS, i*FRAME_MS, 1);
      ctx.drawImage(f, (i % c) * W, Math.floor(i / c) * H);
    }
    return { url: cv.toDataURL('image/png'), frames: n, fw: W, fh: H, ms: FRAME_MS };
  }
};

window.ZASprites = ZASprites;
})();
