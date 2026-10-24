export type CameraInsets = { top: number; right: number; bottom: number };
export const isPortraitCastle = (width: number, height: number) => width <= 640 && height >= width;
/** Portrait is a close view into the world, rather than a fit of the entire island width. */
export function castleProjection(width: number, height: number, safe?: CameraInsets) {
  if (isPortraitCastle(width, height)) {
    return { portrait: true, fov: 42, offsetX: 0, offsetY: -height * .055 };
  }
  if (safe) {
    const availableWidth = Math.max(160, width - safe.right);
    const availableHeight = Math.max(140, height - safe.top - safe.bottom);
    const tangent = Math.max(Math.tan(39 * Math.PI / 360) * height / availableHeight, Math.tan(44 * Math.PI / 360) * height / availableWidth);
    return { portrait: false, fov: Math.max(39, Math.min(104, 360 / Math.PI * Math.atan(tangent))), offsetX: safe.right / 2, offsetY: (safe.bottom - safe.top) / 2 };
  }
  const aspect = width / height;
  return { portrait: false, fov: aspect < .85 ? 65 : aspect < 1.25 ? 49 : 39, offsetX: 0, offsetY: 0 };
}
