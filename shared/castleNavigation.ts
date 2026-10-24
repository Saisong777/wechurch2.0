// Shared, CPU-only walk network. No client supplied coordinates are accepted by the server.
export const WALK_NODES = [[0, 15], [0, 10.5], [0, 5.5], [0, 1], [-6.5, 4], [-11, 4.5], [-15, 8.5], [-9.5, -2.5], [-8, -12], [0, -12], [10, -11], [10, -3], [12, 4.5], [16, 6.5], [9, 12.7], [13, 12.7]] as const;
export const WALK_EDGES = [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6], [5, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [12, 15], [15, 14], [14, 1], [12, 2]] as const;
export type WalkPoint = readonly [
    number,
    number
];
export type CastleMotion = {
    sequence: number;
    path: WalkPoint[];
    startedAt: number;
    durationMs: number;
};
export const WALK_SPEED = 1.65;
const distance = (a: WalkPoint, b: WalkPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function sampleCastleMotion(motion: CastleMotion, now: number) {
    const path = motion.path;
    const total = path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0);
    let remaining = total * Math.max(0, Math.min(1, (now - motion.startedAt) / Math.max(1, motion.durationMs)));
    let a = path[0] || WALK_NODES[0], b = a;
    for (let i = 1; i < path.length; i++) {
        b = path[i];
        const length = distance(a, b);
        if (remaining <= length || i === path.length - 1) {
            const t = length ? Math.min(1, remaining / length) : 0;
            return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, angle: Math.atan2(b[0] - a[0], b[1] - a[1]), moving: total > 0 && now < motion.startedAt + motion.durationMs };
        }
        remaining -= length;
        a = b;
    }
    return { x: a[0], z: a[1], angle: 0, moving: false };
}
function shortest(from: number, to: number) {
    const costs = Array(WALK_NODES.length).fill(Infinity), previous = Array(WALK_NODES.length).fill(-1), todo = new Set(WALK_NODES.map((_, i) => i));
    costs[from] = 0;
    while (todo.size) {
        const current = [...todo].reduce((a, b) => costs[a] < costs[b] ? a : b);
        todo.delete(current);
        if (current === to)
            break;
        for (const [a, b] of WALK_EDGES) {
            const next = a === current ? b : b === current ? a : -1;
            if (next < 0 || !todo.has(next))
                continue;
            const cost = costs[current] + distance(WALK_NODES[current], WALK_NODES[next as number]!);
            if (cost < costs[next]) {
                costs[next] = cost;
                previous[next] = current;
            }
        }
    }
    const nodes = [to];
    while (nodes[0] !== from && previous[nodes[0]] >= 0)
        nodes.unshift(previous[nodes[0]]);
    return { nodes, cost: costs[to] };
}
export function planCastleMotion(current: CastleMotion, target: number, now: number): CastleMotion {
    if (!Number.isInteger(target) || target < 0 || target >= WALK_NODES.length)
        throw new Error('Invalid castle destination');
    const position = sampleCastleMotion(current, now), p: WalkPoint = [position.x, position.z];
    // The current point lies on a graph edge, including when a previous command is interrupted.
    let best: {
        path: WalkPoint[];
        cost: number;
    } | undefined;
    for (const [a, b] of WALK_EDGES) {
        const pa = WALK_NODES[a], pb = WALK_NODES[b];
        if (Math.abs(distance(pa, p) + distance(p, pb) - distance(pa, pb)) > .001)
            continue;
        for (const endpoint of [a, b]) {
            const route = shortest(endpoint, target), cost = distance(p, WALK_NODES[endpoint]) + route.cost;
            if (!best || cost < best.cost)
                best = { cost, path: [p, ...route.nodes.map(i => WALK_NODES[i])] };
        }
    }
    if (!best)
        throw new Error('Castle position outside walk network');
    const path = best.path.filter((point, i, all) => i === 0 || distance(point, all[i - 1]) > .00001);
    return { sequence: current.sequence + 1, path, startedAt: now, durationMs: best.cost / WALK_SPEED * 1000 };
}
export const PLACE_WALK_NODES = { chapel: 3, bible: 7, prayer: 10, groups: 6, grace: 13, square: 2, play: 14 } as const;
export function nearestWalkNode(x: number, z: number) { return WALK_NODES.reduce((best, p, i) => Math.hypot(p[0] - x, p[1] - z) < Math.hypot(WALK_NODES[best][0] - x, WALK_NODES[best][1] - z) ? i : best, 0); }
