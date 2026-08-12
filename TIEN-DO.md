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
