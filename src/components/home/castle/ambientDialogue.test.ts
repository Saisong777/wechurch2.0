import {describe,expect,it} from 'vitest';
import {AMBIENT_FRIENDS} from './ambientFriends';
import {getFriendSpeech} from './ambientDialogue';
describe('finite RPG character speech',()=>{
 it('gives all thirteen real scene characters a distinct opening and three short character-only lines',()=>{
  const openings=new Set<string>();
  for(const friend of AMBIENT_FRIENDS){const speech=getFriendSpeech(friend.id)!;expect(speech.friend).toBe(friend);expect(speech.lines).toHaveLength(3);openings.add(speech.lines[0]);for(const line of speech.lines){expect(line.length).toBeGreaterThan(5);expect(line.length).toBeLessThanOrEqual(40);expect(line).not.toMatch(/玩家：|你說：|積分|上線|診斷/);}}
  expect(openings.size).toBe(13);expect(new Set(AMBIENT_FRIENDS.map(friend=>friend.kind)).size).toBe(5);
 });
 it('does not invent a character for a real avatar or unknown id',()=>{expect(getFriendSpeech('real-avatar')).toBeUndefined();expect(getFriendSpeech('')).toBeUndefined();});
});
