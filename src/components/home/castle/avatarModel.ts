import * as THREE from 'three';
import { castleAppearanceSchema, type CastleAppearance } from '@shared/castleAvatar';
export const AVATAR_COLORS = { coral: 0xd88065, sunshine: 0xe3b854, jade: 0x3d8986, blue: 0x677cac, ivory: 0xf0e6cc, violet: 0x8b79a5 };
const SKIN = { light: 0xf3d5b6, warm: 0xdca582, tan: 0xb77a55, deep: 0x79533f }, HAIR = { black: 0x342f2b, brown: 0x775133, chestnut: 0xa36140, silver: 0xc6c8c3 };
/** Shared by the world and wardrobe. Every option reuses a fixed owned mesh/material pool. */
export function createCastleAvatarModel(initial: CastleAppearance) {
    const group = new THREE.Group(), geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    let disposed = false, appearance = castleAppearanceSchema.parse(initial);
    const own = <T extends THREE.BufferGeometry>(g: T) => {
        geometry.add(g);
        return g;
    };
    const cube = own(new THREE.BoxGeometry(1, 1, 1)), cylinder = own(new THREE.CylinderGeometry(1, 1, 1, 10)), sphere = own(new THREE.IcosahedronGeometry(1, 1)), flare = own(new THREE.CylinderGeometry(.65, 1, 1, 10));
    const mat = (color: number) => {
        const m = new THREE.MeshStandardMaterial({ color, roughness: .86, flatShading: true });
        materials.add(m);
        return m;
    };
    const skin = mat(SKIN.warm), hair = mat(HAIR.brown), fabric = mat(AVATAR_COLORS.jade), pants = mat(0x435865), dark = mat(0x35443e), trim = mat(0xf4e8cd);
    const mesh = (parent: THREE.Group, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) => {
        const value = new THREE.Mesh(g, m);
        value.position.set(x, y, z);
        value.scale.set(sx, sy, sz);
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
        skin.color.setHex(SKIN[appearance.skinTone]);
        hair.color.setHex(HAIR[appearance.hairColor]);
        fabric.color.setHex(AVATAR_COLORS[appearance.outfitColor]);
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
        geometry.forEach(value => value.dispose());
        materials.forEach(value => value.dispose());
        group.clear();
    }
    return { group, arms, legs, applyAppearance, dispose, get appearance() {
            return appearance;
        } };
}
