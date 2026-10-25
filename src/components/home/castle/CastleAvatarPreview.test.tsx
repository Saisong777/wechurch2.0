// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { castleAppearance, defaultCastleProfile } from '@shared/castleAvatar';
const gpu = vi.hoisted(() => ({ instances: 0, render: vi.fn(), dispose: vi.fn(), force: vi.fn(), fail: false }));
vi.mock('three', async (original) => ({ ...await original<typeof import('three')>(), WebGLRenderer: class {
        outputColorSpace = '';
        constructor() {
            gpu.instances++;
            if (gpu.fail)
                throw Error('disabled');
        }
        setPixelRatio() {
        }
        setSize() {
        }
        render = gpu.render;
        dispose = gpu.dispose;
        forceContextLoss = gpu.force;
    } }));
import CastleAvatarPreview from './CastleAvatarPreview';
beforeEach(() => {
    gpu.instances = 0;
    gpu.fail = false;
    gpu.render.mockClear();
    gpu.dispose.mockClear();
    gpu.force.mockClear();
    vi.stubGlobal('ResizeObserver', class {
        observe() {
        }
        disconnect() {
        }
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(250);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(260);
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
it('changes the shared actual model without a new renderer or animation loop, and cleans context restore/unmount', () => {
    const appearance = castleAppearance(defaultCastleProfile()), raf = vi.spyOn(window, 'requestAnimationFrame');
    const view = render(<CastleAvatarPreview appearance={appearance}/>);
    expect(gpu.instances).toBe(1);
    const count = gpu.render.mock.calls.length;
    view.rerender(<CastleAvatarPreview appearance={{ ...appearance, outfit: 'skirt' }}/>);
    expect(gpu.instances).toBe(1);
    expect(gpu.render.mock.calls.length).toBeGreaterThan(count);
    expect(raf).not.toHaveBeenCalled();
    const canvas = screen.getByLabelText('自己的玩偶造型預覽，可拖曳轉身');
    fireEvent(canvas, new Event('webglcontextlost', { cancelable: true }));
    expect(screen.getByRole('status').textContent).toContain('仍可選擇');
    fireEvent(canvas, new Event('webglcontextrestored'));
    expect(gpu.instances).toBe(2);
    view.unmount();
    expect(gpu.dispose).toHaveBeenCalledTimes(2);
    expect(gpu.force).toHaveBeenCalledTimes(2);
});
it('does not substitute a fake successful 3D preview when WebGL is unsupported', () => {
    gpu.fail = true;
    render(<CastleAvatarPreview appearance={castleAppearance(defaultCastleProfile())}/>);
    expect(screen.getByRole('status').textContent).toContain('目前無法顯示3D預覽');
    expect(screen.getByRole('button', { name: '重新顯示預覽' })).toBeTruthy();
});
