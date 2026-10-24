import { AMBIENT_FRIENDS, type AmbientKind } from './ambientFriends';

const openings: Record<string, string> = {
  'ambient-resident-1': '背包裡沒帶行程表，今天慢慢逛就好。',
  'ambient-resident-2': '我喜歡沿路看看花，剛好和你打聲招呼。',
  'ambient-resident-3': '風有一點涼，圍巾剛好派上用場。',
  'ambient-resident-4': '換個角度看，城堡側面也很有意思呢。',
  'ambient-resident-5': '今天不趕路，也看看路邊的小動物。',
  'ambient-resident-6': '帽沿擋住陽光，可以悠閒地走一圈了。',
  'ambient-resident-7': '石板路轉個彎，又有不同的風景。',
  'ambient-cat-1': '喵。這裡有一小塊陽光，留給你。',
  'ambient-dog-2': '汪！剛好停一停，陪你看看城堡。',
  'ambient-rabbit-3': '小兔晃晃長耳朵，向你說聲好。',
  'ambient-sheep-4': '咩——慢慢走，聊天也不用太趕。',
  'ambient-cat-5': '尾巴尖彎成小問號。喵，你也來逛逛嗎？',
  'ambient-dog-6': '汪！今天的散步，又是一場小冒險。',
};
const lines: Record<AmbientKind, readonly [string, string]> = {
  resident: ['這座城堡換個角度看，還有不同的小風景。', '我再沿著石板路走一圈，下次經過再打聲招呼吧。'],
  cat: ['喵，這一小塊暖暖的位置，我很喜歡。', '呼嚕……你慢慢逛，我也繼續巡一圈。'],
  dog: ['汪！橋邊、小路和花園，我都想看看。', '下次再陪我停一停。汪，先去前面的小路囉！'],
  rabbit: ['長耳朵晃一晃，小兔也在看看四周的風景。', '小兔準備繼續散步，下次見面再聊。'],
  sheep: ['咩，走一走，也可以停一停，慢慢逛就很好。', '小羊輕輕點頭，等下次經過，再說聲好。'],
};
/** NPC speech only. Never synthesize a player utterance or auto-select an old dialogue branch. */
export function getFriendSpeech(id: string) {
  const friend = AMBIENT_FRIENDS.find(candidate => candidate.id === id);
  if (!friend || !openings[id]) return undefined;
  return { friend, lines: [openings[id], ...lines[friend.kind]] as const };
}
