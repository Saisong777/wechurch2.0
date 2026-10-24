export type BubbleRect = { left: number; top: number; width: number; height: number };
export type BubblePoint = { x: number; y: number };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
function overlap(a: BubbleRect, b: BubbleRect) {
  return Math.max(0, Math.min(a.left + a.width, b.left + b.width + 6) - Math.max(a.left, b.left - 6)) * Math.max(0, Math.min(a.top + a.height, b.top + b.height + 6) - Math.max(a.top, b.top - 6));
}
/** All coordinates are viewport pixels; the tail always ends at the real projected head. */
export function placeHeadBubble(head: BubblePoint, size: { width: number; height: number }, bounds: BubbleRect, obstacles: readonly BubbleRect[]) {
  const width = Math.min(size.width, bounds.width), height = Math.min(size.height, bounds.height);
  const right = bounds.left + bounds.width - width, bottom = bounds.top + bounds.height - height;
  const xs = [head.x - width / 2, head.x - width - 14, head.x + 14, bounds.left, right, ...obstacles.flatMap(rect => [rect.left - width - 8, rect.left + rect.width + 8])];
  const ys = [head.y - height - 14, head.y + 14, head.y - height / 2, bounds.top, bottom, ...obstacles.flatMap(rect => [rect.top - height - 8, rect.top + rect.height + 8])];
  let best: BubbleRect = { left: bounds.left, top: bounds.top, width, height }, score = Infinity;
  for (const x of xs) for (const y of ys) {
    const candidate = { left: clamp(x, bounds.left, right), top: clamp(y, bounds.top, bottom), width, height };
    const occlusion = obstacles.reduce((sum, rect) => sum + overlap(candidate, rect), 0);
    const distance = Math.hypot(head.x - clamp(head.x, candidate.left, candidate.left + width), head.y - clamp(head.y, candidate.top, candidate.top + height));
    const above = candidate.top + height <= head.y;
    const coversHead = head.x >= candidate.left && head.x <= candidate.left + width && head.y >= candidate.top && head.y <= candidate.top + height;
    const nearHead = overlap(candidate,{left:head.x-4,top:head.y-4,width:8,height:8});
    const next = (coversHead ? 1e9 : 0) + nearHead * 100000 + occlusion * 10000 + distance + (above ? 0 : 18) + Math.abs(candidate.left + width / 2 - head.x) * .1;
    if (next < score) { best = candidate; score = next; }
  }
  let base: BubblePoint, horizontal: boolean;
  if (head.y < best.top) { base = { x: clamp(head.x, best.left + 14, best.left + width - 14), y: best.top }; horizontal = true; }
  else if (head.y > best.top + height) { base = { x: clamp(head.x, best.left + 14, best.left + width - 14), y: best.top + height }; horizontal = true; }
  else { base = { x: head.x < best.left + width / 2 ? best.left : best.left + width, y: clamp(head.y, best.top + 14, best.top + height - 14) }; horizontal = false; }
  return { ...best, tail: [horizontal ? { x: base.x - 7, y: base.y } : { x: base.x, y: base.y - 7 }, head, horizontal ? { x: base.x + 7, y: base.y } : { x: base.x, y: base.y + 7 }], overlap: obstacles.reduce((sum, rect) => sum + overlap(best, rect), 0) };
}
