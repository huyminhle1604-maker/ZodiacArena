/* Tường của SẢNH — biến thể NGÔI LÀNG. 16 khối: viền cây 56px bốn cạnh, 6 thân
 * nhà, hội trường, sạp rèn, giếng, hồ nước, 2 cây cổ thụ (hai khối 40x130 ở
 * (300,200) và (860,200) đúng chỗ hai bệ đá cũ, nên cảm giác va chạm quanh cổng
 * giữ nguyên). Toạ độ spawn / NPC / cổng KHÔNG đổi.
 * Dùng được cả ở server (require) lẫn client (<script> -> window.LOBBY_WALLS). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M; else root.LOBBY_WALLS = M;
})(typeof self !== 'undefined' ? self : this, function () {

return [
  { x: 0, y: 0, w: 1200, h: 56 },
  { x: 0, y: 764, w: 1200, h: 56 },
  { x: 0, y: 0, w: 56, h: 820 },
  { x: 1144, y: 0, w: 56, h: 820 },
  { x: 296, y: 272, w: 172, h: 110 },
  { x: 736, y: 272, w: 172, h: 110 },
  { x: 452, y: 596, w: 52, h: 52 },
  { x: 960, y: 688, w: 112, h: 64 },
  { x: 300, y: 200, w: 40, h: 130 },
  { x: 860, y: 200, w: 40, h: 130 },
  { x: 64, y: 64, w: 210, h: 150 },
  { x: 64, y: 300, w: 184, h: 120 },
  { x: 64, y: 552, w: 196, h: 126 },
  { x: 936, y: 64, w: 210, h: 150 },
  { x: 952, y: 300, w: 184, h: 120 },
  { x: 944, y: 552, w: 196, h: 126 }
];

});
