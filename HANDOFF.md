# Zodiac Arena — Hand-off cho team

> MMORPG-lite pixel: **ngày sinh (DOB) → cung hoàng đạo → buff nền**, chồng lên hệ **class + nhánh + cây kỹ năng**. Bản hiện tại là prototype **co-op PvE** và **PvP FFA (2-3 người) xếp hạng**, chạy **LAN** bằng 1 file Node zero-dependency.

Tài liệu này để một dev khác pick-up và làm tiếp. Đọc mục 2 (tầm nhìn) + mục 3 (kiến trúc) trước, rồi mục 6 (công thức mở rộng) khi bắt tay code.

---

## 1. TL;DR

- **Stack:** Node.js 18+ thuần, **không cần `npm install`** (WebSocket + HTTP viết tay bằng module `http`/`crypto` có sẵn). Client là 1 file HTML + Canvas 2D pixel.
- **Chạy:** trong thư mục này gõ `node server.js` → mở `http://<IP-LAN>:8080` trên mỗi máy (server in sẵn IP khi khởi động).
- **File cần biết:** `server.js` (toàn bộ game logic — authoritative), `index.html` (client: render + input + UI), `ranks.json` (dữ liệu xếp hạng, tự sinh), `README.md` (hướng dẫn người chơi).
- **Điều khiển:** `WASD`/`↑↓←→` chạy · **chuột** ngắm · giữ **chuột trái**/`Space` đánh · `E` kỹ năng class · `R` kỹ năng nhánh · `T` mở cây kỹ năng (co-op).

---

## 2. Tầm nhìn thiết kế & các quyết định đã chốt

Ý tưởng gốc: game nhập DOB, ra **cung hoàng đạo** (12) cho buff riêng. Qua nhiều vòng, hệ thống đã chốt:

| Trục | Nguồn | Vai trò | Ghi chú |
|---|---|---|---|
| **Cung hoàng đạo** | Tính từ DOB người chơi | Buff **nền toàn cục** (passive) | 12 cung, mỗi cung 1 cơ chế cảm nhận được. Vì do DOB nên KHÔNG dùng để cân bằng nặng. |
| **Class + nhánh** | Người chơi **chọn** | Quyết combat | 3 class × 2 nhánh. Class do chọn (không phải DOB) → né vấn đề phân bổ DOB lệch. |
| **Cây kỹ năng** | Lên cấp / loadout | Chiều sâu build | Trunk chung → rẽ 1 trong 2 nhánh (loại trừ) → keystone. |

**Trinity:** Kiếm sĩ (Tank/Bruiser), Xạ thủ (Cung/Nỏ = DPS), Nhà sư (Healer/Prayer = Support). Co-op quái đuổi người gần nhất (tank giữ tuyến); PvP là FFA hỗn chiến.

**Ý tưởng cũ chưa làm** (ghi lại để không quên): hệ **vũ khí chính + phụ, swap giữa trận**, mỗi vũ khí 1 cây skill riêng; các vũ khí lẻ (dao găm / ám khí / vuốt) có thể là **class Sát thủ** tương lai. Bản hiện tại đã đơn giản hoá thành "class = họ vũ khí cố định".

**Tham chiếu trực quan** (prototype chơi trên trình duyệt, xây trong quá trình thiết kế — chủ dự án có link để chia sẻ):
- Demo 1 máy (onboarding + 12 cung + rẽ nhánh): artifact "Zodiac Arena".
- Cây kỹ năng 3 class tương tác: artifact "Skill Trees".

---

## 3. Kiến trúc

### Netcode — server thẩm quyền (authoritative)
- Server giữ **toàn bộ state** (người chơi, quái, đạn, orb, vòng đấu). Client chỉ **gửi input** và **vẽ lại snapshot** → không gian lận, không lệch state.
- Vòng lặp server **30Hz** (`setInterval(..., TICK=1000/30)`), mỗi tick chạy `step()` rồi broadcast `snapshot()`.
- Client **nội suy** giữa 2 snapshot gần nhất để mượt 60fps (xem `render()` dùng `alpha`).
- WebSocket **viết tay**: bắt tay ở sự kiện `upgrade`, giải/đóng khung ở `onData`/`frame` (hỗ trợ payload 16-bit length cho snapshot lớn). Không dùng thư viện `ws`.
- Cùng process **phục vụ luôn `index.html`** qua HTTP → 2 máy chỉ mở URL, không cần build/serve riêng.

### `server.js` — bản đồ hàm
- **Cấu hình:** `CLASSES` (chỉ số gốc mỗi class), `RSKILL` (cost/cd kỹ năng nhánh), `META` (gating cây kỹ năng: tier/branch/cost/req/minLv), `ZODIAC` không ở server (chỉ zkey string; hiệu ứng nằm trong code hook).
- **Người chơi:** `makePlayer()` → `recompute(p)` dựng lại chỉ số từ base + duyệt `p.nodes` gọi `applyFx(p,id)` (bảng hiệu ứng 48 node). `canAlloc()` kiểm tra học node hợp lệ.
- **Sát thương (dùng chung coop & PvP):** `dmgTo(t, base, sp, kb, src)` — `t` có thể là **quái hoặc người** (phát hiện qua `t.slot`). Áp zodiac (`zDmg/zCrit/zDr`), crit, vulnerable, lifesteal, poison (Bọ Cạp), giáp/khiên (chỉ khi target là người), cheat-death, orb buff.
- **Chọn mục tiêu:** `targetsFor(slot)` → coop trả `enemies`, duel trả **tất cả người còn sống khác** (FFA). `aoe()` và vòng lặp đạn (`updateProjs`) đều đi qua `targetsFor`.
- **Kỹ năng:** `attack()` (đánh thường), `useSkill()`/`doSkill()` (E & R theo class/nhánh, đọc các cờ augment).
- **Vòng lặp:** `step()` rẽ `stepCoop()` hoặc `stepDuel()`. `updatePlayer()` (di chuyển/ngắm/đánh/hồi/cd) và `passiveTick()` (aura, keystone Bất Hoại Thành) dùng chung.
- **Co-op:** `stepCoop()` — spawn quái theo số người, quái đuổi người gần nhất / bị taunt, va chạm gây sát thương, poison lan, rớt EXP → `gainXp()` → +điểm kỹ năng.
- **PvP FFA:** state machine `stepDuel()` với phase `loadout → countdown → playing → roundover → matchover`. `beginRound/endRound/finalizeMatch`, loại người khi HP≤0, người sống cuối thắng ván, BO5 tới `WIN_ROUNDS=3`. Orb: `stepOrbs()`, `applyOrb()`.
- **Xếp hạng:** ELO trong `finalizeMatch()` (winner cộng từ mỗi loser theo chênh rank), lưu `ranks.json` (`saveRanks/getMMR/tierOf`).
- **Mạng:** `handleMsg()` xử lý message client; `snapshot()` đóng gói state gửi đi.

### `index.html` — client
- **Dữ liệu hiển thị:** `DATA` (class + tên/icon/mô tả **toàn bộ node cây kỹ năng**), `ZOD` (12 cung), `signOf(m,d)` (DOB→cung), `buildMeta`/`treeNodes` (dựng layout cây, phải khớp `META` server).
- **Mạng:** `connect()/onMsg()` nhận snapshot vào `cur` (+ `prev` để nội suy), `onEvent()` biến event server (hit/heal/ring/toast/orb…) thành hiệu ứng hình.
- **Render:** vòng `render()` vẽ pixel — `drawHero/drawSlime/drawProj` + orb + hào quang buff + số nổi/particle.
- **HUD:** `syncHud()` cập nhật tối đa **3 ô người chơi** (P1 xanh / P2 cam / P3 tím), thanh máu/mana/khiên, cấp, cd kỹ năng.
- **Cây kỹ năng:** `openTree/renderTree/canAllocC` (co-op mở bằng `T`; PvP là màn loadout).
- **Luồng UI:** wizard `rw()` (Tạo nhân vật → Chọn class → Chốt → Nhập DOB → Chúc phúc) → `openMode()` (Co-op / FFA) → `duelSync()` (điều phối màn loadout/countdown/roundover/matchover cho PvP).

---

## 4. Cơ chế hiện có (số liệu để cân bằng)

- **Class:** Kiếm sĩ (HP130, cận chiến), Xạ thủ (HP92, cung), Nhà sư (HP100, gậy phép). Mỗi class có `E` (Lv.2) + rẽ nhánh (Lv.3) mở `R` + passive.
- **Cây kỹ năng:** gate theo level `MINLV={0:1,1:2,2:2,3:3,4:5,5:8,6:12}`; cost root0/e1/passive1/branch-root1/mid1/**keystone2**; keystone cần **1 trong 2** đường (`any`). Co-op: mỗi cấp +1 điểm. PvP: cấp sẵn **10 điểm** (`LOADOUT_PTS`), khoá build cả trận.
- **12 cung** (buff nền, xem `applyFx`/`zDmg…`): Bạch Dương đòn mở trận ×2, Kim Ngưu đứng yên −35% sát thương nhận, Song Tử dùng skill +tốc đánh, Cự Giải máu thấp hồi mạnh, Sư Tử càng đông địch càng mạnh, Xử Nữ chuỗi không dính đòn dồn crit, Thiên Bình HP%≈MP% +sát thương, Bọ Cạp crit gieo độc lây, Nhân Mã xa hơn mạnh hơn, Ma Kết ramp theo thời gian, Bảo Bình proc ngẫu nhiên, Song Ngư mana ×1.8.
- **Co-op:** 1-3 người, quái = **3-6 × số người**, quái đuổi người gần nhất (Tank taunt kéo aggro).
- **PvP FFA:** 2-3 người, `ROUND_TIME=60`, `COUNTDOWN=3`, `WIN_ROUNDS=3` (BO5). Hết giờ → ai %máu cao nhất thắng ván.
- **Orb (PvP):** orb đầu ở 5s rồi mỗi 10s (tối đa 2 trên sân, biến mất sau 12s). 5 loại: hồi 25% máu / khiên +30 / mana +25% (tức thời), +25% sát thương / +25% thủ (5 giây).
- **Rank:** MMR bắt đầu 1000; tier `<1000 Đồng · <1200 Bạc · <1400 Vàng · <1600 Bạch Kim · ≥1600 Kim Cương`. Lưu `ranks.json` theo **tên nhân vật**.

**Nerf tank (chỉ PvP)** đã áp: khiên **rò rỉ 10/giây** trong duel; `dr` chỉ **70% hiệu lực**; Bất Hoại Thành khiên **120→70**.

---

## 5. Protocol WebSocket (JSON)

**Client → Server**
- `{t:"join", nm, cls, z, mode}` — vào phòng (`mode`: `"coop"`|`"duel"`).
- `{t:"in", up,dn,lf,rt, aim, fire}` — input mỗi frame (~30Hz).
- `{t:"sk", s:"E"|"R"}` — dùng kỹ năng.
- `{t:"alloc", id}` — học node cây kỹ năng.
- `{t:"respec"}` — reset điểm (chỉ lúc loadout PvP).
- `{t:"ready", v}` — sẵn sàng (PvP loadout).
- `{t:"rematch"}` — đấu lại (PvP matchover).

**Server → Client**
- `{t:"welcome"|"roster"|"joined"|"full"}` — vòng đời phòng.
- `{t:"state", mode, P[], E[], R[], ev[], np, duel?}` — snapshot mỗi tick. `P` = người chơi (tối đa 3, có `nd` node đã học, `pts`, `hasE/hasR`, `br`…), `E` = quái, `R` = đạn, `ev` = sự kiện hình (hit/heal/ring/toast/orb…), `duel` = {ph, score[], ready[], t, winner, result, rk[], orbs[]} khi PvP.

---

## 6. Công thức mở rộng (recipe cho dev)

> Nguyên tắc: **server là nguồn sự thật**; thêm cơ chế → sửa `server.js` trước, rồi thêm hiển thị ở `index.html`.

**Thêm 1 node kỹ năng mới**
1. `server.js`: thêm case trong `applyFx()` (đặt cờ/tăng chỉ số), và nếu là cơ chế runtime thì hook trong `dmgTo/updatePlayer/passiveTick/doSkill`.
2. `index.html`: thêm mô tả (nm/ic/ty/d) vào `DATA[class].{trunk|A|B}` — **id phải khớp** quy ước `cls_<slot>` (slot: `e,p0,p1,A_root,A_4a,A_4b,A_5a,A_5b,A_key`, tương tự B).

**Thêm 1 class**
- `server.js`: thêm vào `CLASSES` + `RSKILL` + các case `applyFx` + nhánh trong `doSkill`. `META` tự sinh từ `buildMeta` (chỉ cần class key).
- `index.html`: thêm `DATA[classKey]` (đủ trunk + A + B) + xử lý `drawHero` (vẽ vũ khí).

**Thêm 1 cung hoàng đạo / sửa buff**
- Hiệu ứng nằm trong `zDmg/zCrit/zDr/zReg` + các nhánh theo `p.z` trong `dmgTo/updatePlayer`. Thêm nhãn ở `ZOD` (client) + `signOf` nếu đổi ngày.

**Thêm loại orb**
- `server.js`: thêm vào mảng `ORBS` + case trong `applyOrb()`.
- `index.html`: thêm vào `ORBFX` (màu + ký tự + tên).

---

## 7. Trạng thái & vấn đề đã biết

- ✅ Đã test bằng bot: coop (lên cấp/rải điểm/quái), PvP 1v1 & FFA 3 người (loại người, BO5, ELO ghi file), orb (spawn/nhặt/buff). **Chưa test tay người** — UI/game-feel nên chơi thật để soi.
- ⚠️ **Cân bằng còn thô.** Tank đã nerf 1 đợt (mục 4) nhưng cần chơi lại. Nhà sư Healer duel kéo dài. Vài cung yếu ở 1v1/FFA (Sư Tử cần đông địch; nên có xử lý riêng cho PvP).
- ⚠️ **FFA dễ "hội đồng người yếu máu"** — cân nhắc cơ chế comeback / orb spawn giữa map làm điểm tranh chấp.
- ⚠️ Một số hiệu ứng "mới" làm **bản đơn giản**: Hộ Vệ (trích 25% sát thương đồng đội), Phục Sinh (tăng tốc hồi sinh thay vì revive tức thì), Suy Nhược (global khi có Prayer), taunt trong PvP đổi thành slow+vulnerable.
- ⚠️ **Không respec** khi đã học (co-op); PvP cấp loadout mới mỗi trận.
- 🚧 **LAN only** — arena 1 màn hình cố định (không camera/split-screen), tối đa **3 người/phòng** (`MAXP=3`), không có matchmaking thật (cần backend online + pool người chơi).
- 🎨 Art là khối pixel vẽ tay bằng Canvas (chưa có sprite/animation thật), chưa có âm thanh.

---

## 8. Roadmap ý tưởng (gợi ý ưu tiên)

**Ngắn hạn — polish & cân bằng (ít rủi ro)**
- Đợt cân bằng số liệu sau khi chơi tay: tank, Healer sustain, cung yếu ở PvP, tuning orb.
- FFA **comeback** (người ít ván thắng được buff nhẹ) và/hoặc **orb tranh chấp giữa map**.
- **Bảng xếp hạng (leaderboard)** đọc từ `ranks.json` + lịch sử đấu / streak.
- Đóng gói **`.bat` double-click** để chạy server không cần gõ lệnh.

**Trung hạn — chiều sâu nội dung**
- **Boss co-op cần đủ 3 vai** (giai đoạn cần tank chịu đòn / healer đỡ / DPS burst) để trinity thành thiết yếu.
- **Hồi sinh đồng đội** đầy đủ (cơ chế co-op kinh điển; hiện mới có tăng tốc hồi sinh).
- **Đào sâu cây kỹ năng** lên kiểu 3-lane (như bản Prayer chi tiết) cho cả 6 nhánh, có capstone riêng.
- **Gamepad twin-stick** (lấy lại ngắm tay 2 cần) + hỗ trợ nhiều input.
- Hiện thực **hệ vũ khí chính/phụ + swap** (ý tưởng gốc) hoặc thêm **class Sát thủ** cho dao găm/ám khí/vuốt.

**Dài hạn — sản phẩm thật**
- **Online multiplayer + matchmaking thật**: tách backend realtime (Node + WebSocket/Colyseus/Photon), server thẩm quyền, prediction + reconciliation, phòng/queue theo rank. Đây là bước lớn ngoài phạm vi LAN.
- **Tài khoản + lưu nhân vật** (thay vì rank theo tên); DB thật.
- **Camera + map lớn / nhiều phòng**; art pixel thật (sprite, animation, hiệu ứng), âm thanh.
- Mở rộng **world MMORPG** (map, quest, kinh tế) như ý tưởng gốc.

---

## 9. Ghi chú vận hành

- **`ranks.json`** tự sinh, lưu MMR/thắng-thua theo **tên nhân vật**. Muốn reset bảng xếp hạng: xoá file (server tự tạo lại). **Đừng commit dữ liệu test lẫn dữ liệu thật** — cân nhắc `.gitignore` file này.
- Đổi cổng: `PORT=9000 node server.js` (mặc định 8080).
- **Firewall Windows** lần đầu chạy sẽ hỏi cho Node truy cập mạng → Allow (cả Private) thì máy khác mới vào được.
- Sửa **server.js** phải **restart** `node server.js`; sửa **index.html** chỉ cần **refresh** trình duyệt (server đọc file mỗi request).
- Không có bước build; muốn thêm test: viết client WS thô bằng Node `net`+`crypto` (đã dùng trong quá trình phát triển) để mô phỏng người chơi.
