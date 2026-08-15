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

- 3 NPC (`class` / `sign` / `shop`) + 1 cổng; bấm `F` khi đứng trong bán kính 62px.
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
