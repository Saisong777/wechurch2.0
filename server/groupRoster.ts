import { selectedChurch } from './churchContext';
import { getChurchAliases } from './churches';

// Counts registered accounts, not handwritten names or unlinked email entries.
// All three group lists use the same roster and deduplicate leader membership.
export function registeredGroupCount(groupAlias = 'g') {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(groupAlias)) throw new Error('Invalid group alias');
  const aliases = getChurchAliases(selectedChurch()).map(value => "'" + value.replaceAll("'", "''") + "'").join(',');
  return `(SELECT count(DISTINCT account.id)::int FROM users account JOIN (
    SELECT user_id AS uid FROM small_group_members WHERE group_id=${groupAlias}.id AND is_active
    UNION SELECT ${groupAlias}.leader_user_id UNION SELECT ${groupAlias}.co_leader_user_id UNION SELECT ${groupAlias}.pastor_user_id
    ) roster ON roster.uid=account.id WHERE account.church IN (${aliases}))`;
}
