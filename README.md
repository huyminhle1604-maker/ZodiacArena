# ⚔ Zodiac Arena

Pixel MMORPG-lite chơi LAN: **ngày sinh → cung hoàng đạo → buff nền**, chồng lên hệ **class + nhánh + cây kỹ năng**.
Hai chế độ: **Co-op PvE** (1–3 người) và **PvP FFA xếp hạng** (2–3 người, BO5).

Không cần `npm install`. Không cần build. Chỉ cần Node.js.

---

## Chạy game

1. Cài **Node.js 18+** (https://nodejs.org — bản LTS).
2. Trong thư mục này, chạy:

```bash
node server.js
```

3. Server sẽ in ra địa chỉ, ví dụ:

```
Máy này :  http://localhost:8080
Máy khác:  http://192.168.1.12:8080
```

4. Mỗi người mở địa chỉ đó bằng trình duyệt (Chrome/Edge/Firefox). Xong.

> Windows lần đầu chạy sẽ hỏi **Firewall** cho Node — chọn **Allow** (nhớ tick cả *Private network*) thì máy khác mới vào được.
> Đổi cổng: `PORT=9000 node server.js`
> Trên Windows dùng `.bat`: double-click **`start.bat`**.

---

## Điều khiển

| Phím | Tác dụng |
|---|---|
| `WASD` / `↑ ↓ ← →` | Di chuyển |
| Chuột | Ngắm |
| Giữ **chuột trái** hoặc `Space` | Đánh thường |
| `E` | Kỹ năng class |
| `R` | Kỹ năng nhánh (mở ở cấp 3) |
| `T` | Mở cây kỹ năng (co-op) |

---

## Cách chơi

### Tạo nhân vật
Nhập tên → chọn class → nhập **ngày sinh** → nhận cung hoàng đạo. Ngày sinh chỉ dùng để tính cung, không lưu ở đâu.

### 3 class (trinity)

| Class | Vai | Nhánh A | Nhánh B |
|---|---|---|---|
| ⚔ **Kiếm sĩ** (HP 130) | Tank / Bruiser | Vệ Binh — khiên, khiêu chiến | Cuồng Chiến — sát thương, hút máu |
| 🏹 **Xạ thủ** (HP 92) | DPS tầm xa | Cung Thủ — chí mạng, đa mũi tên | Nỏ Thủ — đạn nặng, xuyên giáp |
| 🔮 **Nhà sư** (HP 100) | Support | Trị Liệu — hồi máu, khiên | Cầu Nguyện — nguyền, làm yếu |

Chọn nhánh ở tầng 3 sẽ **khoá vĩnh viễn** nhánh còn lại.

### 12 cung hoàng đạo (buff nền)

| Cung | Buff |
|---|---|
| ♈ Bạch Dương | Đòn mở trận ×2 sát thương |
| ♉ Kim Ngưu | Đứng yên 0.6s → −35% sát thương nhận |
| ♊ Song Tử | Dùng kỹ năng → +30% tốc đánh 3s |
| ♋ Cự Giải | Dưới 40% máu → hồi máu ×3 |
| ♌ Sư Tử | +6% sát thương mỗi địch gần (tối đa 5) |
| ♍ Xử Nữ | Mỗi giây không dính đòn → +3% chí mạng (tối đa +30%) |
| ♎ Thiên Bình | HP% ≈ MP% → +18% sát thương |
| ♏ Bọ Cạp | +6% chí mạng; chí mạng gieo độc, độc lây |
| ♐ Nhân Mã | Càng xa mục tiêu càng mạnh (tới +30%) |
| ♑ Ma Kết | +1.5% sát thương mỗi 10s sống sót (tối đa +30%) |
| ♒ Bảo Bình | 12% mỗi đòn kích hoạt hiệu ứng ngẫu nhiên |
| ♓ Song Ngư | Mana tối đa ×1.8 |

### Co-op PvE
Chống các đợt quái, số quái = 3–6 × số người. Quái đuổi người **gần nhất** — Kiếm sĩ nhánh Vệ Binh dùng `R` để **khiêu chiến** kéo aggro.
Giết quái → EXP → lên cấp → **+1 điểm kỹ năng** (nhấn `T` để rải). Gục ngã thì hồi sinh sau 6 giây; Nhà sư nhánh Trị Liệu rút ngắn thời gian này.

### PvP FFA xếp hạng
Màn chuẩn bị: mỗi người được **10 điểm** kỹ năng, rải xong bấm **Sẵn sàng**. Build **khoá cả trận**, có nút *Đặt lại điểm* trước khi sẵn sàng.
Hỗn chiến tự do 60 giây/ván; hết giờ thì ai **% máu cao nhất** thắng ván. Ai thắng **3 ván** trước là vô địch (BO5).

**Orb** rơi giữa map (đầu tiên ở giây 5, sau đó mỗi 10 giây, tối đa 2, biến mất sau 12 giây):

| Orb | Hiệu ứng |
|---|---|
| ➕ xanh lá | Hồi 25% máu |
| ◆ trắng | +30 khiên |
| ✦ xanh dương | +25% mana |
| ▲ cam | +25% sát thương (5 giây) |
| ■ vàng | +25% phòng thủ (5 giây) |

**Xếp hạng:** MMR bắt đầu 1000, tính ELO sau mỗi trận, lưu vào `ranks.json` theo **tên nhân vật**.
Bậc: `<1000` Đồng · `<1200` Bạc · `<1400` Vàng · `<1600` Bạch Kim · `≥1600` Kim Cương.
Xem bảng xếp hạng ở màn chọn chế độ, hoặc mở `http://<địa-chỉ>:8080/leaderboard`.

---

## Cân bằng PvP (nerf tank)

Chỉ áp dụng trong PvP, không áp ở co-op:
- Khiên **rò rỉ 10/giây**.
- Giảm sát thương (`dr`) chỉ còn **70% hiệu lực**.
- Keystone *Bất Hoại Thành*: trần khiên **120 → 70**.

---

## File trong thư mục

| File | Vai trò |
|---|---|
| `server.js` | Toàn bộ game logic — server thẩm quyền, HTTP + WebSocket viết tay |
| `index.html` | Client: render Canvas, input, HUD, cây kỹ năng |
| `sprites.js` | Bộ sprite pixel 16×16 (nhân vật + quái), vẽ bằng code — không có file ảnh |
| `ranks.json` | Dữ liệu xếp hạng (tự sinh — xoá file là reset bảng) |
| `start.bat` | Double-click để chạy server trên Windows |
| `test-bot.js` | Bot giả lập người chơi để test không cần mở nhiều máy |
| `HANDOFF.md` | Tài liệu kiến trúc cho dev |

Sửa `server.js` phải **restart**. Sửa `index.html` chỉ cần **F5** trình duyệt.

---

## Test bằng bot

Mở server ở một cửa sổ, rồi chạy ở cửa sổ khác:

```bash
node test-bot.js coop 40000
```

```bash
node test-bot.js duel 120000
```

Bot là client WebSocket thô (`net` + `crypto`), tự vào phòng, rải điểm kỹ năng, đuổi đánh mục tiêu và in thống kê khi xong (số đợt, cấp, quái giết, các pha PvP, tỉ số, ELO). Tham số thứ hai là thời gian chạy tính bằng mili-giây.
