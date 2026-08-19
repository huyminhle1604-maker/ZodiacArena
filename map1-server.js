/* ============================================================
 * ZODIAC ARENA — PROTOTYPE MAP 1
 * ------------------------------------------------------------
 * Mục tiêu: chứng minh vòng lặp 10 phút của map 1 có vui không.
 *   farm quái -> xu -> rương -> blessing -> merchant -> world boss
 *   -> hết giờ -> mưa thiên thạch + 5 cổng -> thoát hoặc chết
 *
 * KHÔNG đụng gì tới server.js. Chạy song song ở cổng khác:
 *   node map1-server.js        ->  http://localhost:8081
 *   MATCH_TIME=120 node map1-server.js   (ván ngắn để test nhanh)
 *
 * Khác bản chính: map 2400x1600 có camera, 6 người, có dash (Shift),
 * blessing gắn slot. Cây kỹ năng và hệ nhánh tạm lược bỏ.
 * ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

/* Hai biến thể địa hình của map 1 — server bốc một cái mỗi ván.
 * Cùng API: ROWS (lưới 75x50 ô 32px), solid(), surfaceAt(), và toạ độ
 * boss / rương / bãi quái / merchant / cổng đã kiểm tra nằm trên sàn. */
const LAYOUTS = {
  crypt: require('./assets/map1-layout.js'),
  ruin: require('./assets/map1-ruin-layout.js')
};

const PORT = Number(process.env.PORT) || 8081;
const ROOT = __dirname;

const TICK = 1000 / 30;
const DT = 1 / 30;

const MW = 2400, MH = 1600;        // map 1 — rộng hơn màn hình, có camera
const MAXP = 6;
const BOTS = Number(process.env.BOTS ?? 5);          // bot lấp chỗ để test một mình
const MATCH_TIME = Number(process.env.MATCH_TIME || 600);   // 10 phút
const EXODUS_TIME = 30;            // 30 giây mở cổng + mưa thiên thạch
const BOSS_AT = Math.round(MATCH_TIME * 0.35);       // world boss xuất hiện
const MERCHANT_DELAY = 30;         // merchant chỉ xuất hiện sau 30 giây đầu ván
const MERCHANT_ROTATE = 120;       // đổi merchant đang mở mỗi 2 phút
const STOCK_N = 4;                 // mỗi lượt bày bán 4 món ngẫu nhiên
const RESPAWN = 8;
const CAMP_RESPAWN = 4;            // 4 giây một lượt hồi sinh quái
const CAMP_BURST = 3;              // mỗi lượt bù 3 con cho 3 bãi khác nhau
                                   // (~45 con/phút — đo thực tế: 6 người dọn
                                   //  hết 70 con trong ~6 phút nếu chậm hơn)
const CHEST_RESPAWN = 45;          // rương mở xong 45 giây thì đầy lại

/* ============================ CLASS ============================ */
/* Giữ nguyên số liệu của bản chính để cảm giác không lệch. */
const CLASSES = {
  sw: { nm: 'Kiếm sĩ', hp: 130, mp: 60, spd: 2.6, atk: 11, rng: 46, rate: 0.42, kind: 'melee' },
  ar: { nm: 'Xạ thủ', hp: 92, mp: 72, spd: 3.1, atk: 9, rng: 330, rate: 0.36, kind: 'bow' },
  mk: { nm: 'Nhà sư', hp: 100, mp: 115, spd: 2.8, atk: 8, rng: 260, rate: 0.48, kind: 'staff' }
};
const ESKILL = { sw: { nm: 'Chém Xoay', cost: 12, cd: 6 }, ar: { nm: 'Mũi Xuyên', cost: 14, cd: 5 }, mk: { nm: 'Sóng Âm', cost: 12, cd: 6 } };
const RSKILL = { sw: { nm: 'Khiên Thánh', cost: 20, cd: 12 }, ar: { nm: 'Mưa Tên', cost: 25, cd: 13 }, mk: { nm: 'Chữa Lành', cost: 25, cd: 10 } };

const DASH_DIST = 140, DASH_CD = 4, DASH_IFRAME = 0.15;

/* ============================ BLESSING ============================ */
/* 12 cung x 5 slot. Slot atk / pas / dash đã nối cơ chế đầy đủ.
 * Slot e / r ở prototype này chỉ áp phần tăng cường đơn giản (xem doSkill). */
const SIGNS = ['ari', 'tau', 'gem', 'can', 'leo', 'vir', 'lib', 'sco', 'sag', 'cap', 'aqu', 'pis'];
const SIGN_NM = {
  ari: 'Bạch Dương', tau: 'Kim Ngưu', gem: 'Song Tử', can: 'Cự Giải',
  leo: 'Sư Tử', vir: 'Xử Nữ', lib: 'Thiên Bình', sco: 'Bọ Cạp',
  sag: 'Nhân Mã', cap: 'Ma Kết', aqu: 'Bảo Bình', pis: 'Song Ngư'
};
const SIGN_THEME = {
  ari: 'Bùng nổ', tau: 'Kiên cố', gem: 'Nhân đôi', can: 'Vỏ giáp',
  leo: 'Uy vũ', vir: 'Chuẩn xác', lib: 'Cân bằng', sco: 'Nọc độc',
  sag: 'Viễn xạ', cap: 'Trường kỳ', aqu: 'Hỗn nguyên', pis: 'Thuỷ triều'
};
const SLOTS = ['atk', 'e', 'r', 'pas', 'dash'];
const SLOT_NM = { atk: 'Đánh thường', e: 'Kỹ năng E', r: 'Kỹ năng R', pas: 'Bị động', dash: 'Lướt' };

const BLESS = {
  ari: {
    atk: 'Đòn đầu vào mỗi mục tiêu mới gây nổ AoE nhỏ',
    e: 'E gây nổ lan, bán kính +50%',
    r: 'Giết địch bằng R → reset hồi chiêu R',
    pas: '5 giây đầu mỗi lần giao tranh +25% sát thương',
    dash: 'Kết thúc lướt gây nổ AoE tại điểm đến'
  },
  tau: {
    atk: 'Đứng yên khi đánh → tích Kiên Cố (tối đa 5 tầng)',
    e: 'E tạo sóng chấn đẩy lùi và làm chậm',
    r: 'Tiêu hết tầng Kiên Cố, mỗi tầng +10% sát thương R',
    pas: '−15% sát thương nhận; không bị đẩy lùi',
    dash: 'Húc văng địch, choáng 0.5s; đứng yên sau lướt +3 tầng'
  },
  gem: {
    atk: 'Mỗi đòn thứ 3 đánh 2 lần',
    e: 'E tung 2 lần, lần 2 sức mạnh 50%',
    r: 'R để lại ảnh phân thân, lặp lại R sau 2 giây',
    pas: 'Mở rương → hiện 2 lựa chọn để chọn lấy 1',
    dash: 'Lướt có 2 lượt tích, hồi chiêu dùng chung'
  },
  can: {
    atk: 'Hút máu 8%',
    e: 'E tạo khiên bằng 15% sát thương gây ra',
    r: 'Dưới 40% máu → R hồi máu thay vì tốn mana',
    pas: 'Hồi 2% máu mỗi 3 giây; máu thừa thành khiên (trần 40)',
    dash: 'Lướt xong nhận khiên 20 trong 3 giây'
  },
  leo: {
    atk: '+6% sát thương mỗi địch trong 200px (tối đa 5)',
    e: 'E tạo hào quang 4 giây — đồng đội +dmg, địch −thủ',
    r: 'R trúng càng nhiều mục tiêu càng mạnh (+20% mỗi mục tiêu)',
    pas: 'Đồng đội trong 300px → +8% sát thương, +8% tốc chạy',
    dash: 'Lướt xuyên địch; mỗi địch bị xuyên −15% thủ trong 4 giây'
  },
  vir: {
    atk: 'Chí mạng trả lại 10 mana',
    e: 'Chuỗi không trượt → E +10% sát thương mỗi tầng (tối đa 5)',
    r: 'R luôn chí mạng nhưng hồi chiêu +30%',
    pas: 'Thấy máu và blessing của địch; rương hiện trên minimap',
    dash: 'Đòn đầu trong 2 giây sau khi lướt luôn chí mạng'
  },
  lib: {
    atk: 'Sát thương gây ra chia đôi thành hồi máu và hồi mana',
    e: 'HP% xấp xỉ MP% → E +30% sát thương',
    r: 'R kéo HP và MP về cùng tỉ lệ',
    pas: 'Chênh HP%/MP% dưới 15% → +20% dmg, −20% dmg nhận',
    dash: 'Hồi 3% HP + 3% MP; đang cân bằng → hồi chiêu giảm nửa'
  },
  sco: {
    atk: 'Chí mạng gieo độc, cộng dồn tối đa 5 tầng',
    e: 'E để lại vũng độc tồn tại 5 giây',
    r: 'Mục tiêu chết vì độc phát nổ, lan độc trong 150px',
    pas: 'Miễn nhiễm độc; địch dính độc gần nhau tự lây',
    dash: 'Lướt để lại vệt độc 4 giây, chạm vào dính 2 tầng'
  },
  sag: {
    atk: 'Xa hơn 400px → xuyên mục tiêu, không giảm sát thương',
    e: 'E tầm xa +50%, càng xa càng mạnh',
    r: 'R bắn thêm 2 mũi lệch góc',
    pas: '+15% tốc chạy; tầm nhìn minimap +50%',
    dash: 'Lướt xa hơn 50%; lướt ra xa địch → đòn kế +30% dmg'
  },
  cap: {
    atk: 'Mỗi 20 giây không giao tranh +10% dmg đòn thường (tối đa +30%)',
    e: 'Mỗi lần dùng, E rẻ đi 5% mana (tối đa −50%)',
    r: 'R để dành càng lâu càng mạnh: +5%/10s, tới 50 giây',
    pas: 'Mỗi 30 giây sống sót +3% mọi chỉ số (tối đa 10 tầng)',
    dash: 'Không lướt 5 giây → lướt kế miễn hồi chiêu và gây sát thương'
  },
  aqu: {
    atk: '12% mỗi đòn kích hoạt hiệu ứng ngẫu nhiên của cung khác',
    e: 'E mang hiệu ứng một cung ngẫu nhiên',
    r: 'R sao chép blessing slot R của địch gần nhất',
    pas: 'Mở rương → hiệu ứng ngẫu nhiên 60 giây; rương +1 token',
    dash: 'Xa hơn 50% nhưng lệch ±30%; 25% không tính hồi chiêu'
  },
  pis: {
    atk: 'Đòn thường tốn 3 mana nhưng +40% sát thương',
    e: 'Mana trên 80% → E miễn phí',
    r: 'Dưới 30% mana → R miễn phí và hồi lại 30% mana',
    pas: 'Mana tối đa ×1.5; ngoài giao tranh hồi mana gấp 3',
    dash: 'Bỏ hồi chiêu, đổi thành tốn 10 mana mỗi lần lướt'
  }
};

/* Bộ Hợp Cung — mở khi đủ 5 slot cùng cung */
const COMBO_NM = {
  ari: 'Chiến Thần', tau: 'Sơn Nhạc', gem: 'Song Sinh', can: 'Giáp Triều',
  leo: 'Bá Vương', vir: 'Vô Khuyết', lib: 'Lưỡng Nghi', sco: 'Vạn Độc',
  sag: 'Thiên Cung', cap: 'Bất Diệt', aqu: 'Vạn Biến', pis: 'Vô Tận'
};


/* ============================ CÂY KỸ NĂNG ============================ */
/* Port từ arena cũ (server.js): 16 node / class × 3 class = 48 node.
 * Ba chỗ buộc phải khác bản cũ vì map 1 có sẵn E/R từ cấp 1 và blessing
 * slot e/r phụ thuộc vào chúng:
 *   1. Node `_e` KHÔNG mở khoá E nữa (E đã có sẵn) mà nâng E lên +25%.
 *   2. Nhánh A giữ nguyên R hiện tại; nhánh B ĐỔI R sang chiêu của nhánh B
 *      (Cuồng Nộ / Nỏ Liên Thanh / Lời Nguyền) đúng nội dung bản cũ.
 *   3. Node hồi sinh của Nhà sư tác động lên RESPAWN của map 1.
 * Chọn nhánh cũng đặt p.br -> client đổi luôn skin sprite theo nhánh. */
const MINLV = { 0: 1, 1: 2, 2: 2, 3: 3, 4: 5, 5: 8, 6: 12 };

function buildMeta() {
  const M = {};
  for (const cls of Object.keys(CLASSES)) {
    const k = (s) => cls + '_' + s;
    M[k('root')] = { t: 0, cost: 0, req: [], mode: 'all', br: null };
    M[k('e')] = { t: 1, cost: 1, req: [k('root')], mode: 'all', br: null };
    M[k('p0')] = { t: 2, cost: 1, req: [k('e')], mode: 'all', br: null };
    M[k('p1')] = { t: 2, cost: 1, req: [k('e')], mode: 'all', br: null };
    for (const br of ['A', 'B']) {
      const b = (s) => k(br + '_' + s);
      M[b('root')] = { t: 3, cost: 1, req: [k('p0'), k('p1')], mode: 'any', br };
      M[b('4a')] = { t: 4, cost: 1, req: [b('root')], mode: 'all', br };
      M[b('4b')] = { t: 4, cost: 1, req: [b('root')], mode: 'all', br };
      M[b('5a')] = { t: 5, cost: 1, req: [b('4a')], mode: 'all', br };
      M[b('5b')] = { t: 5, cost: 1, req: [b('4b')], mode: 'all', br };
      M[b('key')] = { t: 6, cost: 2, req: [b('5a'), b('5b')], mode: 'any', br };
    }
  }
  return M;
}
const META = buildMeta();

/* Node chỉ đặt cờ / cộng chỉ số. Cơ chế runtime hook trong dmgTo,
 * attack, doE, doR, stepPlayer, onPlayerDown. */
function applyFx(p, id) {
  const f = p.fx;
  switch (id) {
    /* ---------- KIẾM SĨ ---------- */
    case 'sw_root': p.mhp += 14; p.atk += 1; break;
    case 'sw_e': f.ePow = (f.ePow || 1) + 0.25; break;
    case 'sw_p0': p.dr += 0.08; break;
    case 'sw_p1': p.reg += 0.7; break;
    case 'sw_A_root': p.mhp += 22; p.dr += 0.04; break;
    case 'sw_A_4a': p.dr += 0.10; p.spd -= 0.15; break;
    case 'sw_A_4b': f.tauntPlus = 1; f.shieldPlus = 15; break;
    case 'sw_A_5a': f.reflect = 0.25; break;
    case 'sw_A_5b': f.guard = 0.25; break;
    case 'sw_A_key': f.bulwark = 1; break;
    case 'sw_B_root': p.atk += 6; p.spd += 0.1; break;
    case 'sw_B_4a': p.ls += 0.08; break;
    case 'sw_B_4b': p.dmgM += 0.20; p.rateM *= 1.15; break;
    case 'sw_B_5a': f.rage = 0.25; break;
    case 'sw_B_5b': f.whirl2 = 1; break;
    case 'sw_B_key': f.lastStand = 1; break;

    /* ---------- XẠ THỦ ---------- */
    case 'ar_root': p.atk += 1; p.critC += 0.05; break;
    case 'ar_e': f.ePow = (f.ePow || 1) + 0.25; break;
    case 'ar_p0': p.spd += 0.35; break;
    case 'ar_p1': p.rateM *= 0.88; break;
    case 'ar_A_root': p.critC += 0.05; p.rngM += 0.05; break;
    case 'ar_A_4a': p.critC += 0.12; break;
    case 'ar_A_4b': p.rngM += 0.25; f.farDmg = 1; break;
    case 'ar_A_5a': p.critD += 0.45; break;
    case 'ar_A_5b': p.projN = 3; f.spreadPen = 0.6; break;
    case 'ar_A_key': f.hunter = 1; break;
    case 'ar_B_root': p.atk += 7; p.rateM *= 1.18; break;
    case 'ar_B_4a': f.heavyBolt = 1; p.dmgM += 0.25; break;
    case 'ar_B_4b': f.armorPen = 0.5; f.vulnOnHit = 1; break;
    case 'ar_B_5a': f.rcdCut = 0.35; break;
    case 'ar_B_5b': f.trapBoom = 1; break;
    case 'ar_B_key': f.deathShot = 1; break;

    /* ---------- NHÀ SƯ ---------- */
    case 'mk_root': p.mmp += 18; p.mreg += 0.5; break;
    case 'mk_e': f.ePow = (f.ePow || 1) + 0.25; break;
    case 'mk_p0': p.mreg += 1.0; break;
    case 'mk_p1': p.dmgM += 0.10; break;
    case 'mk_A_root': p.mhp += 12; break;
    case 'mk_A_4a': f.healM = (f.healM || 1) + 0.2; f.fastRes = 1; break;
    case 'mk_A_4b': f.healShield = 20; break;
    case 'mk_A_5a': f.auraHeal = 0.8; break;
    case 'mk_A_5b': f.resurrect = 1; break;
    case 'mk_A_key': f.fountain = 1; break;
    case 'mk_B_root': p.atk += 2; p.mreg += 0.4; break;
    case 'mk_B_4a': f.weaken = 0.12; break;
    case 'mk_B_4b': f.mark = 0.15; break;
    case 'mk_B_5a': f.burn = 1; break;
    case 'mk_B_5b': p.ls += 0.12; f.soulDrain = 1; break;
    case 'mk_B_key': f.judgement = 1; break;
  }
}

function canAlloc(p, id) {
  const m = META[id];
  if (!m) return false;
  if (!id.startsWith(p.cls + '_')) return false;
  if (p.nodes.includes(id)) return false;
  if (p.pts < m.cost) return false;
  if (p.lv < MINLV[m.t]) return false;
  if (m.br) {
    const other = m.br === 'A' ? 'B' : 'A';
    if (p.br === other) return false;                 // hai nhánh loại trừ nhau
  }
  if (m.req.length) {
    const ok = m.mode === 'any'
      ? m.req.some(r => p.nodes.includes(r))
      : m.req.every(r => p.nodes.includes(r));
    if (!ok) return false;
  }
  return true;
}


/* ============================ SẢNH ============================ */
/* Sảnh là một MAP đi lại được, KHÔNG có chiến đấu: không quái, không đạn,
 * không đánh thường, không kỹ năng, không lướt. Chỉ có 3 NPC và 1 cổng —
 * đúng phần mô tả trong game_idea.txt. */
const LOBBY = {
  W: 1200, H: 820,
  spawn: { x: 600, y: 690 },
  walls: [
    { x: 0, y: 0, w: 1200, h: 24 }, { x: 0, y: 796, w: 1200, h: 24 },
    { x: 0, y: 0, w: 24, h: 820 }, { x: 1176, y: 0, w: 24, h: 820 },
    /* hai bệ đá hai bên cổng */
    { x: 300, y: 200, w: 40, h: 130 }, { x: 860, y: 200, w: 40, h: 130 }
  ],
  /* Chọn cung KHÔNG có NPC riêng — bước vào cổng là hiện bảng chọn luôn,
     vì đó là lúc người chơi thực sự cần quyết định. */
  npcs: [
    { id: 'class', x: 380, y: 430, nm: 'Giáo Trưởng', role: 'Đổi class', g: '⚔' },
    { id: 'shop', x: 820, y: 430, nm: 'Thợ Rèn', role: 'Cửa hàng vũ khí', g: '🔨' }
  ],
  gate: { x: 600, y: 300, r: 58 }
};
const NPC_R = 62;          // khoảng cách bấm F được

/* Vũ khí mua bằng token — meta, giữ qua các ván. Mỗi class một dòng riêng. */
const WEAPONS = [
  { id: 'w_sw1', cls: 'sw', nm: 'Trường Kiếm Thép', d: '+3 sát thương', cost: 4, atk: 3 },
  { id: 'w_sw2', cls: 'sw', nm: 'Đại Kiếm Hắc Diện', d: '+7 sát thương, +10 HP', cost: 12, atk: 7, hp: 10 },
  { id: 'w_ar1', cls: 'ar', nm: 'Cung Gỗ Thuỷ Tùng', d: '+3 sát thương', cost: 4, atk: 3 },
  { id: 'w_ar2', cls: 'ar', nm: 'Cung Sừng Bạc', d: '+6 sát thương, +4% chí mạng', cost: 12, atk: 6, crit: 0.04 },
  { id: 'w_mk1', cls: 'mk', nm: 'Tích Trượng Đồng', d: '+3 sát thương', cost: 4, atk: 3 },
  { id: 'w_mk2', cls: 'mk', nm: 'Tích Trượng Ngọc', d: '+5 sát thương, +15 mana', cost: 12, atk: 5, mp: 15 }
];
const WEAPON_BY_ID = {};
for (const w of WEAPONS) WEAPON_BY_ID[w.id] = w;

function inLobbyWall(x, y, pad) {
  pad = pad || 0;
  for (const w of LOBBY.walls) {
    if (x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad) return true;
  }
  return false;
}

/* Đưa người chơi về sảnh — gọi khi vừa vào và sau mỗi ván. */
function toLobby(p) {
  p.x = LOBBY.spawn.x + rnd(-70, 70);
  p.y = LOBBY.spawn.y + rnd(-40, 40);
  p.ready = false; p.alive = true; p.escaped = false;
  p.hp = p.mhp; p.mp = p.mmp; p.shield = 0;
  p.nearNpc = null; p.atGate = false;
  p.in = { up: 0, dn: 0, lf: 0, rt: 0, aim: 0, fire: 0, use: 0 };
}

function stepLobby() {
  const R = ROOM;
  for (const p of R.players) {
    if (p.bot) continue;                     // bot không hiện ở sảnh
    const mx = p.in.rt - p.in.lf, my = p.in.dn - p.in.up;
    if (mx || my) {
      const l = Math.hypot(mx, my) || 1;
      const sp = 3.2;
      const nx = clamp(p.x + (mx / l) * sp * 2, 16, LOBBY.W - 16);
      const ny = clamp(p.y + (my / l) * sp * 2, 16, LOBBY.H - 16);
      if (!inLobbyWall(nx, p.y, 12)) p.x = nx;
      if (!inLobbyWall(p.x, ny, 12)) p.y = ny;
    }
    p.aim = p.in.aim;

    let near = null, nd = NPC_R;
    for (const n of LOBBY.npcs) { const d = dist(n, p); if (d < nd) { nd = d; near = n.id; } }
    p.nearNpc = near;
    p.atGate = dist(LOBBY.gate, p) < LOBBY.gate.r;
  }

  const humans = R.players.filter(p => !p.bot);
  if (humans.length && humans.every(p => p.ready)) startMatch();
}

/* Áp vũ khí đã mua vào chỉ số — gọi trong recompute. */
function applyWeapon(p) {
  const w = WEAPON_BY_ID[p.weapon];
  if (!w || w.cls !== p.cls) return;
  p.atk += w.atk || 0;
  p.mhp += w.hp || 0;
  p.mmp += w.mp || 0;
  p.critC += w.crit || 0;
}

/* ============================ QUÁI ============================ */
const ETYPES = {
  slime: { hp: 34, spd: 1.05, dmg: 7, r: 13, xp: 6, coin: 2, big: false },
  runner: { hp: 22, spd: 2.0, dmg: 5, r: 10, xp: 7, coin: 2, big: false },
  brute: { hp: 95, spd: 0.7, dmg: 15, r: 19, xp: 18, coin: 7, big: true },
  caster: { hp: 40, spd: 0.9, dmg: 9, r: 12, xp: 13, coin: 4, big: false, ranged: true },
  boss: { hp: 1400, spd: 0.55, dmg: 26, r: 34, xp: 160, coin: 90, big: true }
};

/* Buff hoàng đạo cho quái — chỉ 5 loại, dễ nhận diện bằng hình ảnh */
const MBUFFS = ['ari', 'tau', 'gem', 'sco', 'pis'];

/* ============================ BỐ CỤC MAP ============================ */
/* Địa hình KHÔNG còn là danh sách tường rời — mỗi ván server bốc một trong
 * hai biến thể trong assets/ và lấy luôn lưới va chạm + mọi toạ độ đặt vật thể
 * của biến thể đó. Bốc ở server chứ không ở client, nếu không 6 người sẽ thấy
 * 6 map khác nhau. */
let MAP = LAYOUTS.ruin;            // biến thể đang chạy, đặt lại ở resetWorld()
let CAMPS = [];                    // {x,y,r,ty,n}
let CHEST_SPOTS = [];              // {x,y}
let MERCHANTS = [];                // {x,y}
let GATE_SPOTS = [];               // {x,y} — cổng thoát lúc di tản
let SPAWNS = [];                   // {x,y} — chỗ đứng đầu ván, rải đều
let BOSS_POS = { x: 1200, y: 800 };

/* File layout chỉ cho toạ độ và bán kính bãi quái, không nói loại quái.
 * Bảng này rải loại theo thứ tự bãi để mỗi map vẫn đủ 4 loại xen kẽ —
 * tổng ~70-77 con, đúng mật độ của bản cũ. */
const CAMP_MIX = [
  { ty: 'slime', n: 7 }, { ty: 'runner', n: 7 }, { ty: 'caster', n: 5 }, { ty: 'brute', n: 4 },
  { ty: 'slime', n: 8 }, { ty: 'runner', n: 6 }, { ty: 'caster', n: 5 }, { ty: 'brute', n: 5 },
  { ty: 'slime', n: 6 }, { ty: 'runner', n: 8 }, { ty: 'caster', n: 5 }, { ty: 'brute', n: 4 },
  { ty: 'slime', n: 7 }
];

/* Áp một biến thể vào các bảng ở trên. Gọi trong resetWorld(), trước khi
 * dựng lại rương / quái / merchant. */
function applyLayout(key) {
  MAP = LAYOUTS[key] || LAYOUTS.ruin;
  const L = MAP;
  BOSS_POS = { x: L.BOSS_POS[0], y: L.BOSS_POS[1] };
  CHEST_SPOTS = L.CHEST_SPOTS.map(s => ({ x: s[0], y: s[1] }));
  MERCHANTS = L.MERCHANTS.map(s => ({ x: s[0], y: s[1] }));
  GATE_SPOTS = L.GATES.map(s => ({ x: s[0], y: s[1] }));
  CAMPS = L.CAMPS.map((c, i) => {
    const m = CAMP_MIX[i % CAMP_MIX.length];
    return { x: c.x, y: c.y, r: c.r, ty: m.ty, n: m.n };
  });
  buildNav();
  SPAWNS = pickSpawns();
}

/* ============================ TIỆN ÍCH ============================ */
let UID = 1;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

/* Va chạm: tra lưới 32px của biến thể đang chạy. `pad` là bán kính thân —
 * lấy mẫu 9 điểm (tâm, 4 cạnh, 4 góc) của hộp bao. Phải có cả 4 điểm giữa
 * cạnh: chỉ lấy 4 góc thì một ô cản nằm thẳng ngay bên phải sẽ lọt qua khe
 * giữa hai góc. Ngoài rìa bản đồ tính là đặc (lưới có viền '#'). */
function inWall(x, y, pad) {
  const L = MAP;
  if (L.solid(x, y)) return true;
  if (!pad) return false;
  return L.solid(x - pad, y) || L.solid(x + pad, y) ||
         L.solid(x, y - pad) || L.solid(x, y + pad) ||
         L.solid(x - pad, y - pad) || L.solid(x + pad, y - pad) ||
         L.solid(x - pad, y + pad) || L.solid(x + pad, y + pad);
}

function ev(e) { if (ROOM.ev.length < 200) ROOM.ev.push(e); }

/* Mô tả địa hình gửi cho client để dựng lớp nền. Chỉ gửi khi vào phòng và khi
 * bốc lại biến thể — ~4KB, không nằm trong gói state mỗi tick. */
function mapPacket() {
  return {
    t: 'map', skin: MAP.key, cell: MAP.CELL, rows: MAP.ROWS,
    boss: [BOSS_POS.x, BOSS_POS.y],
    camps: CAMPS.map(c => [c.x, c.y, c.r]),
    chests: CHEST_SPOTS.map(c => [c.x, c.y]),
    merchants: MERCHANTS.map(m => [m.x, m.y]),
    gates: GATE_SPOTS.map(g => [g.x, g.y])
  };
}

/* Phát địa hình mới cho mọi người đang trong phòng. */
function broadcastMap() {
  const s = JSON.stringify(mapPacket());
  for (const p of ROOM.players) if (!p.bot && p.ws) send(p.ws, s);
}

/* ============================ TÌM ĐƯỜNG CHO BOT ============================ */
/* Địa hình giờ là lưới 75x50 chứ không phải vài hình chữ nhật, nên đồ thị tầm
 * nhìn theo góc tường không còn dùng được. Thay bằng A* trên chính lưới đó
 * (3750 ô — quét hết cũng chỉ tốn vài chục micro giây), rồi rút gọn đường bằng
 * kiểm tra tầm nhìn để bot đi theo đường chéo mượt thay vì bò từng ô. */
const NAV_PAD = 14;                 // bán kính thân bot khi xét ô đi được

let NAV_OK = null;                  // Uint8Array: 1 = ô đi được (đã trừ NAV_PAD)
let NAV_W = 0, NAV_H = 0, NAV_CELL = 32;

function buildNav() {
  const L = MAP;
  NAV_W = L.GW; NAV_H = L.GH; NAV_CELL = L.CELL;
  NAV_OK = new Uint8Array(NAV_W * NAV_H);
  for (let gy = 0; gy < NAV_H; gy++) {
    for (let gx = 0; gx < NAV_W; gx++) {
      const cx = gx * NAV_CELL + NAV_CELL / 2, cy = gy * NAV_CELL + NAV_CELL / 2;
      NAV_OK[gy * NAV_W + gx] = inWall(cx, cy, NAV_PAD) ? 0 : 1;
    }
  }
}

/* Đoạn thẳng a->b có xuyên vật cản không (lấy mẫu theo bước ~14px). */
function losClear(ax, ay, bx, by, pad) {
  pad = pad == null ? 14 : pad;
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1) return !inWall(ax, ay, pad);
  const steps = Math.ceil(len / 14);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (inWall(ax + dx * t, ay + dy * t, pad)) return false;
  }
  return true;
}

/* Ô đi được gần nhất quanh một điểm — dùng khi đích nằm sát mép vật cản. */
function navCellNear(x, y) {
  const gx = clamp((x / NAV_CELL) | 0, 0, NAV_W - 1);
  const gy = clamp((y / NAV_CELL) | 0, 0, NAV_H - 1);
  if (NAV_OK[gy * NAV_W + gx]) return gy * NAV_W + gx;
  for (let r = 1; r <= 4; r++) {
    for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
      if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
      const nx = gx + ox, ny = gy + oy;
      if (nx < 0 || ny < 0 || nx >= NAV_W || ny >= NAV_H) continue;
      if (NAV_OK[ny * NAV_W + nx]) return ny * NAV_W + nx;
    }
  }
  return -1;
}

/* Bộ đệm A* cấp phát một lần, dùng lại mỗi lượt gọi. */
const A_G = new Float32Array(75 * 50), A_F = new Float32Array(75 * 50);
const A_PREV = new Int32Array(75 * 50), A_STATE = new Uint8Array(75 * 50);
let A_STAMP = 0;
const A_SEEN = new Int32Array(75 * 50);

/* Trả về mảng waypoint từ (từ) tới (đến). Rỗng = không tìm được đường. */
function findPath(from, to) {
  if (losClear(from.x, from.y, to.x, to.y)) return [{ x: to.x, y: to.y }];
  if (!NAV_OK) return [];

  const s = navCellNear(from.x, from.y), g = navCellNear(to.x, to.y);
  if (s < 0 || g < 0) return [];
  if (s === g) return [{ x: to.x, y: to.y }];

  const gxT = g % NAV_W, gyT = (g / NAV_W) | 0;
  A_STAMP++;
  const open = [s];
  A_SEEN[s] = A_STAMP; A_STATE[s] = 1; A_G[s] = 0; A_PREV[s] = -1;
  A_F[s] = Math.hypot(s % NAV_W - gxT, ((s / NAV_W) | 0) - gyT);

  let found = false;
  while (open.length) {
    /* danh sách mở hiếm khi quá vài trăm ô nên quét tuyến tính là đủ */
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (A_F[open[i]] < A_F[open[bi]]) bi = i;
    const u = open[bi];
    open[bi] = open[open.length - 1]; open.pop();
    if (u === g) { found = true; break; }
    A_STATE[u] = 2;

    const ux = u % NAV_W, uy = (u / NAV_W) | 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = ux + ox, ny = uy + oy;
      if (nx < 0 || ny < 0 || nx >= NAV_W || ny >= NAV_H) continue;
      const v = ny * NAV_W + nx;
      if (!NAV_OK[v]) continue;
      /* không cắt góc: đi chéo phải mở cả hai ô kề */
      if (ox && oy && (!NAV_OK[uy * NAV_W + nx] || !NAV_OK[ny * NAV_W + ux])) continue;
      if (A_SEEN[v] === A_STAMP && A_STATE[v] === 2) continue;
      const nd = A_G[u] + (ox && oy ? 1.4142 : 1);
      if (A_SEEN[v] === A_STAMP && nd >= A_G[v]) continue;
      A_SEEN[v] = A_STAMP; A_STATE[v] = 1;
      A_G[v] = nd; A_PREV[v] = u;
      A_F[v] = nd + Math.hypot(nx - gxT, ny - gyT);
      open.push(v);
    }
  }
  if (!found) return [];

  /* dựng ngược đường theo ô, đổi ra tâm ô */
  const cells = [];
  for (let i = g; i >= 0; i = A_PREV[i]) {
    cells.unshift({ x: (i % NAV_W) * NAV_CELL + NAV_CELL / 2, y: (((i / NAV_W) | 0)) * NAV_CELL + NAV_CELL / 2 });
    if (i === s) break;
  }
  cells.push({ x: to.x, y: to.y });

  /* rút gọn: bỏ mọi waypoint mà đoạn thẳng vẫn thông */
  const path = [];
  let cur = { x: from.x, y: from.y };
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !losClear(cur.x, cur.y, cells[j].x, cells[j].y)) j--;
    if (j <= i) j = i;
    path.push(cells[j]);
    cur = cells[j];
    i = j + 1;
  }
  return path;
}

/* Chỗ đứng đầu ván: rải đều trên sàn, xa bệ boss, mỗi người một góc map.
 * Bản phế tích ưu tiên vành đai đường đất (ký tự ','), hầm mộ thì sàn nào
 * cũng được — cả hai đều bảo đảm không ai vào ván ngay cạnh boss. */
function pickSpawns() {
  const L = MAP, cand = [];
  const wantRoad = L.ROWS.some(r => r.indexOf(',') >= 0);
  for (let gy = 0; gy < L.GH; gy++) for (let gx = 0; gx < L.GW; gx++) {
    const ch = L.ROWS[gy][gx];
    if (ch === '#') continue;
    if (wantRoad && ch !== ',') continue;
    const x = gx * L.CELL + L.CELL / 2, y = gy * L.CELL + L.CELL / 2;
    if (inWall(x, y, 20)) continue;
    if (Math.hypot(x - BOSS_POS.x, y - BOSS_POS.y) < 520) continue;
    cand.push({ x, y });
  }
  if (cand.length < MAXP) return [];              // để nơi gọi tự xoay xở

  /* lấy mẫu điểm-xa-nhất: bắt đầu từ ô xa boss nhất rồi mỗi lần thêm ô xa
     những ô đã chọn nhất — 6 chỗ đứng trải khắp map, không ai chung góc */
  cand.sort((a, b) => Math.hypot(b.x - BOSS_POS.x, b.y - BOSS_POS.y) - Math.hypot(a.x - BOSS_POS.x, a.y - BOSS_POS.y));
  const out = [cand[0]];
  while (out.length < MAXP) {
    let best = null, bd = -1;
    for (const c of cand) {
      let nd = 1e9;
      for (const o of out) nd = Math.min(nd, Math.hypot(c.x - o.x, c.y - o.y));
      if (nd > bd) { bd = nd; best = c; }
    }
    if (!best) break;
    out.push(best);
  }
  return out;
}

/* ============================ PHÒNG ============================ */
function makeRoom() {
  return {
    ph: 'lobby',          // lobby | playing | exodus | over
    skin: MAP.key,        // crypt | ruin — biến thể địa hình của ván này
    t: 0,                 // giây đã trôi trong phase hiện tại
    players: [], enemies: [], projs: [], chests: [], loot: [],
    pools: [],            // vũng độc / hào quang
    gates: [], meteors: [], ev: [],
    merchantOpen: -1, merchantT: 0, merchantRot: 0, stock: [], weaken: 0,
    bossUp: false, bossDead: false, bossId: 0,
    campT: 0, blessT: 0, buffT: 0,
    results: null
  };
}
/* Dựng sẵn một biến thể lúc khởi động: người vào sảnh đầu tiên phải nhận được
   gói địa hình đầy đủ trong `welcome`, chứ không phải bảng rỗng. */
applyLayout('ruin');
let ROOM = makeRoom();

function resetWorld() {
  /* Bốc biến thể địa hình cho ván này. Phải bốc ở đây — client tự random thì
     6 người sẽ chơi trên 6 map khác nhau. */
  applyLayout(LAYOUTS[process.env.SKIN] ? process.env.SKIN : (Math.random() < 0.5 ? 'crypt' : 'ruin'));
  ROOM.skin = MAP.key;
  ROOM.enemies = []; ROOM.projs = []; ROOM.loot = []; ROOM.pools = [];
  ROOM.gates = []; ROOM.meteors = []; ROOM.results = null;
  ROOM.bossUp = false; ROOM.bossDead = false;
  ROOM.merchantOpen = -1; ROOM.merchantT = 0; ROOM.merchantRot = 0; ROOM.stock = [];
  ROOM.chests = CHEST_SPOTS.map((s, i) => ({ id: i, x: s.x, y: s.y, open: false, prog: 0, by: -1, rt: 0 }));
  for (const c of CAMPS) for (let i = 0; i < c.n; i++) spawnAtCamp(c);
}

/* ============================ NGƯỜI CHƠI ============================ */
function makePlayer(ws, nm, cls, slot, bot, sign) {
  const c = CLASSES[cls];
  /* Cung chọn ở sảnh = blessing slot BỊ ĐỘNG lúc vào map. Bot chọn bừa.
     Về sau nhặt blessing khác đè lên slot pas thì mất — giống mọi slot khác. */
  const sg = SIGNS.includes(sign) ? sign : (bot ? pick(SIGNS) : null);
  const p = {
    ws, bot: !!bot, slot, nm: (nm || 'Người chơi').slice(0, 14), cls,
    x: rnd(200, MW - 200), y: rnd(200, MH - 200), aim: 0,
    hp: c.hp, mhp: c.hp, mp: c.mp, mmp: c.mp, shield: 0, shieldT: 0,
    lv: 1, xp: 0, xn: 40, spd: c.spd, atk: c.atk, rng: c.rng, rate: c.rate,
    alive: true, deadT: 0, escaped: false,
    xu: 0, token: 0,
    sign: sg,
    bl: { atk: null, e: null, r: null, pas: sg, dash: null },
    /* meta — giữ qua các ván, không reset khi startMatch */
    metaToken: 0, weapon: null, nearNpc: null, atGate: false,
    /* cây kỹ năng */
    pts: 0, nodes: [cls + '_root'], fx: {}, br: null,
    dr: 0, ls: 0, reg: 0, mreg: 0, rateM: 1, rngM: 1, projN: 1,
    frenzy: 0, volley: null, usedLast: false, lastStandBuff: 0, shotN: 0,
    combo: null,
    /* chỉ số phái sinh */
    dmgM: 1, drM: 1, spdM: 1, critC: 0.05, critD: 1.8,
    /* trạng thái */
    cdA: 0, cdE: 0, cdR: 0, mxE: ESKILL[cls].cd, mxR: RSKILL[cls].cd,
    dashCd: 0, dashChg: 1, dashMax: 1, iframe: 0, dashIdle: 0,
    poisonT: 0, poison: 0, slow: 0, vuln: 0, stun: 0,
    combatT: 0, peaceT: 0, aliveT: 0, rSaved: 0,
    /* blessing runtime */
    stackTau: 0, stackCap: 0, stackAtkCap: 0, stackVir: 0, hitSet: {},
    shotN: 0, dashCrit: 0, dashFar: 0, eUses: 0, noHitT: 0,
    /* rương */
    opening: -1, openProg: 0, pending: null,
    inMerchant: false,
    in: { up: 0, dn: 0, lf: 0, rt: 0, aim: 0, fire: 0 },
    bt: { tgt: null, think: 0, wx: 0, wy: 0, path: [], stuck: 0, mvT: 0, lx: 0, ly: 0, side: 0, dodge: 0 }   // bot state
  };
  recompute(p);
  p.hp = p.mhp; p.mp = p.mmp;
  return p;
}

function recompute(p) {
  const c = CLASSES[p.cls];
  p.mhp = c.hp; p.mmp = c.mp; p.spd = c.spd; p.atk = c.atk;
  p.rng = c.rng; p.rate = c.rate;
  p.dmgM = 1; p.drM = 1; p.spdM = 1; p.critC = 0.05; p.critD = 1.8;
  p.mhp += p.bonusHp || 0; p.atk += p.bonusAtk || 0;

  /* cây kỹ năng: dựng lại từ base rồi duyệt node */
  p.fx = {}; p.br = null;
  p.dr = 0; p.ls = 0; p.reg = 0; p.mreg = 0; p.rateM = 1; p.rngM = 1; p.projN = 1;
  applyWeapon(p);                                   // vũ khí mua ở sảnh
  for (const id of p.nodes || []) applyFx(p, id);
  for (const id of p.nodes || []) { const m = META[id]; if (m && m.br && m.t === 3) p.br = m.br; }
  p.dr = Math.min(0.6, p.dr);

  const B = p.bl;
  if (B.pas === 'tau') p.drM *= 0.85;
  if (B.pas === 'sag') p.spdM *= 1.15;
  if (B.pas === 'pis') p.mmp = Math.round(p.mmp * 1.5);
  if (B.pas === 'cap') { const s = p.stackCap; p.dmgM *= 1 + s * 0.03; p.drM *= 1 - s * 0.03; p.spdM *= 1 + s * 0.01; }
  if (B.dash === 'gem') p.dashMax = 2; else p.dashMax = 1;

  /* node cộng vào tốc đánh / tầm / hồi chiêu R */
  p.rate = c.rate * p.rateM;
  p.rng = c.rng * p.rngM;
  p.spd = Math.max(1.2, p.spd);

  /* Bộ Hợp Cung */
  const all = SLOTS.map(s => B[s]);
  p.combo = (all[0] && all.every(v => v === all[0])) ? all[0] : null;
  if (p.combo === 'cap') p.reviveLeft = p.reviveLeft ?? 1;

  p.mhp = Math.round(p.mhp);
  p.hp = Math.min(p.hp, p.mhp); p.mp = Math.min(p.mp, p.mmp);
  p.mmp = Math.round(p.mmp);
  p.mxE = ESKILL[p.cls].cd;
  p.mxR = RSKILL[p.cls].cd * (1 - (p.fx.rcdCut || 0));   // Nạp Nhanh
}

/* ============================ QUÁI ============================ */
function spawnAtCamp(c) {
  const b = ETYPES[c.ty];
  /* Bãi quái là hình tròn vẽ trên bản thiết kế nên mép nó ăn cả vào lùm cây /
     đá đặc. Thu dần bán kính rồi mới chịu về đúng tâm bãi — tâm luôn nằm trên
     sàn — thay vì thả bừa con quái vào trong vật cản. */
  let x = c.x, y = c.y;
  for (let tries = 0; tries < 40; tries++) {
    const k = 1 - tries / 40;
    const tx = c.x + rnd(-c.r, c.r) * k, ty = c.y + rnd(-c.r, c.r) * k;
    if (!inWall(tx, ty, 18)) { x = tx; y = ty; break; }
  }
  ROOM.enemies.push({
    id: UID++, ty: c.ty, x: clamp(x, 30, MW - 30), y: clamp(y, 30, MH - 30),
    hx: c.x, hy: c.y, r: b.r, hp: b.hp, mhp: b.hp, spd: b.spd, dmg: b.dmg,
    xp: b.xp, coin: b.coin, big: b.big, ranged: !!b.ranged,
    cd: 0, poison: 0, poisonT: 0, slow: 0, vuln: 0, buff: null, tgt: -1, boss: false
  });
}

function spawnBoss() {
  const b = ETYPES.boss;
  const e = {
    id: UID++, ty: 'boss', x: BOSS_POS.x, y: BOSS_POS.y, hx: BOSS_POS.x, hy: BOSS_POS.y,
    r: b.r, hp: b.hp, mhp: b.hp, spd: b.spd, dmg: b.dmg, xp: b.xp, coin: b.coin,
    big: true, ranged: false, cd: 0, poison: 0, poisonT: 0, slow: 0, vuln: 0,
    buff: null, tgt: -1, boss: true
  };
  ROOM.enemies.push(e);
  ROOM.bossUp = true; ROOM.bossId = e.id;
  ev({ k: 'toast', s: -1, m: '⚠ TINH LINH HOÀNG ĐẠO đã thức giấc ở trung tâm bản đồ!' });
  ev({ k: 'boss', x: BOSS_POS.x, y: BOSS_POS.y });
}

/* ============================ SÁT THƯƠNG ============================ */
function critOf(p) {
  let c = p.critC;
  if (p.bl.pas === 'vir') c += 0.05;
  if (p.dashCrit > 0) c = 1;
  return c;
}

function dmgTo(t, base, opt, src) {
  opt = opt || {};
  if (!t || t.hp <= 0) return 0;
  if (t.slot !== undefined) {                       // mục tiêu là người
    if (!t.alive || t.iframe > 0 || t.escaped) return 0;
  }
  let d = base;
  const isPlayer = src && src.slot !== undefined;

  if (isPlayer) {
    /* --- blessing slot đánh thường --- */
    if (opt.basic) {
      const B = src.bl.atk;
      if (B === 'leo') {
        let n = 0; for (const e of ROOM.enemies) if (e.hp > 0 && dist(e, src) < 200) n++;
        d *= 1 + Math.min(5, n) * 0.06;
      }
      if (B === 'sag' && opt.far) d *= 1.25;
      if (B === 'cap') d *= 1 + src.stackAtkCap * 0.10;
      if (B === 'pis') d *= 1.4;
    }
    /* --- bị động --- */
    if (src.bl.pas === 'ari' && src.combatT > 0 && src.combatT < 5) d *= 1.25;
    if (src.bl.pas === 'leo') {
      for (const q of alliesOf(src)) if (dist(q, src) < 300) { d *= 1.08; break; }
    }
    if (src.bl.pas === 'lib' && Math.abs(src.hp / src.mhp - src.mp / src.mmp) < 0.15) d *= 1.2;

    /* --- cây kỹ năng: bên gây sát thương --- */
    const F = src.fx;
    const dd = dist(src, t);
    if (F.farDmg) d *= 1 + 0.2 * Math.min(1, dd / 350);            // Bắn Xa
    if (F.rage && src.hp / src.mhp < 0.5) d *= 1 + F.rage;         // Máu Điên
    if (F.hunter && t.hp / (t.mhp || 1) > 0.7) d *= 1.2;           // Thợ Săn
    if (F.mark && t.mark > 0) d *= 1 + F.mark;                     // Trừng Phạt
    if (F.judgement && (t.slow > 0 || t.vuln > 0)) d *= 1.35;      // Phán Xét
    if (src.frenzy > 0) d *= 1.25;                                 // Cuồng Nộ
    if (src.lastStandBuff > 0) d *= 1.5;                           // Tử Chiến
    d *= src.dmgM;

    /* --- chí mạng --- */
    let crit = Math.random() < critOf(src);
    if (src.combo === 'vir' && t.hp >= (t.mhp || 1) * 0.999) crit = true;
    if (crit) {
      d *= src.critD;
      if (src.fx.hunter) src.cdR = Math.max(0, src.cdR - 1);       // Thợ Săn
      ev({ k: 'crit', x: t.x, y: t.y });
      if (src.bl.atk === 'vir') src.mp = Math.min(src.mmp, src.mp + 10);
      if (src.bl.atk === 'sco') applyPoison(t, src.combo === 'sco' ? 99 : 5);
    }
    if (src.dashCrit > 0) src.dashCrit = 0;
  }

  /* --- phòng thủ của mục tiêu --- */
  if (t.slot !== undefined) {
    if (t.bl.pas === 'tau') { /* đã tính trong drM */ }
    if (t.bl.pas === 'lib' && Math.abs(t.hp / t.mhp - t.mp / t.mmp) < 0.15) d *= 0.8;
    if (t.bl.atk === 'tau') d *= 1 - t.stackTau * 0.03;
    d *= t.drM;
    /* giáp phẳng từ cây; Xuyên Giáp của người đánh bào bớt */
    let dr = t.dr || 0;
    if (src && src.fx && src.fx.armorPen) dr *= 1 - src.fx.armorPen;
    if (dr > 0) d *= Math.max(0.25, 1 - dr);
    /* Hộ Vệ: đồng đội Vệ Binh gần đó gánh 25% */
    for (const g of alliesOf(t)) {
      if (!g.fx.guard || dist(g, t) > 220) continue;
      const share = d * g.fx.guard;
      d -= share;
      absorbTo(g, share);
      break;
    }
    if (t.shield > 0) {
      const a = Math.min(t.shield, d);
      t.shield -= a; d -= a;
      if (t.combo === 'can' && src && src.slot === undefined) { /* phản đòn chỉ với người */ }
    }
  }
  if (t.vuln > 0) d *= 1.15;

  d = Math.max(1, Math.round(d));
  t.hp -= d;
  ev({ k: 'hit', x: t.x, y: t.y, d, c: t.slot !== undefined ? 1 : 0 });

  /* --- cây kỹ năng: hiệu ứng sau đòn --- */
  if (t.slot !== undefined && t.fx.reflect && src && opt.melee) {   // Phản Đòn
    const r = Math.round(d * t.fx.reflect);
    if (r > 0 && src.hp > 0) dmgTo(src, r, { noReflect: true }, null);
  }
  if (isPlayer) {
    if (src.ls > 0) {                                               // Khát Máu / Đoạt Hồn
      healP(src, d * src.ls);
      if (src.fx.soulDrain) src.mp = Math.min(src.mmp, src.mp + d * 0.15);
    }
    if (src.fx.vulnOnHit) t.vuln = Math.max(t.vuln, 3);            // Xuyên Giáp (map1: vuln là giây)
    if (src.fx.mark) t.mark = 3;                                    // Trừng Phạt (giây)
  }

  /* --- hồi lại cho người đánh --- */
  if (isPlayer) {
    src.combatT = 0.001; src.peaceT = 0;
    if (opt.basic) {
      if (src.bl.atk === 'can') healP(src, d * 0.08);
      if (src.bl.atk === 'lib') { healP(src, d * 0.10); src.mp = Math.min(src.mmp, src.mp + d * 0.10); }
    }
    if (src.combo === 'leo' && t.hp <= 0) { src.leoStack = Math.min(10, (src.leoStack || 0) + 1); }
  }

  if (t.hp <= 0) {
    if (t.slot !== undefined) onPlayerDown(t, src);
    else onEnemyDown(t, src);
  }
  return d;
}

function applyPoison(t, cap) {
  if (t.slot !== undefined && t.bl.pas === 'sco') return;   // miễn nhiễm
  t.poison = Math.min(cap || 5, (t.poison || 0) + 1);
  t.poisonT = 4;
}

/* Hộ Vệ dùng: đổ sát thương đã gánh sang người khác, khiên chịu trước. */
/* Map 1 hiện là hỗn chiến tự do — CHƯA có hệ team, nên không ai là đồng đội.
 * Mọi hiệu ứng hỗ trợ đi qua đây; khi làm hệ team (thiết kế 4 người/team)
 * chỉ cần đổi đúng hàm này, không phải lần lại từng chỗ. */
function alliesOf(p) {
  return [];   // TODO: ROOM.players.filter(q => q !== p && q.alive && q.team === p.team)
}

function absorbTo(p, amount) {
  let d = Math.round(amount);
  if (d <= 0) return;
  if (p.shield > 0) { const a = Math.min(p.shield, d); p.shield -= a; d -= a; }
  if (d > 0) {
    p.hp -= d;
    ev({ k: 'hit', x: p.x, y: p.y, d, c: 1 });
    if (p.hp <= 0) onPlayerDown(p, null);
  }
}

function healP(p, amt) {
  if (!p.alive) return;
  const before = p.hp;
  p.hp = Math.min(p.mhp, p.hp + amt);
  const over = amt - (p.hp - before);
  if (over > 0 && (p.bl.pas === 'can' || p.bl.atk === 'can')) {
    p.shield = Math.min(p.combo === 'can' ? 120 : 40, p.shield + over);
    p.shieldT = 6;
  }
  if (p.hp - before > 0.5) ev({ k: 'heal', x: p.x, y: p.y, s: p.slot });
}

function onEnemyDown(e, src) {
  const i = ROOM.enemies.indexOf(e);
  if (i >= 0) ROOM.enemies.splice(i, 1);
  ev({ k: 'die', x: e.x, y: e.y, r: e.r });

  /* xu rơi ra đất, tự hút khi lại gần */
  const n = e.boss ? 12 : (e.big ? 3 : 1);
  for (let k = 0; k < n; k++) {
    ROOM.loot.push({ id: UID++, ty: 'coin', v: Math.max(1, Math.round(e.coin / n)), x: e.x + rnd(-16, 16), y: e.y + rnd(-16, 16), t: 30 });
  }
  /* quái lớn 15% rơi blessing; quái mang buff 10-15% rơi đúng blessing đó */
  if (e.buff && Math.random() < 0.13) dropBless(e.x, e.y, e.buff);
  else if (e.big && Math.random() < 0.15) dropBless(e.x, e.y, null);
  if (e.boss) {
    ROOM.bossDead = true; ROOM.bossUp = false;
    dropBless(e.x - 30, e.y, null); dropBless(e.x + 30, e.y, null);
    ROOM.loot.push({ id: UID++, ty: 'token', v: 8, x: e.x, y: e.y - 24, t: 60 });
    ev({ k: 'toast', s: -1, m: '💥 Tinh Linh Hoàng Đạo đã bị hạ gục!' });
  }

  if (src && src.slot !== undefined) gainXp(src, e.xp);

  /* Bọ Cạp slot R: chết vì độc thì nổ lan */
  if (src && src.slot !== undefined && src.bl.r === 'sco' && e.poison > 0) {
    for (const o of ROOM.enemies) if (dist(o, e) < 150) applyPoison(o, 5);
    ev({ k: 'ring', x: e.x, y: e.y, r: 150, c: '#7bd67b', sk: 'poison' });
  }
  if (src && src.combo === 'sco') healP(src, src.mhp * 0.15);
}

function dropBless(x, y, sign) {
  ROOM.loot.push({
    id: UID++, ty: 'bless', x: clamp(x, 20, MW - 20), y: clamp(y, 20, MH - 20),
    sign: sign || pick(SIGNS), t: 45
  });
}

function gainXp(p, amt) {
  p.xp += amt;
  while (p.xp >= p.xn) {
    p.xp -= p.xn; p.lv++; p.xn = Math.round(p.xn * 1.35);
    p.bonusHp = (p.bonusHp || 0) + 6; p.bonusAtk = (p.bonusAtk || 0) + 1.2;
    p.pts++;                                    // mỗi cấp 1 điểm kỹ năng
    recompute(p);
    if (p.bot) botSpend(p);
    p.hp = Math.min(p.mhp, p.hp + 20);
    ev({ k: 'lvl', s: p.slot, x: p.x, y: p.y, lv: p.lv });
  }
}

function onPlayerDown(p, src) {
  /* Tử Chiến: mỗi ván 1 lần sống sót ở 1 HP */
  if (p.fx.lastStand && !p.usedLast) {
    p.usedLast = true;
    p.hp = 1; p.shield = 20; p.shieldT = 8; p.lastStandBuff = 4; p.iframe = 0.6;
    ev({ k: 'toast', s: -1, m: p.nm + ' — TỬ CHIẾN: sống sót ở 1 máu!' });
    return;
  }
  /* Phục Sinh / Hồi Sinh Nhanh: nhà sư nhánh Trị Liệu rút ngắn thời gian chờ */
  /* Chưa có team nên node hồi sinh áp cho chính người có nó */
  let fast = 1;
  if (p.fx.resurrect) fast = 2.2;
  else if (p.fx.fastRes) fast = 1.5;
  for (const q of alliesOf(p)) {
    if (q.fx.resurrect) fast = Math.max(fast, 2.2);
    else if (q.fx.fastRes) fast = Math.max(fast, 1.5);
  }
  p.alive = false; p.deadT = RESPAWN / fast; p.shield = 0;
  p.stackTau = 0; p.stackVir = 0;
  if (p.bl.pas !== 'cap' && p.combo !== 'cap') p.stackCap = 0;
  ev({ k: 'down', x: p.x, y: p.y, s: p.slot });

  /* Ma Kết Hợp Cung: 1 lượt hồi sinh tại chỗ, 100% máu */
  if (p.combo === 'cap' && p.reviveLeft > 0) {
    p.reviveLeft--; p.alive = true; p.deadT = 0; p.hp = p.mhp; p.iframe = 1.2;
    ev({ k: 'toast', s: p.slot, m: p.nm + ' — BẤT DIỆT: hồi sinh tại chỗ!' });
    return;
  }
  if (src && src.slot !== undefined && src !== p) {
    src.token += 1;
    ev({ k: 'toast', s: -1, m: src.nm + ' hạ gục ' + p.nm + '  (+1 token)' });
  } else {
    ev({ k: 'toast', s: -1, m: p.nm + ' đã gục ngã' });
  }
  /* rơi lại một phần xu */
  const drop = Math.floor(p.xu * 0.4);
  if (drop > 0) {
    p.xu -= drop;
    for (let i = 0; i < Math.min(6, drop); i++)
      ROOM.loot.push({ id: UID++, ty: 'coin', v: Math.ceil(drop / Math.min(6, drop)), x: p.x + rnd(-24, 24), y: p.y + rnd(-24, 24), t: 40 });
  }
}

/* ============================ ĐẠN ============================ */
function shoot(p, ang, dmg, o) {
  o = o || {};
  ROOM.projs.push({
    x: p.x, y: p.y, vx: Math.cos(ang) * (o.sp || 11), vy: Math.sin(ang) * (o.sp || 11),
    dmg, life: o.life || 0.9, own: p.slot === undefined ? -2 : p.slot,
    ty: o.ty || 'arrow', pierce: o.pierce || 0, hit: [], src: p, sx: p.x, sy: p.y
  });
}

function updateProjs() {
  for (let i = ROOM.projs.length - 1; i >= 0; i--) {
    const pr = ROOM.projs[i];
    pr.x += pr.vx; pr.y += pr.vy; pr.life -= DT;
    if (pr.life <= 0 || pr.x < 0 || pr.y < 0 || pr.x > MW || pr.y > MH || inWall(pr.x, pr.y, 0)) {
      ROOM.projs.splice(i, 1); continue;
    }
    const fromPlayer = pr.own >= 0;
    const list = fromPlayer ? ROOM.enemies.concat(ROOM.players.filter(q => q.slot !== pr.own)) : ROOM.players;
    let done = false;
    for (const t of list) {
      if (t.hp <= 0) continue;
      if (t.slot !== undefined && (!t.alive || t.escaped)) continue;
      if (pr.hit.includes(t.id || ('p' + t.slot))) continue;
      if (Math.hypot(t.x - pr.x, t.y - pr.y) > (t.r || 14) + 5) continue;
      const far = Math.hypot(pr.x - pr.sx, pr.y - pr.sy) > 400;
      dmgTo(t, pr.dmg, { basic: !!pr.basic, far }, pr.src);
      pr.hit.push(t.id || ('p' + t.slot));
      if (pr.pierce > 0) pr.pierce--; else { done = true; }
      break;
    }
    if (done) ROOM.projs.splice(i, 1);
  }
}

function aoe(src, x, y, r, dmg, opt) {
  const list = ROOM.enemies.concat(ROOM.players.filter(q => q !== src));
  let n = 0;
  for (const t of list) {
    if (t.hp <= 0) continue;
    if (t.slot !== undefined && (!t.alive || t.escaped)) continue;
    if (Math.hypot(t.x - x, t.y - y) > r + (t.r || 14)) continue;
    dmgTo(t, dmg, opt || {}, src); n++;
  }
  return n;
}

/* ============================ ĐÁNH THƯỜNG ============================ */
function attack(p) {
  const c = CLASSES[p.cls];
  p.shotN++;
  let mult = 1, times = 1;

  if (p.fx.deathShot && p.shotN % 5 === 0) {                       // Phát Bắn Tử Thần
    mult *= 3;
    ev({ k: 'toast', s: p.slot, m: 'Phát Bắn Tử Thần!' });
  }
  if (p.bl.atk === 'gem' && p.shotN % 3 === 0) times = 2;
  if (p.bl.atk === 'pis') {
    if (p.mp < 3) return;
    p.mp -= 3;
  }
  if (p.bl.atk === 'tau') {
    const moving = p.in.up || p.in.dn || p.in.lf || p.in.rt;
    if (!moving) p.stackTau = Math.min(p.combo === 'tau' ? 10 : 5, p.stackTau + 1);
  }
  if (p.bl.atk === 'aqu' && Math.random() < 0.12) {
    const s = pick(SIGNS.filter(v => v !== 'aqu'));
    ev({ k: 'proc', x: p.x, y: p.y, sign: s });
    if (s === 'sco') { for (const e of ROOM.enemies) if (dist(e, p) < 160) applyPoison(e, 5); }
    else if (s === 'can') healP(p, 6);
    else if (s === 'ari') aoe(p, p.x + Math.cos(p.aim) * 60, p.y + Math.sin(p.aim) * 60, 60, p.atk * 0.8);
    else mult = 1.5;
  }

  for (let k = 0; k < times; k++) {
    const power = k === 0 ? 1 : 0.6;
    if (c.kind === 'melee') {
      const rng = p.rng;
      const list = ROOM.enemies.concat(ROOM.players.filter(q => q !== p));
      let first = true;
      for (const t of list) {
        if (t.hp <= 0) continue;
        if (t.slot !== undefined && (!t.alive || t.escaped)) continue;
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        if (d > rng + (t.r || 14)) continue;
        if (Math.abs(angDiff(Math.atan2(t.y - p.y, t.x - p.x), p.aim)) > 0.85) continue;
        const key = t.id || ('p' + t.slot);
        const isNew = !p.hitSet[key];
        p.hitSet[key] = 1;
        dmgTo(t, p.atk * mult * power, { basic: true, far: false }, p);
        if (p.bl.atk === 'ari' && isNew) {
          aoe(p, t.x, t.y, 70, p.atk * 0.7);
          ev({ k: 'ring', x: t.x, y: t.y, r: 70, c: '#e2703a' });
          if (p.combo === 'ari') aoe(p, t.x, t.y, 110, p.atk * 0.4);
        }
        first = false;
      }
      ev({ k: 'slash', x: p.x, y: p.y, a: p.aim, r: rng, s: p.slot });
    } else {
      const sp = p.fx.heavyBolt ? 8 : (p.cls === 'ar' ? 11 : 8);   // Bu-lông Nặng: đạn chậm hơn
      const pr = { sp, life: p.rng / sp / 30, ty: p.cls === 'ar' ? 'arrow' : 'orbp', pierce: 0 };
      if (p.bl.atk === 'sag') pr.pierce = 3;
      if (p.combo === 'sag') pr.pierce = 5;
      /* Đa Tiễn: 3 mũi hình quạt, mỗi mũi yếu đi theo spreadPen */
      const nProj = p.projN || 1;
      const pen = nProj > 1 ? (p.fx.spreadPen || 1) : 1;
      for (let i = 0; i < nProj; i++) {
        const off = nProj === 1 ? 0 : (i - (nProj - 1) / 2) * 0.16;
        shoot(p, p.aim + off, p.atk * mult * power * pen, Object.assign({}, pr));
        const last = ROOM.projs[ROOM.projs.length - 1];
        if (last) last.basic = true;
      }
    }
  }
  p.combatT = 0.001; p.peaceT = 0;
}

/* ============================ KỸ NĂNG ============================ */
function useSkill(p, s) {
  if (!p.alive || p.stun > 0) return;
  if (s === 'E') {
    let cost = ESKILL[p.cls].cost;
    if (p.bl.e === 'cap') cost *= Math.max(0.5, 1 - p.eUses * 0.05);
    if (p.bl.e === 'pis' && p.mp / p.mmp > 0.8) cost = 0;
    if (p.cdE > 0 || p.mp < cost) return;
    p.mp -= cost; p.cdE = p.mxE; p.eUses++;
    doE(p);
    if (p.bl.e === 'gem') setTimeout(() => { if (p.alive) doE(p, 0.5); }, 250);
  } else {
    let cost = RSKILL[p.cls].cost;
    if (p.bl.r === 'pis' && p.mp / p.mmp < 0.3) { cost = 0; p.mp = Math.min(p.mmp, p.mp + p.mmp * 0.3); }
    if (p.bl.r === 'can' && p.hp / p.mhp < 0.4) cost = 0;
    if (p.cdR > 0 || p.mp < cost) return;
    p.mp -= cost;
    p.cdR = p.mxR * (p.bl.r === 'vir' ? 1.3 : 1);
    doR(p);
    p.rSaved = 0;
  }
}

function doE(p, scale) {
  scale = scale || 1;
  let power = p.fx.ePow || 1;              // node `_e`: E mạnh thêm 25%
  if (p.bl.e === 'lib' && Math.abs(p.hp / p.mhp - p.mp / p.mmp) < 0.15) power *= 1.3;
  if (p.bl.e === 'vir') power *= 1 + Math.min(5, p.stackVir) * 0.1;
  if (p.bl.e === 'cap') power *= 1;
  const dealt = { v: 0 };

  if (p.cls === 'sw') {
    let r = 96; if (p.bl.e === 'ari') r *= 1.5;
    const times = p.fx.whirl2 ? 2 : 1;     // Xoáy Lốc: Chém Xoay đánh 2 lần
    let n = 0;
    for (let i = 0; i < times; i++) n = aoe(p, p.x, p.y, r, p.atk * 1.8 * power * scale);
    ev({ k: 'ring', x: p.x, y: p.y, r, c: '#ffd479', sk: 'whirl', a: p.aim, x2: times > 1 ? 1 : 0 });
    if (p.bl.e === 'tau') for (const e of ROOM.enemies) if (dist(e, p) < r) { e.slow = 2; kb(e, p, 26); }
    dealt.v = n * p.atk * 1.8;
  } else if (p.cls === 'ar') {
    let rngM = p.bl.e === 'sag' ? 1.5 : 1;
    shoot(p, p.aim, p.atk * 2.4 * power * scale, { sp: 14, life: p.rng * rngM / 14 / 30, ty: 'pierce', pierce: 4, boom: p.fx.trapBoom ? 1 : 0 });
    ev({ k: 'slash', x: p.x, y: p.y, a: p.aim, r: 60, s: p.slot, sk: 'pierce' });
  } else {
    let r = 120; if (p.bl.e === 'ari') r *= 1.5;
    const cx = p.x + Math.cos(p.aim) * 70, cy = p.y + Math.sin(p.aim) * 70;
    const n = aoe(p, cx, cy, r, p.atk * 1.6 * power * scale);
    ev({ k: 'ring', x: cx, y: cy, r, c: '#8fd4ff', sk: 'smite' });
    if (p.bl.e === 'tau') for (const e of ROOM.enemies) if (dist(e, { x: cx, y: cy }) < r) { e.slow = 2; kb(e, p, 30); }
    dealt.v = n * p.atk * 1.6;
  }
  if (p.bl.e === 'sco') ROOM.pools.push({ ty: 'poison', x: p.x + Math.cos(p.aim) * 60, y: p.y + Math.sin(p.aim) * 60, r: 80, t: 5, own: p.slot });
  if (p.bl.e === 'can' && dealt.v > 0) { p.shield = Math.min(80, p.shield + dealt.v * 0.15); p.shieldT = 6; }
  if (p.bl.e === 'leo') ROOM.pools.push({ ty: 'aura', x: p.x, y: p.y, r: 160, t: 4, own: p.slot });
  /* Ánh Sáng Thiêu: E gây bỏng 4 giây — dùng lại hệ độc sẵn có của map 1 */
  if (p.fx.burn) {
    for (const e of ROOM.enemies) if (dist(e, p) < 190) { e.poison = Math.max(e.poison, p.atk * 0.25); e.poisonT = 4; }
  }
}

/* ký hiệu cung gửi kèm hiệu ứng Lời Nguyền (effects.js vẽ glyph) */
const SIGN_G = { ari:'♈', tau:'♉', gem:'♊', can:'♋', leo:'♌', vir:'♍',
                 lib:'♎', sco:'♏', sag:'♐', cap:'♑', aqu:'♒', pis:'♓' };

/* Nhánh B đổi hẳn R sang chiêu riêng — nội dung lấy từ arena cũ. */
function doR_B(p, power) {
  if (p.cls === 'sw') {                       // Cuồng Nộ
    p.frenzy = 6;
    /* s = slot: client cho aura bám theo người chơi suốt 6 giây buff */
    ev({ k: 'ring', x: p.x, y: p.y, r: 70, c: '#ff5c6c', sk: 'frenzy', s: p.slot });
    ev({ k: 'toast', s: p.slot, m: 'Cuồng Nộ! +25% sát thương và tốc đánh trong 6 giây' });
  } else if (p.cls === 'ar') {                // Nỏ Liên Thanh
    p.volley = { n: 6, t: 0, gap: 0.09, dmg: p.atk * 1.1 * power };
    ev({ k: 'cast', x: p.x, y: p.y, s: p.slot, sk: 'volley', a: p.aim });
  } else {                                    // Lời Nguyền
    const cx = p.x + Math.cos(p.aim) * 150, cy = p.y + Math.sin(p.aim) * 150;
    ROOM.pools.push({ ty: 'curse', x: cx, y: cy, r: 110, t: 5, own: p.slot });
    ev({ k: 'ring', x: cx, y: cy, r: 110, c: '#c58cff', sk: 'curse', g: SIGN_G[p.bl.r] || '' });
  }
}

function doR(p) {
  let power = 1;
  if (p.bl.r === 'tau') { power *= 1 + p.stackTau * 0.10; p.stackTau = 0; }
  if (p.bl.r === 'cap') power *= 1 + Math.min(5, Math.floor(p.rSaved / 10)) * 0.05;

  /* Nhánh B đổi hẳn R sang chiêu của nhánh (đúng nội dung arena cũ) */
  if (p.br === 'B') { doR_B(p, power); return; }

  if (p.cls === 'sw') {
    /* Khiên Thánh — Khiêu Chiến nới bán kính và cộng khiên */
    p.shield = Math.min(140, p.shield + (60 + (p.fx.shieldPlus || 0)) * power); p.shieldT = 8;
    const R = p.fx.tauntPlus ? 260 : 200;
    for (const e of ROOM.enemies) if (dist(e, p) < R) { e.taunt = 4; e.tauntBy = p.slot; }
    ev({ k: 'ring', x: p.x, y: p.y, r: R, c: '#ffe9a8', sk: 'taunt' });
  } else if (p.cls === 'ar') {
    const cx = p.x + Math.cos(p.aim) * 180, cy = p.y + Math.sin(p.aim) * 180;
    let r = 140;
    const n = aoe(p, cx, cy, r, p.atk * 2.6 * power);
    if (p.bl.r === 'leo') aoe(p, cx, cy, r, p.atk * 0.2 * n);
    if (p.bl.r === 'sag') { shoot(p, p.aim + 0.25, p.atk * 1.6, { sp: 12, life: 1, pierce: 2 }); shoot(p, p.aim - 0.25, p.atk * 1.6, { sp: 12, life: 1, pierce: 2 }); }
    ev({ k: 'ring', x: cx, y: cy, r, c: '#c8f08a', sk: 'trap' });
  } else {
    /* Chữa Lành — Hồi Sinh Nhanh (+20%), Suối Nguồn (×2, xoá độc, máu thừa thành khiên),
       Lá Chắn Sinh Mệnh (+20 khiên mỗi lần hồi) */
    const hm = (p.fx.healM || 1) * (p.fx.fountain ? 2 : 1);
    /* Chưa có hệ team nên KHÔNG hồi máu cho người khác — vòng lặp cũ chữa
       cho cả kẻ địch đứng gần. Bù lại lượng hồi bản thân tăng 45 -> 60. */
    const selfHeal = 60 * power * hm;
    if (p.fx.fountain) { p.poisonT = 0; p.poison = 0; }
    const over = Math.max(0, p.hp + selfHeal - p.mhp);
    healP(p, selfHeal);
    if (p.fx.fountain && over > 0) { p.shield = Math.min(140, p.shield + over); p.shieldT = 8; }
    if (p.fx.healShield) { p.shield = Math.min(140, p.shield + p.fx.healShield); p.shieldT = 8; }
    for (const q of alliesOf(p)) {
      if (dist(q, p) > 220) continue;
      healP(q, 30 * power * hm);
      if (p.fx.fountain) { q.poisonT = 0; q.poison = 0; }
      if (p.fx.healShield) { q.shield = Math.min(140, q.shield + p.fx.healShield); q.shieldT = 8; }
    }
    ev({ k: 'ring', x: p.x, y: p.y, r: 120, c: '#9dffb0', sk: 'heal', sh: p.fx.fountain ? 1 : 0 });
  }
  if (p.bl.r === 'lib') { const avg = (p.hp / p.mhp + p.mp / p.mmp) / 2; p.hp = p.mhp * avg; p.mp = p.mmp * avg; }
  if (p.bl.r === 'gem') p.echoR = 2;   // lặp lại sau 2 giây
}

/* ============================ LƯỚT ============================ */
function doDash(p) {
  if (!p.alive || p.stun > 0) return;
  const B = p.bl.dash;
  if (B === 'pis') { if (p.mp < 10) return; p.mp -= 10; }
  else {
    if (p.dashChg <= 0) return;
    let free = false;
    if (B === 'cap' && p.dashIdle >= 5) free = true;
    if (B === 'aqu' && Math.random() < 0.25) free = true;
    if (!free) p.dashChg--;
  }

  let d = DASH_DIST;
  if (B === 'sag' || B === 'aqu') d *= 1.5;
  let ang = p.aim;
  if (p.in.up || p.in.dn || p.in.lf || p.in.rt) ang = Math.atan2(p.in.dn - p.in.up, p.in.rt - p.in.lf);
  if (B === 'aqu') ang += rnd(-0.3, 0.3) * 1;

  /* Đi từng bước dọc đường lướt, dừng ở điểm hợp lệ CUỐI CÙNG.
     Bản cũ nhảy thẳng tới đích rồi mới kiểm tra, nên lướt vào tường là kẹt trong đó. */
  const fx = p.x, fy = p.y;
  const STEPS = 16;
  let nx = p.x, ny = p.y;
  for (let i = 1; i <= STEPS; i++) {
    const tx = clamp(p.x + Math.cos(ang) * d * (i / STEPS), 20, MW - 20);
    const ty = clamp(p.y + Math.sin(ang) * d * (i / STEPS), 20, MH - 20);
    if (inWall(tx, ty, 12)) break;
    nx = tx; ny = ty;
  }
  p.x = nx; p.y = ny;
  p.iframe = DASH_IFRAME;
  p.dashIdle = 0;
  ev({ k: 'dash', x1: fx, y1: fy, x2: nx, y2: ny, s: p.slot });

  /* hiệu ứng theo cung */
  if (B === 'ari') { aoe(p, nx, ny, 90, p.atk * 1.4); ev({ k: 'ring', x: nx, y: ny, r: 90, c: '#e2703a' }); }
  if (B === 'tau') {
    for (const e of ROOM.enemies) if (dist(e, { x: nx, y: ny }) < 80) { kb(e, { x: fx, y: fy }, 40); e.slow = 0.5; }
    const moving = p.in.up || p.in.dn || p.in.lf || p.in.rt;
    if (!moving) p.stackTau = Math.min(5, p.stackTau + 3);
  }
  if (B === 'can') { p.shield = Math.min(80, p.shield + 20); p.shieldT = 3; }
  if (B === 'leo') for (const e of ROOM.enemies) if (distToSeg(e, fx, fy, nx, ny) < 30) { e.vuln = 4; }
  if (B === 'vir') p.dashCrit = 2;
  if (B === 'lib') {
    healP(p, p.mhp * 0.03); p.mp = Math.min(p.mmp, p.mp + p.mmp * 0.03);
  }
  if (B === 'sco') ROOM.pools.push({ ty: 'poison', x: (fx + nx) / 2, y: (fy + ny) / 2, r: 70, t: 4, own: p.slot });
  if (B === 'sag') {
    let near = null, nd = 1e9;
    for (const e of ROOM.enemies) { const dd = dist(e, { x: fx, y: fy }); if (dd < nd) { nd = dd; near = e; } }
    if (near && dist(near, { x: nx, y: ny }) > nd) p.dashFar = 3;
  }
  if (B === 'cap' && p.dashIdleWas >= 5) aoe(p, (fx + nx) / 2, (fy + ny) / 2, 60, p.atk * 1.5);

  /* hồi chiêu */
  let cd = DASH_CD;
  if (B === 'lib' && Math.abs(p.hp / p.mhp - p.mp / p.mmp) < 0.15) cd *= 0.5;
  if (B !== 'pis') p.dashCd = Math.max(p.dashCd, cd);
}

function distToSeg(p, x1, y1, x2, y2) {
  const A = p.x - x1, B = p.y - y1, C = x2 - x1, D = y2 - y1;
  const len = C * C + D * D;
  let t = len ? (A * C + B * D) / len : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (x1 + C * t), p.y - (y1 + D * t));
}

/* đẩy thực thể ra khỏi tường: quét vòng tròn mở rộng dần, tìm chỗ trống gần nhất */
function unstick(p) {
  for (let r = 14; r <= 140; r += 12) {
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6;
      const x = clamp(p.x + Math.cos(a) * r, 20, MW - 20);
      const y = clamp(p.y + Math.sin(a) * r, 20, MH - 20);
      if (!inWall(x, y, 12)) { p.x = x; p.y = y; return; }
    }
  }
  /* Quét vòng tròn có thể trượt sạch nếu đang nằm giữa một khối đá to hơn
     140px. Đây là lưới an toàn cuối: tìm thẳng trên lưới, mở rộng từng vành ô
     cho tới khi gặp ô đứng được — không bao giờ để người chơi kẹt cứng. */
  const L = MAP, C = L.CELL;
  const gx = clamp((p.x / C) | 0, 0, L.GW - 1), gy = clamp((p.y / C) | 0, 0, L.GH - 1);
  for (let ring = 1; ring < Math.max(L.GW, L.GH); ring++) {
    for (let oy = -ring; oy <= ring; oy++) for (let ox = -ring; ox <= ring; ox++) {
      if (Math.max(Math.abs(ox), Math.abs(oy)) !== ring) continue;
      const nx = gx + ox, ny = gy + oy;
      if (nx < 0 || ny < 0 || nx >= L.GW || ny >= L.GH) continue;
      const cx = nx * C + C / 2, cy = ny * C + C / 2;
      if (!inWall(cx, cy, 12)) { p.x = cx; p.y = cy; return; }
    }
  }
}

function kb(t, from, force) {
  if (t.slot !== undefined && t.bl.pas === 'tau') return;
  const a = Math.atan2(t.y - from.y, t.x - from.x);
  const nx = clamp(t.x + Math.cos(a) * force, 20, MW - 20);
  const ny = clamp(t.y + Math.sin(a) * force, 20, MH - 20);
  if (inWall(nx, ny, 12)) return;              // không đẩy ai vào trong tường
  t.x = nx; t.y = ny;
}

/* ============================ CẬP NHẬT NGƯỜI CHƠI ============================ */
function updatePlayer(p) {
  if (p.escaped) return;

  if (!p.alive) {
    p.deadT -= DT;
    if (p.deadT <= 0) {
      p.alive = true; p.hp = p.mhp * 0.6; p.mp = p.mmp * 0.5;
      /* Hồi sinh ĐÚNG chỗ chết. Bản cũ nhích ngẫu nhiên ±120px để khỏi sống
         lại ngay trong mặt con quái vừa giết mình — nhưng địa hình bây giờ có
         52% là đá đặc, nên cú nhích đó ném người chơi vào giữa khối đá và kẹt
         cứng. Chỗ chết thì chắc chắn đứng được, còn 1.5 giây bất tử đã đủ để
         thoát khỏi đám quái. */
      if (inWall(p.x, p.y, 12)) unstick(p);         // lưới an toàn, gần như không dùng tới
      p.iframe = 1.5; p.hitSet = {};
    }
    return;
  }

  /* Lưới an toàn: nếu vì bất kỳ lý do gì mà đang nằm trong tường thì đẩy ra
     chỗ trống gần nhất, không để người chơi kẹt cứng. */
  if (inWall(p.x, p.y, 10)) unstick(p);

  p.aliveT += DT;
  p.iframe = Math.max(0, p.iframe - DT);
  p.stun = Math.max(0, p.stun - DT);
  p.slow = Math.max(0, p.slow - DT);
  p.vuln = Math.max(0, p.vuln - DT);
  if (p.mark > 0) p.mark = Math.max(0, p.mark - DT);
  p.dashCrit = Math.max(0, p.dashCrit - DT);
  p.dashFar = Math.max(0, p.dashFar - DT);
  p.cdA = Math.max(0, p.cdA - DT);
  p.cdE = Math.max(0, p.cdE - DT);
  p.cdR = Math.max(0, p.cdR - DT);
  p.rSaved += DT;
  p.dashIdleWas = p.dashIdle;
  p.dashIdle += DT;
  if (p.bl.dash !== 'pis') {
    p.dashCd = Math.max(0, p.dashCd - DT);
    if (p.dashCd <= 0 && p.dashChg < p.dashMax) { p.dashChg++; if (p.dashChg < p.dashMax) p.dashCd = DASH_CD; }
  }

  /* trong / ngoài giao tranh */
  if (p.combatT > 0) { p.combatT += DT; if (p.combatT > 6) { p.combatT = 0; p.peaceT = 0; } }
  else p.peaceT += DT;

  /* Ma Kết slot đánh thường: tích theo thời gian không giao tranh, không mất */
  if (p.bl.atk === 'cap' && p.peaceT >= 20) { p.peaceT -= 20; p.stackAtkCap = Math.min(3, p.stackAtkCap + 1); }
  /* Ma Kết bị động: tích theo thời gian sống */
  if (p.bl.pas === 'cap') {
    const want = Math.min(10, Math.floor(p.aliveT / 30));
    if (want !== p.stackCap) { p.stackCap = want; recompute(p); }
  }

  /* độc */
  if (p.poisonT > 0) {
    p.poisonT -= DT;
    p.hp -= p.poison * 2 * DT;
    if (p.hp <= 0) onPlayerDown(p, null);
  }
  /* khiên rò rỉ */
  if (p.shield > 0) { p.shieldT -= DT; if (p.shieldT <= 0) p.shield = Math.max(0, p.shield - 12 * DT); }

  /* đồng hồ của cây kỹ năng */
  if (p.frenzy > 0) p.frenzy = Math.max(0, p.frenzy - DT);
  if (p.lastStandBuff > 0) p.lastStandBuff = Math.max(0, p.lastStandBuff - DT);

  /* Bất Hoại Thành: tự hồi khiên tới 120, đồng đội quanh 120 cũng được */
  if (p.fx.bulwark) {
    if (p.shield < 120) { p.shield = Math.min(120, p.shield + 14 * DT); p.shieldT = 8; }
    for (const q of alliesOf(p)) {
      if (dist(q, p) > 120) continue;
      if (q.shield < 60) { q.shield = Math.min(60, q.shield + 8 * DT); q.shieldT = 8; }
    }
  }
  /* Hào Quang: đồng đội trong 130 hồi máu mỗi giây */
  if (p.fx.auraHeal) {
    for (const q of alliesOf(p)) if (dist(q, p) < 130) healP(q, p.fx.auraHeal * DT);
    healP(p, p.fx.auraHeal * DT);          // chưa có team -> hưởng trọn phần của mình
  }

  /* hồi phục */
  let mreg = 3 + (p.mreg || 0), hreg = p.reg || 0;
  if (p.combatT === 0) {
    mreg *= (p.bl.pas === 'pis') ? 3 : 1.4;
    hreg += 1.5;
  }
  if (p.bl.pas === 'can') hreg += p.mhp * 0.02 / 3;
  p.mp = Math.min(p.mmp, p.mp + mreg * DT);
  if (hreg > 0) healP(p, hreg * DT);
  if (p.combo === 'pis') { /* hồi mana khi giết — xử lý ở onEnemyDown qua src */ }

  /* Sư Tử bị động: tốc chạy khi có đồng đội */
  let sp = p.spd * p.spdM;
  if (p.bl.pas === 'leo') { for (const q of alliesOf(p)) if (dist(q, p) < 300) { sp *= 1.08; break; } }
  if (p.bl.atk === 'tau' && p.stackTau > 0) sp *= 1 - p.stackTau * 0.01;
  if (p.combo === 'tau') sp *= 1 - Math.min(10, p.stackTau) * 0.01;
  if (p.slow > 0) sp *= 0.6;
  if (p.stun > 0) sp = 0;

  /* di chuyển */
  const mx = p.in.rt - p.in.lf, my = p.in.dn - p.in.up;
  if ((mx || my) && !p.opening) { }
  if (mx || my) {
    const l = Math.hypot(mx, my) || 1;
    const nx = clamp(p.x + (mx / l) * sp * 2, 16, MW - 16);
    const ny = clamp(p.y + (my / l) * sp * 2, 16, MH - 16);
    if (!inWall(nx, p.y, 12)) p.x = nx;
    if (!inWall(p.x, ny, 12)) p.y = ny;
    p.openProg = 0; p.opening = -1;      // di chuyển thì huỷ mở rương
  }
  p.aim = p.in.aim;

  /* đánh thường */
  /* Nỏ Liên Thanh: nhả 6 phát cách nhau 0.09 giây */
  if (p.volley) {
    p.volley.t -= DT;
    if (p.volley.t <= 0) {
      p.volley.t = p.volley.gap;
      shoot(p, p.aim, p.volley.dmg, { sp: 13, life: p.rng / 13 / 30, ty: 'bolt' });
      if (--p.volley.n <= 0) p.volley = null;
    }
  }
  const rate = p.rate * (p.frenzy > 0 ? 0.8 : 1);     // Cuồng Nộ: đánh nhanh hơn
  if (p.in.fire && p.cdA <= 0 && !p.pending) { attack(p); p.cdA = rate; }

  /* vùng độc / hào quang */
  for (const pool of ROOM.pools) {
    if (pool.ty === 'poison' && pool.own !== p.slot && dist(pool, p) < pool.r) applyPoison(p, 5);
  }

  /* nhặt loot */
  for (let i = ROOM.loot.length - 1; i >= 0; i--) {
    const L = ROOM.loot[i];
    const d = dist(L, p);
    if (L.ty === 'coin' && d < 46) { p.xu += L.v; ROOM.loot.splice(i, 1); ev({ k: 'pick', x: L.x, y: L.y, ty: 'coin', s: p.slot }); continue; }
    if (L.ty === 'token' && d < 46) { p.token += L.v; ROOM.loot.splice(i, 1); ev({ k: 'pick', x: L.x, y: L.y, ty: 'token', s: p.slot }); continue; }
    if (L.ty === 'bless' && d < 34 && !p.pending) {
      ROOM.loot.splice(i, 1);
      offerBless(p, [L.sign], 'bless');
      continue;
    }
  }

  /* mở rương */
  let near = -1;
  for (const c of ROOM.chests) if (!c.open && dist(c, p) < 46) { near = c.id; break; }
  p.nearChest = near;
  if (near >= 0 && p.in.use && !p.pending) {
    p.opening = near; p.openProg += DT;
    if (p.openProg >= 1.2) {
      const c = ROOM.chests[near];
      c.open = true; c.rt = CHEST_RESPAWN; p.openProg = 0; p.opening = -1;
      openChest(p, c);
    }
  } else if (!p.in.use) { p.openProg = 0; p.opening = -1; }

  /* merchant — chưa dựng quầy thì không có gì để tới */
  p.nearMerchant = -1;
  if (ROOM.merchantOpen >= 0) {
    const m = MERCHANTS[ROOM.merchantOpen];
    if (dist(m, p) < 70) p.nearMerchant = ROOM.merchantOpen;
  }

  /* thiên thạch + vùng chết */
  if (ROOM.ph === 'exodus') {
    for (const mt of ROOM.meteors) {
      if (mt.t <= 0 && !mt.done) { }
    }
  }
}

/* ============================ RƯƠNG ============================ */
function openChest(p, c) {
  const roll = Math.random();
  /* Bảo Bình bị động: rương thêm 1 token */
  const bonusTok = p.bl.pas === 'aqu' ? 1 : 0;

  if (roll < 0.45) {
    /* blessing — Song Tử bị động cho 2 lựa chọn */
    const n = (p.bl.pas === 'gem') ? 2 : 1;
    const opts = [];
    while (opts.length < n) { const s = pick(SIGNS); if (!opts.includes(s)) opts.push(s); }
    offerBless(p, opts, 'chest');
  } else if (roll < 0.72) {
    const v = 1 + Math.floor(Math.random() * 2) + bonusTok;    // map 1: 1-2 token
    p.token += v;
    ev({ k: 'toast', s: p.slot, m: 'Rương: +' + v + ' token' });
  } else if (roll < 0.9) {
    const v = 8 + Math.floor(Math.random() * 14);
    p.xu += v;
    if (bonusTok) p.token += bonusTok;
    ev({ k: 'toast', s: p.slot, m: 'Rương: +' + v + ' xu' });
  } else {
    p.bonusHp = (p.bonusHp || 0) + 10; p.bonusAtk = (p.bonusAtk || 0) + 1.5;
    recompute(p); p.hp = Math.min(p.mhp, p.hp + 10);
    if (bonusTok) p.token += bonusTok;
    ev({ k: 'toast', s: p.slot, m: 'Rương: +10 HP tối đa, +1.5 sát thương' });
  }
  if (p.bl.pas === 'aqu') {
    p.dmgM *= 1.15; p.aquBuffT = 60;
    ev({ k: 'toast', s: p.slot, m: 'Hỗn Nguyên: +15% sát thương trong 60 giây' });
  }
  ev({ k: 'chest', x: c.x, y: c.y });
}

/* Đưa ra bảng chọn blessing: chọn cung + chọn slot */
function offerBless(p, signs, from) {
  if (p.bot) {                       // bot chọn bừa ngay
    const s = pick(signs);
    const slot = pick(SLOTS);
    setBless(p, s, slot);
    return;
  }
  p.pending = { signs, from };
  send(p.ws, JSON.stringify({ t: 'offer', signs, from }));
}

function setBless(p, sign, slot) {
  if (!SIGNS.includes(sign) || !SLOTS.includes(slot)) return;
  const old = p.bl[slot];
  p.bl[slot] = sign;
  recompute(p);
  const cb = p.combo;
  /* riêng tư — không announce cho cả map biết ai có blessing gì */
  ev({ k: 'toast', s: p.slot, m: 'Nhận ' + SIGN_NM[sign] + ' — ' + SLOT_NM[slot] + (old ? ' (thay ' + SIGN_NM[old] + ')' : '') });
  if (cb) ev({ k: 'toast', s: p.slot, m: '✦ Mở BỘ HỢP CUNG: ' + COMBO_NM[cb] + '!' });
}

/* ============================ MERCHANT ============================ */
/* Kho hàng đầy đủ. Mỗi lượt merchant chỉ bày ra STOCK_N món ngẫu nhiên. */
const SHOP = [
  { id: 'hp', nm: '+15 HP tối đa', cost: 20 },
  { id: 'hp2', nm: '+30 HP tối đa', cost: 36 },
  { id: 'atk', nm: '+2 sát thương', cost: 25 },
  { id: 'atk2', nm: '+4 sát thương', cost: 44 },
  { id: 'spd', nm: '+4% tốc chạy', cost: 22 },
  { id: 'heal', nm: 'Hồi đầy máu', cost: 18 },
  { id: 'shield', nm: 'Khiên 60 giữ tới khi vỡ', cost: 30 },
  { id: 'reroll', nm: 'Đổi 1 blessing sang cung khác', cost: 40 },
  { id: 'bless', nm: 'Mua 1 blessing ngẫu nhiên', cost: 55 }
];

function rollStock() {
  ROOM.merchantRot++;
  const pool = SHOP.slice();
  const out = [];
  while (out.length < STOCK_N && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
  ROOM.stock = out;
}

function buy(p, id, slot) {
  if (ROOM.merchantOpen < 0) return;
  if (!ROOM.stock.includes(id)) return;
  const it = SHOP.find(s => s.id === id);
  if (!it || p.xu < it.cost) return;
  if (p.nearMerchant < 0) return;
  /* mỗi lượt bày hàng chỉ mua được mỗi món một lần */
  const key = ROOM.merchantRot + ':' + id;
  if (!p.bought) p.bought = {};
  if (p.bought[key]) return;
  p.bought[key] = 1;
  p.xu -= it.cost;
  if (id === 'hp') { p.bonusHp = (p.bonusHp || 0) + 15; recompute(p); p.hp += 15; }
  else if (id === 'hp2') { p.bonusHp = (p.bonusHp || 0) + 30; recompute(p); p.hp += 30; }
  else if (id === 'atk') { p.bonusAtk = (p.bonusAtk || 0) + 2; recompute(p); }
  else if (id === 'atk2') { p.bonusAtk = (p.bonusAtk || 0) + 4; recompute(p); }
  else if (id === 'spd') { p.spdBuy = (p.spdBuy || 0) + 0.04; p.spdM *= 1.04; }
  else if (id === 'heal') { p.hp = p.mhp; }
  else if (id === 'shield') { p.shield = Math.min(160, p.shield + 60); p.shieldT = 9999; }
  else if (id === 'reroll') {
    const has = SLOTS.filter(s => p.bl[s]);
    const tgt = SLOTS.includes(slot) && p.bl[slot] ? slot : (has.length ? pick(has) : null);
    if (tgt) { let s; do { s = pick(SIGNS); } while (s === p.bl[tgt]); setBless(p, s, tgt); }
  }
  else if (id === 'bless') offerBless(p, [pick(SIGNS)], 'shop');
  ev({ k: 'toast', s: p.slot, m: 'Đã mua: ' + it.nm });
}

/* ============================ QUÁI AI ============================ */
function updateEnemies() {
  /* Suy Nhược: lấy giá trị mạnh nhất trong số người chơi còn sống */
  ROOM.weaken = 0;
  for (const q of ROOM.players) if (q.alive && q.fx.weaken) ROOM.weaken = Math.max(ROOM.weaken, q.fx.weaken);

  /* lặp trên bản sao vì onEnemyDown có splice mảng gốc */
  for (const e of ROOM.enemies.slice()) {
    if (e.hp <= 0) continue;
    if (e.poisonT > 0) { e.poisonT -= DT; e.hp -= e.poison * 2.2 * DT; if (e.hp <= 0) { onEnemyDown(e, e.lastSrc || null); continue; } }
    e.slow = Math.max(0, e.slow - DT);
    e.vuln = Math.max(0, e.vuln - DT);
    if (e.mark > 0) e.mark = Math.max(0, e.mark - DT);
    e.cd = Math.max(0, e.cd - DT);

    /* buff hoàng đạo: tự hồi máu (Song Ngư) */
    if (e.buff === 'pis' && e.hp < e.mhp) e.hp = Math.min(e.mhp, e.hp + e.mhp * 0.01 * DT);

    /* Khiêu Chiến (Vệ Binh): ép quái nhắm người khiêu chiến, bỏ qua aggro thường */
    if (e.taunt > 0) {
      e.taunt -= DT;
      const tp = ROOM.players.find(q => q.slot === e.tauntBy && q.alive && !q.escaped);
      if (!tp) e.taunt = 0;
    }
    /* aggro hẹp: chỉ đuổi khi tới gần, và bỏ cuộc nếu bị kéo quá xa camp */
    let tgt = null, nd = e.boss ? 420 : (e.ranged ? 260 : 190);
    if (e.taunt > 0) {
      tgt = ROOM.players.find(q => q.slot === e.tauntBy);
      nd = tgt ? dist(tgt, e) : nd;
    }
    if (!tgt) for (const p of ROOM.players) {
      if (!p.alive || p.escaped) continue;
      const d = dist(p, e);
      if (d < nd) { nd = d; tgt = p; }
    }
    if (tgt && !e.boss && Math.hypot(e.hx - e.x, e.hy - e.y) > 420) tgt = null;   // leash về camp
    if (!tgt) {
      /* về lại camp */
      const dh = Math.hypot(e.hx - e.x, e.hy - e.y);
      if (dh > 30) {
        /* tách trục như lúc đuổi người chơi — đường về camp cũng cắt qua
           lùm cây / đá đặc, đi thẳng là chui vào trong vật cản */
        const bx = e.x + (e.hx - e.x) / dh * e.spd * 0.6;
        const by = e.y + (e.hy - e.y) / dh * e.spd * 0.6;
        if (!inWall(bx, e.y, 8)) e.x = bx;
        if (!inWall(e.x, by, 8)) e.y = by;
      }
      continue;
    }
    const spd = e.spd * (e.slow > 0 ? 0.5 : 1) * (e.buff === 'gem' ? 1.25 : 1);
    const a = Math.atan2(tgt.y - e.y, tgt.x - e.x);
    const reach = e.ranged ? 220 : (e.r + 20);
    if (nd > reach) {
      const nx = e.x + Math.cos(a) * spd * 2, ny = e.y + Math.sin(a) * spd * 2;
      if (!inWall(nx, e.y, 8)) e.x = clamp(nx, 20, MW - 20);
      if (!inWall(e.x, ny, 8)) e.y = clamp(ny, 20, MH - 20);
    } else if (e.cd <= 0) {
      e.cd = e.ranged ? 2.4 : 1.4;      // quái đánh chậm lại (1.6/0.85 -> 2.4/1.4)
      let dmg = e.dmg * (e.buff === 'ari' ? 1.5 : 1) * (1 - (ROOM.weaken || 0));
      if (e.ranged) {
        ROOM.projs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, dmg, life: 2.2, own: -1, ty: 'eball', pierce: 0, hit: [], src: e, sx: e.x, sy: e.y });
      } else {
        dmgTo(tgt, dmg, {}, e);
        if (e.buff === 'sco') applyPoison(tgt, 5);
        if (e.boss) { aoe(e, e.x, e.y, 90, e.dmg * 0.5); ev({ k: 'ring', x: e.x, y: e.y, r: 90, c: '#ff6b6b' }); }
      }
    }
  }
}

/* ============================ BOT ============================ */
/* Bot rải điểm ngay khi có: đi thẳng một nhánh cho ra build tử tế. */
function botSpend(p) {
  for (let guard = 0; guard < 20 && p.pts > 0; guard++) {
    const pool = Object.keys(META).filter(id => canAlloc(p, id));
    if (!pool.length) break;
    /* ưu tiên node rẻ và sâu nhất có thể */
    pool.sort((a, b) => META[b].t - META[a].t);
    const id = pool[0];
    p.pts -= META[id].cost;
    p.nodes.push(id);
    recompute(p);
  }
}

function updateBot(p) {
  if (!p.alive) return;
  const bt = p.bt;
  bt.think -= DT;
  if (bt.think <= 0) {
    bt.think = 0.4;
    /* ưu tiên: loot gần > rương gần > quái gần > lang thang */
    let best = null, bd = 1e9, kind = '';
    for (const L of ROOM.loot) { const d = dist(L, p); if (d < 420 && d < bd) { bd = d; best = L; kind = 'loot'; } }
    if (!best) for (const c of ROOM.chests) { if (c.open) continue; const d = dist(c, p); if (d < 460 && d < bd) { bd = d; best = c; kind = 'chest'; } }
    if (!best) for (const e of ROOM.enemies) { if (e.boss && p.lv < 5) continue; const d = dist(e, p); if (d < 420 && d < bd) { bd = d; best = e; kind = 'foe'; } }
    if (!best) for (const q of ROOM.players) { if (q === p || !q.alive) continue; const d = dist(q, p); if (d < 300 && d < bd) { bd = d; best = q; kind = 'foe'; } }
    if (ROOM.ph === 'exodus' && ROOM.gates.length) {
      let g = null, gd = 1e9;
      for (const G of ROOM.gates) { const d = dist(G, p); if (d < gd) { gd = d; g = G; } }
      best = g; kind = 'gate'; bd = gd;
    }
    bt.tgt = best; bt.kind = kind;
    if (!best) { bt.wx = rnd(100, MW - 100); bt.wy = rnd(100, MH - 100); }

    /* Tính lại đường đi mỗi lần nghĩ. Đường thẳng thông thì findPath trả về
       đúng 1 điểm là đích, nên trường hợp thường không tốn gì. */
    const goal = bt.tgt || { x: bt.wx, y: bt.wy };
    bt.path = findPath(p, goal);
    bt.stuck = 0;
  }

  const t = bt.tgt || { x: bt.wx, y: bt.wy };
  const d = dist(t, p);
  /* ngắm luôn vào mục tiêu, còn chân thì đi theo waypoint */
  p.in.aim = Math.atan2(t.y - p.y, t.x - p.x);

  /* bỏ waypoint đã tới nơi */
  while (bt.path && bt.path.length > 1 && dist(bt.path[0], p) < 26) bt.path.shift();
  const wp = (bt.path && bt.path.length) ? bt.path[0] : t;
  const a = Math.atan2(wp.y - p.y, wp.x - p.x);

  const wantRange = bt.kind === 'foe' ? (CLASSES[p.cls].kind === 'melee' ? 40 : 220) : 20;
  /* chỉ dừng khi đã ở waypoint CUỐI — còn đang đi vòng thì cứ đi tiếp */
  const lastLeg = !bt.path || bt.path.length <= 1;
  const go = lastLeg ? d > wantRange : true;

  /* kẹt: nhích chưa tới 6px trong 0.5 giây tuy vẫn đang cố đi -> tính lại đường,
     và né sang bên để thoát góc tường */
  if (go) {
    bt.mvT = (bt.mvT || 0) + DT;
    if (bt.mvT >= 0.5) {
      const moved = Math.hypot(p.x - (bt.lx ?? p.x), p.y - (bt.ly ?? p.y));
      if (moved < 6) {
        bt.stuck = (bt.stuck || 0) + 1;
        bt.path = findPath(p, t);
        if (bt.stuck >= 2) {                       // vẫn kẹt -> lách ngang
          bt.side = bt.side || (Math.random() < 0.5 ? 1 : -1);
          bt.dodge = 0.6;
          bt.stuck = 0;
        }
      } else { bt.stuck = 0; bt.side = 0; }
      bt.lx = p.x; bt.ly = p.y; bt.mvT = 0;
    }
  } else { bt.mvT = 0; bt.stuck = 0; bt.lx = p.x; bt.ly = p.y; }

  let mvA = a;
  if (bt.dodge > 0) { bt.dodge -= DT; mvA = a + (bt.side || 1) * 1.35; }

  p.in.up = go && Math.sin(mvA) < -0.25 ? 1 : 0;
  p.in.dn = go && Math.sin(mvA) > 0.25 ? 1 : 0;
  p.in.lf = go && Math.cos(mvA) < -0.25 ? 1 : 0;
  p.in.rt = go && Math.cos(mvA) > 0.25 ? 1 : 0;
  const canSee = bt.kind === 'foe' && losClear(p.x, p.y, t.x, t.y, 6);
  p.in.fire = (canSee && d < (CLASSES[p.cls].kind === 'melee' ? 55 : 300)) ? 1 : 0;
  p.in.use = (bt.kind === 'chest' && d < 40) ? 1 : 0;

  if (canSee && d < 340 && Math.random() < 0.02) useSkill(p, 'E');
  if (canSee && d < 260 && Math.random() < 0.012) useSkill(p, 'R');
  if (go && d > 260 && Math.random() < 0.02 &&
      losClear(p.x, p.y, p.x + Math.cos(mvA) * DASH_DIST, p.y + Math.sin(mvA) * DASH_DIST, 10)) doDash(p);
}

/* ============================ VÒNG LẶP ============================ */
function step() {
  const R = ROOM;

  if (R.ph === 'lobby') { stepLobby(); return; }

  if (R.ph === 'over') return;

  R.t += DT;

  /* --- bot --- */
  for (const p of R.players) if (p.bot) updateBot(p);

  /* --- người chơi --- */
  for (const p of R.players) updatePlayer(p);

  /* --- echo R của Song Tử --- */
  for (const p of R.players) {
    if (p.echoR > 0) { p.echoR -= DT; if (p.echoR <= 0) { p.echoR = 0; if (p.alive) doR(p); } }
  }

  updateEnemies();
  updateProjs();

  /* --- vũng độc / hào quang --- */
  for (let i = R.pools.length - 1; i >= 0; i--) {
    const pool = R.pools[i];
    pool.t -= DT;
    if (pool.ty === 'poison') for (const e of R.enemies) if (dist(e, pool) < pool.r && Math.random() < 0.1) applyPoison(e, 5);
    /* Lời Nguyền: làm chậm 45% và gây Yếu Giáp trong vùng */
    if (pool.ty === 'curse') {
      for (const e of R.enemies) if (dist(e, pool) < pool.r) { e.slow = 0.4; e.vuln = Math.max(e.vuln, 0.4); }
      for (const q of R.players) {
        if (!q.alive || q.slot === pool.own || dist(q, pool) > pool.r) continue;
        q.slow = 0.4; q.vuln = Math.max(q.vuln, 0.4);
      }
    }
    if (pool.t <= 0) R.pools.splice(i, 1);
  }

  /* --- loot hết hạn --- */
  for (let i = R.loot.length - 1; i >= 0; i--) { R.loot[i].t -= DT; if (R.loot[i].t <= 0) R.loot.splice(i, 1); }

  /* --- Bọ Cạp bị động: độc lây giữa các quái --- */
  for (const p of R.players) {
    if (p.bl.pas !== 'sco' || !p.alive) continue;
    for (const e of R.enemies) {
      if (e.poison <= 0) continue;
      for (const o of R.enemies) if (o !== e && o.poison <= 0 && dist(o, e) < 90 && Math.random() < 0.05) applyPoison(o, 5);
    }
  }

  if (R.ph === 'playing') stepPlaying();
  else if (R.ph === 'exodus') stepExodus();
}

function stepPlaying() {
  const R = ROOM;

  /* hồi sinh quái ở camp — chậm, và mỗi lượt chỉ bù 1 con cho 1 camp
     để dọn sạch một bãi thì bãi đó trống một lúc, đáng công đi dọn */
  R.campT += DT;
  if (R.campT >= CAMP_RESPAWN) {
    R.campT = 0;
    const thin = [];
    for (const c of CAMPS) {
      let n = 0;
      for (const e of R.enemies) if (!e.boss && Math.hypot(e.hx - c.x, e.hy - c.y) < 5) n++;
      if (n < c.n) thin.push(c);
    }
    /* ưu tiên bãi trống nhiều nhất, mỗi lượt bù tối đa CAMP_BURST con */
    thin.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(CAMP_BURST, thin.length); i++) spawnAtCamp(thin[i]);
  }

  /* rương mở xong thì đầy lại sau CHEST_RESPAWN giây */
  for (const c of R.chests) {
    if (!c.open) continue;
    c.rt -= DT;
    if (c.rt <= 0) { c.open = false; c.prog = 0; c.by = -1; ev({ k: 'chestUp', x: c.x, y: c.y }); }
  }

  /* blessing rơi ngẫu nhiên toàn map */
  R.blessT += DT;
  if (R.blessT >= 25) {
    R.blessT = 0;
    if (R.loot.filter(l => l.ty === 'bless').length < 4) {
      /* sàn chỉ chiếm ~45% bản đồ nên phải thử nhiều lần; hết lượt thì rơi
         vào một ô rương cho chắc chắn là chỗ đi tới được */
      let x = 0, y = 0, tr = 0, ok = false;
      while (tr < 80 && !ok) { x = rnd(80, MW - 80); y = rnd(80, MH - 80); tr++; ok = !inWall(x, y, 24); }
      if (!ok) { const c = pick(CHEST_SPOTS); x = c.x; y = c.y; }
      dropBless(x, y, null);
      ev({ k: 'toast', s: -1, m: 'Một blessing vừa hiện ra trên bản đồ' });
    }
  }

  /* buff hoàng đạo cho quái — mỗi phút, 33% */
  R.buffT += DT;
  if (R.buffT >= 60) {
    R.buffT = 0;
    let n = 0;
    for (const e of R.enemies) {
      if (e.boss || e.buff) continue;
      if (Math.random() < 0.33) { e.buff = pick(MBUFFS); n++; if (e.buff === 'tau') { e.mhp = Math.round(e.mhp * 1.4); e.hp = e.mhp; } }
    }
    if (n) ev({ k: 'toast', s: -1, m: n + ' con quái vừa được chúc phúc hoàng đạo' });
  }

  /* world boss */
  if (!R.bossUp && !R.bossDead && R.t >= BOSS_AT) spawnBoss();

  /* merchant: 30 giây đầu chưa có ai, sau đó luân phiên 3 vị trí */
  R.merchantT += DT;
  if (R.merchantOpen < 0) {
    if (R.merchantT >= MERCHANT_DELAY) {
      R.merchantT = 0; R.merchantOpen = Math.floor(Math.random() * MERCHANTS.length);
      rollStock();
      ev({ k: 'toast', s: -1, m: '⚑ Merchant đã dựng quầy ở vị trí ' + (R.merchantOpen + 1) });
      ev({ k: 'merchant', x: MERCHANTS[R.merchantOpen].x, y: MERCHANTS[R.merchantOpen].y });
    }
  } else if (R.merchantT >= MERCHANT_ROTATE) {
    R.merchantT = 0;
    R.merchantOpen = (R.merchantOpen + 1) % MERCHANTS.length;
    rollStock();
    ev({ k: 'toast', s: -1, m: '⚑ Merchant dọn sang vị trí ' + (R.merchantOpen + 1) + ' với hàng mới' });
    ev({ k: 'merchant', x: MERCHANTS[R.merchantOpen].x, y: MERCHANTS[R.merchantOpen].y });
  }

  /* hết giờ -> exodus */
  const aliveHumans = R.players.filter(p => !p.escaped);
  if (R.t >= MATCH_TIME) beginExodus('Hết 10 phút');
}

function beginExodus(reason) {
  const R = ROOM;
  R.ph = 'exodus'; R.t = 0;
  /* Cổng đứng ở đúng chỗ bản thiết kế đặt vòm đá — không rải ngẫu nhiên nữa,
     vì hai biến thể đều có sẵn bệ bát giác vẽ ngay dưới chân cổng. */
  R.gates = GATE_SPOTS.map((g, i) => ({ id: i, x: g.x, y: g.y, r: 54 }));
  ev({ k: 'toast', s: -1, m: '☄ ' + reason + ' — ' + R.gates.length + ' cổng dịch chuyển đã mở! Chạy tới cổng trong 30 giây!' });
  ev({ k: 'exodus' });
}

function stepExodus() {
  const R = ROOM;

  /* mưa thiên thạch */
  if (Math.random() < 0.55) {
    R.meteors.push({ id: UID++, x: rnd(60, MW - 60), y: rnd(60, MH - 60), t: 1.3, r: 78, done: false });
  }
  for (let i = R.meteors.length - 1; i >= 0; i--) {
    const m = R.meteors[i];
    m.t -= DT;
    if (m.t <= 0 && !m.done) {
      m.done = true;
      ev({ k: 'boom', x: m.x, y: m.y, r: m.r });
      for (const p of R.players) {
        if (!p.alive || p.escaped) continue;
        if (dist(m, p) < m.r) dmgTo(p, 55, {}, null);
      }
      for (const e of R.enemies) if (dist(m, e) < m.r) { e.hp -= 90; if (e.hp <= 0) onEnemyDown(e, null); }
    }
    if (m.t < -0.4) R.meteors.splice(i, 1);
  }

  /* tới cổng thì thoát */
  for (const p of R.players) {
    if (p.escaped || !p.alive) continue;
    for (const g of R.gates) {
      if (dist(g, p) < g.r) {
        p.escaped = true;
        ev({ k: 'toast', s: -1, m: '✦ ' + p.nm + ' đã thoát qua cổng dịch chuyển!' });
        ev({ k: 'ring', x: g.x, y: g.y, r: 80, c: '#7FD4E8' });
        break;
      }
    }
  }

  if (R.t >= EXODUS_TIME) finish();
  else if (R.players.every(p => p.escaped || !p.alive)) finish();
}

function finish() {
  const R = ROOM;
  R.ph = 'over';
  R.results = R.players.map(p => {
    /* Prototype chỉ có map 1 nên chưa nhân x2 — ghi rõ để không nhầm */
    return {
      nm: p.nm, cls: p.cls, bot: p.bot ? 1 : 0,
      escaped: p.escaped ? 1 : 0, lv: p.lv, xu: p.xu, token: p.token,
      bl: Object.assign({}, p.bl), combo: p.combo
    };
  }).sort((a, b) => (b.escaped - a.escaped) || (b.token - a.token));
  /* token chỉ giữ được nếu thoát qua cổng — cộng vào ví meta để tiêu ở sảnh */
  for (const p of R.players) {
    if (p.bot || !p.escaped) continue;
    p.metaToken += p.token;
  }
  ev({ k: 'toast', s: -1, m: 'Ván kết thúc.' });
}

function startMatch() {
  resetWorld();
  broadcastMap();          // biến thể vừa bốc — client dựng lại lớp nền theo gói này
  /* thêm bot cho đủ chỗ */
  const names = ['Bot Lâm', 'Bot Khoa', 'Bot Vy', 'Bot Nam', 'Bot Hạ', 'Bot Trí'];
  const want = Math.min(MAXP, ROOM.players.filter(p => !p.bot).length + BOTS);
  let bi = 0;
  while (ROOM.players.length < want) {
    const used = ROOM.players.map(p => p.slot);
    let slot = 0; while (used.includes(slot)) slot++;
    const b = makePlayer(null, names[bi % names.length], pick(['sw', 'ar', 'mk']), slot, true, null);
    bi++;
    ROOM.players.push(b);
  }
  /* Chỗ đứng đầu ván lấy từ SPAWNS (rải đều, xa boss). Xáo thứ tự để không ai
     luôn vào ở cùng một góc, và nhích nhẹ để 2 người cùng ô không chồng nhau. */
  const spots = SPAWNS.slice();
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[spots[i], spots[j]] = [spots[j], spots[i]]; }
  ROOM.players.forEach((p, i) => {
    const s = spots[i % spots.length];
    if (s) { p.x = s.x + rnd(-18, 18); p.y = s.y + rnd(-18, 18); if (inWall(p.x, p.y, 12)) { p.x = s.x; p.y = s.y; } }
    else { let tr = 0; do { p.x = rnd(150, MW - 150); p.y = rnd(150, MH - 150); tr++; } while (inWall(p.x, p.y, 16) && tr < 60); }
  });
  for (const p of ROOM.players) {
    p.hp = p.mhp; p.mp = p.mmp; p.alive = true; p.escaped = false;
    p.xu = 0; p.token = 0; p.lv = 1; p.xp = 0; p.xn = 40;
    p.bonusHp = 0; p.bonusAtk = 0;
    p.bl = { atk: null, e: null, r: null, pas: p.sign || null, dash: null };
    p.pts = 0; p.nodes = [p.cls + '_root']; p.usedLast = false;
    p.frenzy = 0; p.volley = null; p.lastStandBuff = 0; p.shotN = 0;
    p.stackCap = 0; p.stackAtkCap = 0; p.aliveT = 0; p.reviveLeft = 1;
    p.bought = {}; p.spdBuy = 0;
    recompute(p);
  }
  ROOM.ph = 'playing'; ROOM.t = 0;
  ev({ k: 'toast', s: -1, m: 'Bắt đầu! 10 phút săn đồ trên map 1.' });
}

/* ============================ SNAPSHOT ============================ */
function snapshot(forSlot) {
  const R = ROOM;
  const me = R.players.find(p => p.slot === forSlot);
  const seeAll = me && me.bl.pas === 'vir';

  const P = R.players.map(p => ({
    s: p.slot, nm: p.nm, cls: p.cls, bot: p.bot ? 1 : 0, br: p.br,
    x: Math.round(p.x), y: Math.round(p.y), a: Math.round(p.aim * 100) / 100,
    hp: Math.max(0, Math.round(p.hp)), mhp: p.mhp, mp: Math.round(p.mp), mmp: p.mmp,
    sh: Math.round(p.shield), lv: p.lv, al: p.alive ? 1 : 0, es: p.escaped ? 1 : 0,
    dt: Math.max(0, Math.round(p.deadT * 10) / 10),
    ps: p.poisonT > 0 ? 1 : 0, tau: p.stackTau, cb: p.combo || 0,
    bl: (p === me || seeAll) ? p.bl : undefined
  }));

  /* Ở sảnh không có gì để bắn cả — gửi mảng rỗng cho nhẹ và để client
     không vẽ nhầm quái/rương của ván trước. */
  const inLobby = R.ph === 'lobby';
  const E = inLobby ? [] : R.enemies.map(e => ({
    i: e.id, x: Math.round(e.x), y: Math.round(e.y), ty: e.ty, r: e.r,
    hp: Math.max(0, Math.round(e.hp)), mhp: e.mhp, ps: e.poisonT > 0 ? 1 : 0,
    bf: e.buff || 0, bs: e.boss ? 1 : 0
  }));

  const out = {
    t: 'state', ph: R.ph, skin: R.skin,
    tm: Math.max(0, Math.round(((R.ph === 'playing' ? MATCH_TIME : EXODUS_TIME) - R.t) * 10) / 10),
    P, E,
    R: inLobby ? [] : R.projs.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), ty: p.ty, a: Math.round(Math.atan2(p.vy, p.vx) * 100) / 100, o: p.own })),
    L: inLobby ? [] : R.loot.map(l => ({ i: l.id, x: Math.round(l.x), y: Math.round(l.y), ty: l.ty, sg: l.sign || 0, v: l.v || 0 })),
    C: inLobby ? [] : R.chests.map(c => ({ i: c.id, x: c.x, y: c.y, o: c.open ? 1 : 0 })),
    M: (inLobby || R.merchantOpen < 0) ? [] : [{ x: MERCHANTS[R.merchantOpen].x, y: MERCHANTS[R.merchantOpen].y, o: 1 }],
    G: inLobby ? [] : R.gates.map(g => ({ x: g.x, y: g.y, r: g.r })),
    MT: inLobby ? [] : R.meteors.filter(m => !m.done).map(m => ({ x: m.x, y: m.y, r: m.r, t: Math.round(m.t * 100) / 100 })),
    /* t = giây còn lại, để client nhạt dần vũng ở nhịp cuối thay vì tắt phụt */
    PO: inLobby ? [] : R.pools.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), r: p.r, ty: p.ty, t: Math.round(p.t * 10) / 10 })),
    boss: R.bossUp ? 1 : (R.bossDead ? 2 : 0),
    lobby: R.ph === 'lobby' ? 1 : 0,
    bossIn: R.ph === 'playing' && !R.bossUp && !R.bossDead ? Math.max(0, Math.round(BOSS_AT - R.t)) : -1,
    ev: R.ev
  };
  if (me) {
    out.me = {
      s: me.slot, xu: me.xu, token: me.token, xp: Math.round(me.xp), xn: me.xn,
      cdE: Math.round(me.cdE * 10) / 10, mxE: me.mxE,
      cdR: Math.round(me.cdR * 10) / 10, mxR: me.mxR,
      dc: me.dashChg, dm: me.dashMax, dcd: Math.round(me.dashCd * 10) / 10,
      bl: me.bl, combo: me.combo, prog: Math.round(me.openProg / 1.2 * 100),
      nd: me.nodes, pts: me.pts, br: me.br,
      sign: me.sign, cls: me.cls, weapon: me.weapon, mtoken: me.metaToken,
      npc: me.nearNpc, gate: me.atGate ? 1 : 0,
      nc: me.nearChest, nm2: me.nearMerchant, ready: me.ready ? 1 : 0,
      stock: R.stock,
      bought: R.stock.filter(id => me.bought && me.bought[R.merchantRot + ':' + id])
    };
  }
  if (R.ph === 'over') out.results = R.results;
  return out;
}

setInterval(() => {
  if (!ROOM.players.length) { ROOM.ev = []; return; }
  step();
  for (const p of ROOM.players) {
    if (p.bot || !p.ws) continue;
    send(p.ws, JSON.stringify(snapshot(p.slot)));
  }
  ROOM.ev = [];
}, TICK);

/* ============================ HTTP + WEBSOCKET ============================ */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/map1.html';
  const file = path.join(ROOT, path.normalize(url).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const ws = { sock, buf: Buffer.alloc(0), open: true, player: null };
  sock.on('data', d => onData(ws, d));
  sock.on('close', () => onClose(ws));
  sock.on('error', () => onClose(ws));
  send(ws, JSON.stringify({
    t: 'welcome', maxp: MAXP,
    cfg: { MW, MH, MATCH_TIME, EXODUS_TIME, SIGNS, SIGN_NM, SIGN_THEME, SLOTS, SLOT_NM, BLESS, COMBO_NM, SHOP, CLASSES, MINLV, META, LOBBY, WEAPONS },
    map: mapPacket()
  }));
});

function onData(ws, chunk) {
  ws.buf = Buffer.concat([ws.buf, chunk]);
  for (; ;) {
    const b = ws.buf;
    if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0;
    const op = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    let mask = null;
    if (masked) { if (b.length < off + 4) return; mask = b.slice(off, off + 4); off += 4; }
    if (b.length < off + len) return;
    let payload = b.slice(off, off + len);
    ws.buf = b.slice(off + len);
    if (mask) { const o = Buffer.allocUnsafe(len); for (let i = 0; i < len; i++) o[i] = payload[i] ^ mask[i & 3]; payload = o; }
    if (op === 8) { closeSock(ws); return; }
    if (op === 9) { ws.sock.write(frame(payload, 0xA)); continue; }
    if (op === 1 && fin) {
      let msg = null;
      try { msg = JSON.parse(payload.toString('utf8')); } catch (e) { continue; }
      try { handleMsg(ws, msg); } catch (e) { console.error('[msg]', e); }
    }
  }
}

function frame(payload, opcode) {
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.allocUnsafe(2); head[1] = len; }
  else if (len < 65536) { head = Buffer.allocUnsafe(4); head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.allocUnsafe(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  head[0] = 0x80 | (opcode === undefined ? 1 : opcode);
  return Buffer.concat([head, payload]);
}

function send(ws, str) {
  if (!ws || !ws.open) return;
  try { ws.sock.write(frame(Buffer.from(str, 'utf8'), 1)); } catch (e) { closeSock(ws); }
}
function closeSock(ws) { if (ws.open) { ws.open = false; try { ws.sock.destroy(); } catch (e) { } } onClose(ws); }

function onClose(ws) {
  ws.open = false;
  const p = ws.player;
  if (!p) return;
  ws.player = null;
  const i = ROOM.players.indexOf(p);
  if (i >= 0) ROOM.players.splice(i, 1);
  if (!ROOM.players.filter(q => !q.bot).length) ROOM = makeRoom();
}

function handleMsg(ws, m) {
  if (m.t === 'join') {
    if (ws.player) return;
    if (ROOM.ph !== 'lobby') { ROOM = makeRoom(); }      // ván cũ xong thì mở ván mới
    const humans = ROOM.players.filter(p => !p.bot).length;
    if (humans >= MAXP) { send(ws, JSON.stringify({ t: 'full' })); return; }
    const used = ROOM.players.map(p => p.slot);
    let slot = 0; while (used.includes(slot)) slot++;
    const cls = CLASSES[m.cls] ? m.cls : 'sw';
    const p = makePlayer(ws, m.nm, cls, slot, false, m.sg);
    ws.player = p;
    ROOM.players.push(p);
    toLobby(p);
    send(ws, JSON.stringify({ t: 'joined', slot }));
    return;
  }
  const p = ws.player;
  if (!p) return;

  switch (m.t) {
    case 'in':
      p.in.up = m.up ? 1 : 0; p.in.dn = m.dn ? 1 : 0;
      p.in.lf = m.lf ? 1 : 0; p.in.rt = m.rt ? 1 : 0;
      p.in.fire = m.fire ? 1 : 0; p.in.use = m.use ? 1 : 0;
      if (typeof m.aim === 'number' && isFinite(m.aim)) p.in.aim = m.aim;
      break;
    case 'sk': useSkill(p, m.s === 'R' ? 'R' : 'E'); break;
    case 'dash': doDash(p); break;
    case 'ready': p.ready = !!m.v; break;

    /* --- lệnh chỉ dùng trong sảnh --- */
    case 'setcls':
      if (ROOM.ph !== 'lobby' || !CLASSES[m.v]) break;
      p.cls = m.v;
      p.mxE = ESKILL[p.cls].cd; p.mxR = RSKILL[p.cls].cd;
      p.nodes = [p.cls + '_root']; p.pts = 0;      // cây gắn theo class
      if (WEAPON_BY_ID[p.weapon] && WEAPON_BY_ID[p.weapon].cls !== p.cls) p.weapon = null;
      recompute(p); p.hp = p.mhp; p.mp = p.mmp;
      break;
    case 'setsign':
      if (ROOM.ph !== 'lobby' || !SIGNS.includes(m.v)) break;
      p.sign = m.v; p.bl.pas = m.v;
      recompute(p);
      break;
    case 'buyw': {
      if (ROOM.ph !== 'lobby') break;
      const w = WEAPON_BY_ID[m.id];
      if (!w || w.cls !== p.cls) break;
      if (p.weapon === w.id) break;
      if (p.metaToken < w.cost) break;
      p.metaToken -= w.cost; p.weapon = w.id;
      recompute(p); p.hp = p.mhp;
      break;
    }
    case 'enter':
      if (ROOM.ph !== 'lobby' || !p.sign) break;
      p.ready = true;
      break;
    case 'node': {
      const id = String(m.id || '');
      if (!canAlloc(p, id)) break;
      p.pts -= META[id].cost;
      p.nodes.push(id);
      recompute(p);
      ev({ k: 'toast', s: p.slot, m: 'Mở kỹ năng: ' + id });
      break;
    }
    case 'pick':
      if (!p.pending) return;
      if (p.pending.signs.includes(m.sign)) setBless(p, m.sign, m.slot);
      p.pending = null;
      break;
    case 'skip': p.pending = null; break;
    case 'buy': buy(p, m.id, m.slot); break;
    case 'again':
      /* Về SẢNH chứ không reload: token đã thoát được cộng vào ví meta,
         class / cung / vũ khí giữ nguyên để đi ván tiếp. */
      if (ROOM.ph === 'over') {
        ROOM.ph = 'lobby'; ROOM.t = 0; ROOM.results = null;
        resetWorld();
        broadcastMap();
        for (const q of ROOM.players) { if (!q.bot) toLobby(q); }
        ROOM.players = ROOM.players.filter(q => !q.bot);
      }
      break;
  }
}

server.listen(PORT, () => {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  console.log('');
  console.log('  ZODIAC ARENA — PROTOTYPE MAP 1');
  console.log('  ------------------------------------');
  console.log('  Máy này :  http://localhost:' + PORT);
  for (const ip of ips) console.log('  Máy khác:  http://' + ip + ':' + PORT);
  console.log('');
  console.log('  Ván ' + MATCH_TIME + 's + ' + EXODUS_TIME + 's thoát · ' + BOTS + ' bot · boss ở giây ' + BOSS_AT);
  console.log('  Ván ngắn để test:  MATCH_TIME=90 node map1-server.js');
  console.log('');
});
