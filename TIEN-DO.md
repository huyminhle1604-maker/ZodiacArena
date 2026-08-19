# Tiến độ — Zodiac Arena

Cập nhật: **04/08/2026**

## Trạng thái: chạy được, đã test, chưa chơi tay người

```bash
node server.js
```

Rồi mở `http://localhost:8080` (máy khác trong LAN dùng IP mà server in ra).
Trên Windows có thể double-click `start.bat`.

---

## Đã xong

### Game lõi (dựng theo `HANDOFF.md`)
- `server.js` — server thẩm quyền, HTTP + WebSocket **viết tay**, zero-dependency, vòng lặp 30Hz.
- `index.html` — client 1 file, Canvas 2D, nội suy 60fps, HUD 3 người, wizard tạo nhân vật.
- 3 class × 2 nhánh, **48 node** cây kỹ năng (gate `MINLV={0:1,1:2,2:2,3:3,4:5,5:8,6:12}`, keystone cost 2 kiểu `any`).
- 12 cung hoàng đạo tính từ ngày sinh (đã test 14 mốc ngày biên).
- Co-op PvE theo đợt; PvP FFA BO5 với state machine `loadout → countdown → playing → roundover → matchover`.
- 5 loại orb, ELO ghi `ranks.json`, cả 3 nerf tank ở duel (khiên rò rỉ 10/s, `dr` × 0.7, Bất Hoại Thành 120→70).

### Sprite (theo `SPRITES_HANDOFF.md`)
- Nạp `sprites.js`, viết lại `drawHero` / `drawEnemy`, thêm bộ theo dõi animation `ANIM` ở client.
- 6 biến thể hero + 4 loại quái × 5 state (`idle/move/attack/hit/die`), xác quái tự tan rồi dọn.
- Vòng màu slot dưới chân để phân biệt 2 người cùng class.
- **`server.js` không sửa dòng nào** cho phần sprite.
- ⚠️ Bản sprite này giờ nằm ở **`sprites-legacy.js`** (xem mục dưới); `index.html` đã đổi thẻ script sang file đó.

### Sprite "Hero's Quest" — bản mới, dùng cho `map1.html`
- `sprites.js` = bộ mới do Claude Design dựng (bản cũ 16×16 giữ nguyên ở `sprites-legacy.js`).
- **9 skin hero** (3 nhánh × 3 class) + 4 quái, khung 92×76, thân cao ~52px @scale 1, bóng bake sẵn.
- API khác bản cũ: key `knight_3a` / `mon_slime`, **không còn `ZASprites.DUR`**, thêm `branches` / `skinFor(cls,branch)` / `info(key)` / `sheet(key,state)`.
- Sửa trong `map1.html`: `SPR_DUR` cục bộ thay `ZASprites.DUR`; `SPR_SCALE=0.58` **dùng chung cho mọi sprite** (giữ đúng tỉ lệ brute 64px vs slime 37px mà bộ sprite đã dựng), quái scale theo `r / MON_R[ty]` nên world boss tự to ra; tên + thanh máu hero nhích từ `y-19/y-16` lên `y-30/y-27` cho khỏi đè đầu.
- `skinOf(p)` ưu tiên `p.br` (nhánh) nếu server gửi, chưa có thì chia theo `p.s % 3` để mỗi slot một dáng. **Khi làm hệ nhánh cho map1, chỉ cần broadcast thêm trường `br` là ngoại hình tự đổi.**
- `map1-server.js` không sửa dòng nào.

### Sảnh thành một map đi lại được
Trước đây "sảnh" chỉ là cái form trên màn intro. Giờ là map thật 1200×820, `ROOM.ph === 'lobby'` có `stepLobby()` riêng: di chuyển + phát hiện NPC gần + phát hiện đứng trong cổng. **Không quái, không đạn, không đánh thường, không kỹ năng, không lướt** — client chặn ở khâu gửi input, server chỉ chạy nhánh sảnh.

- 2 NPC (`class` / `shop`) + 1 cổng; bấm `F` khi đứng trong bán kính 62px. **Chọn cung không có NPC riêng** — bảng chọn nằm trong hộp của cổng, vì bước vào cổng mới đúng là lúc phải quyết định.

⚠ Lỗi đã sửa: nhánh chặn chiến đấu ở sảnh (`if(inLobby()) return;`) đặt **trước** nhánh xử lý phím `F`, nên `F` không bao giờ chạy tới — không nói chuyện được với NPC nào. Giờ gom cả `F` và `Esc` của sảnh vào một khối đặt trước cái return đó.
- Lệnh mới: `setcls`, `setsign`, `buyw`, `enter`. Tất cả chỉ nhận khi `ph === 'lobby'`.
- Đổi class thì **reset cây kỹ năng** (`nodes = [cls_root]`, `pts = 0`) và tháo vũ khí không hợp class — cây và vũ khí đều gắn theo class.
- `WEAPONS`: 2 món/class, mua bằng token, `applyWeapon()` chạy trong `recompute()`.
- **Ví token meta** (`p.metaToken`) tách khỏi token trong ván (`p.token`). `finish()` chỉ cộng token của người **đã thoát** vào ví.
- `again` không reload trang nữa mà đưa `ph` về `'lobby'`, gọi `resetWorld()`, `toLobby()` cho người thật và **xoá hết bot** — class/cung/vũ khí/ví giữ nguyên.
- Snapshot ở sảnh gửi mảng rỗng cho `E/R/L/C/M/G/MT/PO` để client không vẽ nhầm quái và rương của ván trước.
- Client: `inLobby()` đổi `worldW()/worldH()` cho camera, `drawLobby()` vẽ nền/tường/NPC/cổng, HUD rút gọn (giấu máu/mana/minimap/ô kỹ năng/cột blessing).

Hai lỗi bắt được lúc chạy thử:
1. Client vẫn gửi `{t:'ready',v:true}` ngay khi `joined` — tàn dư luồng cũ, làm ván bắt đầu luôn không kịp vào sảnh.
2. Bảng kết quả không tự đóng khi về sảnh (trước kia `again` reload trang nên không lộ).

⚠ Lúc test: pane trình duyệt ẩn thì `requestAnimationFrame` bị tạm dừng nên `syncHud()` không chạy — tưởng HUD hỏng. Vòng gửi input dùng `setInterval` nên vẫn chạy. Muốn kiểm HUD lúc pane ẩn thì gọi tay `syncHud()`.

### Hồi máu không còn chữa cho kẻ địch
Map 1 là hỗn chiến tự do, **chưa có hệ team**, nhưng R của Nhà sư và 4 node cây kỹ năng vẫn duyệt `ROOM.players` như thể ai cũng là đồng đội — chữa và tiếp khiên cho cả người đang đánh mình.

Gom về một hàm `alliesOf(p)` hiện trả về `[]`; khi làm hệ team chỉ sửa đúng hàm đó. Chỗ đã đổi: R Nhà sư (bù lại tự hồi 45 → 60), Hào Quang (hưởng trọn phần của mình thay vì một nửa), Bất Hoại Thành, Hộ Vệ, Phục Sinh/Hồi Sinh Nhanh (áp cho chính mình), và cả bị động Sư Tử của blessing (trước đây kẻ địch đứng gần cũng tính là "đồng đội quanh 300px").

### Bot tự tìm đường + chỉnh nhịp map
- **Tìm đường**: tường là hình chữ nhật thẳng trục và không đổi, nên dựng sẵn đồ thị tầm nhìn — 4 góc mỗi tường đẩy ra 26px làm nút (32 nút), `NAVLINK` tính 1 lần lúc khởi động. Lúc chơi: `losClear()` kiểm đường thẳng trước, thông thì đi thẳng (trường hợp thường, không tốn gì); bị chắn mới chạy Dijkstra trên 32 nút — đo được **0.10 ms/lần**.
- Bot giờ **ngắm mục tiêu nhưng đi theo waypoint** (trước đây dùng chung một góc). Thêm phát hiện kẹt: nhích chưa tới 6px trong 0.5 giây thì tính lại đường, kẹt lần hai thì lách ngang 1.35 rad.
- Bot **không bắn và không lướt xuyên tường** nữa (`losClear` gác cả hai).
- Đo thực tế 573 mẫu: chuỗi đứng-yên-sát-tường dài nhất còn **0.4 giây** (trước đó có bot đứng chết một chỗ).

⚠ Lúc đo phải lọc bot đã chết (`al===1 && hp>0`) và bot đang đánh nhau, không thì tưởng nhầm là kẹt tường — lần đo đầu báo "kẹt 24 giây" hoá ra là xác bot chờ hồi sinh.

- **Rương hồi sinh** sau 45 giây (`CHEST_RESPAWN`), đầy lại đúng chỗ cũ.
- **Quái**: 9 bãi → 12 bãi (thêm 3 bãi lấp khoảng giữa map, trước đây đi giữa map không gặp gì), sĩ số mỗi bãi tăng, tổng ~70 con. Hồi sinh 15s/1 con → **4s/3 con**. Lý do phải tăng mạnh: bot có tìm đường rồi thì dọn map nhanh hơn hẳn — đo ở nhịp cũ thì phút thứ 6 chỉ còn 5 con trên toàn map.
- **Hộp blessing nổi lên trên hộp merchant** (`#offer{z-index:45}`): mua "blessing ngẫu nhiên" ở merchant bật bảng chọn ngay khi hộp merchant còn mở, cùng `z-index` thì thứ tự DOM quyết định nên bảng chọn nằm khuất phía sau.
- **Nút lên cấp có hiệu ứng thở** — quầng viền lan ra rồi tan + số nảy sáng, dùng thẻ `<i class="ring">` riêng chứ không phải `::after` (nút đã dùng `::after` cho vạch góc). Có nhánh `prefers-reduced-motion` tắt animation.

### Cây kỹ năng 48 node — port từ arena cũ sang map 1
`server.js` chạy cây trên hệ cờ `p.fx` với 30 flag móc vào `dmgTo`/`updatePlayer`/`doSkill`. `map1-server.js` không có hạ tầng đó (`grep -c 'p.fx'` = 0) và dùng mô hình chỉ số khác, nên phải dựng lại toàn bộ hook.

- Thêm `MINLV` / `buildMeta()` / `applyFx()` / `canAlloc()`; người chơi có thêm `pts`, `nodes`, `fx`, `br`, `dr`, `ls`, `reg`, `mreg`, `rateM`, `rngM`, `projN`.
- `recompute()` reset `fx` + 7 chỉ số mới rồi duyệt `nodes` — gọi nhiều lần không cộng dồn lặp (có test).
- Hook mới trong `dmgTo` (farDmg, rage, hunter, mark, judgement, frenzy, lastStandBuff, armorPen, giáp phẳng `dr`, Hộ Vệ, Phản Đòn, hút máu, soulDrain, vulnOnHit), `attack` (deathShot, Đa Tiễn + spreadPen, heavyBolt), `doE` (ePow, Xoáy Lốc, Bẫy Nổ, Ánh Sáng Thiêu), `doR` (Khiêu Chiến, healM/healShield/fountain), tick bị động (bulwark, auraHeal, weaken, reg/mreg, đồng hồ frenzy), `updateEnemies` (taunt, Suy Nhược), `onPlayerDown` (Tử Chiến, fastRes/resurrect).
- `doR_B()` mới: nhánh B đổi hẳn R (Cuồng Nộ / Nỏ Liên Thanh / Lời Nguyền) đúng nội dung bản cũ.

Bốn chỗ buộc phải khác bản cũ:
1. **Node tầng 1 nâng cấp E thay vì mở khoá E** — map 1 có E từ cấp 1 và blessing slot `e` phụ thuộc vào nó; gate lại là cấp 1 mất E và slot `e` thành vô dụng.
2. **Nhánh A giữ R hiện có**, chỉ nhánh B đổi R. Bản cũ cả hai nhánh đều *mở* R vì R vốn khoá.
3. **`vuln` ở map 1 là đồng hồ giây**, không phải hệ số như bản cũ — Xuyên Giáp đặt `vuln = 3` chứ không phải `0.15`.
4. **Bỏ hệ số nerf tank của PvP** (`DR_DUEL_SCALE`, trần khiên 70) — map 1 không có chế độ duel.

UI: nút lên cấp cạnh thanh máu (không tự bật bảng, đúng yêu cầu), phím `T` mở/đóng, `Esc` đóng. Bảng cây chỉ vẽ lại khi dữ liệu đổi — vẽ mỗi frame thì nút bị thay giữa `mousedown` và `mouseup` nên click không ăn (đã dính lỗi này ở merchant trước đó).

`test-tree.js` trích thẳng `applyFx`/`canAlloc`/`META` từ `map1-server.js` bằng `vm` nên không thể lệch bản khi sửa server.

### Chọn cung ở sảnh -> blessing bị động
- `map1-server.js`: `makePlayer()` nhận thêm tham số `sign`, lưu `p.sign` và gắn thẳng `bl.pas`. `join` đọc `m.sg`. `startMatch()` reset blessing nhưng **giữ lại** `pas: p.sign`. Bot không truyền cung nên tự bốc ngẫu nhiên.
- `map1.html`: client **nối WebSocket ngay khi mở trang** thay vì đợi bấm nút — gói `welcome` mang `cfg` tới trước cả khi join, nhờ đó bảng chọn cung lấy được `BLESS[sg].pas` thật từ server thay vì chép lại mô tả ở client (chép thì cân bằng lại là lệch ngay). Nút vào map khoá tới khi chọn xong cung.

### Địa hình map 1 — hai biến thể, dựng theo `design_handoff_map1_ruin`
Bỏ hẳn mô hình cũ (sàn trống + 8 tường hình chữ nhật). Mỗi ván server bốc **HẦM MỘ** (`crypt`, 17 phòng nối hành lang, sàn 46,2%) hoặc **PHẾ TÍCH** (`ruin`, vành đai đường đất + 4 nan hoa vào quảng trường tâm, sàn 43,8%).

- `assets/map1-layout.js`, `assets/map1-ruin-layout.js` — lưới 75×50 ô 32px + toạ độ boss/rương/bãi quái/merchant/cổng. Viết kiểu dùng được **cả hai phía**: `require()` ở server, `<script>` ở client (`window.MAP1_CRYPT` / `MAP1_RUIN`). Ký tự: `#` vật cản · `.` sàn/cỏ · `,` đường đất · `=` đá lát.
- **Bốc skin ở `resetWorld()`**, không bao giờ ở client (6 người sẽ thấy 6 map khác nhau). `SKIN=crypt node map1-server.js` để ép một biến thể khi test.
- `inWall()` giờ tra lưới thay vì quét `WALLS`. Phải lấy mẫu **9 điểm** (tâm + 4 cạnh + 4 góc) chứ không chỉ 4 góc — chỉ 4 góc thì ô cản nằm thẳng bên cạnh lọt qua khe giữa hai góc.
- **Tìm đường bot**: đồ thị tầm nhìn theo góc tường không mô tả nổi lưới, thay bằng A* trên chính lưới đó + rút gọn đường bằng `losClear`. 0,2 ms/lần, nối được 100% các cặp điểm quan trọng trên cả hai bản đồ.
- Ba chỗ trước đây thả thực thể bừa ra map nay phải bám sàn: quái sinh ở bãi (thu dần bán kính rồi mới về tâm bãi), quái **đi về camp** (tách trục X/Y như lúc đuổi), blessing rơi ngẫu nhiên (80 lượt thử, hết thì rơi vào ô rương).
- Cổng thoát lúc di tản đứng đúng chỗ bản thiết kế vẽ vòm đá (crypt 4 cổng, ruin 2) thay vì rải ngẫu nhiên 5 cái.
- **Chỗ đứng đầu ván**: lấy mẫu điểm-xa-nhất trên sàn, cách bệ boss ≥520px; bản phế tích ưu tiên vành đai đường đất. (Handoff để ngỏ câu này — đây là câu trả lời đã chọn.)
- Client: nền + decal vẽ **một lần** vào canvas đệm 2400×1600 lúc nhận gói `map`, mỗi frame chỉ blit phần trong khung nhìn. Hầm mộ có thêm lớp tối `dark:.55` khoét vũng đuốc + bloom ấm; phế tích không cần lớp tối, chỉ vignette — vật liệu tự phân tầng độ sáng.
- Prop (rương / quầy merchant / cổng dịch chuyển / bệ boss) **dùng chung một bộ** cho cả hai biến thể, đúng yêu cầu handoff.
- Test: `node test-nav.js` (va chạm + tìm đường + chỗ đứng, chạy cả hai biến thể) và `node test-map1.js` (mở server thật, chơi hết một ván với 5 bot, soát không ai kẹt trong vật cản).

### Bốn lỗi sau khi ghép địa hình mới (đã sửa)
1. **Tường vô hình ở hầm ngục.** `paintCrypt` chỉ vẽ vành đá **sát sàn** (712/2019 ô); 1307 ô đá sâu bên trong để nguyên màu nền `#0C0A10` — đúng bằng màu ngoài rìa bản đồ. Nên nhìn ra là hư không chứ không phải đá, và không có mép nào để biết bản đồ hết ở đâu. Va chạm luôn đúng: mô phỏng 430k bước cho ra 0 lần lọt ra ngoài lưới, 0 lần đứng trong ô đặc. Sửa: vẽ **mọi** ô đá — ô sát sàn thành mặt tường, ô sâu thành khối đá tối có mạch so le. Lớp tối cũng phải gỡ 12% cho đá (sàn 34%) thì vân đá mới còn nhìn thấy, và bloom đuốc bị cắt cho chỉ nằm trên sàn — để nó tràn lên mặt đá thì luật "sàn luôn sáng hơn đá" gãy ngay chỗ đông đuốc nhất. Đo lại: sàn tối nhất 60 vs đá sáng nhất 53 → tách bạch, 0 ô đá đen như hư không. Bản phế tích không dính lỗi này vì vẽ đủ 100% ô cản.
2. **Hồi sinh văng vào giữa khối đá rồi kẹt cứng.** Tôi giữ lại cú nhích ngẫu nhiên ±120px của bản cũ; địa hình mới có ~52% là đá nên cú nhích đó ném người chơi vào trong đá, `unstick()` quét vòng tròn 140px không tới được sàn nên đứng im vĩnh viễn. Sửa: **hồi sinh đúng chỗ chết** (chỗ đó chắc chắn đứng được, và 1.5 giây bất tử đã đủ thoát đám quái), cộng thêm lưới an toàn cuối cho `unstick()` — tìm thẳng trên lưới, mở rộng từng vành ô cho tới khi gặp ô đứng được, không bao giờ bỏ cuộc.
3. **Vũng độc / vũng nguyền vẽ sai.** `drawPools` vẫn là hình tròn phẳng alpha .22 từ bản prototype, không cùng ngôn ngữ với hiệu ứng pixel, và vũng nguyền còn tô nhầm màu vàng `#ffd479` thay vì tím. Sửa: thêm `ZAFx.pool()` vẽ vũng thường trú bằng đúng bộ nguyên thuỷ pixel của `effects.js`, theo đúng bán kính sát thương server gửi; server gửi thêm `t` (giây còn lại) để vũng nhạt dần ở nhịp cuối thay vì tắt phụt.
4. **Aura Cuồng Nộ không đi theo nhân vật.** Buff kéo 6 giây nhưng hiệu ứng sinh ra ở toạ độ lúc thi triển rồi đứng đó. Sửa bằng khái niệm **chủ hiệu ứng**: server gửi kèm `s` (slot), `effects.js` lưu `own`, thêm `ZAFx.follow(fn)` gọi mỗi frame trước khi vẽ — `fn(own)` trả vị trí đã nội suy, trả `null` thì hiệu ứng tắt luôn (chủ chết là aura tắt). Dùng lại được cho mọi buff bám người về sau.

⚠ Gói `state` **làm tròn** `x`/`y` về số nguyên, nên đừng lấy toạ độ trong gói mà kiểm va chạm trực tiếp — lệch nửa pixel là báo nhầm kẹt tường ở chỗ thân chạm chéo một góc đá. `test-map1.js` định nghĩa "kẹt" là **không nhúc nhích được theo cả 8 hướng**, miễn nhiễm với chuyện làm tròn.

### Sảnh chờ — biến thể NGÔI LÀNG
Theo `design_handoff_lobby_village`. Sảnh **không theo skin map**: crypt hay ruin thì làng vẫn thế. Làng là chỗ duy nhất trong game có màu ấm, nên bước qua cổng mới thấy hai map kia tối.

- Toạ độ gameplay **không đổi một con số nào**: sảnh 1200×820, spawn (600,690), Giáo Trưởng (380,430), Thợ Rèn (820,430), cổng (600,300) r58. `toLobby()`, `stepLobby()`, `inLobbyWall()` không sửa dòng nào.
- `assets/lobby-village-walls.js` — 16 khối thay mảng `LOBBY.walls` cũ: viền cây 56px bốn cạnh, 6 thân nhà, hội trường, sạp rèn, giếng, hồ, 2 cây cổ thụ. Hai cây cổ thụ đặt đúng chỗ hai bệ đá cũ nên cảm giác va chạm quanh cổng giữ nguyên.
- `assets/lobby-village.png` — nền 1200×820 vẽ 1:1, **là asset sản phẩm** chứ không phải ảnh tham chiếu. `drawLobby()` rút từ ~45 dòng còn: vẽ ảnh, nhịp sáng cổng, gọi `drawLobbyNpcs()`. Bỏ hẳn nền `#181220`, lưới 80px, thảm tím, vòng lặp vẽ `L.walls`.
- Bảng `MIME` của server phải có `.png` — thiếu là ảnh về dạng `application/octet-stream`.

**Lỗi bắt được khi làm việc này:** `doDash()` và `useSkill()` **không chặn theo phase**. Trong sảnh, `doDash` vẫn chạy và nó dùng `inWall()` tức lưới của **map đấu** chứ không phải tường làng — bấm Shift trong làng là lướt xuyên thẳng qua nhà, thả người chơi vào chỗ bất kỳ mà lưới map đấu cho phép. Đã chặn cả hai bằng `if (ROOM.ph === 'lobby') return;`. Đây cũng là câu trả lời cho câu hỏi số 1 của handoff (chạy nhanh trong làng: **không**).

Câu hỏi số 2 (tên người chơi khác): hiện trong 140px, mờ dần tới 200px, tên mình luôn hiện — 6 người tụ ở quảng trường giếng thì 6 cái tên đè lên nhau.

Còn một túi ~0,7% sàn ở góc phải dưới (sau hồ nước) mà bán kính thân 12px không lách vào được. Không có mốc gameplay nào trong đó nên để nguyên; `test-lobby.js` canh ngưỡng 1% để biết nếu nó phình ra.

### HUD & UI pixel "THÁNH TÍCH" — thay bản Thiên Bàn
Theo `design_handoff_pixel_hud` (phương án 1b). Chỉ đổi lớp trình bày: `map1-server.js`, netcode và vòng lặp game không sửa dòng nào.

- **Font**: Silkscreen (nhãn máy, số liệu, phím) + Press Start 2P (đồng hồ, tiêu đề dải) + Be Vietnam Pro (mọi câu văn). Hai font bitmap **không có glyph tiếng Việt** — mọi chuỗi có dấu buộc phải ăn `--font-body`. Nhãn lấy chữ từ `CFG` của server thì không hardcode được, nên có hàm `px()` bỏ dấu + viết HOA tại chỗ.
- **Bố cục HUD đổi hẳn** (kiểu Hades): máu + ví góc trên trái, dải blessing dọc cạnh trái, đồng hồ dán mép trên giữa, toast góc trên phải, hàng kỹ năng giữa dưới (LMB · E · R · SHF), minimap xuống góc dưới phải 192×128. Mọi thanh HP/MP/EXP/tiến trình là **ô rời** (`flex` + `gap:2px`), không `width:%` mượt; khiên vẽ **nối tiếp sau** máu chứ không đè.
- **Cây kỹ năng** quay về **đồ thị** của arena cũ (`index.html`): lấy nguyên bảng `POS`, dựng `<svg>` `crispEdges` cho đường nối, node 60×60 vuông, tooltip 190px.
- Minimap đổi ký hiệu từ **hình tròn sang hình vuông** — hình tròn ở cỡ 4–6px ra một cục nhoè, phá nhịp pixel của cả HUD.

**Hai chỗ làm khác bản thiết kế, có lý do:**
1. **Nhãn trạng thái slot trong hộp Blessing để 11.5px, không phải 10px.** Chuỗi ở đó có dấu ("trống", "thay Bọ Cạp") nên buộc ăn `--font-body`, mà chính checklist của handoff đặt sàn body là 11.5px — bản mock để 10px là tự mâu thuẫn. Chọn theo checklist cho đọc được.
2. **Tooltip cây kỹ năng đặt bằng cách thử vị trí có kiểm va chạm**, không chỉ đẩy trái/phải theo nửa khung như handoff mô tả. Cách của handoff vẫn đè node ở hàng giữa — đo được 176 lần đè trên 80 vị trí thử. Bản hiện tại thử lần lượt 6 vị trí ứng viên (phải/trái con trỏ, rồi ra ngoài khung) và lấy cái đầu tiên không cắt node nào: 0 lần đè trên 112 vị trí thử.

⚠ `#treeBox` phải có `flex:none`. Nó là flex item của `.bd`, không khoá thì bị co lại và hàng node dưới cùng (định vị tuyệt đối theo `POS`) bị cắt mất.

⚠ Font nạp từ Google Fonts. Chơi LAN không mạng sẽ tụt về font hệ thống — muốn chắc thì tải 3 font về `fonts/` rồi khai `@font-face` (bảng `MIME` đã có sẵn `.woff2`).

### UI "Thiên Bàn" — áp vào `map1.html`
Theo `UI_HANDOFF.md` + trang đối chiếu `Zodiac Arena UI.dc.html` của Claude Design. Chỉ đổi lớp trình bày, không đụng gameplay/netcode/`map1-server.js`.
- **Font**: Cormorant Garamond (tên gọi, tiêu đề, đồng hồ, phím kỹ năng) · Be Vietnam Pro (câu văn) · JetBrains Mono (nhãn máy, số liệu). Nạp qua `<link>` Google Fonts — xem cảnh báo dưới.
- **Màu**: nền navy → tím than `#0C0910`, nhấn cyan → thạch anh tím `#B98BE8`; giữ vàng và cam. Toàn bộ hex rời trong `<style>` đã gom về biến `:root`.
- **Mô-típ**: vạch góc (`.tick`, `::before/::after`) thay bo góc; nhãn mono giãn chữ; kẻ chỉ vàng hai bên đồng hồ; viền trái phân loại cho toast và hàng blessing; nút chính khối đặc.
- **HUD**: khiên vẽ **nối tiếp** sau máu (không đè) + sọc chéo + 10 vạch chia + nhãn số có nền riêng; ô kỹ năng 60×60 hiện tên chiêu khi sẵn sàng / số giây khi hồi; minimap 222×148 với 4 vạch góc vàng + hàng chú giải; cột blessing có ô glyph viền màu theo slot.
- **4 hộp thoại** dựng lại: vào game, blessing, merchant, kết quả (bảng grid 6 cột thay `<table>`).

Bốn chỗ làm khác handoff:
1. **Vạch góc dùng `::before/::after`** thay 2 thẻ `.tick-tl/.tick-br` — cùng kết quả, không thêm DOM. Minimap cần 4 góc nên có thêm một `<i class="c2">`.
2. **Ký hiệu hoàng đạo phải ép `U+FE0E`** — không có thì trình duyệt vẽ thành emoji màu, phá bảng màu.
3. **Tên kỹ năng và mô tả món hàng giữ ở client** (`SKNM`, `SHOPD`) vì server không gửi. Tên chiêu phải ≤9 ký tự mới vừa ô 60px ở mono 8.5px — `Khiên Thánh` rút thành `Khiên`.
4. **`#intro` dùng `align-items:flex-start` + `.card{margin:auto}`** thay `center` — màn hình thấp hơn thẻ thì `center` cắt mất đầu thẻ.

⚠ **Font tải từ Google Fonts CDN.** Game chạy LAN nên máy không có mạng sẽ tụt về Georgia/Consolas — đúng vấn đề handoff muốn tránh. Muốn chắc thì tải 3 font về `fonts/` rồi khai báo `@font-face`, và thêm `.woff2` vào bảng `MIME` trong `map1-server.js`.

---

### Sảnh chờ nhiều người — đếm ngược, không khoá vì AFK (19/08/2026)
Ba thay đổi để rủ bạn bè chơi chung mà không vướng nhau:
- **Đếm ngược 15 giây** (`LOBBY_CD`, đổi bằng biến môi trường). Trước đây `stepLobby()` đòi
  `humans.every(p => p.ready)` nên một người AFK là khoá cả phòng. Giờ: tất cả sẵn sàng thì vào
  ngay, chỉ MỘT người sẵn sàng cũng chạy đếm ngược, hết giờ cả sảnh đi cùng (ai chưa chọn cung
  thì vào không có blessing bị động). Người cuối cùng huỷ sẵn sàng thì đếm ngược dừng lại.
- **Cho biết đang chờ ai**: gói state thêm `lb {n, r, cd, w}`. Client vẽ dải "2/3 SAN SANG · vào
  map sau 9s / Đang chờ: <tên>" ở đỉnh màn hình sảnh (`#lobwait`) và lặp lại trong bảng cổng.
- **Vào giữa ván không phá ván đang chạy**: chỗ join cũ làm `if (ROOM.ph !== 'lobby') ROOM = makeRoom()`
  — thay phòng là xoá sạch người đang chơi khỏi `ROOM.players`, cả bọn đứng hình. Giờ chỉ dựng phòng
  mới khi KHÔNG còn người thật nào; còn lại server trả `{t:'wait', tm}`, client hiện màn hình chờ và
  tự gõ cửa 4 giây một lần cho tới khi ván xong về sảnh.

## Ba chỗ làm khác `SPRITES_HANDOFF.md` (cân nhắc lại nếu cần)

1. **Xác quái dùng diff `ANIM` thay vì event `die`** — event `die` không mang `r`, mà `scale = r/8` cần nó; cách diff còn bắt được quái chết vì độc.
2. **Dấu độc đổi từ nhuộm thân sang bọt xanh nổi phía trên** — sprite có bảng màu cố định nên không nhuộm được như code khối cũ.
3. **Có sửa `drawGhost`** (handoff bảo không đụng) — bỏ khối chữ nhật cũ, thay bằng animation `die`, giữ nguyên đồng hồ hồi sinh. Để nguyên thì lòi khối vuông giữa dàn pixel.

Lưu ý kỹ thuật: **đòn thường tầm xa không phát event nào từ server** (chỉ cận chiến bắn `slash`). Client suy ra bằng cách phát hiện đạn còn nằm trong 24px quanh chủ nhân.

---

## Việc tiếp theo (ưu tiên từ trên xuống)

### 1. Cân bằng — có số liệu rồi, cần chơi tay
Test bot cho thấy **Nhà sư nhánh Trị Liệu thắng 6/6 trận FFA**, Kiếm sĩ và Xạ thủ không thắng ván nào.
Nghi combo `mk_A_root` (Chữa Lành) + `mk_A_key` (Suối Nguồn: hồi ×2, máu thừa hoá khiên) hồi vượt xa DPS.

Hướng xử lý gợi ý: giảm hiệu lực hồi máu riêng ở PvP, giống cách khiên đã bị rò rỉ 10/giây.

Chạy lại để có mốc so sánh:
```bash
node test-bot.js duel 120000
```

Cũng ghi nhận: quái co-op gây ~26 dmg/giây khi 3 con bám sát (mỗi con 7 dmg / 0.8s) — đủ hạ Kiếm sĩ 144 HP trong ~5.5 giây nếu đứng yên. Có thể hơi gắt cho đợt đầu.

### 2. Mã phòng (bắt buộc nếu muốn host online)
Hiện chỉ có **2 phòng toàn cục** (`coop` và `duel`), mỗi phòng `MAXP=3`. Đưa lên internet thì người lạ lấp chỗ, bạn bè không vào được. Đây là thứ chặn thật sự, không phải hạ tầng.

Kèm theo: `ranks.json` ghi theo **tên nhân vật**, không có tài khoản — ai gõ trùng tên là chiếm MMR người khác.

### 3. Host free (đã khảo sát, chưa làm)
- **Render** — dễ nhất, có Singapore. Ngủ sau ~15 phút, cold start ~50s, ổ đĩa ephemeral nên `ranks.json` bay mỗi lần deploy.
- **Fly.io** — region `sin`, ping tốt nhất cho VN, có volume giữ `ranks.json`. Free allowance đổi liên tục, phải xem lại giá.
- **Oracle Cloud Always Free** — VM không ngủ, free vĩnh viễn, nhưng tốn công setup nhất.

Loại thẳng Vercel/Netlify/Cloudflare Pages: serverless không giữ được WebSocket và vòng lặp 30Hz.

`PORT` đã đọc từ `process.env.PORT` và client đã tự chọn `wss://` khi trang chạy https — hai thứ này sẵn sàng rồi.

### 4. Từ roadmap gốc, chưa đụng
- Boss co-op cần đủ 3 vai (tank chịu đòn / healer đỡ / DPS burst).
- Hồi sinh đồng đội đầy đủ (hiện mới có tăng tốc hồi sinh).
- Leaderboard có lịch sử đấu / streak (đã có endpoint `/leaderboard` trả JSON).
- Gamepad twin-stick; hệ vũ khí chính/phụ + swap; class Sát thủ.
- Âm thanh (chưa có gì).

---

## Vặt cần nhớ

- Sửa `server.js` phải **restart**; sửa `index.html` hoặc `sprites.js` chỉ cần **F5**.
- `ranks.json` tự sinh, đã cho vào `.gitignore`. Xoá file = reset bảng xếp hạng.
- Chưa phải git repo — muốn version thì `git init` trước.
- Node.js v24.18.1 đã cài trên máy này (04/08/2026), có sẵn trong PATH.
- Chưa có rate-limit hay giới hạn số kết nối: một người mở 50 tab là server ngợp.
