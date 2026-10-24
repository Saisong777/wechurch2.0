import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Compass, Map as MapIcon, RotateCcw, RotateCw, ZoomIn, ZoomOut, type LucideIcon } from 'lucide-react';
import { buildCastleWorld, WORLD_PLACES, type PlaceId } from './world';

export interface ScenePlace { id: string; name: string; label: string; icon: LucideIcon }
export interface CastleSceneProps { places: ScenePlace[]; selectedId?: string; onSelect: (id: string) => void; paused: boolean; night: boolean; detailId: string; insets?: { top: number; right: number; bottom: number } }
type SceneHandle = { reset: () => void; zoom: (factor: number) => void; rotate: (angle: number) => void; focus: (id: string) => void; refresh: () => void; layout: () => void };
type SceneState = 'loading' | 'ready' | 'unsupported' | 'lost';

export default function CastleScene({ places, selectedId, onSelect, paused, night, detailId, insets }: CastleSceneProps) {
  const container = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const live = useRef({ places, selectedId, onSelect, paused, night, insets }); live.current = { places, selectedId, onSelect, paused, night, insets };
  const api = useRef<SceneHandle>();
  const [state, setState] = useState<SceneState>('loading');
  const [reduced, setReduced] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = container.current, surface = canvas.current;
    if (!host || !surface) return;
    let disposed = false, lost = false, raf = 0, lastTime = 0, frame = 0, rendering = false;
    let renderer: THREE.WebGLRenderer | undefined;
    let controls: OrbitControls | undefined;
    let world: ReturnType<typeof buildCastleWorld> | undefined;
    let resizeObserver: ResizeObserver | undefined;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduceMotion = media?.matches ?? false; setReduced(reduceMotion);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc7e7de);
    scene.fog = new THREE.Fog(0xc7e7de, 85, 190);
    const camera = new THREE.PerspectiveCamera(39, 1, .2, 250);
    const initialTarget = new THREE.Vector3(0, .7, 2);
    const homePosition = new THREE.Vector3(35, 32, 43);
    const hemisphere = new THREE.HemisphereLight(0xfff5de, 0x6d9e8c, 2.9); scene.add(hemisphere);
    const sunlight = new THREE.DirectionalLight(0xfff1d6, 3.1); sunlight.position.set(-20, 38, 19); sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048); sunlight.shadow.camera.left = -32; sunlight.shadow.camera.right = 32; sunlight.shadow.camera.top = 30; sunlight.shadow.camera.bottom = -30; sunlight.shadow.camera.near = 1; sunlight.shadow.camera.far = 100; sunlight.shadow.normalBias = .035; sunlight.shadow.bias = -.00025; sunlight.shadow.radius = 2; scene.add(sunlight);
    const fill = new THREE.DirectionalLight(0xb9e0df, .7); fill.position.set(23, 13, -20); scene.add(fill);
    let cameraTween: { from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3; elapsed: number } | null = null;
    const projected = new THREE.Vector3(), forward = new THREE.Vector3();
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    let pointerDown: { id: number; x: number; y: number; moved: boolean } | null = null;
    const activePointers = new Set<number>();
    let multiTouch = false;

    function projectLabels() {
      if (!controls || !world || !host) return;
      camera.getWorldDirection(forward);
      const width = host.clientWidth, height = host.clientHeight;
      const occupied: { x: number; y: number; width: number; height: number }[] = [];
      const ordered = [...live.current.places].sort((a, b) => Number(b.id === live.current.selectedId) - Number(a.id === live.current.selectedId));
      for (const place of ordered) {
        const label = labels.current.get(place.id), definition = WORLD_PLACES[place.id as PlaceId]; if (!label || !definition) continue;
        projected.set(definition.position[0], definition.position[1], definition.position[2]);
        const inFront = projected.clone().sub(camera.position).dot(forward) > 0;
        projected.project(camera);
        const x = (projected.x * .5 + .5) * width, y = (-projected.y * .5 + .5) * height;
        const labelWidth = width < 600 ? 44 : 125, labelHeight = 46;
        const safe = live.current.insets;
        const clipped = !inFront || projected.z < -1 || projected.z > 1 || x < 22 || x > width - (safe?.right || 0) - 22 || y < (safe?.top || 0) + 46 || y > height - (safe?.bottom || 0) - 64;
        const overlaps = occupied.some(p => Math.abs(p.x - x) < (p.width + labelWidth) * .48 && Math.abs(p.y - y) < (p.height + labelHeight) * .5);
        const hidden = clipped || overlaps;
        const transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-100%)`;
        if (label.style.transform !== transform) label.style.transform = transform;
        if (label.hidden !== hidden) label.hidden = hidden;
        if (!hidden) occupied.push({ x, y, width: labelWidth, height: labelHeight });
      }
    }
    function applyLight() {
      if (!world) return;
      const isNight = live.current.night;
      scene.background = new THREE.Color(isNight ? 0x263f55 : 0xc7e7de); (scene.fog as THREE.Fog).color.setHex(isNight ? 0x263f55 : 0xc7e7de);
      hemisphere.intensity = isNight ? 1.2 : 2.9; sunlight.intensity = isNight ? .7 : 3.1; sunlight.color.setHex(isNight ? 0xbccce6 : 0xfff1d6); fill.intensity = isNight ? .8 : .7; world.night(isNight);
    }
    function recordState() {
      if (!host || !controls || !world) return;
      host.dataset.worldState = lost ? 'lost' : 'ready'; host.dataset.worldPaused = String(live.current.paused || reduceMotion);
      host.dataset.worldFrame = String(frame); host.dataset.worldResidents = String(world.residentCount);
      host.dataset.worldCamera = camera.position.distanceTo(controls.target).toFixed(2);
      host.dataset.worldAzimuth = controls.getAzimuthalAngle().toFixed(3);
      host.dataset.worldTarget = `${controls.target.x.toFixed(2)},${controls.target.y.toFixed(2)},${controls.target.z.toFixed(2)}`;
      host.dataset.worldResidentPosition = `${world.walkers[0].group.position.x.toFixed(3)},${world.walkers[0].group.position.z.toFixed(3)}`;
      host.dataset.worldInsets = JSON.stringify(live.current.insets || { top: 0, right: 0, bottom: 0 });
      host.dataset.worldProjection = JSON.stringify({ fov: Number(camera.fov.toFixed(2)), x: camera.view?.offsetX || 0, y: camera.view?.offsetY || 0 });
      host.dataset.worldVisible = String(!document.hidden); host.dataset.worldReducedMotion = String(reduceMotion);
    }
    function render() {
      if (disposed || lost || !renderer || !controls || !world || rendering) return;
      rendering = true;
      try { projectLabels(); renderer.render(scene, camera); frame++; recordState(); }
      finally { rendering = false; }
    }
    function shouldAnimate() { return !disposed && !lost && !document.hidden && !live.current.paused && !reduceMotion; }
    function loop(now: number) {
      raf = 0; if (!shouldAnimate()) { lastTime = 0; return; }
      const delta = lastTime ? Math.min(.05, Math.max(0, (now - lastTime) / 1000)) : 0; lastTime = now;
      world?.update(delta);
      if (cameraTween && controls) {
        cameraTween.elapsed += delta;
        const t = Math.min(1, cameraTween.elapsed / .85), eased = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(cameraTween.from, cameraTween.to, eased); controls.target.lerpVectors(cameraTween.targetFrom, cameraTween.targetTo, eased); controls.update(); if (t === 1) cameraTween = null;
      }
      render(); raf = requestAnimationFrame(loop);
    }
    function syncAnimation() {
      if (raf) cancelAnimationFrame(raf); raf = 0; lastTime = 0;
      if (!shouldAnimate() && cameraTween && controls) { camera.position.copy(cameraTween.to); controls.target.copy(cameraTween.targetTo); cameraTween = null; controls.update(); }
      applyLight(); render(); if (shouldAnimate()) raf = requestAnimationFrame(loop);
    }
    function moveCamera(position: THREE.Vector3, target: THREE.Vector3) {
      if (!controls) return;
      if (live.current.paused || reduceMotion || document.hidden) { cameraTween = null; camera.position.copy(position); controls.target.copy(target); controls.update(); render(); }
      else { cameraTween = { from: camera.position.clone(), to: position, targetFrom: controls.target.clone(), targetTo: target, elapsed: 0 }; if (!raf) { lastTime = 0; raf = requestAnimationFrame(loop); } }
    }
    function focus(id: string) {
      const definition = WORLD_PLACES[id as PlaceId]; if (!definition || !controls) return;
      const target = new THREE.Vector3(...definition.target);
      const direction = camera.position.clone().sub(controls.target).normalize();
      direction.y = Math.max(.5, direction.y); direction.normalize();
      moveCamera(target.clone().addScaledVector(direction, definition.distance), target);
    }
    function resize() {
      if (disposed || !renderer || !host || !host.clientWidth || !host.clientHeight) return;
      const width = host.clientWidth, height = host.clientHeight, safe = live.current.insets;
      camera.aspect = width / height;
      if (safe) {
        const availableWidth = Math.max(160, width - safe.right), availableHeight = Math.max(140, height - safe.top - safe.bottom);
        const tangent = Math.max(Math.tan(THREE.MathUtils.degToRad(39 / 2)) * height / availableHeight, Math.tan(THREE.MathUtils.degToRad(44 / 2)) * height / availableWidth);
        camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(tangent)), 39, 104);
        camera.setViewOffset(width, height, safe.right / 2, (safe.bottom - safe.top) / 2, width, height);
      } else {
        camera.clearViewOffset(); camera.fov = camera.aspect < .85 ? 65 : camera.aspect < 1.25 ? 49 : 39;
      }
      camera.updateProjectionMatrix(); renderer.setSize(width, height, false); render();
    }
    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 && event.pointerType !== 'touch') { pointerDown = null; return; }
      activePointers.add(event.pointerId); if (activePointers.size > 1) { multiTouch = true; pointerDown = null; }
      else { multiTouch = false; pointerDown = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }; }
    }
    function handlePointerMove(event: PointerEvent) { if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 7) pointerDown.moved = true; }
    function handlePointerUp(event: PointerEvent) {
      activePointers.delete(event.pointerId);
      const down = pointerDown; pointerDown = null;
      if (multiTouch || !down || down.id !== event.pointerId || down.moved || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7 || !world || !renderer || lost) return;
      const rect = surface!.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera);
      const enabled = new Set(live.current.places.map(place => place.id));
      // Include terrain/trees as occluders; never pick a building behind the visible surface.
      const intersections = raycaster.intersectObject(world.group, true);
      const hit = intersections[0]; if (!hit) return;
      let object: THREE.Object3D | null = hit.object;
      while (object && !object.userData.placeId) object = object.parent;
      const id = object?.userData.placeId; if (id && enabled.has(id)) { live.current.onSelect(id); focus(id); }
    }
    function handlePointerCancel(event: PointerEvent) { activePointers.delete(event.pointerId); pointerDown = null; }
    function handleContextLost(event: Event) { event.preventDefault(); lost = true; if (raf) cancelAnimationFrame(raf); raf = 0; lastTime = 0; host!.dataset.worldState = 'lost'; setState('lost'); }
    function handleContextRestored() { if (!disposed) { setState('loading'); setAttempt(value => value + 1); } }
    function handleVisibility() { syncAnimation(); }
    function handleReducedMotion(event: MediaQueryListEvent) { reduceMotion = event.matches; setReduced(event.matches); syncAnimation(); }
    function handleControlsStart() { cameraTween = null; }
    function handleKey(event: KeyboardEvent) {
      if (event.target !== surface || !controls) return;
      const action = event.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(action)) event.preventDefault();
      if (action === 'ArrowLeft' || action === 'ArrowRight') api.current?.rotate(action === 'ArrowLeft' ? -.22 : .22);
      if (action === '+' || action === '=' || action === 'ArrowUp') api.current?.zoom(.83);
      if (action === '-' || action === 'ArrowDown') api.current?.zoom(1.2);
      if (action === 'Home') api.current?.reset();
    }
    try {
      renderer = new THREE.WebGLRenderer({ canvas: surface, alpha: false, antialias: true, powerPreference: 'high-performance' });
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, memory && memory <= 4 ? 1.2 : 1.5));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.17;
      world = buildCastleWorld(); scene.add(world.group);
      camera.position.copy(homePosition);
      controls = new OrbitControls(camera, surface); controls.target.copy(initialTarget); controls.enableDamping = false; controls.minDistance = 11; controls.maxDistance = 86; controls.minPolarAngle = .18; controls.maxPolarAngle = Math.PI / 2.3; controls.enablePan = true; controls.screenSpacePanning = false; controls.panSpeed = .65; controls.rotateSpeed = .65; controls.zoomSpeed = .8; controls.maxTargetRadius = 26; controls.cursor.set(0, 0, 0);
      controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }; controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }; controls.update();
      controls.addEventListener('change', render); controls.addEventListener('start', handleControlsStart);
      api.current = {
        reset: () => moveCamera(homePosition.clone(), initialTarget.clone()),
        zoom: (factor: number) => { if (!controls) return; cameraTween = null; const offset = camera.position.clone().sub(controls.target); offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 11, 86)); camera.position.copy(controls.target).add(offset); controls.update(); render(); },
        rotate: (angle: number) => { if (!controls) return; cameraTween = null; const offset = camera.position.clone().sub(controls.target); offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle); camera.position.copy(controls.target).add(offset); controls.update(); render(); },
        focus, refresh: syncAnimation, layout: resize,
      };

      resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();
      surface.addEventListener('pointerdown', handlePointerDown); surface.addEventListener('pointermove', handlePointerMove); surface.addEventListener('pointerup', handlePointerUp); surface.addEventListener('pointercancel', handlePointerCancel); surface.addEventListener('keydown', handleKey);
      surface.addEventListener('webglcontextlost', handleContextLost); surface.addEventListener('webglcontextrestored', handleContextRestored);
      document.addEventListener('visibilitychange', handleVisibility); media?.addEventListener('change', handleReducedMotion);
      host.dataset.worldState = 'ready'; setState('ready'); syncAnimation();
    } catch {
      host.dataset.worldState = 'unsupported'; setState('unsupported');
    }
    return () => {
      disposed = true; if (raf) cancelAnimationFrame(raf); api.current = undefined; cameraTween = null;
      resizeObserver?.disconnect(); controls?.removeEventListener('change', render); controls?.removeEventListener('start', handleControlsStart); controls?.dispose();
      surface.removeEventListener('pointerdown', handlePointerDown); surface.removeEventListener('pointermove', handlePointerMove); surface.removeEventListener('pointerup', handlePointerUp); surface.removeEventListener('pointercancel', handlePointerCancel); surface.removeEventListener('keydown', handleKey);
      surface.removeEventListener('webglcontextlost', handleContextLost); surface.removeEventListener('webglcontextrestored', handleContextRestored); document.removeEventListener('visibilitychange', handleVisibility); media?.removeEventListener('change', handleReducedMotion);
      world?.dispose(); sunlight.shadow.map?.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); scene.clear();
    };
  }, [attempt]);

  useEffect(() => { api.current?.layout(); }, [insets?.top, insets?.right, insets?.bottom]);
  useEffect(() => { api.current?.refresh(); }, [paused, night]);
  useEffect(() => { api.current?.refresh(); }, [places, selectedId, state]);
  const select = (id: string) => { onSelect(id); api.current?.focus(id); };
  const unavailable = state === 'unsupported' || state === 'lost';
  return <div className="castle-3d-shell">
    <div ref={container} className="castle-3d-viewport" data-world-state={state} data-testid="castle-3d-world">
      <canvas key={attempt} ref={canvas} className="castle-3d-canvas" aria-label="可以拖曳旋轉、縮放的3D城堡；方向鍵旋轉與縮放，Home回全景" tabIndex={unavailable ? -1 : 0} data-testid="castle-3d-canvas" hidden={unavailable} />
      {state === 'ready' && <div className="castle-3d-labels" aria-label="3D城堡地點">{places.map(place => { const Icon = place.icon; return <button ref={node => { if (node) labels.current.set(place.id, node); else labels.current.delete(place.id); }} key={place.id} type="button" className={`castle-3d-label ${selectedId === place.id ? 'is-selected' : ''}`} aria-label={`${place.name}・${place.label}`} aria-pressed={selectedId === place.id} aria-controls={detailId} onClick={() => select(place.id)}><span><Icon size={17} aria-hidden="true" /></span><span>{place.name}<small>{place.label}</small></span></button>; })}</div>}
      {state === 'loading' && <div className="castle-3d-loading" role="status"><Compass size={27} aria-hidden="true" /><p>正在打開城門…</p></div>}
      {unavailable && <div className="castle-3d-fallback"><img src="/im-castle-world.webp" alt="城堡概念插畫；目前不是3D場景。" width="1536" height="1024" /><div role="status"><h2>{state === 'lost' ? '3D畫面暫時中斷' : '這個裝置目前無法開啟3D'}</h2><p>目前顯示城堡插畫。你仍可開啟「探索」，從地點清單前往各個功能。</p><button type="button" onClick={() => { setState('loading'); setAttempt(value => value + 1); }}>重新開啟3D</button></div></div>}
    </div>
    {!unavailable && <div className="castle-3d-toolbar" role="group" aria-label="3D地圖視角">
      <button type="button" onClick={() => api.current?.reset()} aria-label="重設為城堡全景"><MapIcon size={17} aria-hidden="true" /><span>全景</span></button>
      <button type="button" onClick={() => api.current?.rotate(-.35)} aria-label="向左旋轉城堡"><RotateCcw size={17} aria-hidden="true" /></button>
      <button type="button" onClick={() => api.current?.rotate(.35)} aria-label="向右旋轉城堡"><RotateCw size={17} aria-hidden="true" /></button>
      <span />
      <button type="button" onClick={() => api.current?.zoom(.8)} aria-label="拉近城堡"><ZoomIn size={18} aria-hidden="true" /></button>
      <button type="button" onClick={() => api.current?.zoom(1.25)} aria-label="拉遠城堡"><ZoomOut size={18} aria-hidden="true" /></button>
    </div>}
    {!unavailable && <p className="castle-3d-gesture">拖曳轉一圈<span>・</span>滾輪或雙指拉近<span>・</span>點建築探索</p>}
    <p className="castle-3d-caption">{unavailable ? '城堡插畫備用畫面' : '3D 概念世界・居民為虛構角色'}{reduced && !unavailable && <span>・已減少動態</span>}</p>
  </div>;
}
