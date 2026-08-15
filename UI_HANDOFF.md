# Handoff — Hệ chữ & UI cho `map1.html`

Áp bản thiết kế trong project design (`Zodiac Arena UI.dc.html`) vào `map1.html`.
Đây là **thay lớp trình bày**: font, màu, khung, nhịp. Không đổi gameplay, không đổi
`map1-server.js`, không đổi netcode, không đổi bố cục HUD (đồng hồ trên giữa, minimap
phải trên, cột blessing phải, thanh máu trái dưới, ô kỹ năng phải dưới — giữ nguyên vị trí).

---

## 1. Font

Thay 3 font hệ thống hiện tại (Constantia / Segoe UI / Consolas). Lý do: máy người chơi
không có sẽ tụt về Georgia/Courier — mỗi máy hiển thị một kiểu, và Consolas thiếu dấu
tiếng Việt ở một số weight.

Thêm vào `<head>`:

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Be+Vietnam+Pro:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

Khai báo biến:

```css
:root{
  --font-display: 'Cormorant Garamond', Constantia, Georgia, serif;
  --font-body:    'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', Consolas, monospace;
}
```

Dùng ở đâu:

| Font | Dùng cho | Không dùng cho |
|---|---|---|
| `--font-display` | Tên nhân vật, tên cung hoàng đạo, tiêu đề hộp thoại, đồng hồ đếm ngược, chữ phím trong ô kỹ năng (E/R/⇧), tên Bộ Hợp Cung | Bất cứ gì dưới 15px |
| `--font-body` | Mọi câu văn: mô tả blessing, mô tả món hàng, toast, tên người chơi trong bảng kết quả, nhãn bàn phím trong màn intro | Số liệu |
| `--font-mono` | Nhãn viết hoa giãn chữ (`letter-spacing:.14em–.22em`), số máu/mana/xu/token, giá tiền, phím tắt, cooldown, nhãn cột bảng | Câu văn dài |

Mọi chỗ hiện số phải có `font-variant-numeric: tabular-nums` — số cùng bề rộng nên
thanh máu và đồng hồ không giật khi số thay đổi.

Vẽ chữ trên canvas (tên nổi trên đầu nhân vật, nhãn CỔNG / MERCHANT / boss):

```js
ctx.font = '8px "Be Vietnam Pro", sans-serif';   // tên người chơi
ctx.font = '8px "JetBrains Mono", monospace';    // nhãn viết hoa trên map
```

---

## 2. Bảng màu

Nền cũ xanh navy → **tím than / obsidian**. Nhấn chính cyan → **thạch anh tím**.

```css
:root{
  /* nền */
  --bg:        #0C0910;   /* nền ngoài cùng, khoảng tối nhất */
  --bg-field:  #151019;   /* nền vùng chơi trên canvas */
  --panel:     #1A1420;   /* nền panel / hộp thoại / ô kỹ năng */
  --panel-2:   #231A2C;   /* nền hàng trong danh sách, input */
  --slot:      #130E19;   /* rãnh thanh máu, ô rỗng */

  /* viền */
  --line:      #2F2439;   /* viền mảnh, đường chia hàng */
  --line-2:    #40314C;   /* viền panel, viền ô */
  --grid:      #1E1726;   /* lưới nền trên canvas */
  --wall:      #271F33;   /* khối tường trên map */

  /* chữ */
  --ink:       #F0E9F4;   /* chữ chính (hơi ấm, không trắng lạnh) */
  --ink-2:     #9E90AB;   /* chữ phụ, mô tả */
  --ink-3:     #70647B;   /* nhãn mờ, chú giải */

  /* nhấn */
  --accent:    #B98BE8;   /* thạch anh tím — nhấn chính, cổng, sẵn sàng */
  --accent-in: #160C22;   /* chữ trên nền accent */
  --gold:      #C9A961;   /* xu, rương, merchant, Bộ Hợp Cung */
  --danger:    #E2703A;   /* cam thiên thạch — boss, exodus, cảnh báo */

  /* máu / mana / khiên */
  --hp-a:      #a32e22;  --hp-b: #e05a3f;
  --mp-a:      #5C3E92;  --mp-b: #A579DC;
  --shield:    #E6D8C4;  --shield-2: #C3B096;
}
```

Màu slot blessing (thay 4 sắc xanh cũ — mỗi slot một sắc để phân biệt tức thì):

```
Đòn đánh   #E2703A    Kỹ năng E  #8E7AD8    Kỹ năng R  #E08FB4
Bị động    #8FC98A    Lướt       #C9A961
```

Nguyên tắc: nền tối chỉ 2 tông (`--bg`, `--panel`); vàng và cam là hai màu duy nhất
cạnh tím — không thêm màu mới.

---

## 3. Chi tiết khung — 5 mô-típ dùng lại khắp UI

**a) Vạch góc (corner tick).** Đặc trưng hình của cả UI, thay cho bo góc:

```css
.tick-tl,.tick-br{position:absolute;width:12px;height:12px}
.tick-tl{top:-1px;left:-1px;border-top:1px solid var(--accent);border-left:1px solid var(--accent)}
.tick-br{bottom:-1px;right:-1px;border-bottom:1px solid var(--accent);border-right:1px solid var(--accent)}
```

Mọi panel/hộp thoại có 2 vạch góc chéo nhau (trên-trái + dưới-phải), màu theo ngữ cảnh:
tím cho UI chung, vàng cho merchant, hồng cho blessing. Minimap dùng đủ 4 góc, màu vàng.

**Không dùng `border-radius` ở đâu cả.** Toàn bộ UI là góc vuông — khớp với sprite pixel.

**b) Nhãn máy.** Mọi nhãn phân loại:

```css
.label{font-family:var(--font-mono);font-size:10px;letter-spacing:.18em;
       text-transform:uppercase;color:var(--ink-3)}
```

**c) Kẻ chỉ vàng.** Hai bên đồng hồ đếm ngược:

```css
.rule-l{width:54px;height:1px;background:linear-gradient(90deg,transparent,var(--gold))}
.rule-r{width:54px;height:1px;background:linear-gradient(270deg,transparent,var(--gold))}
```

**d) Viền trái màu.** Toast và hàng blessing dùng `border-left:2–3px solid <màu loại>`
để phân loại bằng màu mà không cần icon.

**e) Nút.** Nút chính là khối đặc `background:var(--accent);color:var(--accent-in)`,
chữ mono viết hoa giãn chữ. Nút phụ chỉ có viền `1px solid var(--line-2)`, chữ `--ink-2`.
Không gradient, không shadow ngoài.

---

## 4. HUD — sửa từng phần

### Đồng hồ + pha (trên giữa)

```
kẻ chỉ vàng ── 02:41 ── kẻ chỉ vàng      display, 52px, weight 700, tabular-nums,
                                          text-shadow: 0 3px 18px #000
        SĂN ĐỒ — MAP 1                    mono 10.5px, letter-spacing .22em, --ink-2
  ⚠ TINH LINH HOÀNG ĐẠO · TRUNG TÂM       mono 11px, nền rgba(226,112,58,.1),
                                          viền rgba(226,112,58,.4), chữ --danger
```

Dòng cảnh báo chỉ hiện khi có sự kiện đang chạy (boss spawn, exodus). Khi vào phút
exodus, đổi chữ pha thành `EXODUS — CHẠY TỚI CỔNG` và cho khối cảnh báo nhấp nháy
`opacity 1 ↔ .55` chu kỳ 700ms.

### Thanh máu (trái dưới)

Thứ tự từ trên xuống: tên + cấp/class → ví → máu → mana → EXP.

```
Lê Minh Huy            display 19px 700
CẤP 7 · KIẾM SĨ        mono 11px, letter-spacing .1em, --ink-2

◈ 284 XU   ✦ 3 TOKEN   mono 13px; số --gold / --accent, chữ "XU"/"TOKEN" 10px opacity .75
```

Thanh máu — 3 điểm quan trọng:

1. **Khiên vẽ NỐI TIẾP sau máu**, không đè lên. Máu `left:0;width:<hp%>`,
   khiên `left:<hp%>;width:<shield%>`. Khiên dùng sọc chéo để phân biệt cả khi
   người chơi bị mù màu:
   `repeating-linear-gradient(135deg,var(--shield) 0 3px,var(--shield-2) 3px 6px)`
2. **10 vạch chia** phủ lên trên (`border-right:1px solid rgba(12,9,16,.55)`) — đọc được
   phần trăm bằng mắt mà không cần đọc số.
3. **Nhãn số có nền mờ riêng** (`background:rgba(6,9,14,.72);padding:0 9px`) chứ không
   dựa vào `text-shadow` — vì chữ nằm trên cả nền đỏ, nền sọc trắng và rãnh tối.

Cao: máu 17px, mana 11px, EXP 4px (EXP chỉ là vạch mảnh + nhãn `EXP 34%` bên phải).

### Ô kỹ năng (phải dưới)

60×60px, `gap:9px`, nền `--panel`.

- Sẵn sàng: `border:1px solid var(--accent)` + `box-shadow:0 0 0 1px rgba(185,139,232,.18)`,
  vạch góc màu accent, chữ phím `--ink`.
- Đang hồi: `border:1px solid var(--line-2)`, vạch góc `--line-2`, chữ phím `--ink-3`,
  và một khối `rgba(12,9,16,.72)` dâng từ dưới lên theo `height:<cd%>`.

Trong ô: chữ phím (display 21px 700) trên, dòng phụ (mono 8.5px viết hoa) dưới —
dòng phụ hiện tên kỹ năng khi sẵn sàng, hiện số giây khi đang hồi (`4.2s`),
hiện số lần còn lại với dash (`Lướt 2/3`).

### Minimap (phải trên)

222×148px, nền `rgba(12,9,16,.86)`, viền `--line-2`, **4 vạch góc vàng**.
Dưới minimap là hàng chú giải mono 9px — hàng này phải có nền riêng
(`background:rgba(12,9,16,.9);border:1px solid var(--line);padding:5px 8px`),
không để chữ trần trên canvas.

Ký hiệu: rương = ô vuông vàng 3px · cổng = tròn tím 3.5px · boss = tròn cam 4px ·
đồng đội = tròn `#CBBDD6` 2.2px · mình = tròn tím 3px · khung nhìn = viền
`rgba(240,233,244,.25)`.

### Cột blessing (phải, dưới minimap)

Mỗi slot là một hàng `grid-template-columns:26px 1fr`:

```
┌──┐  ĐÒN ĐÁNH          mono 8.5px, letter-spacing .16em, --ink-3
│♏│  Bọ Cạp             display 15px 600, --ink
└──┘
```

`border-left:3px solid <màu slot>` khi đã gắn; slot trống thì viền `--line-2`,
glyph thành `·` màu `#463854`, tên "Trống" màu `#5A4C68`.

Cuối cột: dòng Bộ Hợp Cung `✦ BỘ HỢP CUNG · TAM HOẢ` mono 10px màu vàng, canh phải —
chỉ hiện khi đủ bộ.

### Toast (giữa trên, dưới đồng hồ)

Nền `rgba(26,20,32,.94)`, viền `--line-2`, `border-left:2px solid <màu loại>`,
xếp dọc `gap:5px`. Mỗi toast: nhãn loại mono 9px (màu theo loại) + câu văn body 13.5px.

Màu theo loại: rương/xu → vàng · lên cấp/blessing → tím · nguy hiểm/exodus → cam.

### Prompt tương tác (giữa, trên thanh máu)

```
[F] Giữ để mở rương          phím: nền --accent, chữ --accent-in, mono 11px 700
▓▓▓▓▓▓▓░░░░                  vòng tiến trình: 200×5px, rãnh --slot, fill --gold
```

Chỉ hiện khi đứng trong vùng tương tác.

---

## 5. Hộp thoại

Cả 4 hộp cùng cấu trúc: nền `--panel`, viền `--line-2`, 2 vạch góc chéo,
padding `28–34px 30–36px`, `gap:16–20px`, tiêu đề gồm nhãn mono màu + tên display 28px.

| Hộp | Màu vạch góc | Nhãn |
|---|---|---|
| Màn vào game | `--gold` | `PROTOTYPE · VÒNG LẶP MAP 1` |
| Blessing | `#E08FB4` | `BLESSING HOÀNG ĐẠO` |
| Merchant | `--gold` | `MERCHANT · QUẦY 2` |
| Kết quả ván | `--accent` | `KẾT THÚC VÁN` |

**Màn vào game** — tiêu đề `Zodiac / Arena` hai dòng display 52px (chữ "Arena" màu accent,
weight 700), đoạn mô tả vòng lặp 10 phút, input tên (viền accent khi focus),
3 ô chọn class (ô đang chọn: `background:rgba(185,139,232,.08)` + viền accent),
nút `VÀO MAP 1` khối đặc, và bảng phím tắt dạng `grid auto 1fr` phân cách bằng
`border-top:1px solid var(--line)`.

**Blessing** — 3 ô cung ở trên (glyph 26px + tên display 20px + chủ đề mono 9.5px),
một câu mô tả chủ đề cung, rồi 3 hàng chọn slot `grid 118px 1fr auto`: nhãn slot mono |
mô tả hiệu ứng body 14px | trạng thái hiện tại mono 10.5px (`trống` màu accent /
`thay Xử Nữ` màu `--ink-3`). Hàng đang trỏ có viền hồng.

**Merchant** — dòng ví ở đầu (`Bạn có 284 xu · mỗi món chỉ mua được một lần`),
mỗi món là hàng `justify-content:space-between`: tên 14.5px + mô tả 11.5px `--ink-3`
bên trái, giá mono vàng bên phải. Món đã mua: `opacity:.36`, viền `--line`, giá đổi
thành `đã mua` màu `--ink-3`.

**Kết quả ván** — bảng 6 cột `1.4fr .8fr .5fr .7fr .7fr 1fr`:
Người chơi | Thoát | Cấp | Xu | Token | Bộ Hợp Cung. Header mono 9.5px `--ink-3`
với `border-bottom:1px solid var(--line-2)`; mỗi hàng `border-bottom:1px solid var(--line)`.
Hàng của mình có nền `rgba(185,139,232,.06)` và tên màu accent. Cột Thoát: `✦ thoát`
màu accent, hoặc `—` màu `--ink-3` nếu không kịp. Tên người chơi dùng body, số dùng
mono, Bộ Hợp Cung dùng display 16px.

Chân hộp: câu nhắc luật bên trái (`Ai qua được cổng thì giữ token; ai không kịp thì
mất trắng.`) + nút `VÁN MỚI` bên phải.

---

## 6. Vẽ trên canvas — sửa cho khớp

- Nền vùng chơi `--bg-field` `#151019`, lưới 64px màu `--grid` `#1E1726`, `lineWidth = 1/zoom`.
- Khối tường: fill `--wall` `#271F33`, `strokeRect` màu `--line-2` lệch nửa pixel
  (`x+.5, y+.5`) cho nét sắc.
- Cổng dịch chuyển: vòng `strokeStyle=--accent, lineWidth=2` bán kính 26 + fill
  `globalAlpha .16`, cả vòng đập theo `0.55 + 0.45*sin(t/220)`.
- Rương: `fillRect` vàng 22×16 + dải tối `#8a6a2c` ngang giữa.
- Vũng độc: `globalAlpha .22` fill `#7bd67b`.
- Vòng chọn dưới chân người chơi: `ellipse(x, y, 11, 4)` stroke accent `lineWidth 1.2`.
- Thanh máu nổi trên đầu quái thường: 28×2.5px; boss: 70×5px màu `--danger` + nhãn
  `TINH LINH HOÀNG ĐẠO` mono 9px cam canh giữa phía trên.
- Luôn `ctx.imageSmoothingEnabled = false` sau mỗi lần `ctx.scale()` (mất khi restore).

**Vùng cấm đặt đối tượng quan trọng**: HUD che 4 góc màn hình. Khi đặt merchant, cổng,
rương gần biên, tránh dải 240px bên phải (minimap + blessing), dải 340×140px góc trái
dưới (thanh máu) và 200×70px góc phải dưới (ô kỹ năng).

---

## 7. Thứ tự làm

1. Thêm `<link>` font + khối `:root` biến màu mới, xoá biến màu cũ.
2. Tìm-thay toàn bộ hex cũ trong `<style>` bằng biến (`var(--panel)` v.v.) — không để
   hex rời rạc trong file.
3. Sửa CSS canvas + các `ctx.fillStyle`/`ctx.font` trong vòng vẽ.
4. Áp lại từng phần HUD theo mục 4 (thanh máu là phần đáng làm trước — khác nhiều nhất).
5. 4 hộp thoại theo mục 5.
6. Kiểm: chữ nhỏ nhất trong HUD không dưới 8.5px (mono) / 11.5px (body); mọi số có
   `tabular-nums`; không còn `border-radius` nào.

Trang design để đối chiếu pixel: `Zodiac Arena UI.dc.html` trong project design.
