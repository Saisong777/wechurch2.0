// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Castle } from 'lucide-react';
import * as THREE from 'three';
import CastleScene from './CastleScene';
const gpu = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn(), fail: false, instances: 0 }));
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: class {
    shadowMap = { enabled: false, type: 0 }; outputColorSpace = ''; toneMapping = 0; toneMappingExposure = 0;
    constructor() { gpu.instances++; if (gpu.fail) throw new Error('WebGL disabled'); }
    setPixelRatio() {} setSize() {} render = gpu.render; dispose = gpu.dispose; forceContextLoss = gpu.forceContextLoss;
  } };
});
const places = [{ id: 'chapel', name: '同行主堡', label: '每日靈修', icon: Castle }];
let callbacks: Map<number, FrameRequestCallback>, frameId: number, reduced: boolean;
const disconnect = vi.fn();
function tick(now: number) { const next = [...callbacks.values()]; callbacks.clear(); act(() => next.forEach(callback => callback(now))); }
function show(props: Partial<React.ComponentProps<typeof CastleScene>> = {}) { return render(<CastleScene places={places} selectedId="chapel" onSelect={vi.fn()} paused={false} night={false} detailId="detail" {...props} />); }
beforeEach(() => {
  gpu.fail = false; gpu.instances = 0; gpu.render.mockClear(); gpu.dispose.mockClear(); gpu.forceContextLoss.mockClear(); disconnect.mockClear(); reduced = false; frameId = 0; callbacks = new Map();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000); vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(650);
  vi.stubGlobal('PointerEvent', class extends MouseEvent { pointerId: number; pointerType: string; isPrimary: boolean; constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId || 0; this.pointerType = init.pointerType || 'mouse'; this.isPrimary = true; } });
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() }); Object.defineProperty(HTMLCanvasElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = ++frameId; callbacks.set(id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect; });
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('3D scene lifecycle (CPU renderer harness; visual WebGL is checked on B)', () => {
  it('mounts one renderer, moves residents, pauses animation and preserves manual camera controls', () => {
    const view = show(); const host = screen.getByTestId('castle-3d-world');
    expect(host.dataset.worldState).toBe('ready'); expect(host.dataset.worldResidents).toBe('0'); expect(gpu.instances).toBe(1);
    tick(1000); const start = host.dataset.worldResidentPosition; tick(1050); expect(host.dataset.worldResidentPosition).toBe(start);
    view.rerender(<CastleScene places={places} selectedId="chapel" onSelect={vi.fn()} paused night={false} detailId="detail" />);
    expect(callbacks.size).toBe(0); const still = host.dataset.worldResidentPosition;
    const before = Number(host.dataset.worldCamera); fireEvent.click(screen.getByRole('button', { name: '拉近城堡' }));
    expect(Number(host.dataset.worldCamera)).toBeLessThan(before); expect(host.dataset.worldResidentPosition).toBe(still); expect(gpu.instances).toBe(1);
    const angle = host.dataset.worldAzimuth; fireEvent.click(screen.getByRole('button', { name: '向左旋轉城堡' })); expect(host.dataset.worldAzimuth).not.toBe(angle);
    view.unmount(); expect(callbacks.size).toBe(0); expect(disconnect).toHaveBeenCalledOnce(); expect(gpu.dispose).toHaveBeenCalledOnce(); expect(gpu.forceContextLoss).toHaveBeenCalledOnce();
  });
  it('shifts the projection into the unobscured viewport without rebuilding the world or moving residents', () => {
    const view = show({ paused: true }); const host = screen.getByTestId('castle-3d-world');
    const position = host.dataset.worldResidentPosition, target = host.dataset.worldTarget;
    view.rerender(<CastleScene places={places} selectedId="chapel" onSelect={vi.fn()} paused night={false} detailId="detail" insets={{ top: 100, right: 330, bottom: 0 }} />);
    expect(JSON.parse(host.dataset.worldProjection || '{}')).toMatchObject({ x: 165, y: -50 });
    expect(host.dataset.worldTarget).toBe(target); expect(host.dataset.worldResidentPosition).toBe(position); expect(gpu.instances).toBe(1);
    view.rerender(<CastleScene places={places} selectedId="chapel" onSelect={vi.fn()} paused night={false} detailId="detail" insets={{ top: 100, right: 0, bottom: 300 }} />);
    expect(JSON.parse(host.dataset.worldProjection || '{}')).toMatchObject({ x: 0, y: 100 }); expect(gpu.instances).toBe(1);
  });
  it('suspends the background loop and resumes without a large movement jump', () => {
    show(); const host = screen.getByTestId('castle-3d-world'); tick(1000); tick(1050); const position = host.dataset.worldResidentPosition;
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); fireEvent(document, new Event('visibilitychange'));
    expect(callbacks.size).toBe(0); expect(host.dataset.worldVisible).toBe('false');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false); fireEvent(document, new Event('visibilitychange'));
    tick(100000); expect(host.dataset.worldResidentPosition).toBe(position); expect(callbacks.size).toBe(1);
  });
  it('projects labels even when reduced motion is enabled on the initial mount', () => {
    reduced = true; show();
    expect(callbacks.size).toBe(0);
    const label = screen.getByRole('button', { name: '同行主堡・每日靈修' });
    expect(label.style.transform).toMatch(/translate3d\([^0]/); expect(screen.getByTestId('castle-3d-world').dataset.worldReducedMotion).toBe('true');
  });
  it('clearly labels the illustration fallback when WebGL is unavailable', () => {
    gpu.fail = true; show(); expect(screen.getByText('這個裝置目前無法開啟3D')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('alt')).toContain('目前不是3D場景');
    expect(screen.getByTestId('castle-3d-canvas').hidden).toBe(true); expect(callbacks.size).toBe(0);
  });
  it('stops on context loss and rebuilds on context restoration', () => {
    show(); const surface = screen.getByTestId('castle-3d-canvas');
    fireEvent(surface, new Event('webglcontextlost', { cancelable: true }));
    expect(screen.getByTestId('castle-3d-world').dataset.worldState).toBe('lost'); expect(callbacks.size).toBe(0);
    fireEvent(surface, new Event('webglcontextrestored'));
    expect(screen.getByTestId('castle-3d-world').dataset.worldState).toBe('ready'); expect(gpu.instances).toBe(2); expect(screen.getAllByTestId('castle-3d-canvas')).toHaveLength(1);
  });
  it('does not select buildings after right-click, drag, or two-finger gestures', () => {
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObject').mockImplementation(object => { let hit: THREE.Object3D | undefined; object.traverse(child => { if (child.userData.placeId === 'chapel') hit = child; }); return hit ? [{ object: hit, distance: 1, point: new THREE.Vector3() }] : []; });
    const select = vi.fn(); show({ onSelect: select }); const surface = screen.getByTestId('castle-3d-canvas');
    fireEvent.pointerDown(surface, { pointerId: 1, pointerType: 'mouse', button: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(surface, { pointerId: 1, pointerType: 'mouse', button: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(surface, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(surface, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 180, clientY: 130 });
    fireEvent.pointerUp(surface, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 180, clientY: 130 });
    fireEvent.pointerDown(surface, { pointerId: 2, pointerType: 'touch', button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(surface, { pointerId: 3, pointerType: 'touch', button: 0, clientX: 150, clientY: 100 });
    fireEvent.pointerUp(surface, { pointerId: 3, pointerType: 'touch', button: 0, clientX: 150, clientY: 100 });
    fireEvent.pointerUp(surface, { pointerId: 2, pointerType: 'touch', button: 0, clientX: 100, clientY: 100 });
    expect(select).not.toHaveBeenCalled();
    fireEvent.pointerDown(surface, { pointerId: 4, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(surface, { pointerId: 4, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 });
    expect(select).toHaveBeenCalledWith('chapel');
  });
  it('moves only a joined self on short ground clicks and keeps building clicks for exploration',()=>{
    let ground=true;vi.spyOn(THREE.Raycaster.prototype,'intersectObject').mockImplementation(object=>{let hit:THREE.Object3D|undefined;object.traverse(child=>{if(ground?child.userData.walkSurface:child.userData.placeId==='chapel')hit=child;});return hit?[{object:hit,distance:1,point:new THREE.Vector3(0,0,10.5)}]:[];});
    const move=vi.fn(),select=vi.fn(),presence={roster:{instanceEpoch:'11111111-1111-4111-8111-111111111111',serverNow:1000,ttlMs:25000 as const,avatars:[{avatarId:'22222222-2222-4222-8222-222222222222',alias:'我',preset:'jade' as const,isSelf:true,motion:{sequence:0,path:[[0,15] as [number,number]],startedAt:1000,durationMs:0}}]},receivedAt:performance.now()};
    const view=show({presence,onMove:move,onSelect:select});const surface=screen.getByTestId('castle-3d-canvas');
    const click=()=>{fireEvent.pointerDown(surface,{pointerId:1,button:0,clientX:100,clientY:100});fireEvent.pointerUp(surface,{pointerId:1,button:0,clientX:100,clientY:100});};click();expect(move).toHaveBeenCalledWith(1);expect(select).not.toHaveBeenCalled();ground=false;click();expect(select).toHaveBeenCalledWith('chapel');expect(move).toHaveBeenCalledTimes(1);
    view.rerender(<CastleScene places={places} onSelect={select} paused night={false} detailId="detail" onMove={move}/>);ground=true;click();expect(move).toHaveBeenCalledTimes(1);expect(screen.getByTestId('castle-3d-world').dataset.worldResidents).toBe('0');
  });

  it('preserves zoom/orbit/target through portrait sheets and orientation changes with one renderer',()=>{
    vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(390);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(844);
    const view=show({paused:true,insets:{top:100,right:64,bottom:76}}),host=screen.getByTestId('castle-3d-world');expect(JSON.parse(host.dataset.worldProjection||'{}').fov).toBe(42);
    fireEvent.click(screen.getByRole('button',{name:'拉近城堡'}));fireEvent.click(screen.getByRole('button',{name:'向左旋轉城堡'}));const distance=host.dataset.worldCamera,angle=host.dataset.worldAzimuth,target=host.dataset.worldTarget;
    view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night={false} detailId="detail" insets={{top:100,right:64,bottom:490}}/>);expect(JSON.parse(host.dataset.worldProjection||'{}').fov).toBe(42);expect(host.dataset.worldCamera).toBe(distance);
    vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(844);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(390);view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night={false} detailId="detail" insets={{top:101,right:0,bottom:0}}/>);expect(host.dataset.worldCamera).toBe(distance);expect(host.dataset.worldAzimuth).toBe(angle);expect(host.dataset.worldTarget).toBe(target);expect(gpu.instances).toBe(1);
    vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(390);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(844);view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night={false} detailId="detail" insets={{top:100,right:64,bottom:76}}/>);expect(JSON.parse(host.dataset.worldProjection||'{}').fov).toBe(42);expect(host.dataset.worldCamera).toBe(distance);
    fireEvent.click(screen.getByRole('button',{name:'重設為城堡全景'}));expect(Number(host.dataset.worldCamera)).toBeCloseTo(62.34,1);expect(JSON.parse(host.dataset.worldProjection||'{}').fov).toBe(42);
  });

});
