import { describe, expect, it } from 'vitest';
import { AMBIENT_FRIENDS } from './ambientFriends';
import { getFriendDialogue } from './ambientDialogue';

describe('bounded fictional friend dialogue scripts', () => {
  it('gives all thirteen scene friends unique openings and every species two complete two-round topics', () => {
    const openings = new Set<string>(), speciesScripts = new Map<string, string>();
    for (const friend of AMBIENT_FRIENDS) {
      const script = getFriendDialogue(friend.id)!;
      expect(script.friend).toEqual(friend); expect(script.opening.trim()).not.toBe(''); openings.add(script.opening);
      expect(script.topics).toHaveLength(2); expect(new Set(script.topics.map(topic => topic.id)).size).toBe(2);
      speciesScripts.set(friend.kind, JSON.stringify(script.topics));
      for (const topic of script.topics) {
        expect(topic.line.length).toBeGreaterThan(2); expect(topic.reply.length).toBeGreaterThan(4); expect(topic.followUps).toHaveLength(2);
        expect(topic.followUps[0].line).not.toBe(topic.followUps[1].line);
        for (const followUp of topic.followUps) {
          expect(followUp.line.length).toBeGreaterThan(2); expect(followUp.reply.length).toBeGreaterThan(4);
          expect(followUp.reply.length).toBeLessThan(110); expect(Object.keys(followUp).sort()).toEqual(['line', 'reply']);
        }
      }
    }
    expect(openings.size).toBe(13); expect(new Set(speciesScripts.values()).size).toBe(5);
  });
  it('does not derive conversations from a real avatar, user id or arbitrary input', () => {
    expect(getFriendDialogue('member-123')).toBeUndefined(); expect(getFriendDialogue('')).toBeUndefined(); expect(getFriendDialogue('__proto__')).toBeUndefined();
  });
});
