import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CastleAppearance } from '@shared/castleAvatar';
import { createCastleAvatarModel } from './avatarModel';
export default function CastleAvatarPreview({ appearance }: {
    appearance: CastleAppearance;
}) {
    const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), current = useRef(appearance), update = useRef<(value: CastleAppearance) => void>();
    current.current = appearance;
    const [state, setState] = useState<'loading' | 'ready' | 'lost' | 'unsupported'>('loading'), [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const root = host.current, surface = canvas.current;
        if (!root || !surface)
            return;
        let renderer: THREE.WebGLRenderer | undefined, controls: OrbitControls | undefined, model: ReturnType<typeof createCastleAvatarModel> | undefined, observer: ResizeObserver | undefined, disposed = false, lost = false;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf5f1df);
        const camera = new THREE.PerspectiveCamera(35, 1, .1, 30);
        camera.position.set(2.8, 2.1, 4);
        scene.add(new THREE.HemisphereLight(0xfff8e4, 0x739a84, 3));
        const light = new THREE.DirectionalLight(0xfff3d2, 3);
        light.position.set(-3, 5, 4);
        scene.add(light);
        const render = () => {
            if (!disposed && !lost && renderer)
                renderer.render(scene, camera);
        };
        const resize = () => {
            if (!root.clientWidth || !root.clientHeight || !renderer)
                return;
            camera.aspect = root.clientWidth / root.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(root.clientWidth, root.clientHeight, false);
            render();
        };
        const touchPoints = new Map<number, { x: number; y: number }>();
        const touchStart = (event: PointerEvent) => {
            if (event.pointerType !== 'touch' || !controls) return;
            // OrbitControls' native touch handler prevents vertical browser scrolling.
            // Capture first; mouse orbit remains native, touch rotates only horizontally.
            controls.enabled = false;
            event.stopImmediatePropagation();
            touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
        };
        const touchMove = (event: PointerEvent) => {
            if (event.pointerType === 'touch') event.stopImmediatePropagation();
            const previous = touchPoints.get(event.pointerId);
            if (!previous || !controls) return;
            const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
            touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (touchPoints.size !== 1 || Math.abs(dx) <= Math.abs(dy)) return;
            const angle = -dx / Math.max(root.clientWidth, 1) * Math.PI * 2;
            camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(controls.target);
            controls.update();
            render();
        };
        const touchEnd = (event: PointerEvent) => {
            if (event.pointerType !== 'touch') return;
            event.stopImmediatePropagation();
            touchPoints.delete(event.pointerId);
            if (!touchPoints.size && controls) controls.enabled = true;
        };
        const contextLost = (event: Event) => {
            event.preventDefault();
            lost = true;
            setState('lost');
        };
        const restored = () => {
            if (!disposed) {
                setState('loading');
                setAttempt(n => n + 1);
            }
        };
        try {
            renderer = new THREE.WebGLRenderer({ canvas: surface, antialias: true, powerPreference: 'low-power' });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            model = createCastleAvatarModel(current.current);
            scene.add(model.group);
            controls = new OrbitControls(camera, surface);
            surface.style.touchAction = 'pan-y pinch-zoom';
            surface.addEventListener('pointerdown', touchStart, true);
            surface.addEventListener('pointermove', touchMove, true);
            surface.addEventListener('pointerup', touchEnd, true);
            surface.addEventListener('pointercancel', touchEnd, true);
            controls.target.set(0, .85, 0);
            controls.enablePan = false;
            controls.enableZoom = false;
            controls.minPolarAngle = .35;
            controls.maxPolarAngle = Math.PI / 2.1;
            controls.update();
            controls.addEventListener('change', render);
            update.current = value => {
                model?.applyAppearance(value);
                render();
            };
            observer = new ResizeObserver(resize);
            observer.observe(root);
            surface.addEventListener('webglcontextlost', contextLost);
            surface.addEventListener('webglcontextrestored', restored);
            resize();
            setState('ready');
        }
        catch {
            setState('unsupported');
        }
        return () => {
            disposed = true;
            update.current = undefined;
            observer?.disconnect();
            controls?.removeEventListener('change', render);
            surface.removeEventListener('pointerdown', touchStart, true);
            surface.removeEventListener('pointermove', touchMove, true);
            surface.removeEventListener('pointerup', touchEnd, true);
            surface.removeEventListener('pointercancel', touchEnd, true);
            touchPoints.clear();
            controls?.dispose();
            surface.removeEventListener('webglcontextlost', contextLost);
            surface.removeEventListener('webglcontextrestored', restored);
            model?.dispose();
            renderer?.dispose();
            renderer?.forceContextLoss();
            scene.clear();
        };
    }, [attempt]);
    useEffect(() => update.current?.(appearance), [appearance]);
    const unavailable = state === 'lost' || state === 'unsupported';
    return <div ref={host} className="castle-avatar-preview" data-preview-state={state}><canvas key={attempt} ref={canvas} hidden={unavailable} aria-label="自己的玩偶造型預覽，可拖曳轉身"/>{unavailable && <p role="status">目前無法顯示3D預覽，仍可選擇並儲存造型。<button type="button" onClick={() => {
        setState('loading');
        setAttempt(n => n + 1);
    }}>重新顯示預覽</button></p>}<span className="castle-avatar-plinth" aria-hidden="true">我的城堡玩偶</span></div>;
}
