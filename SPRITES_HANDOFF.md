# Handoff — bộ sprite "Hero's Quest" cho Zodiac Arena

Thay 2 hàm vẽ hình khối hiện tại trong `index.html` bằng bộ sprite trong `sprites.js`.
Không đổi `server.js`, không đổi netcode, không đổi gameplay.

Bộ này thay thế hoàn toàn bản Chibi NES 16×16 trước đó (file `sprites.js` đã được ghi đè).

## Có gì trong bộ

- **9 skin hero** — 3 skin cho mỗi class, dùng làm **ngoại hình theo nhánh nâng cấp**:
  người chơi lên nhánh nào thì đổi `key`, không đổi gì khác.
- **4 quái NPC** — slime, sói, quỷ chuỳ đá, oán linh.
- Mỗi sprite có đủ 5 trạng thái: `idle` · `move` · `attack` · `hit` · `die`,
  vẽ bằng code (không cần file PNG), góc nhìn 3/4 từ trên xuống — khớp với arena top-down hiện tại.

| class | key | nhánh | ghi chú ngoại hình |
|---|---|---|---|
| knight | `knight_3a` | Vệ Binh | giáp trắng viền vàng, đại thuẫn, mũ có mào |
| knight | `knight_3b` | Tiêu Chuẩn | thép xám trơn, khiên diều — bản gọn, đọc rõ khi đông |
| knight | `knight_3c` | Cuồng Chiến | giáp tối, choàng đỏ, mũ sừng, búa chiến |
| archer | `archer_4a` | Cung Thủ | khăn đỏ bay, băng đô, cung dài |
| archer | `archer_4b` | Thợ Săn | choàng trùm đầu xanh rêu, chỉ thấy mắt sáng |
| archer | `archer_4c` | Nỏ Thủ | hakama chàm, bịt mặt, hai nỏ tay |
| monk | `monk_5a` | Thuỷ Ấn | cà sa xanh, mặt nạ, vòng nước quanh người |
| monk | `monk_5b` | Tích Trượng | cà sa đỏ, cổ lông, tích trượng đầu vòng phát sáng |
| monk | `monk_5c` | Tịch Diệt | cà sa tím trùm đầu, tràng hạt, ấn phù xoay |
| quái | `mon_slime` | — | khối keo trong, phình dẹt khi nảy |
| quái | `mon_runner` | — | sói bốn chân, lao tới cắn |
| quái | `mon_brute` | — | quỷ vai rộng, vác chuỳ đá |
| quái | `mon_caster` | — | oán linh lơ lửng, bắn cầu phù chú |

## Nạp

```html
<script src="sprites.js"></script>   <!-- đặt TRƯỚC script chính của game -->
```

`sprites.js` không có `import/export`, tự gán `window.ZASprites`.

## API

```js
ZASprites.draw(ctx, {
  key:    'knight_3c',      // xem bảng trên, hoặc ZASprites.keys
  x, y,                     // TÂM CHÂN nhân vật (đáy sprite) = đúng toạ độ server gửi về
  state:  'move',           // 'idle' | 'move' | 'attack' | 'hit' | 'die'
  t:      performance.now(),// đồng hồ chung, dùng cho idle/move
  stateT: 120,              // ms đã trôi trong state — BẮT BUỘC cho attack/hit/die
  facing: 1,                // 1 = phải (mặc định), -1 = lật ngang
  scale:  1,                // 1 ≈ sprite cao 76px trên màn hình
  alpha:  1                 // tuỳ chọn
});
```

Phụ trợ:

- `ZASprites.keys` — mảng toàn bộ key.
- `ZASprites.branches` — map `class → [{key, tier, nm, branch}]`, dùng dựng UI chọn nhánh.
- `ZASprites.skinFor('knight', 'Cuồng Chiến')` → `'knight_3c'`.
- `ZASprites.info(key)` → `{nm, cls, note, weapon, mon}`.
- `ZASprites.sheet(key, state)` → `{url, frames, fw, fh, ms}` — xuất PNG sprite sheet nếu sau này muốn dùng file tĩnh thay vì vẽ runtime.
- `ZASprites.W / H` = 92 × 76 px, `ANCHOR_X / ANCHOR_Y` = vị trí tâm chân trong khung.

Mọi frame được cache theo `key|state|slot|facing` (60ms/frame), nên vẽ hàng chục nhân vật vẫn nhẹ.

## Việc cần làm trong `index.html`

1. **Nạp `sprites.js`** trước script game.

2. **Bám trạng thái animation ở client.** Server chỉ gửi vị trí/HP; client tự suy ra state:

```js
const animState = new Map(); // id -> {state, t0, x, y, facing}

function stateOf(ent, now){
  let a = animState.get(ent.id);
  if(!a){ a = { state:'idle', t0:now, x:ent.x, y:ent.y, facing:1 }; animState.set(ent.id, a); }

  const moved = Math.hypot(ent.x - a.x, ent.y - a.y) > 0.5;
  if(ent.x !== a.x) a.facing = ent.x > a.x ? 1 : -1;
  a.x = ent.x; a.y = ent.y;

  const locked = (a.state === 'attack' && now - a.t0 < 660) ||
                 (a.state === 'hit'    && now - a.t0 < 520) ||
                  a.state === 'die';

  if(!locked){
    const next = moved ? 'move' : 'idle';
    if(next !== a.state){ a.state = next; a.t0 = now; }
  }
  return a;
}

// gọi khi có sự kiện từ server:
function trigger(id, state, now){          // 'attack' | 'hit' | 'die'
  const a = animState.get(id); if(!a) return;
  if(a.state === 'die') return;
  a.state = state; a.t0 = now;
}
```

Thời lượng: `attack` 660ms, `hit` 520ms, `die` 1500ms (`die` giữ frame cuối, không lặp).

3. **Thay `drawHero()`:**

```js
function drawHero(ctx, h, now){
  const a = stateOf(h, now);
  ZASprites.draw(ctx, {
    key: h.skin || ZASprites.skinFor(h.cls, h.branch),
    x: h.x, y: h.y + h.r,     // y = ĐÁY chân
    state: a.state, t: now, stateT: now - a.t0,
    facing: a.facing, scale: (h.r * 2) / 34
  });
}
```

`scale`: sprite dựng cho nhân vật đường kính ~34px. Nếu `r` hiện tại là 16 thì `scale ≈ 0.94`.

4. **Thay `drawEnemy()`:** y hệt, `key: 'mon_' + e.type` với `type` ∈ `slime | runner | brute | caster`.

5. **Ngoại hình theo nhánh nâng cấp.** Khi người chơi chọn nhánh, chỉ cần gán:

```js
hero.skin = ZASprites.skinFor(hero.cls, hero.branch);
```

Nếu server chưa có trường `branch`, thêm 1 trường string vào state player và broadcast — không ảnh hưởng logic chiến đấu.

6. **Giữ nguyên** thanh HP, tên, vòng chọn, hiệu ứng damage number hiện có — sprite chỉ thay phần thân nhân vật. Bóng đổ dưới chân đã nằm sẵn trong sprite, nếu `index.html` đang tự vẽ bóng thì bỏ đi để khỏi chồng.

## Lưu ý

- Sprite vẽ bằng Canvas 2D, không phụ thuộc thư viện ngoài.
- Không dùng `image-smoothing` khi phóng to (`sprites.js` đã tự tắt).
- Nếu muốn chuyển sang file PNG tĩnh sau này: chạy `ZASprites.sheet(key, state)` trong console, lưu dataURL ra file — layout frame và `ms` đã kèm trong kết quả.
