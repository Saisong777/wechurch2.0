import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import { createCastleAvatarModel } from './avatarModel';
import { castleAppearance, defaultCastleProfile } from '@shared/castleAvatar';
it('renders every actual look choice with a fixed resource pool, then disposes each resource once', () => {
    const appearance = castleAppearance(defaultCastleProfile()), model = createCastleAvatarModel(appearance), objects: THREE.Object3D[] = [], geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    model.group.traverse(node => {
        objects.push(node);
        if (node instanceof THREE.Mesh) {
            geometry.add(node.geometry);
            (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => materials.add(m));
        }
    });
    const spies = [...geometry, ...materials].map(r => vi.spyOn(r, 'dispose'));
    const visible = () => {
        let n = 0;
        model.group.traverseVisible(o => {
            if (o instanceof THREE.Mesh)
                n++;
        });
        return n;
    };
    const casual = visible();
    model.applyAppearance({ ...appearance, hairStyle: 'long', outfit: 'skirt', genderPresentation: 'female', skinTone: 'deep', hairColor: 'silver', outfitColor: 'coral' });
    expect(visible()).toBeGreaterThan(casual);
    expect(model.appearance.skinTone).toBe('deep');
    expect(model.legs).toHaveLength(2);
    expect(model.arms).toHaveLength(2);
    for (const hairStyle of ['short', 'bob', 'long', 'none'] as const)
        for (const outfit of ['casual', 'jacket', 'skirt'] as const)
            model.applyAppearance({ ...appearance, hairStyle, outfit });
    const after: THREE.Object3D[] = [];
    model.group.traverse(o => after.push(o));
    expect(after).toEqual(objects);
    expect(materials.size).toBe(6);
    expect(spies.every(s => !s.mock.calls.length)).toBe(true);
    model.dispose();
    model.dispose();
    expect(spies.every(s => s.mock.calls.length === 1)).toBe(true);
    expect(model.group.children).toHaveLength(0);
});

it('only raycasts the visible chosen outfit and hair, not hidden wardrobe alternatives', () => {
    const model = createCastleAvatarModel(castleAppearance(defaultCastleProfile()));
    model.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 1.47, 2), new THREE.Vector3(0, 0, -1));
    const hits = ray.intersectObject(model.group, true);
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) for (let node: THREE.Object3D | null = hit.object; node; node = node.parent) expect(node.visible).toBe(true);
    model.dispose();
});
