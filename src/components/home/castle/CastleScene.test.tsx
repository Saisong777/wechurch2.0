import {useState} from 'react';
import {getFriendSpeech} from './ambientDialogue';
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
let callbacks: Map<number, FrameRequestCallback>, frameId: number, reduced: boolean, notifyWorldResize:()=>void;
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
  notifyWorldResize=()=>{};vi.stubGlobal('ResizeObserver', class { constructor(private callback:ResizeObserverCallback){} observe(node:Element) { if(node.getAttribute('data-testid')==='castle-3d-world')notifyWorldResize=()=>this.callback([{target:node} as ResizeObserverEntry],this as unknown as ResizeObserver); } unobserve() {} disconnect = disconnect; });
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

  it('animates only ambient time in the active loop, freezing it on pause, reduced motion and hidden tabs while real avatars update',()=>{
    let changeMotion:((event:MediaQueryListEvent)=>void)|undefined;
    vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:(_type:string,listener:(event:MediaQueryListEvent)=>void)=>{changeMotion=listener;},removeEventListener:()=>{}}));
    const view=show(),host=screen.getByTestId('castle-3d-world');const ambient=()=>JSON.parse(host.dataset.worldAmbient||'{}');expect(ambient()).toMatchObject({residents:7,animals:6,elapsed:0});expect(host.dataset.worldResidents).toBe('0');
    tick(1000);tick(1050);expect(ambient().elapsed).toBe(.05);const frozen=host.dataset.worldAmbient;
    view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night={false} detailId="detail"/>);fireEvent.click(screen.getByRole('button',{name:'拉近城堡'}));fireEvent.click(screen.getByRole('button',{name:'向右旋轉城堡'}));expect(host.dataset.worldAmbient).toBe(frozen);expect(callbacks.size).toBe(0);
    const avatar={avatarId:'22222222-2222-4222-8222-222222222222',alias:'真人暱稱',preset:'jade' as const,isSelf:true,motion:{sequence:1,path:[[0,10.5] as [number,number]],startedAt:1000,durationMs:0}};
    view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night={false} detailId="detail" presence={{roster:{instanceEpoch:'11111111-1111-4111-8111-111111111111',serverNow:1000,ttlMs:25000,avatars:[avatar]},receivedAt:performance.now()}}/>);expect(host.dataset.worldResidentPosition).toBe('0.000,10.500');expect(host.dataset.worldResidents).toBe('1');expect(host.dataset.worldAmbient).toBe(frozen);expect(document.querySelectorAll('.castle-resident-labels span')).toHaveLength(1);
    view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused={false} night={false} detailId="detail"/>);act(()=>changeMotion?.({matches:true} as MediaQueryListEvent));expect(callbacks.size).toBe(0);fireEvent.click(screen.getByRole('button',{name:'拉遠城堡'}));expect(host.dataset.worldAmbient).toBe(frozen);
    act(()=>changeMotion?.({matches:false} as MediaQueryListEvent));vi.spyOn(document,'hidden','get').mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));expect(callbacks.size).toBe(0);expect(host.dataset.worldAmbient).toBe(frozen);vi.spyOn(document,'hidden','get').mockReturnValue(false);fireEvent(document,new Event('visibilitychange'));tick(100000);expect(host.dataset.worldAmbient).toBe(frozen);tick(100050);expect(ambient().elapsed).toBe(.1);expect(gpu.instances).toBe(1);
  });
  it('consumes the nearest visible ambient hit once, retains environmental occlusion and preserves gesture guards',()=>{
    let first:'ambient'|'terrain'|'building'='ambient';vi.spyOn(THREE.Raycaster.prototype,'intersectObject').mockImplementation(object=>{let ambient:THREE.Object3D|undefined,building:THREE.Object3D|undefined;object.traverse(child=>{if(child instanceof THREE.Mesh&&child.userData.ambientId==='ambient-cat-1')ambient=child;if(child.userData.placeId==='chapel')building=child;});const terrain=new THREE.Mesh();return first==='terrain'?[{object:terrain,distance:.1,point:new THREE.Vector3()},{object:ambient!,distance:.5,point:new THREE.Vector3()}]:first==='building'?[{object:building!,distance:.1,point:new THREE.Vector3()},{object:ambient!,distance:.5,point:new THREE.Vector3()}]:[{object:ambient!,distance:.5,point:new THREE.Vector3()},{object:building!,distance:2,point:new THREE.Vector3()}];});
    const select=vi.fn(),friend=vi.fn(),move=vi.fn();show({paused:true,onSelect:select,onFriendSelect:friend,onMove:move});const surface=screen.getByTestId('castle-3d-canvas'),click=()=>{fireEvent.pointerDown(surface,{pointerId:1,button:0,clientX:100,clientY:100});fireEvent.pointerUp(surface,{pointerId:1,button:0,clientX:100,clientY:100});};click();expect(friend).toHaveBeenCalledExactlyOnceWith('ambient-cat-1');expect(select).not.toHaveBeenCalled();expect(move).not.toHaveBeenCalled();friend.mockClear();first='terrain';click();expect(friend).not.toHaveBeenCalled();expect(select).not.toHaveBeenCalled();first='building';click();expect(select).toHaveBeenCalledWith('chapel');expect(friend).not.toHaveBeenCalled();first='ambient';
    fireEvent.pointerDown(surface,{pointerId:2,button:0,clientX:100,clientY:100});fireEvent.pointerMove(surface,{pointerId:2,clientX:109,clientY:100});fireEvent.pointerUp(surface,{pointerId:2,clientX:109,clientY:100});
    fireEvent.pointerDown(surface,{pointerId:3,button:2});fireEvent.pointerUp(surface,{pointerId:3,button:2});
    fireEvent.pointerDown(surface,{pointerId:4,pointerType:'touch'});fireEvent.pointerDown(surface,{pointerId:5,pointerType:'touch'});fireEvent.pointerUp(surface,{pointerId:5,pointerType:'touch'});fireEvent.pointerUp(surface,{pointerId:4,pointerType:'touch'});expect(friend).not.toHaveBeenCalled();
  });
  it('focuses the real selected actor and keeps interaction time frozen through pause, camera render and reduced motion',()=>{
    reduced=true;const view=show({friendRequest:{id:'ambient-resident-1',action:'hello',sequence:1}}),host=screen.getByTestId('castle-3d-world');expect(host.dataset.worldCamera).toBe('12.00');expect(callbacks.size).toBe(0);
    const ambient=()=>JSON.parse(host.dataset.worldAmbient||'{}');expect(ambient().resident.interaction).toMatchObject({action:'hello',elapsed:0});const frozen=host.dataset.worldAmbient;
    fireEvent.click(screen.getByRole('button',{name:'向左旋轉城堡'}));fireEvent.click(screen.getByRole('button',{name:'拉近城堡'}));expect(host.dataset.worldAmbient).toBe(frozen);
    view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night={false} detailId="detail" friendRequest={{id:'ambient-cat-1',action:'hello',sequence:2}}/>);expect(ambient().animal.interaction).toMatchObject({action:'hello',elapsed:0});expect(callbacks.size).toBe(0);expect(gpu.instances).toBe(1);
  });
  it('does not pretend an unavailable 3D scene can play a friend animation',()=>{
    gpu.fail=true;const ready=vi.fn();show({friendRequest:{id:'ambient-cat-1',action:'hello',sequence:1},onFriendsReady:ready});expect(ready).toHaveBeenLastCalledWith(false);expect(callbacks.size).toBe(0);expect(screen.getByText('這個裝置目前無法開啟3D')).toBeTruthy();
  });

  it('discards requests made while WebGL is unavailable rather than playing them after retry',()=>{
    gpu.fail=true;show({friendRequest:{id:'ambient-cat-1',action:'hello',sequence:1}});expect(document.querySelector('.castle-rpg-bubble')).toBeNull();gpu.fail=false;fireEvent.click(screen.getByRole('button',{name:'重新開啟3D'}));expect(screen.getByTestId('castle-3d-world').dataset.worldState).toBe('ready');expect(document.querySelector('.castle-rpg-bubble')).toBeNull();expect(screen.getByTestId('castle-3d-world').dataset.worldInteractionSequence).toBe('0');
  });

  it('advances an active greeting only on the existing delta loop, not presence/camera/hidden renders',()=>{
    const request={id:'ambient-resident-1',action:'hello' as const,sequence:1},view=show({friendRequest:request}),host=screen.getByTestId('castle-3d-world');tick(1000);tick(1050);expect(JSON.parse(host.dataset.worldAmbient||'{}').resident.interaction.elapsed).toBe(.05);
    view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night={false} detailId="detail" friendRequest={request}/>);const frozen=host.dataset.worldAmbient;
    const avatar={avatarId:'22222222-2222-4222-8222-222222222222',alias:'真人',preset:'jade' as const,isSelf:true,motion:{sequence:1,path:[[0,10.5] as [number,number]],startedAt:1000,durationMs:0}};
    view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night detailId="detail" friendRequest={request} presence={{roster:{instanceEpoch:'11111111-1111-4111-8111-111111111111',serverNow:1000,ttlMs:25000,avatars:[avatar]},receivedAt:performance.now()}}/>);expect(host.dataset.worldResidentPosition).toBe('0.000,10.500');fireEvent.click(screen.getByRole('button',{name:'拉遠城堡'}));expect(host.dataset.worldAmbient).toBe(frozen);
    view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused={false} night={false} detailId="detail" friendRequest={request}/>);vi.spyOn(document,'hidden','get').mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));expect(callbacks.size).toBe(0);expect(host.dataset.worldAmbient).toBe(frozen);vi.spyOn(document,'hidden','get').mockReturnValue(false);fireEvent(document,new Event('visibilitychange'));tick(100000);expect(host.dataset.worldAmbient).toBe(frozen);tick(100050);expect(JSON.parse(host.dataset.worldAmbient||'{}').resident.interaction.elapsed).toBe(.1);expect(gpu.instances).toBe(1);
  });

  it('does not replay a consumed greeting or fly back after WebGL restore, but new same/different friend requests still work',()=>{
    const first={id:'ambient-resident-1',action:'hello' as const,sequence:1},view=show({paused:true,friendRequest:first}),host=screen.getByTestId('castle-3d-world');expect(host.dataset.worldCamera).toBe('12.00');expect(JSON.parse(host.dataset.worldAmbient||'{}').resident.interaction).not.toBeNull();
    const surface=screen.getByTestId('castle-3d-canvas');fireEvent(surface,new Event('webglcontextlost',{cancelable:true}));fireEvent(surface,new Event('webglcontextrestored'));expect(host.dataset.worldState).toBe('ready');expect(JSON.parse(host.dataset.worldAmbient||'{}').resident.interaction).toBeNull();expect(Number(host.dataset.worldCamera)).toBeGreaterThan(50);expect(host.dataset.worldTarget).toBe('0.00,0.70,2.00');
    view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night={false} detailId="detail"/>);view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night={false} detailId="detail" friendRequest={{...first,sequence:2}}/>);expect(host.dataset.worldCamera).toBe('12.00');expect(JSON.parse(host.dataset.worldAmbient||'{}').resident.interaction).toMatchObject({action:'hello'});
    view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night={false} detailId="detail" friendRequest={{id:'ambient-cat-1',action:'hello',sequence:3}}/>);expect(JSON.parse(host.dataset.worldAmbient||'{}').animal.interaction).toMatchObject({action:'hello'});expect(gpu.instances).toBe(2);
  });

  it('opens character speech immediately and advances its three lines without advancing the world, camera or greeting sequence',()=>{
    vi.spyOn(THREE.Raycaster.prototype,'intersectObject').mockReturnValue([]);
    const close=vi.fn();show({paused:true,friendRequest:{id:'ambient-cat-1',action:'hello',sequence:1},onFriendClose:close});
    const host=screen.getByTestId('castle-3d-world'),bubble=document.querySelector<HTMLElement>('.castle-rpg-bubble')!,script=getFriendSpeech('ambient-cat-1')!;
    expect(bubble.hidden).toBe(false);expect(screen.getByText(script.lines[0])).toBeTruthy();const speech=bubble.querySelector<HTMLButtonElement>('.castle-rpg-text')!;expect(speech).toHaveFocus();
    const frozen=host.dataset.worldAmbient,camera=host.dataset.worldCamera,target=host.dataset.worldTarget,sequence=host.dataset.worldInteractionSequence;
    fireEvent.click(speech);expect(screen.getByText(script.lines[1])).toBeTruthy();fireEvent.click(speech);expect(screen.getByText(script.lines[2])).toBeTruthy();expect(host.dataset.worldAmbient).toBe(frozen);expect(host.dataset.worldCamera).toBe(camera);expect(host.dataset.worldTarget).toBe(target);expect(host.dataset.worldInteractionSequence).toBe(sequence);
    fireEvent.click(screen.getByRole('button',{name:'輕輕摸摸'}));expect(host.dataset.worldInteractionSequence).toBe('2');expect(host.dataset.worldCamera).toBe(camera);expect(JSON.parse(host.dataset.worldAmbient||'{}').animal.interaction).toMatchObject({action:'affection',elapsed:0});fireEvent.keyDown(document,{key:'Escape'});expect(document.querySelector('.castle-rpg-bubble')).toBeNull();expect(close).toHaveBeenCalledOnce();expect(gpu.instances).toBe(1);
  });
  it('reprojects the real head on paused orbit, zoom and resize without replaying speech or creating a loop',()=>{
    vi.spyOn(THREE.Raycaster.prototype,'intersectObject').mockReturnValue([]);show({paused:true,friendRequest:{id:'ambient-resident-1',action:'hello',sequence:1}});
    const host=screen.getByTestId('castle-3d-world'),bubble=document.querySelector<HTMLElement>('.castle-rpg-bubble')!,frozen=host.dataset.worldAmbient,angle=host.dataset.worldAzimuth;
    fireEvent.click(screen.getByRole('button',{name:'向左旋轉城堡'}));expect(host.dataset.worldAzimuth).not.toBe(angle);expect(bubble.hidden).toBe(false);const before=bubble.dataset.head;fireEvent.click(screen.getByRole('button',{name:'拉近城堡'}));expect(bubble.dataset.head).not.toBe(before);expect(host.dataset.worldAmbient).toBe(frozen);expect(host.dataset.worldInteractionSequence).toBe('1');expect(callbacks.size).toBe(0);
    vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(390);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(844);act(()=>notifyWorldResize());expect(bubble.dataset.head).not.toBe(before);expect(gpu.instances).toBe(1);
    const tail=document.querySelector('polygon')!.getAttribute('points')!.split(' ')[1].split(',').map(Number),projected=bubble.dataset.head!.split(',').map(Number);expect(tail[0]).toBeCloseTo(projected[0],0);expect(tail[1]).toBeCloseTo(projected[1],0);
  });
  it('hides both body and tail behind an occluder or foreground HUD and does not steal focus when the foreground returns',()=>{
    let occluded=false;vi.spyOn(THREE.Raycaster.prototype,'intersectObject').mockImplementation(()=>occluded?[{object:new THREE.Mesh(),distance:1,point:new THREE.Vector3()}]:[]);
    const request={id:'ambient-cat-1',action:'hello' as const,sequence:1},view=show({paused:true,friendRequest:request,bubbleEnabled:false}),host=screen.getByTestId('castle-3d-world');
    const layer=document.querySelector<HTMLElement>('.castle-rpg-layer')!,bubble=document.querySelector<HTMLElement>('.castle-rpg-bubble')!;expect(bubble.hidden).toBe(true);expect(layer.dataset.anchorVisible).toBe('false');
    const outside=document.createElement('button');document.body.append(outside);outside.focus();view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night={false} detailId="detail" friendRequest={request} bubbleEnabled/>);expect(bubble.hidden).toBe(false);expect(outside).toHaveFocus();
    occluded=true;fireEvent.click(screen.getByRole('button',{name:'向右旋轉城堡'}));expect(bubble.hidden).toBe(true);expect(layer.dataset.anchorVisible).toBe('false');
    view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night={false} detailId="detail" friendRequest={request} bubbleEnabled={false}/>);fireEvent.keyDown(document,{key:'Escape'});expect(document.querySelector('.castle-rpg-bubble')).toBeTruthy();expect(host.dataset.worldInteractionSequence).toBe('1');outside.remove();
  });
  it('projects the walking head on the existing loop and hides a genuinely behind-camera anchor on a manual render',()=>{
    vi.spyOn(THREE.Raycaster.prototype,'intersectObject').mockReturnValue([]);const request={id:'ambient-resident-1',action:'hello' as const,sequence:1},view=show({friendRequest:request});tick(1000);for(let n=1;n<=18;n++)tick(1000+n*50);
    const bubble=document.querySelector<HTMLElement>('.castle-rpg-bubble')!,start=bubble.dataset.head;for(let n=19;n<=80;n++)tick(1000+n*50);expect(bubble.dataset.head).not.toBe(start);expect(screen.getByText(getFriendSpeech(request.id)!.lines[0])).toBeTruthy();
    const camera=gpu.render.mock.calls.at(-1)![1] as THREE.PerspectiveCamera;camera.lookAt(camera.position.clone().add(new THREE.Vector3(0,100,0)));camera.updateMatrixWorld();view.rerender(<CastleScene places={places} onSelect={vi.fn()} paused night detailId="detail" friendRequest={request}/>);expect(bubble.hidden).toBe(true);expect(document.querySelector<HTMLElement>('.castle-rpg-layer')!.dataset.anchorVisible).toBe('false');expect(screen.getByTestId('castle-3d-world').dataset.worldInteractionSequence).toBe('1');expect(callbacks.size).toBe(0);
  });
  it.each(['ambient-resident-2','ambient-resident-1'])('hands keyboard focus to the committed new bubble after opening the drawer and selecting %s',id=>{
    vi.spyOn(THREE.Raycaster.prototype,'intersectObject').mockReturnValue([]);
    function Harness(){const[drawer,setDrawer]=useState(false),[request,setRequest]=useState({id:'ambient-resident-1',action:'hello' as const,sequence:1});return <><CastleScene places={places} onSelect={vi.fn()} paused={false} night={false} detailId="detail" friendRequest={request} bubbleEnabled={!drawer}/><button onClick={()=>setDrawer(true)}>測試朋友清單</button>{drawer&&<button onClick={()=>{setDrawer(false);setRequest({id,action:'hello',sequence:2});}}>選取場景朋友</button>}</>;}
    render(<Harness/>);tick(1000);for(let n=1;n<=20;n++)tick(1000+n*50);const oldSpeech=document.querySelector<HTMLButtonElement>('.castle-rpg-text')!;expect(oldSpeech).toHaveFocus();fireEvent.click(screen.getByRole('button',{name:'測試朋友清單'}));const choose=screen.getByRole('button',{name:'選取場景朋友'});choose.focus();fireEvent.click(choose);for(let n=21;n<=42;n++)tick(1000+n*50);
    const bubble=document.querySelector<HTMLElement>('.castle-rpg-bubble')!,speech=bubble.querySelector<HTMLButtonElement>('.castle-rpg-text')!;expect(bubble.dataset.friendId).toBe(id);expect(oldSpeech.isConnected).toBe(false);expect(speech).toHaveFocus();expect(document.querySelectorAll('.castle-rpg-bubble')).toHaveLength(1);expect(screen.getByTestId('castle-3d-world').dataset.worldInteractionSequence).toBe('2');expect(gpu.instances).toBe(1);
  });
  it('clears the head bubble on context loss and does not replay its old request on restore',()=>{
    vi.spyOn(THREE.Raycaster.prototype,'intersectObject').mockReturnValue([]);show({paused:true,friendRequest:{id:'ambient-cat-1',action:'hello',sequence:1}});expect(document.querySelector('.castle-rpg-bubble')).toBeTruthy();const surface=screen.getByTestId('castle-3d-canvas');fireEvent(surface,new Event('webglcontextlost',{cancelable:true}));expect(document.querySelector('.castle-rpg-bubble')).toBeNull();fireEvent(surface,new Event('webglcontextrestored'));expect(document.querySelector('.castle-rpg-bubble')).toBeNull();expect(screen.getByTestId('castle-3d-world').dataset.worldCamera).not.toBe('12.00');
  });
});
