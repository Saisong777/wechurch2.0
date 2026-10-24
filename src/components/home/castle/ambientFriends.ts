/** Fictional scene characters only. No membership or presence identifiers. */
export type AmbientKind = 'resident' | 'cat' | 'dog' | 'rabbit' | 'sheep';
export type AmbientAction = 'hello' | 'affection';
const residents = ['背包散步者', '金帽園丁', '圍巾朋友', '藍衣旅人', '紫衣鄰居', '陽光帽朋友', '綠衣散步者'];
const animals = [
  { id: 'ambient-cat-1', kind: 'cat', name: '餅乾小貓' },
  { id: 'ambient-dog-2', kind: 'dog', name: '奶油小狗' },
  { id: 'ambient-rabbit-3', kind: 'rabbit', name: '長耳小兔' },
  { id: 'ambient-sheep-4', kind: 'sheep', name: '棉花小羊' },
  { id: 'ambient-cat-5', kind: 'cat', name: '薄荷小貓' },
  { id: 'ambient-dog-6', kind: 'dog', name: '豆豆小狗' },
] as const;
export const AMBIENT_FRIENDS: readonly { id: string; kind: AmbientKind; name: string }[] = [
  ...residents.map((name, i) => ({ id: `ambient-resident-${i + 1}`, kind: 'resident' as const, name })), ...animals,
];
export const FRIEND_RESPONSES: Record<AmbientKind, { hello: string; affection: string; action: string }> = {
  resident: { hello: '嗨！很高興在城堡遇見你。一起慢慢逛吧。', affection: '伸伸手、鬆鬆肩，散步也記得休息。', action: '一起伸展' },
  cat: { hello: '喵——小貓豎起尾巴，向你輕輕招呼。', affection: '呼嚕呼嚕。小貓舒服地晃了晃尾巴。', action: '輕輕摸摸' },
  dog: { hello: '汪！小狗搖著尾巴，開心地原地踏步。', affection: '小狗輕輕踏步，耳朵也跟著開心晃動。', action: '輕輕摸摸' },
  rabbit: { hello: '小兔豎起長耳朵，輕輕蹦了一下。', affection: '小兔放鬆耳朵，乖乖陪你停一會兒。', action: '輕輕摸摸' },
  sheep: { hello: '咩——小羊點點頭，向你說聲好。', affection: '蓬鬆的小羊晃晃耳朵，又點了點頭。', action: '輕輕摸摸' },
};
export type AmbientRequest = { id: string; action: AmbientAction; sequence: number };
