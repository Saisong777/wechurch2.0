import { AMBIENT_FRIENDS, type AmbientKind } from './ambientFriends';

export type DialogueFollowUp = { line: string; reply: string };
export type DialogueTopic = { id: 'explore' | 'day'; line: string; reply: string; followUps: readonly [DialogueFollowUp, DialogueFollowUp] };
const openings: Record<string, string> = {
  'ambient-resident-1': '背包裡沒帶行程表，今天想走到哪就逛到哪。你呢？',
  'ambient-resident-2': '我喜歡沿路看看花。剛好停一停，和你聊兩句。',
  'ambient-resident-3': '風有一點涼，圍巾剛好派上用場。你想從哪裡開始逛？',
  'ambient-resident-4': '我正繞著城堡找不同的角度，側面也很有意思呢。',
  'ambient-resident-5': '今天慢慢走，不趕路。你有看見路邊的小動物嗎？',
  'ambient-resident-6': '帽沿替我擋住陽光，現在可以安心發呆一下了。',
  'ambient-resident-7': '我最喜歡石板路轉彎的地方，每一邊都有新風景。',
  'ambient-cat-1': '喵。餅乾色的小貓伸了伸懶腰，留了一小塊陽光給你。',
  'ambient-dog-2': '汪！奶油小狗抬起耳朵，好像正等著有人陪牠逛一圈。',
  'ambient-rabbit-3': '長耳朵一左一右晃了晃。小兔停下來，想聽你說什麼。',
  'ambient-sheep-4': '咩——棉花小羊慢悠悠地點頭，聊天也不用太趕。',
  'ambient-cat-5': '薄荷色的小貓安靜坐好，尾巴尖像小問號一樣彎著。',
  'ambient-dog-6': '豆豆小狗踏了兩小步，今天連散步都像一場小冒險。',
};
const topics: Record<AmbientKind, readonly [DialogueTopic, DialogueTopic]> = {
  resident: [
    { id: 'explore', line: '你在逛哪裡？', reply: '我沿著石板路繞一圈。你想看建築，還是找個地方歇歇？', followUps: [
      { line: '我想看看城堡。', reply: '可以轉個角度看看主堡的塔和城門。慢慢逛，下次再碰面！' },
      { line: '我想找個地方歇歇。', reply: '花園和廣場都很適合停一停。等你想走了，再接著探索吧。' },
    ] },
    { id: 'day', line: '今天想做什麼？', reply: '先散步，再挑一件小事做。你想讀一點東西，還是看看大家的分享？', followUps: [
      { line: '我想讀一點東西。', reply: '可以從話語之塔打開聖經，或到主堡看看每日靈修。祝你有一段舒服的閱讀時間。' },
      { line: '我想看看大家的分享。', reply: '同行廣場可以打開分享牆。聽聽彼此的故事，也是一種同行。' },
    ] },
  ],
  cat: [
    { id: 'explore', line: '這裡有你喜歡的地方嗎？', reply: '喵，暖暖的石板路就很好。你喜歡曬太陽，還是坐在樹蔭下？', followUps: [
      { line: '我也喜歡曬太陽。', reply: '喵嗚，那就各留一小塊陽光，安靜坐一下吧。' },
      { line: '我喜歡樹蔭。', reply: '樹葉晃呀晃，尾巴也跟著慢慢晃。這裡也不錯呢。' },
    ] },
    { id: 'day', line: '你今天在忙什麼？', reply: '先巡一圈，再伸個懶腰。你想陪我看看，還是讓我打個盹？', followUps: [
      { line: '陪你看看。', reply: '喵！你慢慢轉動城堡看看，我繼續沿小路巡邏。' },
      { line: '讓你打個盹。', reply: '呼嚕……那下次見面，再叫我一聲吧。' },
    ] },
  ],
  dog: [
    { id: 'explore', line: '散步有發現什麼嗎？', reply: '汪！前面有橋，轉彎有花。你想看水，還是看看朋友？', followUps: [
      { line: '我想看水。', reply: '把城堡轉一轉，就能看看橋邊的海。汪，記得也看看小船！' },
      { line: '我想看看朋友。', reply: '朋友清單裡還有小貓、小兔和小羊。替我跟牠們說聲好！' },
    ] },
    { id: 'day', line: '你喜歡怎樣散步？', reply: '有時快兩步，有時停下來。你喜歡慢慢走，還是邊走邊看？', followUps: [
      { line: '慢慢走就好。', reply: '汪，我也停一停。這一小段路，可以走得很悠閒。' },
      { line: '我想邊走邊看。', reply: '那就多轉幾個角度吧！我去前面的小路等下一次招呼。' },
    ] },
  ],
  rabbit: [
    { id: 'explore', line: '長耳朵在聽什麼？', reply: '小兔豎起耳朵：也許是風，也許是小路上的腳步。你想聽哪一種？', followUps: [
      { line: '我想聽風。', reply: '那就安靜一小會兒。小兔把耳朵放鬆，陪你看看樹葉。' },
      { line: '我想聽腳步。', reply: '朋友正沿著石板路散步呢。小兔輕輕蹦一下，也準備出發。' },
    ] },
    { id: 'day', line: '今天想去哪裡？', reply: '小兔望向花園，又看看小家。你會先逛哪邊？', followUps: [
      { line: '先逛花園。', reply: '花園有噴泉，也有禱告入口。小兔在這裡陪你停一下。' },
      { line: '先逛小家。', reply: '一間間小屋很可愛吧。點小家聚落，就能看看原本的小家功能。' },
    ] },
  ],
  sheep: [
    { id: 'explore', line: '這裡好逛嗎？', reply: '咩，很適合慢慢看。你喜歡遠遠看全景，還是靠近一點？', followUps: [
      { line: '我想看全景。', reply: '用全景按鈕就能回到城堡全貌。小羊也慢慢走回小路上。' },
      { line: '我想靠近一點。', reply: '試試拉近，再轉個角度。那些小塔和花草，近看還有不同細節呢。' },
    ] },
    { id: 'day', line: '你怎麼總是慢悠悠的？', reply: '咩，走一走，也停一停。你想一起歇歇，還是繼續探索？', followUps: [
      { line: '一起歇歇。', reply: '好呀。小羊輕輕點頭，陪你把步調放慢一點。' },
      { line: '我再去逛逛。', reply: '下次經過再聊！小羊晃晃耳朵，繼續自己的散步。' },
    ] },
  ],
};

/** Bounded local scripts only: a player line, a reply, a follow-up and a closing reply. */
export function getFriendDialogue(id: string) {
  const friend = AMBIENT_FRIENDS.find(candidate => candidate.id === id);
  if (!friend || !openings[id]) return undefined;
  return { friend, opening: openings[id], topics: topics[friend.kind] };
}
