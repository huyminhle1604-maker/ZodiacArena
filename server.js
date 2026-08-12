'use strict';
/* Zodiac Arena — server thẩm quyền (authoritative), zero-dependency.
 * Chạy: node server.js   (đổi cổng: PORT=9000 node server.js)
 * Toàn bộ game logic nằm ở đây. Client chỉ gửi input + vẽ lại snapshot.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;

/* ============================ HẰNG SỐ GAME ============================ */
const TICK = 1000 / 30;
const DT = 1 / 30;
const W = 960, H = 560;          // arena cố định, 1 màn hình
const MAXP = 3;                  // tối đa 3 người / phòng
const LOADOUT_PTS = 10;          // điểm kỹ năng cấp sẵn ở PvP
const ROUND_TIME = 60;
const COUNTDOWN = 3;
const WIN_ROUNDS = 3;            // BO5
const ROUNDOVER_TIME = 3.5;
const RESPAWN_TIME = 6;          // co-op
const SHIELD_LEAK = 10;          // nerf tank: khiên rò rỉ 10/s trong duel
const DR_DUEL_SCALE = 0.7;       // nerf tank: dr chỉ 70% hiệu lực trong duel

/* Chỉ số gốc mỗi class. rate = giây giữa 2 đòn thường. */
const CLASSES = {
  sw: { nm: 'Kiếm sĩ', hp: 130, mp: 60, spd: 2.6, atk: 11, rng: 46, rate: 0.42, kind: 'melee', A: 'Vệ Binh', B: 'Cuồng Chiến' },
  ar: { nm: 'Xạ thủ', hp: 92, mp: 72, spd: 3.1, atk: 9, rng: 330, rate: 0.36, kind: 'bow', A: 'Cung Thủ', B: 'Nỏ Thủ' },
  mk: { nm: 'Nhà sư', hp: 100, mp: 115, spd: 2.8, atk: 8, rng: 260, rate: 0.48, kind: 'staff', A: 'Trị Liệu', B: 'Cầu Nguyện' }
};

/* Kỹ năng E (trunk) và R (theo nhánh): cost mana + cooldown giây. */
const ESKILL = {
  sw: { nm: 'Chém Xoay', cost: 12, cd: 6 },
  ar: { nm: 'Mũi Xuyên', cost: 14, cd: 5 },
  mk: { nm: 'Sóng Âm', cost: 12, cd: 6 }
};
const RSKILL = {
  sw: { A: { nm: 'Khiên Thánh', cost: 20, cd: 12 }, B: { nm: 'Cuồng Nộ', cost: 20, cd: 14 } },
  ar: { A: { nm: 'Mưa Tên', cost: 25, cd: 13 }, B: { nm: 'Nỏ Liên Thanh', cost: 22, cd: 11 } },
  mk: { A: { nm: 'Chữa Lành', cost: 25, cd: 10 }, B: { nm: 'Lời Nguyền', cost: 22, cd: 12 } }
};

/* ============================ CÂY KỸ NĂNG ============================ */
/* 16 node / class × 3 class = 48 node.
 * slot: root, e, p0, p1, X_root, X_4a, X_4b, X_5a, X_5b, X_key (X = A|B)
 * gate theo level; keystone cần 1 TRONG 2 đường tier-5 (mode 'any'). */
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

/* Bảng hiệu ứng 48 node. Node chỉ đặt cờ / cộng chỉ số;
 * cơ chế runtime được hook trong dmgTo / updatePlayer / passiveTick / doSkill. */
function applyFx(p, id) {
  const f = p.fx;
  switch (id) {
    /* ---------- KIẾM SĨ ---------- */
    case 'sw_root': p.mhp += 14; p.atk += 1; break;
    case 'sw_e': f.hasE = 1; break;
    case 'sw_p0': p.dr += 0.08; break;
    case 'sw_p1': p.reg += 0.7; break;
    case 'sw_A_root': p.mhp += 22; p.dr += 0.04; break;
    case 'sw_A_4a': p.dr += 0.10; p.spd -= 0.15; break;             // Giáp Nặng
    case 'sw_A_4b': f.tauntPlus = 1; f.shieldPlus = 15; break;      // Khiêu Chiến
    case 'sw_A_5a': f.reflect = 0.25; break;                        // Phản Đòn
    case 'sw_A_5b': f.guard = 0.25; break;                          // Hộ Vệ (trích 25% dmg đồng đội)
    case 'sw_A_key': f.bulwark = 1; break;                          // Bất Hoại Thành
    case 'sw_B_root': p.atk += 6; p.spd += 0.1; break;
    case 'sw_B_4a': p.ls += 0.08; break;                            // Khát Máu
    case 'sw_B_4b': p.dmgM += 0.20; p.rateM *= 1.15; break;         // Chém Mạnh (mạnh hơn, chậm hơn)
    case 'sw_B_5a': f.rage = 0.25; break;                           // Máu Điên (<50% HP)
    case 'sw_B_5b': f.whirl2 = 1; break;                            // Xoáy Lốc (E đánh 2 lần)
    case 'sw_B_key': f.lastStand = 1; break;                        // Tử Chiến (cheat death)

    /* ---------- XẠ THỦ ---------- */
    case 'ar_root': p.atk += 1; p.crit += 0.05; break;
    case 'ar_e': f.hasE = 1; break;
    case 'ar_p0': p.spd += 0.35; break;
    case 'ar_p1': p.rateM *= 0.88; break;
    case 'ar_A_root': p.crit += 0.05; p.rngM += 0.05; break;
    case 'ar_A_4a': p.crit += 0.12; break;                          // Trúng Đích
    case 'ar_A_4b': p.rngM += 0.25; f.farDmg = 1; break;            // Bắn Xa
    case 'ar_A_5a': p.critM += 0.45; break;                         // Chí Mạng
    case 'ar_A_5b': p.projN = 3; f.spreadPen = 0.6; break;          // Đa Tiễn
    case 'ar_A_key': f.hunter = 1; break;                           // Thợ Săn
    case 'ar_B_root': p.atk += 7; p.rateM *= 1.18; break;
    case 'ar_B_4a': f.heavyBolt = 1; p.dmgM += 0.25; break;         // Bu-lông Nặng
    case 'ar_B_4b': f.armorPen = 0.5; f.vulnOnHit = 1; break;       // Xuyên Giáp
    case 'ar_B_5a': f.rcdCut = 0.35; break;                         // Nạp Nhanh
    case 'ar_B_5b': f.trapBoom = 1; break;                          // Bẫy Nổ
    case 'ar_B_key': f.deathShot = 1; break;                        // Phát Bắn Tử Thần (đòn thứ 5 ×3)

    /* ---------- NHÀ SƯ ---------- */
    case 'mk_root': p.mmp += 18; p.mreg += 0.5; break;
    case 'mk_e': f.hasE = 1; break;
    case 'mk_p0': p.mreg += 1.0; break;
    case 'mk_p1': p.dmgM += 0.10; break;
    case 'mk_A_root': p.mhp += 12; f.healBase = 30; break;
    case 'mk_A_4a': f.healM = (f.healM || 1) + 0.2; f.fastRes = 1; break;  // Hồi Sinh Nhanh
    case 'mk_A_4b': f.healShield = 20; break;                       // Lá Chắn Sinh Mệnh
    case 'mk_A_5a': f.auraHeal = 0.8; break;                        // Hào Quang
    case 'mk_A_5b': f.resurrect = 1; break;                         // Phục Sinh
    case 'mk_A_key': f.fountain = 1; break;                         // Suối Nguồn
    case 'mk_B_root': p.atk += 2; p.mreg += 0.4; break;
    case 'mk_B_4a': f.weaken = 0.12; break;                         // Suy Nhược (global)
    case 'mk_B_4b': f.mark = 0.15; break;                           // Trừng Phạt
    case 'mk_B_5a': f.burn = 1; break;                              // Ánh Sáng Thiêu
    case 'mk_B_5b': p.ls += 0.12; f.soulDrain = 1; break;           // Đoạt Hồn
    case 'mk_B_key': f.judgement = 1; break;                        // Phán Xét
  }
}

/* ============================ CUNG HOÀNG ĐẠO ============================ */
/* Buff nền toàn cục. Vì sinh từ DOB nên cố ý giữ ở mức "cảm nhận được"
 * chứ không dùng để cân bằng nặng. */
const ZKEYS = ['ari', 'tau', 'gem', 'can', 'leo', 'vir', 'lib', 'sco', 'sag', 'cap', 'aqu', 'pis'];

function zBase(p) {
  if (p.z === 'pis') { p.mmp *= 1.8; p.mreg += 0.6; }       // Song Ngư
  if (p.z === 'tau') { p.mhp += 8; }                        // Kim Ngưu
}

/* Hệ số sát thương gây ra (nhân) */
function zDmg(p, t, dist) {
  let m = 1;
  switch (p.z) {
    case 'ari': if (p.zOpen) m *= 2; break;                              // Bạch Dương: đòn mở trận ×2
    case 'leo': m *= 1 + 0.06 * Math.min(5, p.zNear || 0); break;        // Sư Tử: càng đông địch càng mạnh
    case 'lib': {                                                        // Thiên Bình: HP% ≈ MP%
      const d = Math.abs(p.hp / p.mhp - p.mp / p.mmp);
      if (d < 0.15) m *= 1.18;
      break;
    }
    case 'sag': m *= 1 + 0.30 * Math.min(1, (dist || 0) / 300); break;   // Nhân Mã: xa hơn mạnh hơn
    case 'cap': m *= 1 + Math.min(0.30, (p.zTime || 0) * 0.0015); break; // Ma Kết: ramp theo thời gian
    case 'gem': break;                                                   // Song Tử: xử lý ở tốc đánh
  }
  return m;
}

/* Cộng thêm tỉ lệ crit */
function zCrit(p) {
  switch (p.z) {
    case 'vir': return Math.min(0.30, (p.zClean || 0) * 0.03);   // Xử Nữ: chuỗi không dính đòn
    case 'sco': return 0.06;                                     // Bọ Cạp
    default: return 0;
  }
}

/* Hệ số sát thương NHẬN (nhân) */
function zDr(p) {
  if (p.z === 'tau' && (p.stillT || 0) > 0.6) return 0.65;       // Kim Ngưu đứng yên −35%
  return 1;
}

/* Hồi máu / mana theo giây */
function zReg(p) {
  if (p.z === 'can' && p.hp / p.mhp < 0.4) return 3;             // Cự Giải: máu thấp hồi mạnh
  return 1;
}

/* ============================ ORB (PvP) ============================ */
const ORBS = ['heal', 'shield', 'mana', 'dmg', 'def'];

function applyOrb(p, ty, room) {
  switch (ty) {
    case 'heal': p.hp = Math.min(p.mhp, p.hp + p.mhp * 0.25); break;
    case 'shield': p.shield += 30; break;
    case 'mana': p.mp = Math.min(p.mmp, p.mp + p.mmp * 0.25); break;
    case 'dmg': p.buffDmg = 5; break;
    case 'def': p.buffDef = 5; break;
  }
  ev(room, { k: 'orb', x: p.x, y: p.y, ty });
  ev(room, { k: 'toast', s: p.slot, m: 'Orb: ' + ty });
}

/* ============================ PHÒNG & NGƯỜI CHƠI ============================ */
let UID = 1;

function makeRoom(mode) {
  return {
    mode,
    players: [],
    enemies: [],
    projs: [],
    zones: [],
    orbs: [],
    ev: [],
    time: 0,
    wave: 0,
    waveT: 2,
    orbT: 5,
    weaken: 0,
    duel: {
      ph: 'loadout', score: [0, 0, 0], ready: [false, false, false],
      t: 0, winner: -1, result: null, rk: [], round: 1
    }
  };
}
const ROOMS = { coop: makeRoom('coop'), duel: makeRoom('duel') };

function makePlayer(ws, nm, cls, z, slot) {
  const p = {
    id: UID++, ws, slot, nm: String(nm || 'Người chơi').slice(0, 12), cls, z,
    /* co-op: mỗi cấp +1 điểm, nên bắt đầu là 0 (tier-1 vốn cần cấp 2).
       PvP ghi đè thành LOADOUT_PTS ngay khi join. */
    lv: 1, xp: 0, xn: 20, pts: 0, nodes: [cls + '_root'],
    x: 200 + slot * 260, y: H / 2, aim: 0, alive: true, deadT: 0,
    hp: 1, mp: 1, shield: 0,
    cdE: 0, cdR: 0, atkT: 0,
    in: { up: 0, dn: 0, lf: 0, rt: 0, aim: 0, fire: 0 },
    fx: {}, br: null,
    /* trạng thái runtime */
    poison: 0, poisonT: 0, slow: 0, vuln: 0, vulnT: 0, mark: 0,
    buffDmg: 0, buffDef: 0, frenzy: 0, hasteT: 0,
    stillT: 0, zOpen: true, zClean: 0, zTime: 0, zNear: 0,
    shotN: 0, volley: null, usedLast: false, eliminated: false
  };
  recompute(p);
  p.hp = p.mhp; p.mp = p.mmp;
  return p;
}

/* Dựng lại toàn bộ chỉ số từ base + duyệt nodes. */
function recompute(p) {
  const c = CLASSES[p.cls];
  p.mhp = c.hp; p.mmp = c.mp; p.spd = c.spd; p.atk = c.atk;
  p.rng = c.rng; p.rate = c.rate;
  p.crit = 0.05; p.critM = 1.8; p.dr = 0; p.ls = 0;
  p.reg = 0.5; p.mreg = 1.4;
  p.dmgM = 1; p.rateM = 1; p.rngM = 1; p.projN = 1;
  p.fx = {};
  p.br = null;

  for (const id of p.nodes) applyFx(p, id);
  for (const id of p.nodes) {
    const m = META[id];
    if (m && m.br && m.t === 3) p.br = m.br;
  }
  zBase(p);

  p.mhp = Math.round(p.mhp);
  p.mmp = Math.round(p.mmp);
  p.dr = Math.min(0.6, p.dr);
  p.spd = Math.max(1.2, p.spd);
  p.hasE = !!p.fx.hasE;
  p.hasR = !!p.br;
  p.mxE = ESKILL[p.cls].cd;
  p.mxR = p.br ? RSKILL[p.cls][p.br].cd * (1 - (p.fx.rcdCut || 0)) : 0;
  if (p.hp > p.mhp) p.hp = p.mhp;
  if (p.mp > p.mmp) p.mp = p.mmp;
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
    if (p.br === other) return false;                    // nhánh loại trừ nhau
  }
  if (m.req.length) {
    const ok = m.mode === 'any'
      ? m.req.some(r => p.nodes.includes(r))
      : m.req.every(r => p.nodes.includes(r));
    if (!ok) return false;
  }
  return true;
}

/* ============================ TIỆN ÍCH ============================ */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function ev(room, e) { if (room.ev.length < 120) room.ev.push(e); }

/* Chọn mục tiêu — dùng chung cho coop & PvP.
 * coop → quái; duel → tất cả người còn sống khác (FFA). */
function targetsFor(slot, room) {
  if (room.mode === 'coop') return room.enemies;
  return room.players.filter(o => o.slot !== slot && o.alive && !o.eliminated);
}
function alliesOf(p, room) {
  if (room.mode !== 'coop') return [];
  return room.players.filter(o => o !== p && o.alive);
}

/* ============================ SÁT THƯƠNG ============================ */
/* t có thể là QUÁI hoặc NGƯỜI (phát hiện qua t.slot). */
function dmgTo(t, base, sp, kb, src, room) {
  if (!t || t.hp <= 0) return 0;
  sp = sp || {};
  const isP = t.slot !== undefined;
  if (isP && (!t.alive || t.eliminated)) return 0;

  let d = base;

  /* --- bên gây sát thương --- */
  if (src) {
    const dd = dist(src, t);
    d *= zDmg(src, t, dd);
    if (src.fx.farDmg) d *= 1 + 0.2 * Math.min(1, dd / 350);
    if (src.fx.rage && src.hp / src.mhp < 0.5) d *= 1 + src.fx.rage;
    if (src.fx.hunter && t.hp / (t.mhp || 1) > 0.7) d *= 1.2;
    if (src.fx.mark && t.mark > 0) d *= 1 + src.fx.mark;
    if (src.fx.judgement && (t.slow > 0 || t.vuln > 0)) d *= 1.35;
    if (src.buffDmg > 0) d *= 1.25;
    if (src.frenzy > 0) d *= 1.25;
    if (src.lastStandBuff > 0) d *= 1.5;

    /* crit */
    if (!sp.noCrit) {
      const ch = src.crit + zCrit(src);
      if (sp.crit || Math.random() < ch) {
        d *= src.critM;
        sp.wasCrit = true;
        /* Bọ Cạp: chí mạng gieo độc */
        if (src.z === 'sco') { t.poison = Math.max(t.poison, base * 0.3); t.poisonT = 4; t.poisonSrc = src.slot; }
        if (src.fx.hunter) src.cdR = Math.max(0, src.cdR - 1);
      }
    }
    /* Bạch Dương: tiêu đòn mở trận */
    if (src.z === 'ari' && src.zOpen) { src.zOpen = false; src.zOpenT = 0; }
  }

  /* --- bên nhận --- */
  if (t.vuln > 0) d *= 1 + t.vuln;
  if (room && room.weaken && src && room.mode === 'coop') { /* Suy Nhược áp lên quái, không lên player */ }

  if (isP) {
    d *= zDr(t);
    let dr = t.dr;
    if (room && room.mode === 'duel') dr *= DR_DUEL_SCALE;
    if (src && src.fx.armorPen) dr *= (1 - src.fx.armorPen);
    if (t.buffDef > 0) dr += 0.25;
    d *= Math.max(0.25, 1 - dr);
    if (room && room.weaken && src && src.slot !== undefined) {
      /* aura Suy Nhược của Prayer: giảm dmg người khác gây ra */
      if (!src.fx.weaken) d *= 1 - room.weaken;
    }

    /* Hộ Vệ: đồng đội Vệ Binh gánh 25% */
    if (room && room.mode === 'coop') {
      const g = room.players.find(o => o !== t && o.alive && o.fx.guard && dist(o, t) < 220);
      if (g) {
        const share = d * g.fx.guard;
        d -= share;
        absorb(g, share, room);
      }
    }
  } else if (room && room.weaken) {
    /* quái bị Suy Nhược thì yếu đi ở khâu tấn công, không ở đây */
  }

  d = Math.max(1, Math.round(d));

  /* khiên hấp thụ (chỉ người) */
  if (isP && t.shield > 0) {
    const a = Math.min(t.shield, d);
    t.shield -= a; d -= a;
    ev(room, { k: 'shield', x: t.x, y: t.y, d: a });
  }

  t.hp -= d;

  /* Xử Nữ: reset chuỗi sạch đòn */
  if (isP) t.zClean = 0;

  /* Phản Đòn */
  if (isP && t.fx.reflect && src && sp.melee) {
    const r = Math.round(d * t.fx.reflect);
    if (r > 0 && src.hp > 0) dmgTo(src, r, { noCrit: true, noReflect: true }, 0, null, room);
  }

  /* lifesteal */
  if (src && src.ls > 0 && src.alive) {
    src.hp = Math.min(src.mhp, src.hp + d * src.ls);
    if (src.fx.soulDrain) src.mp = Math.min(src.mmp, src.mp + d * 0.15);
  }

  /* Bảo Bình: proc ngẫu nhiên */
  if (src && src.z === 'aqu' && Math.random() < 0.12) {
    const r = Math.random();
    if (r < 0.4) { t.hp -= d; ev(room, { k: 'toast', s: src.slot, m: 'Bảo Bình: đòn kép!' }); }
    else if (r < 0.7) { src.hp = Math.min(src.mhp, src.hp + 8); ev(room, { k: 'heal', x: src.x, y: src.y, d: 8 }); }
    else { src.cdE = Math.max(0, src.cdE - 1.5); src.cdR = Math.max(0, src.cdR - 1.5); }
  }

  /* Xuyên Giáp: gây vulnerable */
  if (src && src.fx.vulnOnHit) { t.vuln = Math.max(t.vuln, 0.15); t.vulnT = 3; }
  /* Trừng Phạt: đánh dấu */
  if (src && src.fx.mark) { t.mark = 3; }

  /* knockback */
  if (kb && src) {
    const a = Math.atan2(t.y - src.y, t.x - src.x);
    t.x = clamp(t.x + Math.cos(a) * kb, 16, W - 16);
    t.y = clamp(t.y + Math.sin(a) * kb, 16, H - 16);
  }

  ev(room, { k: 'hit', x: t.x, y: t.y, d, c: sp.wasCrit ? 1 : 0 });

  if (t.hp <= 0) {
    if (isP) onPlayerDown(t, room, src);
    else onEnemyDown(t, room, src);
  }
  return d;
}

function absorb(p, amount, room) {
  let d = Math.round(amount);
  if (p.shield > 0) { const a = Math.min(p.shield, d); p.shield -= a; d -= a; }
  if (d > 0) { p.hp -= d; ev(room, { k: 'hit', x: p.x, y: p.y, d, c: 0 }); }
  if (p.hp <= 0) onPlayerDown(p, room, null);
}

function healTo(t, amount, room, srcP) {
  if (!t || !t.alive) return 0;
  let a = amount * ((srcP && srcP.fx.healM) || 1);
  if (srcP && srcP.fx.fountain) a *= 2;
  const before = t.hp;
  t.hp = Math.min(t.mhp, t.hp + a);
  const done = t.hp - before;
  if (srcP && srcP.fx.fountain) { t.poison = 0; t.poisonT = 0; const over = a - done; if (over > 0) t.shield += Math.round(over * 0.5); }
  if (srcP && srcP.fx.healShield) t.shield += srcP.fx.healShield;
  ev(room, { k: 'heal', x: t.x, y: t.y, d: Math.round(done) });
  return done;
}

/* ============================ QUÁI (CO-OP) ============================ */
const ETYPES = {
  slime: { hp: 34, spd: 1.05, dmg: 7, r: 13, xp: 6 },
  runner: { hp: 22, spd: 2.0, dmg: 5, r: 10, xp: 7 },
  brute: { hp: 95, spd: 0.7, dmg: 15, r: 19, xp: 18 },
  caster: { hp: 40, spd: 0.9, dmg: 9, r: 12, xp: 13, ranged: true }
};

function spawnEnemy(room, ty, wave) {
  const b = ETYPES[ty];
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  if (edge === 0) { x = Math.random() * W; y = -20; }
  else if (edge === 1) { x = W + 20; y = Math.random() * H; }
  else if (edge === 2) { x = Math.random() * W; y = H + 20; }
  else { x = -20; y = Math.random() * H; }
  const hp = Math.round(b.hp * (1 + wave * 0.18));
  room.enemies.push({
    id: UID++, ty, x, y, r: b.r, hp, mhp: hp,
    spd: b.spd, dmg: b.dmg * (1 + wave * 0.10), xp: b.xp + wave,
    cd: 0, poison: 0, poisonT: 0, slow: 0, vuln: 0, vulnT: 0, mark: 0,
    taunt: 0, tauntBy: -1, ranged: !!b.ranged
  });
}

function onEnemyDown(e, room, src) {
  e.hp = 0;
  ev(room, { k: 'die', x: e.x, y: e.y, ty: e.ty });
  const alive = room.players.filter(p => p.alive);
  const share = Math.max(1, Math.round(e.xp / Math.max(1, alive.length * 0.6)));
  for (const p of room.players) gainXp(p, share, room);
}

function gainXp(p, amount, room) {
  p.xp += amount;
  while (p.xp >= p.xn) {
    p.xp -= p.xn;
    p.lv++;
    p.pts++;
    p.xn = Math.round(20 + p.lv * 14);
    const ratio = p.hp / p.mhp;
    recompute(p);
    p.hp = Math.min(p.mhp, Math.max(p.hp, p.mhp * Math.min(1, ratio + 0.25)));
    ev(room, { k: 'level', s: p.slot, lv: p.lv });
    ev(room, { k: 'toast', s: p.slot, m: 'Lên cấp ' + p.lv + '! +1 điểm (T)' });
  }
}

/* ============================ ĐẠN & VÙNG ============================ */
function shoot(room, p, ang, dmg, opt) {
  opt = opt || {};
  room.projs.push({
    id: UID++, own: p.slot, x: p.x, y: p.y,
    vx: Math.cos(ang) * (opt.sp || 9), vy: Math.sin(ang) * (opt.sp || 9),
    dmg, r: opt.r || 5, life: opt.life || 1.6,
    ty: opt.ty || (p.cls === 'ar' ? 'arrow' : 'orbp'),
    pierce: opt.pierce || 0, hit: [], boom: opt.boom || 0, ownerRef: p
  });
}

function enemyShoot(room, e, tgt) {
  room.projs.push({
    id: UID++, own: -1, x: e.x, y: e.y,
    vx: (tgt.x - e.x), vy: (tgt.y - e.y),
    dmg: e.dmg, r: 5, life: 2.4, ty: 'evil', pierce: 0, hit: []
  });
  const pr = room.projs[room.projs.length - 1];
  const m = Math.hypot(pr.vx, pr.vy) || 1;
  pr.vx = pr.vx / m * 5; pr.vy = pr.vy / m * 5;
}

function updateProjs(room) {
  for (let i = room.projs.length - 1; i >= 0; i--) {
    const pr = room.projs[i];
    pr.x += pr.vx; pr.y += pr.vy; pr.life -= DT;
    if (pr.life <= 0 || pr.x < -40 || pr.x > W + 40 || pr.y < -40 || pr.y > H + 40) {
      if (pr.boom && pr.ownerRef) aoe(room, pr.ownerRef, pr.x, pr.y, 70, pr.dmg * 0.8, 4);
      room.projs.splice(i, 1);
      continue;
    }
    if (pr.own === -1) {
      /* đạn quái → bắn người */
      for (const p of room.players) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - pr.x, p.y - pr.y) < 14 + pr.r) {
          /* Suy Nhược cũng làm yếu đạn của quái */
          dmgTo(p, pr.dmg * (1 - room.weaken), { noCrit: true }, 2, null, room);
          room.projs.splice(i, 1);
          break;
        }
      }
      continue;
    }
    const src = room.players.find(o => o.slot === pr.own);
    const list = targetsFor(pr.own, room);
    let removed = false;
    for (const t of list) {
      if (t.hp <= 0) continue;
      if (pr.hit.includes(t.id)) continue;
      const rr = (t.r || 14) + pr.r;
      if (Math.hypot(t.x - pr.x, t.y - pr.y) < rr) {
        dmgTo(t, pr.dmg, {}, 3, src, room);
        if (pr.boom) { aoe(room, src, pr.x, pr.y, 70, pr.dmg * 0.8, 4); removed = true; break; }
        pr.hit.push(t.id);
        if (pr.pierce > 0) pr.pierce--;
        else { removed = true; break; }
      }
    }
    if (removed) room.projs.splice(i, 1);
  }
}

function aoe(room, src, x, y, r, dmg, kb, sp) {
  const list = targetsFor(src ? src.slot : -99, room);
  for (const t of list) {
    if (t.hp <= 0) continue;
    if (Math.hypot(t.x - x, t.y - y) < r + (t.r || 14)) {
      dmgTo(t, dmg, Object.assign({}, sp), kb, src, room);
    }
  }
  ev(room, { k: 'ring', x, y, r });
}

function updateZones(room) {
  for (let i = room.zones.length - 1; i >= 0; i--) {
    const z = room.zones[i];
    z.t -= DT;
    z.tick -= DT;
    const src = room.players.find(o => o.slot === z.own);
    if (z.tick <= 0) {
      z.tick = z.rate;
      const list = targetsFor(z.own, room);
      for (const t of list) {
        if (t.hp <= 0) continue;
        if (Math.hypot(t.x - z.x, t.y - z.y) > z.r + (t.r || 14)) continue;
        if (z.k === 'rain') dmgTo(t, z.dmg, { noCrit: false }, 0, src, room);
        else if (z.k === 'curse') { t.slow = 0.45; t.slowT = 0.6; t.vuln = Math.max(t.vuln, 0.20); t.vulnT = 1.2; }
      }
      if (z.k === 'rain') ev(room, { k: 'ring', x: z.x, y: z.y, r: z.r });
    }
    if (z.t <= 0) room.zones.splice(i, 1);
  }
}

/* ============================ KỸ NĂNG ============================ */
function attack(p, room) {
  const rng = p.rng * p.rngM;
  const c = CLASSES[p.cls];
  p.shotN++;
  let mult = 1;
  if (p.fx.deathShot && p.shotN % 5 === 0) { mult = 3; ev(room, { k: 'toast', s: p.slot, m: 'Phát Bắn Tử Thần!' }); }

  if (c.kind === 'melee') {
    const list = targetsFor(p.slot, room);
    let hitAny = false;
    for (const t of list) {
      if (t.hp <= 0) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d > rng + (t.r || 14)) continue;
      if (Math.abs(angDiff(Math.atan2(t.y - p.y, t.x - p.x), p.aim)) > 0.8) continue;
      dmgTo(t, p.atk * p.dmgM * mult, { melee: true }, 4, p, room);
      hitAny = true;
    }
    ev(room, { k: 'slash', x: p.x, y: p.y, a: p.aim, r: rng, s: p.slot });
    if (!hitAny) { /* hụt */ }
  } else {
    const n = p.projN;
    const pen = n > 1 ? (p.fx.spreadPen || 1) : 1;
    /* tốc độ đạn phải khớp với life để tầm bay đúng bằng rng */
    const sp = p.fx.heavyBolt ? 8 : (p.cls === 'ar' ? 11 : 8);
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.16;
      shoot(room, p, p.aim + off, p.atk * p.dmgM * pen * mult, {
        sp, life: rng / sp / 30,
        ty: p.cls === 'ar' ? (p.br === 'B' ? 'bolt' : 'arrow') : 'orbp'
      });
    }
  }
}

function useSkill(p, s, room) {
  if (!p.alive) return;
  if (room.mode === 'duel' && room.duel.ph !== 'playing') return;
  if (s === 'E') {
    if (!p.hasE || p.cdE > 0) return;
    const k = ESKILL[p.cls];
    if (p.mp < k.cost) return;
    p.mp -= k.cost; p.cdE = k.cd;
    doSkill(p, 'E', room);
  } else {
    if (!p.hasR || p.cdR > 0) return;
    const k = RSKILL[p.cls][p.br];
    if (p.mp < k.cost) return;
    p.mp -= k.cost; p.cdR = p.mxR;
    doSkill(p, 'R', room);
  }
  if (p.z === 'gem') p.hasteT = 3;   // Song Tử: dùng skill → +tốc đánh
  ev(room, { k: 'cast', x: p.x, y: p.y, s: p.slot });
}

function doSkill(p, s, room) {
  const aimX = clamp(p.x + Math.cos(p.aim) * 170, 30, W - 30);
  const aimY = clamp(p.y + Math.sin(p.aim) * 170, 30, H - 30);

  if (p.cls === 'sw') {
    if (s === 'E') {                                  // Chém Xoay
      const times = p.fx.whirl2 ? 2 : 1;
      for (let i = 0; i < times; i++) aoe(room, p, p.x, p.y, 78, p.atk * p.dmgM * 1.6, 8, { melee: true });
      ev(room, { k: 'ring', x: p.x, y: p.y, r: 78 });
    } else if (p.br === 'A') {                        // Khiên Thánh
      p.shield += 40 + (p.fx.shieldPlus || 0);
      const R = p.fx.tauntPlus ? 260 : 200;
      if (room.mode === 'coop') {
        for (const e of room.enemies) if (dist(e, p) < R) { e.taunt = 4; e.tauntBy = p.slot; }
      } else {
        for (const o of targetsFor(p.slot, room)) if (dist(o, p) < R) { o.slow = 0.35; o.slowT = 2.5; o.vuln = Math.max(o.vuln, 0.12); o.vulnT = 2.5; }
      }
      ev(room, { k: 'ring', x: p.x, y: p.y, r: R });
    } else {                                          // Cuồng Nộ
      p.frenzy = 6;
      ev(room, { k: 'toast', s: p.slot, m: 'Cuồng Nộ!' });
    }
  }

  if (p.cls === 'ar') {
    if (s === 'E') {                                  // Mũi Xuyên
      shoot(room, p, p.aim, p.atk * p.dmgM * 2.2, {
        sp: 14, life: 1.4, pierce: 3, ty: 'pierce', r: 7,
        boom: p.fx.trapBoom ? 1 : 0
      });
    } else if (p.br === 'A') {                        // Mưa Tên
      room.zones.push({ k: 'rain', own: p.slot, x: aimX, y: aimY, r: 92, t: 2.2, tick: 0, rate: 0.35, dmg: p.atk * p.dmgM * 0.7 });
    } else {                                          // Nỏ Liên Thanh
      p.volley = { n: 6, t: 0, gap: 0.09, dmg: p.atk * p.dmgM * 1.1 };
    }
  }

  if (p.cls === 'mk') {
    if (s === 'E') {                                  // Sóng Âm
      const list = targetsFor(p.slot, room);
      for (const t of list) {
        if (t.hp <= 0) continue;
        const d = dist(t, p);
        if (d > 190) continue;
        if (Math.abs(angDiff(Math.atan2(t.y - p.y, t.x - p.x), p.aim)) > 0.7) continue;
        dmgTo(t, p.atk * p.dmgM * 1.4, {}, 14, p, room);
        if (p.fx.burn) { t.poison = Math.max(t.poison, p.atk * 0.25); t.poisonT = 4; t.poisonSrc = p.slot; }
      }
      ev(room, { k: 'cone', x: p.x, y: p.y, a: p.aim, r: 190 });
    } else if (p.br === 'A') {                        // Chữa Lành
      const base = p.fx.healBase || 30;
      healTo(p, base, room, p);
      for (const a of alliesOf(p, room)) if (dist(a, p) < 220) healTo(a, base, room, p);
      ev(room, { k: 'ring', x: p.x, y: p.y, r: 220 });
    } else {                                          // Lời Nguyền
      room.zones.push({ k: 'curse', own: p.slot, x: aimX, y: aimY, r: 110, t: 5, tick: 0, rate: 0.4 });
    }
  }
}

/* ============================ CẬP NHẬT NGƯỜI CHƠI ============================ */
function updatePlayer(p, room) {
  if (!p.alive) {
    p.deadT -= DT;
    if (room.mode === 'coop') {
      /* Phục Sinh / Hồi Sinh Nhanh: đồng đội đẩy nhanh hồi sinh */
      let fast = 1;
      for (const o of room.players) {
        if (o === p || !o.alive) continue;
        if (o.fx.resurrect) fast = 2.2;
        else if (o.fx.fastRes && fast < 1.5) fast = 1.5;
      }
      p.deadT -= DT * (fast - 1);
      if (p.deadT <= 0) {
        p.alive = true;
        p.hp = p.mhp * 0.6; p.mp = p.mmp * 0.5; p.shield = 0;
        p.x = W / 2; p.y = H / 2;
        ev(room, { k: 'toast', s: p.slot, m: 'Hồi sinh!' });
      }
    }
    return;
  }

  const i = p.in;
  let dx = (i.rt ? 1 : 0) - (i.lf ? 1 : 0);
  let dy = (i.dn ? 1 : 0) - (i.up ? 1 : 0);
  const moving = dx || dy;
  if (moving) {
    const m = Math.hypot(dx, dy) || 1;
    let sp = p.spd;
    if (p.slow > 0) sp *= (1 - p.slow);
    p.x = clamp(p.x + dx / m * sp * 1.9, 16, W - 16);
    p.y = clamp(p.y + dy / m * sp * 1.9, 16, H - 16);
    p.stillT = 0;
  } else {
    p.stillT += DT;
  }
  p.aim = i.aim;

  /* tốc đánh */
  let rate = p.rate * p.rateM;
  if (p.frenzy > 0) rate *= 0.6;
  if (p.hasteT > 0) rate *= 0.7;
  p.atkT -= DT;
  const canAtk = room.mode !== 'duel' || room.duel.ph === 'playing';
  if (i.fire && p.atkT <= 0 && canAtk) { attack(p, room); p.atkT = rate; }

  /* volley (Nỏ Liên Thanh) */
  if (p.volley) {
    p.volley.t -= DT;
    if (p.volley.t <= 0) {
      shoot(room, p, p.aim + (Math.random() - 0.5) * 0.08, p.volley.dmg, { sp: 13, life: 1.2, ty: 'bolt' });
      p.volley.n--; p.volley.t = p.volley.gap;
      if (p.volley.n <= 0) p.volley = null;
    }
  }

  /* cooldown & timer */
  p.cdE = Math.max(0, p.cdE - DT);
  p.cdR = Math.max(0, p.cdR - DT);
  p.frenzy = Math.max(0, p.frenzy - DT);
  p.hasteT = Math.max(0, p.hasteT - DT);
  p.buffDmg = Math.max(0, p.buffDmg - DT);
  p.buffDef = Math.max(0, p.buffDef - DT);
  p.lastStandBuff = Math.max(0, (p.lastStandBuff || 0) - DT);
  if (p.slowT > 0) { p.slowT -= DT; if (p.slowT <= 0) p.slow = 0; }
  if (p.vulnT > 0) { p.vulnT -= DT; if (p.vulnT <= 0) p.vuln = 0; }
  if (p.mark > 0) p.mark -= DT;

  /* hồi máu / mana */
  p.hp = Math.min(p.mhp, p.hp + p.reg * zReg(p) * DT);
  p.mp = Math.min(p.mmp, p.mp + p.mreg * DT);

  /* khiên rò rỉ trong duel (nerf tank) */
  if (room.mode === 'duel' && p.shield > 0) p.shield = Math.max(0, p.shield - SHIELD_LEAK * DT);

  /* độc */
  if (p.poisonT > 0) {
    p.poisonT -= DT;
    p.hp -= p.poison * DT;
    if (p.hp <= 0) onPlayerDown(p, room, null);
  }

  /* zodiac runtime */
  p.zTime += DT;
  p.zClean += DT;
  if (p.z === 'ari' && !p.zOpen) {
    p.zOpenT = (p.zOpenT || 0) + DT;
    if (p.zOpenT > 5) { p.zOpen = true; }   // im lặng 5s → lại có đòn mở trận
  }
  if (p.z === 'leo') {
    let n = 0;
    for (const t of targetsFor(p.slot, room)) if (t.hp > 0 && dist(t, p) < 260) n++;
    p.zNear = n;
  }
}

function onPlayerDown(p, room, src) {
  if (!p.alive) return;
  /* Tử Chiến: cheat death 1 lần / ván */
  if (p.fx.lastStand && !p.usedLast) {
    p.usedLast = true;
    p.hp = 1; p.shield = 20; p.lastStandBuff = 4;
    ev(room, { k: 'toast', s: p.slot, m: 'Tử Chiến! Sống sót.' });
    return;
  }
  p.hp = 0;
  p.alive = false;
  p.deadT = RESPAWN_TIME;
  p.shield = 0; p.poison = 0; p.poisonT = 0;
  ev(room, { k: 'down', x: p.x, y: p.y, s: p.slot });
  if (room.mode === 'duel') {
    p.eliminated = true;
    ev(room, { k: 'toast', s: p.slot, m: p.nm + ' bị loại!' });
  } else {
    ev(room, { k: 'toast', s: p.slot, m: p.nm + ' gục ngã (' + RESPAWN_TIME + 's)' });
  }
}

/* Aura / keystone chạy mỗi tick */
function passiveTick(room) {
  /* Suy Nhược (global khi có Prayer) */
  room.weaken = 0;
  for (const p of room.players) if (p.alive && p.fx.weaken) room.weaken = Math.max(room.weaken, p.fx.weaken);

  for (const p of room.players) {
    if (!p.alive) continue;
    /* Bất Hoại Thành */
    if (p.fx.bulwark) {
      const cap = room.mode === 'duel' ? 70 : 120;
      if (p.shield < cap) p.shield = Math.min(cap, p.shield + 14 * DT);
      if (room.mode === 'coop') {
        for (const a of alliesOf(p, room)) if (dist(a, p) < 120 && a.shield < cap * 0.5) a.shield = Math.min(cap * 0.5, a.shield + 8 * DT);
      }
    }
    /* Hào Quang */
    if (p.fx.auraHeal && room.mode === 'coop') {
      for (const a of alliesOf(p, room)) if (dist(a, p) < 130) a.hp = Math.min(a.mhp, a.hp + p.fx.auraHeal * DT);
      p.hp = Math.min(p.mhp, p.hp + p.fx.auraHeal * 0.5 * DT);
    }
  }
}

/* ============================ CO-OP ============================ */
function stepCoop(room) {
  const np = room.players.length;
  if (!np) return;

  /* spawn theo đợt: 3-6 × số người */
  if (room.enemies.length === 0) {
    room.waveT -= DT;
    if (room.waveT <= 0) {
      room.wave++;
      const per = 3 + Math.min(3, Math.floor(room.wave / 2));
      const total = per * np;
      for (let i = 0; i < total; i++) {
        const r = Math.random();
        let ty = 'slime';
        if (room.wave >= 2 && r < 0.28) ty = 'runner';
        else if (room.wave >= 3 && r < 0.42) ty = 'brute';
        else if (room.wave >= 4 && r < 0.55) ty = 'caster';
        spawnEnemy(room, ty, room.wave);
      }
      room.waveT = 3.5;
      ev(room, { k: 'wave', n: room.wave });
      ev(room, { k: 'toast', s: -1, m: 'Đợt ' + room.wave + '!' });
    }
  }

  /* quái đuổi người gần nhất / bị taunt */
  for (let i = room.enemies.length - 1; i >= 0; i--) {
    const e = room.enemies[i];
    if (e.hp <= 0) { room.enemies.splice(i, 1); continue; }

    if (e.poisonT > 0) {
      e.poisonT -= DT;
      e.hp -= e.poison * DT;
      if (e.hp <= 0) {
        /* Bọ Cạp: độc lây sang quái gần */
        for (const o of room.enemies) if (o !== e && o.hp > 0 && dist(o, e) < 90 && o.poisonT <= 0) { o.poison = e.poison * 0.7; o.poisonT = 3; }
        onEnemyDown(e, room, null);
        room.enemies.splice(i, 1);
        continue;
      }
    }
    if (e.slowT > 0) { e.slowT -= DT; if (e.slowT <= 0) e.slow = 0; }
    if (e.vulnT > 0) { e.vulnT -= DT; if (e.vulnT <= 0) e.vuln = 0; }
    if (e.mark > 0) e.mark -= DT;
    if (e.taunt > 0) e.taunt -= DT;

    let tgt = null;
    if (e.taunt > 0) tgt = room.players.find(p => p.slot === e.tauntBy && p.alive);
    if (!tgt) {
      let bd = 1e9;
      for (const p of room.players) {
        if (!p.alive) continue;
        const d = dist(p, e);
        if (d < bd) { bd = d; tgt = p; }
      }
    }
    if (!tgt) continue;

    const d = dist(tgt, e);
    let sp = e.spd * (e.slow > 0 ? 1 - e.slow : 1);
    if (room.weaken) sp *= 0.92;

    if (e.ranged) {
      e.cd -= DT;
      if (d > 220) { e.x += (tgt.x - e.x) / d * sp; e.y += (tgt.y - e.y) / d * sp; }
      else if (d < 150) { e.x -= (tgt.x - e.x) / d * sp * 0.7; e.y -= (tgt.y - e.y) / d * sp * 0.7; }
      if (e.cd <= 0 && d < 300) { enemyShoot(room, e, tgt); e.cd = 2.2; }
    } else {
      e.x += (tgt.x - e.x) / d * sp;
      e.y += (tgt.y - e.y) / d * sp;
      e.cd -= DT;
      if (d < e.r + 16 && e.cd <= 0) {
        let dm = e.dmg;
        if (room.weaken) dm *= 1 - room.weaken;
        const dealt = dmgTo(tgt, dm, { noCrit: true, melee: true }, 3, null, room);
        /* Phản Đòn: dmgTo chỉ phản được khi src là người, nên quái xử lý ở đây */
        if (dealt > 0 && tgt.fx.reflect) {
          const r = Math.round(dealt * tgt.fx.reflect);
          if (r > 0) {
            e.hp -= r;
            ev(room, { k: 'hit', x: e.x, y: e.y, d: r, c: 0 });
            if (e.hp <= 0) { onEnemyDown(e, room, tgt); room.enemies.splice(i, 1); continue; }
          }
        }
        e.cd = 0.8;
      }
    }
    e.x = clamp(e.x, -30, W + 30);
    e.y = clamp(e.y, -30, H + 30);
  }
}

/* ============================ PvP FFA ============================ */
function activeDuelers(room) { return room.players.filter(p => !p.eliminated && p.alive); }

function stepDuel(room) {
  const d = room.duel;
  const np = room.players.length;

  if (np < 2) {
    if (d.ph !== 'loadout') { d.ph = 'loadout'; d.score = [0, 0, 0]; d.round = 1; }
    return;
  }

  if (d.ph === 'loadout') {
    const all = room.players.every(p => d.ready[p.slot]);
    if (all) { d.ph = 'countdown'; d.t = COUNTDOWN; }
    return;
  }

  if (d.ph === 'countdown') {
    d.t -= DT;
    if (d.t <= 0) beginRound(room);
    return;
  }

  if (d.ph === 'playing') {
    d.t -= DT;
    stepOrbs(room);
    const alive = activeDuelers(room);
    if (alive.length <= 1) { endRound(room, alive.length === 1 ? alive[0].slot : -1); return; }
    if (d.t <= 0) {
      /* hết giờ → ai %máu cao nhất thắng ván */
      let best = null, bv = -1;
      for (const p of alive) { const v = p.hp / p.mhp; if (v > bv) { bv = v; best = p; } }
      endRound(room, best ? best.slot : -1);
    }
    return;
  }

  if (d.ph === 'roundover') {
    d.t -= DT;
    if (d.t <= 0) {
      const champ = d.score.findIndex(s => s >= WIN_ROUNDS);
      if (champ >= 0) finalizeMatch(room, champ);
      else { d.round++; d.ph = 'countdown'; d.t = COUNTDOWN; resetRound(room); }
    }
    return;
  }
  /* matchover: chờ rematch */
}

function resetRound(room) {
  const n = room.players.length;
  room.projs.length = 0; room.zones.length = 0; room.orbs.length = 0;
  room.orbT = 5;
  room.players.forEach((p, i) => {
    const ang = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
    p.x = W / 2 + Math.cos(ang) * 300;
    p.y = H / 2 + Math.sin(ang) * 170;
    p.x = clamp(p.x, 40, W - 40); p.y = clamp(p.y, 40, H - 40);
    p.hp = p.mhp; p.mp = p.mmp; p.shield = 0;
    p.alive = true; p.eliminated = false; p.deadT = 0;
    p.cdE = 0; p.cdR = 0; p.atkT = 0; p.volley = null;
    p.poison = 0; p.poisonT = 0; p.slow = 0; p.slowT = 0; p.vuln = 0; p.vulnT = 0; p.mark = 0;
    p.buffDmg = 0; p.buffDef = 0; p.frenzy = 0; p.hasteT = 0; p.lastStandBuff = 0;
    p.usedLast = false; p.zOpen = true; p.zOpenT = 0; p.zClean = 0; p.zTime = 0; p.shotN = 0;
  });
}

function beginRound(room) {
  resetRound(room);
  room.duel.ph = 'playing';
  room.duel.t = ROUND_TIME;
  ev(room, { k: 'toast', s: -1, m: 'Ván ' + room.duel.round + ' — Chiến!' });
}

function endRound(room, winnerSlot) {
  const d = room.duel;
  if (winnerSlot >= 0) d.score[winnerSlot]++;
  d.winner = winnerSlot;
  d.ph = 'roundover';
  d.t = ROUNDOVER_TIME;
  const w = room.players.find(p => p.slot === winnerSlot);
  ev(room, { k: 'toast', s: -1, m: w ? w.nm + ' thắng ván!' : 'Hoà ván' });
}

function stepOrbs(room) {
  room.orbT -= DT;
  if (room.orbT <= 0 && room.orbs.length < 2) {
    room.orbs.push({
      id: UID++, ty: ORBS[Math.floor(Math.random() * ORBS.length)],
      x: 120 + Math.random() * (W - 240),
      y: 90 + Math.random() * (H - 180),
      t: 12
    });
    room.orbT = 10;
  }
  for (let i = room.orbs.length - 1; i >= 0; i--) {
    const o = room.orbs[i];
    o.t -= DT;
    if (o.t <= 0) { room.orbs.splice(i, 1); continue; }
    for (const p of room.players) {
      if (!p.alive || p.eliminated) continue;
      if (Math.hypot(p.x - o.x, p.y - o.y) < 24) {
        applyOrb(p, o.ty, room);
        room.orbs.splice(i, 1);
        break;
      }
    }
  }
}

/* ============================ XẾP HẠNG (ELO) ============================ */
const RANK_FILE = path.join(ROOT, 'ranks.json');
let RANKS = {};
try { RANKS = JSON.parse(fs.readFileSync(RANK_FILE, 'utf8')); } catch (e) { RANKS = {}; }

function saveRanks() {
  try { fs.writeFileSync(RANK_FILE, JSON.stringify(RANKS, null, 2)); } catch (e) { console.error('[ranks] không ghi được:', e.message); }
}
function getMMR(nm) {
  if (!RANKS[nm]) RANKS[nm] = { mmr: 1000, w: 0, l: 0, g: 0 };
  return RANKS[nm];
}
function tierOf(m) {
  if (m < 1000) return 'Đồng';
  if (m < 1200) return 'Bạc';
  if (m < 1400) return 'Vàng';
  if (m < 1600) return 'Bạch Kim';
  return 'Kim Cương';
}

function finalizeMatch(room, champSlot) {
  const d = room.duel;
  const win = room.players.find(p => p.slot === champSlot);
  const losers = room.players.filter(p => p.slot !== champSlot);
  const rk = [];
  if (win) {
    const rw = getMMR(win.nm);
    let total = 0;
    for (const l of losers) {
      const rl = getMMR(l.nm);
      const exp = 1 / (1 + Math.pow(10, (rl.mmr - rw.mmr) / 400));
      const g = Math.max(4, Math.round(32 * (1 - exp)));
      total += g;
      const before = rl.mmr;
      rl.mmr = Math.max(100, rl.mmr - g);
      rl.l++; rl.g++;
      rk.push({ nm: l.nm, mmr: rl.mmr, dt: rl.mmr - before, tier: tierOf(rl.mmr) });
    }
    const before = rw.mmr;
    rw.mmr += total; rw.w++; rw.g++;
    rk.unshift({ nm: win.nm, mmr: rw.mmr, dt: rw.mmr - before, tier: tierOf(rw.mmr) });
    saveRanks();
  }
  d.ph = 'matchover';
  d.result = champSlot;
  d.rk = rk;
  d.ready = [false, false, false];
  ev(room, { k: 'toast', s: -1, m: win ? '🏆 ' + win.nm + ' vô địch!' : 'Kết thúc' });
}

/* ============================ VÒNG LẶP ============================ */
function step(room) {
  room.time += DT;
  for (const p of room.players) updatePlayer(p, room);
  passiveTick(room);
  updateProjs(room);
  updateZones(room);
  if (room.mode === 'coop') stepCoop(room);
  else stepDuel(room);
}

function leaderboard(n) {
  return Object.keys(RANKS)
    .map(k => ({ nm: k, mmr: RANKS[k].mmr, w: RANKS[k].w, l: RANKS[k].l, tier: tierOf(RANKS[k].mmr) }))
    .sort((a, b) => b.mmr - a.mmr)
    .slice(0, n || 10);
}

function snapshot(room) {
  const P = room.players.map(p => ({
    s: p.slot, nm: p.nm, cls: p.cls, z: p.z, br: p.br,
    lv: p.lv, xp: Math.round(p.xp), xn: p.xn, pts: p.pts,
    hp: Math.max(0, Math.round(p.hp)), mhp: p.mhp,
    mp: Math.round(p.mp), mmp: p.mmp, sh: Math.round(p.shield),
    x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, a: Math.round(p.aim * 100) / 100,
    al: p.alive ? 1 : 0, el: p.eliminated ? 1 : 0, dt: Math.max(0, Math.round(p.deadT * 10) / 10),
    cdE: Math.round(p.cdE * 10) / 10, cdR: Math.round(p.cdR * 10) / 10,
    mxE: p.mxE, mxR: Math.round(p.mxR * 10) / 10,
    hasE: p.hasE ? 1 : 0, hasR: p.hasR ? 1 : 0,
    nd: p.nodes,
    bf: (p.buffDmg > 0 ? 1 : 0) | (p.buffDef > 0 ? 2 : 0) | (p.frenzy > 0 ? 4 : 0) |
      (p.shield > 0 ? 8 : 0) | (p.poisonT > 0 ? 16 : 0) | (p.slow > 0 ? 32 : 0) | (p.vuln > 0 ? 64 : 0)
  }));
  const E = room.enemies.map(e => ({
    i: e.id, x: Math.round(e.x), y: Math.round(e.y), ty: e.ty, r: e.r,
    hp: Math.max(0, Math.round(e.hp)), mhp: e.mhp, ps: e.poisonT > 0 ? 1 : 0, sl: e.slow > 0 ? 1 : 0
  }));
  const R = room.projs.map(pr => ({
    x: Math.round(pr.x), y: Math.round(pr.y), ty: pr.ty,
    a: Math.round(Math.atan2(pr.vy, pr.vx) * 100) / 100, o: pr.own
  }));
  const Z = room.zones.map(z => ({ k: z.k, x: Math.round(z.x), y: Math.round(z.y), r: z.r }));

  const out = {
    t: 'state', mode: room.mode, np: room.players.length,
    P, E, R, Z, ev: room.ev, wave: room.wave
  };
  if (room.mode === 'duel') {
    out.duel = {
      ph: room.duel.ph, score: room.duel.score, ready: room.duel.ready,
      t: Math.max(0, Math.round(room.duel.t * 10) / 10),
      round: room.duel.round, winner: room.duel.winner, result: room.duel.result,
      rk: room.duel.rk,
      orbs: room.orbs.map(o => ({ x: Math.round(o.x), y: Math.round(o.y), ty: o.ty, t: Math.round(o.t) }))
    };
  }
  room.ev = [];
  return out;
}

setInterval(() => {
  for (const k of Object.keys(ROOMS)) {
    const room = ROOMS[k];
    if (!room.players.length) { room.ev = []; continue; }
    step(room);
    const snap = JSON.stringify(snapshot(room));
    for (const p of room.players) send(p.ws, snap);
  }
}, TICK);

/* ============================ MẠNG: HTTP + WEBSOCKET ============================ */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  if (url === '/leaderboard') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(leaderboard(20)));
  }
  const file = path.join(ROOT, path.normalize(url).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

/* --- WebSocket viết tay (không dùng thư viện ws) --- */
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  sock.setNoDelay(true);

  const ws = { sock, buf: Buffer.alloc(0), open: true, player: null, room: null };
  sock.on('data', (d) => onData(ws, d));
  sock.on('close', () => onClose(ws));
  sock.on('error', () => onClose(ws));

  send(ws, JSON.stringify({ t: 'welcome', maxp: MAXP, lb: leaderboard(10) }));
});

function onData(ws, chunk) {
  ws.buf = Buffer.concat([ws.buf, chunk]);
  for (;;) {
    const b = ws.buf;
    if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0;
    const op = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    let mask = null;
    if (masked) { if (b.length < off + 4) return; mask = b.slice(off, off + 4); off += 4; }
    if (b.length < off + len) return;
    let payload = b.slice(off, off + len);
    ws.buf = b.slice(off + len);
    if (mask) {
      const out = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
      payload = out;
    }
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
  const room = ws.room;
  if (!room) return;
  const i = room.players.indexOf(p);
  if (i >= 0) room.players.splice(i, 1);
  ev(room, { k: 'toast', s: -1, m: p.nm + ' đã rời phòng' });
  if (room.mode === 'duel') {
    const d = room.duel;
    d.ready[p.slot] = false;
    if (d.ph === 'playing') {
      const alive = activeDuelers(room);
      if (alive.length <= 1) endRound(room, alive.length === 1 ? alive[0].slot : -1);
    }
    if (room.players.length === 0) ROOMS.duel = makeRoom('duel');
  }
  if (room.mode === 'coop' && room.players.length === 0) ROOMS.coop = makeRoom('coop');
  broadcastRoster(room);
}

function broadcastRoster(room) {
  const r = JSON.stringify({
    t: 'roster',
    list: room.players.map(p => ({ s: p.slot, nm: p.nm, cls: p.cls, z: p.z, mmr: getMMR(p.nm).mmr, tier: tierOf(getMMR(p.nm).mmr) }))
  });
  for (const p of room.players) send(p.ws, r);
}

function handleMsg(ws, m) {
  if (m.t === 'join') {
    if (ws.player) return;
    const mode = m.mode === 'duel' ? 'duel' : 'coop';
    const room = ROOMS[mode];
    if (room.players.length >= MAXP) { send(ws, JSON.stringify({ t: 'full' })); return; }
    const used = room.players.map(p => p.slot);
    let slot = 0; while (used.includes(slot)) slot++;
    const cls = CLASSES[m.cls] ? m.cls : 'sw';
    const z = ZKEYS.includes(m.z) ? m.z : 'ari';
    const p = makePlayer(ws, m.nm, cls, z, slot);
    if (mode === 'duel') {
      p.pts = LOADOUT_PTS;
      p.lv = 12;                     // PvP: cấp sẵn để mở toàn cây
      p.xn = 9999;
      recompute(p);
      p.hp = p.mhp; p.mp = p.mmp;
      room.duel.ready[slot] = false;
      if (room.duel.ph === 'playing' || room.duel.ph === 'countdown') {
        /* vào giữa ván: ngồi ngoài xem, tham chiến từ ván sau (resetRound sẽ hồi sinh) */
        p.eliminated = true;
        p.alive = false;
      } else if (room.duel.ph === 'matchover') {
        room.duel.ph = 'loadout';
        room.duel.score = [0, 0, 0];
        room.duel.round = 1;
        room.duel.result = null;
        room.duel.rk = [];
      }
    }
    ws.player = p; ws.room = room;
    room.players.push(p);
    send(ws, JSON.stringify({
      t: 'joined', slot, mode, maxp: MAXP,
      cfg: { W, H, MINLV, META, LOADOUT_PTS, ROUND_TIME, WIN_ROUNDS },
      mmr: getMMR(p.nm).mmr, tier: tierOf(getMMR(p.nm).mmr)
    }));
    ev(room, { k: 'toast', s: -1, m: p.nm + ' vào phòng' });
    broadcastRoster(room);
    return;
  }

  const p = ws.player;
  if (!p) return;
  const room = ws.room;

  switch (m.t) {
    case 'in':
      p.in.up = m.up ? 1 : 0; p.in.dn = m.dn ? 1 : 0;
      p.in.lf = m.lf ? 1 : 0; p.in.rt = m.rt ? 1 : 0;
      if (typeof m.aim === 'number' && isFinite(m.aim)) p.in.aim = m.aim;
      p.in.fire = m.fire ? 1 : 0;
      break;
    case 'sk':
      useSkill(p, m.s === 'R' ? 'R' : 'E', room);
      break;
    case 'alloc': {
      if (room.mode === 'duel' && room.duel.ph !== 'loadout') return;
      if (!canAlloc(p, m.id)) { send(ws, JSON.stringify({ t: 'deny', id: m.id })); return; }
      p.pts -= META[m.id].cost;
      p.nodes.push(m.id);
      const hr = p.hp / p.mhp, mr = p.mp / p.mmp;
      recompute(p);
      p.hp = p.mhp * hr; p.mp = p.mmp * mr;
      break;
    }
    case 'respec':
      if (room.mode !== 'duel' || room.duel.ph !== 'loadout') return;
      p.nodes = [p.cls + '_root'];
      p.pts = LOADOUT_PTS;
      recompute(p);
      p.hp = p.mhp; p.mp = p.mmp;
      break;
    case 'ready':
      if (room.mode !== 'duel') return;
      if (room.duel.ph !== 'loadout') return;
      room.duel.ready[p.slot] = !!m.v;
      break;
    case 'rematch':
      if (room.mode !== 'duel' || room.duel.ph !== 'matchover') return;
      room.duel.ph = 'loadout';
      room.duel.score = [0, 0, 0];
      room.duel.round = 1;
      room.duel.result = null;
      room.duel.rk = [];
      room.duel.ready = [false, false, false];
      for (const q of room.players) {
        q.nodes = [q.cls + '_root'];
        q.pts = LOADOUT_PTS;
        recompute(q);
        q.hp = q.mhp; q.mp = q.mmp;
      }
      break;
    case 'lb':
      send(ws, JSON.stringify({ t: 'lb', list: leaderboard(20) }));
      break;
  }
}

/* ============================ KHỞI ĐỘNG ============================ */
server.listen(PORT, () => {
  const ifs = os.networkInterfaces();
  const ips = [];
  for (const k of Object.keys(ifs)) for (const a of ifs[k]) if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
  console.log('');
  console.log('  ⚔  ZODIAC ARENA — server đang chạy');
  console.log('  ─────────────────────────────────────');
  console.log('   Máy này :  http://localhost:' + PORT);
  for (const ip of ips) console.log('   Máy khác:  http://' + ip + ':' + PORT);
  console.log('  ─────────────────────────────────────');
  console.log('   Ctrl+C để dừng. Sửa index.html chỉ cần F5.');
  console.log('');
});
