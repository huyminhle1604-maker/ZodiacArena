# ⚔ Zodiac Arena

**PvPvE extraction 3 map.** Vào map, đánh quái, mở rương, nhặt **blessing của 12 cung hoàng đạo**, đánh nhau với người khác, sống sót tới cổng dịch chuyển để mang token đi tiếp.

> Điểm bán hàng cốt lõi: **mỗi ván bạn xây một build khác nhau — và build đó chết theo ván.**

Cảm hứng: 33 Immortals (đông người, PvE co-op) · Hades (build ngẫu nhiên) · battle royale (map co dần).

Không cần `npm install`. Không cần build. Chỉ cần Node.js 18+.

---

## Repo này đang có gì

| Thứ | Trạng thái |
|---|---|
| **Prototype Map 1** (`map1-server.js` + `map1.html`) | 🟢 **Đang phát triển** — vòng lặp 10 phút của map 1, chạy được đầy đủ |
| Thiết kế 3 map | 📄 Đã chốt trên giấy — xem `game_idea.txt` |
| **Arena bản cũ** (`server.js` + `index.html`) | 🟡 **Legacy** — bản co-op PvE + PvP FFA trước khi xoay hướng. Giữ lại để tham chiếu số liệu class/skill, không phát triển tiếp |

Map 2 và map 3 **chưa code**. Prototype hiện tại chỉ trả lời một câu hỏi: *vòng lặp 10 phút của map 1 có vui không?*

---

## Chạy Prototype Map 1

```bash
node map1-server.js
```

Mở `http://localhost:8081` (Windows: double-click **`start-map1.bat`**).

Server tự **thêm 5 bot** cho đủ 6 chỗ, nên chơi thử một mình vẫn có người để đụng độ.

Biến môi trường để test nhanh:

```bash
MATCH_TIME=120 BOTS=0 PORT=9001 node map1-server.js
```

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `MATCH_TIME` | `600` | Độ dài ván (giây) |
| `BOTS` | `5` | Số bot lấp chỗ |
| `PORT` | `8081` | Cổng |

> Windows lần đầu chạy sẽ hỏi **Firewall** cho Node — chọn **Allow** (tick cả *Private network*) thì máy khác trong LAN mới vào được.

### Chạy arena bản cũ

```bash
node server.js
```

Cổng `8080` (hoặc `start.bat`). Chạy song song với map 1 được vì khác cổng.

---

## Điều khiển (Map 1)

| Phím | Tác dụng |
|---|---|
| `WASD` / `↑ ↓ ← →` | Di chuyển |
| Chuột | Ngắm |
| Giữ **chuột trái** hoặc `Space` | Đánh thường |
| `E` | Kỹ năng class |
| `R` | Kỹ năng mạnh |
| `Shift` | **Lướt** — 140px, hồi 4 giây, có 0.15s bất tử |
| `F` | Mở merchant (khi đứng cạnh) |
| `Esc` | Đóng merchant |

---

## Vòng lặp Map 1

Map **2400×1600** có camera bám nhân vật, 6 người, **10 phút + 30 giây thoát**.

```
farm quái → xu → rương → blessing → merchant → world boss
          → hết giờ → mưa thiên thạch + 5 cổng → thoát hoặc mất trắng
```

**Địa hình cố định mọi ván** (dễ so sánh khi test): 9 bãi quái · 16 chỗ rương · 3 merchant · 8 bức tường · boss ở chính giữa.

### Quái

| Loại | HP | Sát thương | XP | Xu |
|---|---|---|---|---|
| Slime | 34 | 7 | 6 | 2 |
| Runner | 22 | 5 | 7 | 2 |
| Brute | 95 | 15 | 18 | 7 |
| Caster (tầm xa) | 40 | 9 | 13 | 4 |
| **World boss** | **1400** | 26 | 160 | 90 |

Boss xuất hiện ở **giây 210** (35% thời lượng ván) tại giữa map — đếm ngược công khai cho cả map thấy, đây là lý do PvP nổ ra sớm. Boss rơi **token**.

Định kỳ có quái được **buff hoàng đạo** (5 loại dễ nhận diện bằng hình: Bạch Dương, Kim Ngưu, Song Tử, Bọ Cạp, Song Ngư), hiện ký hiệu cung trên đầu.

### Blessing — 12 cung × 5 slot

Đây là hệ build của game. Mỗi cung có **5 hiệu ứng khác nhau** tuỳ **slot** bạn gắn vào:

| Slot | Ảnh hưởng |
|---|---|
| `atk` | Đánh thường |
| `e` | Kỹ năng E |
| `r` | Kỹ năng R |
| `pas` | Bị động |
| `dash` | Lướt |

Ví dụ **Bọ Cạp**: gắn `atk` → chí mạng gieo độc cộng dồn 5 tầng · gắn `dash` → lướt để lại vệt độc · gắn `pas` → miễn nhiễm độc, độc tự lây giữa các địch đứng gần nhau.

→ **60 hiệu ứng**, bảng đầy đủ ở `BLESS` trong [`map1-server.js`](map1-server.js).

Gắn **đủ 5 slot cùng một cung** thì mở **Bộ Hợp Cung** (Chiến Thần, Sơn Nhạc, Vạn Độc, Bất Diệt…).

### Chọn cung ở màn vào game

Trước khi vào map, người chơi chọn **1 trong 12 cung** — cung đó vào thẳng slot **Bị Động**, nên bạn bắt đầu ván với sẵn một blessing thay vì tay trắng. Màn chọn hiện luôn mô tả hiệu ứng bị động của từng cung (lấy trực tiếp từ server, không chép lại ở client).

Cung chọn ở sảnh **được giữ qua các ván mới**. Nhặt blessing khác gắn vào slot `pas` thì đè mất — giống mọi slot khác. Bot cũng được bốc một cung ngẫu nhiên.

Nguồn blessing: rương (45% cơ hội) và merchant. Blessing của người khác **không công khai** — trừ khi bạn gắn Xử Nữ vào `pas`.

### Rương

16 chỗ cố định, mở mất thời gian nên là điểm dễ bị úp. Kết quả:

| Tỉ lệ | Nhận được |
|---|---|
| 45% | 1 blessing (chọn cung + chọn slot) |
| 27% | 1–2 token |
| 18% | 8–21 xu |
| 10% | +10 HP tối đa, +1.5 sát thương |

### Merchant

3 vị trí **cố định, hiện trên minimap**, chỉ **mở 1 chỗ tại một thời điểm** và **luân phiên mỗi 2 phút** — cố tình làm vậy để biến thành điểm nóng: ai cũng biết đối thủ sắp phải tới đâu. Xuất hiện sau giây 30, mỗi lượt bày **4 món ngẫu nhiên** trong 9 món.

Bán bằng **xu**: HP tối đa, sát thương, tốc chạy, hồi máu, khiên 60, **đổi 1 blessing sang cung khác (40 xu)**, **mua blessing ngẫu nhiên (55 xu)**.

### Thoát — 30 giây cuối

Hết 10 phút thì **5 cổng dịch chuyển** mở ở vị trí ngẫu nhiên, đồng thời **mưa thiên thạch** rơi khắp map (báo trước 1.3 giây, bán kính 78px, 55 sát thương lên người và 90 lên quái).

Chạm cổng = **thoát, giữ token**. Không kịp hoặc chết = **mất trắng**. Xếp hạng cuối ván: thoát được trước, rồi tới số token.

### Xu vs token

- **Xu** — tiêu trong ván, để mua ở merchant. Quái rơi xu. Chết thì rơi lại 40%.
- **Token** — phần thưởng mang ra khỏi ván (theo thiết kế là để mua đồ ở lobby). Rương, boss và **giết người (+1)** cho token.

> Theo thiết kế 3 map, thắng ở map 3 sẽ **nhân đôi toàn bộ token cả ván**. Prototype chỉ có map 1 nên **chưa áp hệ số x2** — con số cuối ván là con số thô.

---

## 3 class

| Class | HP | MP | Tốc | Sát thương | Tầm | Vai |
|---|---|---|---|---|---|---|
| ⚔ **Kiếm sĩ** | 130 | 60 | 2.6 | 11 | 46 | Cận chiến |
| 🏹 **Xạ thủ** | 92 | 72 | 3.1 | 9 | 330 | DPS tầm xa |
| 🔮 **Nhà sư** | 100 | 115 | 2.8 | 8 | 260 | Phép / hỗ trợ |

| Class | `E` | `R` |
|---|---|---|
| Kiếm sĩ | Chém Xoay (12 mana, 6s) | Khiên Thánh (20 mana, 12s) |
| Xạ thủ | Mũi Xuyên (14 mana, 5s) | Mưa Tên (25 mana, 13s) |
| Nhà sư | Sóng Âm (12 mana, 6s) | Chữa Lành (25 mana, 10s) |

Số liệu giữ nguyên từ bản arena cũ để cảm giác không lệch. **Cây kỹ năng và hệ nhánh tạm lược bỏ ở map 1** — build giờ đến từ blessing.

Ở map 1, cung hoàng đạo **chọn tự do**, không tính theo ngày sinh như bản cũ.

---

## Sprite

Nhân vật và quái **vẽ hoàn toàn bằng Canvas 2D, không có một file ảnh nào**.

- `sprites.js` — bộ **"Hero's Quest"**, khung 92×76, góc nhìn 3/4 top-down. **9 skin hero** (3 nhánh × 3 class) + 4 quái, mỗi con đủ 5 trạng thái `idle` · `move` · `attack` · `hit` · `die`. Frame được cache theo `key|state|slot|facing` nên vẽ hàng chục nhân vật vẫn nhẹ. Dùng cho `map1.html`.
- `sprites-legacy.js` — bộ pixel 16×16 cũ, 6 skin hero. Dùng cho `index.html`.

9 skin hero là **ngoại hình theo nhánh nâng cấp**. Map 1 chưa có hệ nhánh nên đang chia theo slot; khi server gửi thêm trường `br` thì ngoại hình tự đổi, không phải sửa phần vẽ.

Chi tiết API và cách tích hợp: [`SPRITES_HANDOFF.md`](SPRITES_HANDOFF.md).

---

## Giao diện

`map1.html` chạy hệ thiết kế **"Thiên Bàn"** — nền tím than, nhấn thạch anh tím, vạch góc thay bo góc, ba font: Cormorant Garamond (tên gọi, tiêu đề, đồng hồ) · Be Vietnam Pro (câu văn) · JetBrains Mono (nhãn máy, số liệu). Đặc tả đầy đủ ở [`UI_HANDOFF.md`](UI_HANDOFF.md).

> Font nạp từ Google Fonts qua `<link>`. Chơi LAN không có internet thì tụt về font hệ thống — muốn chắc chắn thì tải font về máy và khai báo `@font-face`.

`index.html` (arena cũ) vẫn giữ giao diện navy/cyan trước đó.

---

## File trong thư mục

| File | Vai trò |
|---|---|
| `map1-server.js` | **Prototype map 1** — server thẩm quyền, HTTP + WebSocket viết tay, có bot |
| `map1.html` | Client map 1 — camera, minimap, bảng chọn blessing, merchant |
| `sprites.js` | Bộ sprite "Hero's Quest" — 9 hero + 4 quái, vẽ bằng code |
| `server.js` | Arena bản cũ (legacy) — co-op PvE + PvP FFA + cây kỹ năng + ELO |
| `index.html` | Client arena bản cũ |
| `sprites-legacy.js` | Bộ sprite 16×16 cũ, chỉ `index.html` dùng |
| `test-bot.js` | Bot client cho **arena cũ** (map 1 đã có bot sẵn trong server) |
| `game_idea.txt` | **Thiết kế 3 map đầy đủ** — đã chốt sau vòng review |
| `TIEN-DO.md` | Nhật ký tiến độ, các quyết định làm khác handoff |
| `HANDOFF.md` | Kiến trúc arena cũ, cho dev |
| `SPRITES_HANDOFF.md` | API sprite và cách tích hợp |
| `UI_HANDOFF.md` | Đặc tả hệ chữ, bảng màu và UI của map 1 |
| `pitch.html` | Trang pitch của dự án |
| `ranks.json` | Xếp hạng ELO của arena cũ (tự sinh, không commit) |

Sửa file `*-server.js` phải **restart**. Sửa `.html` hoặc `sprites*.js` chỉ cần **F5**.

---

## Arena bản cũ (legacy)

Bản trước khi xoay sang extraction, vẫn chạy đầy đủ ở cổng `8080`:

- **Co-op PvE** 1–3 người, chống các đợt quái, có **cây kỹ năng 48 node**.
- **PvP FFA xếp hạng** 2–3 người, BO5 60 giây/ván, 5 loại orb rơi giữa map, MMR ELO lưu vào `ranks.json`. Bảng xếp hạng ở `http://localhost:8080/leaderboard`.
- 3 class × **2 nhánh** (khoá vĩnh viễn ở tầng 3), 12 cung hoàng đạo **tính từ ngày sinh**.
- Nerf tank riêng cho PvP: khiên rò rỉ 10/giây, `dr` chỉ còn 70% hiệu lực, keystone Bất Hoại Thành trần khiên 120 → 70.

Test bằng bot:

```bash
node test-bot.js coop 40000
```

```bash
node test-bot.js duel 120000
```

Chi tiết: [`HANDOFF.md`](HANDOFF.md).
