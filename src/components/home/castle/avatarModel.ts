import * as THREE from 'three';
import { castleAppearanceSchema, type CastleAppearance } from '@shared/castleAvatar';
export const AVATAR_COLORS = { coral: 0xd88065, sunshine: 0xe3b854, jade: 0x3d8986, blue: 0x677cac, ivory: 0xf0e6cc, violet: 0x8b79a5 };
const SKIN = { light: 0xf3d5b6, warm: 0xdca582, tan: 0xb77a55, deep: 0x79533f }, HAIR = { black: 0x342f2b, brown: 0x775133, chestnut: 0xa36140, silver: 0xc6c8c3 };
/** A world owns one finite immutable palette; a wardrobe preview owns its own pool. */
export function createCastleAvatarResources() {
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
    const sphere = new THREE.IcosahedronGeometry(1, 1);
    const flare = new THREE.CylinderGeometry(.65, 1, 1, 10);
    const geometries = [cube, cylinder, sphere, flare];
    const materials = new Map<number, THREE.MeshStandardMaterial>();
    const colors = [...Object.values(SKIN), ...Object.values(HAIR), ...Object.values(AVATAR_COLORS), 0x435865, 0x35443e, 0xf4e8cd];
    for (const color of colors) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .86, flatShading: true }));
    let disposed = false;
    return {
        cube, cylinder, sphere, flare,
        material(color: number) {
            const value = materials.get(color);
            if (!value || disposed) throw new Error('Avatar resource pool is unavailable');
            return value;
        },
        get geometryCount() { return geometries.length; },
        get materialCount() { return materials.size; },
        dispose() {
            if (disposed) return;
            disposed = true;
            geometries.forEach(value => value.dispose());
            materials.forEach(value => value.dispose());
        },
    };
}
export type CastleAvatarResources = ReturnType<typeof createCastleAvatarResources>;

/** Shared by the world and wardrobe. Look changes swap references, never shared colors. */
export function createCastleAvatarModel(initial: CastleAppearance, resources?: CastleAvatarResources) {
    const pool = resources || createCastleAvatarResources();
    const owned = !resources, group = new THREE.Group();
    let disposed = false, appearance = castleAppearanceSchema.parse(initial);
    const { cube, cylinder, sphere, flare } = pool;
    const skin = pool.material(SKIN.warm), hair = pool.material(HAIR.brown), fabric = pool.material(AVATAR_COLORS.jade);
    const pants = pool.material(0x435865), dark = pool.material(0x35443e), trim = pool.material(0xf4e8cd);
    const slots: Record<'skin' | 'hair' | 'fabric', THREE.Mesh[]> = { skin: [], hair: [], fabric: [] };
    const mesh = (parent: THREE.Group, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) => {
        const value = new THREE.Mesh(g, m);
        value.position.set(x, y, z);
        value.scale.set(sx, sy, sz);
        if (m === skin) slots.skin.push(value);
        else if (m === hair) slots.hair.push(value);
        else if (m === fabric) slots.fabric.push(value);
        value.castShadow = true;
        value.receiveShadow = true;
        value.userData.realAvatar = true;
        // Inactive wardrobe alternatives must not become invisible picking obstacles.
        value.raycast = (raycaster, intersections) => {
            for (let node: THREE.Object3D | null = value; node; node = node.parent) {
                if (!node.visible) return;
            }
            THREE.Mesh.prototype.raycast.call(value, raycaster, intersections);
        };
        parent.add(value);
        return value;
    };
    const outfits = { casual: new THREE.Group(), jacket: new THREE.Group(), skirt: new THREE.Group() };
    Object.values(outfits).forEach(value => group.add(value));
    mesh(outfits.casual, cylinder, fabric, 0, .89, 0, .21, .56, .21);
    mesh(outfits.casual, cube, trim, 0, 1.15, .12, .12, .045, .12);
    mesh(outfits.jacket, cylinder, fabric, 0, .84, 0, .225, .72, .22);
    mesh(outfits.jacket, cube, trim, 0, .89, .217, .045, .51, .025);
    for (const side of [-1, 1]) {
        const lapel = mesh(outfits.jacket, cube, trim, side * .075, 1.1, .18, .055, .23, .04);
        lapel.rotation.z = side * -.26;
    }
    mesh(outfits.skirt, cylinder, fabric, 0, 1.01, 0, .205, .32, .205);
    mesh(outfits.skirt, flare, fabric, 0, .61, 0, .29, .57, .26);
    mesh(outfits.skirt, cylinder, trim, 0, .87, 0, .215, .055, .215);
    const head = mesh(group, sphere, skin, 0, 1.36, 0, .185, .21, .18);
    mesh(group, sphere, skin, 0, 1.35, .17, .05, .055, .05);
    for (const x of [-.065, .065])
        mesh(group, sphere, dark, x, 1.4, .164, .018, .023, .018);
    const styles = { short: new THREE.Group(), bob: new THREE.Group(), long: new THREE.Group(), none: new THREE.Group() };
    Object.values(styles).forEach(value => group.add(value));
    mesh(styles.short, sphere, hair, 0, 1.49, -.025, .195, .13, .18);
    for (const style of [styles.bob, styles.long]) {
        mesh(style, sphere, hair, 0, 1.5, -.025, .202, .14, .185);
        for (const side of [-1, 1])
            mesh(style, cube, hair, side * .174, 1.31, -.035, .075, style === styles.long ? .49 : .3, .24);
        mesh(style, cube, hair, 0, style === styles.long ? 1.22 : 1.34, -.15, .31, style === styles.long ? .54 : .29, .095);
    }
    const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
    for (const side of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(side * .26, 1.08, 0);
        group.add(arm);
        arms.push(arm);
        mesh(arm, cylinder, fabric, 0, -.13, 0, .075, .27, .075);
        mesh(arm, cylinder, skin, 0, -.34, 0, .057, .22, .057);
        mesh(arm, sphere, skin, 0, -.47, 0, .065);
        const leg = new THREE.Group();
        leg.position.set(side * .105, .64, 0);
        group.add(leg);
        legs.push(leg);
        mesh(leg, cylinder, pants, 0, -.25, 0, .08, .5, .08);
        mesh(leg, cube, dark, 0, -.51, .055, .16, .1, .27);
    }
    function applyAppearance(next: CastleAppearance) {
        if (disposed)
            return;
        appearance = castleAppearanceSchema.parse(next);
        slots.skin.forEach(value => value.material = pool.material(SKIN[appearance.skinTone]));
        slots.hair.forEach(value => value.material = pool.material(HAIR[appearance.hairColor]));
        slots.fabric.forEach(value => value.material = pool.material(AVATAR_COLORS[appearance.outfitColor]));
        for (const [key, value] of Object.entries(outfits))
            value.visible = key === appearance.outfit;
        for (const [key, value] of Object.entries(styles))
            value.visible = key === appearance.hairStyle;
        const width = appearance.genderPresentation === 'male' ? 1.08 : appearance.genderPresentation === 'female' ? .92 : 1;
        Object.values(outfits).forEach(value => value.scale.x = width);
        head.scale.x = .185 * (appearance.genderPresentation === 'male' ? 1.06 : appearance.genderPresentation === 'female' ? .94 : 1);
        arms.forEach((arm, i) => arm.position.x = (i ? 1 : -1) * (.25 + (width - 1) * .2));
    }
    applyAppearance(appearance);
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        group.removeFromParent();
        if (owned) pool.dispose();
        group.clear();
    }
    return { group, arms, legs, applyAppearance, dispose, get appearance() {
            return appearance;
        } };
}
