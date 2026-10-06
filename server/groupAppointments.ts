import { pool } from './db';
import { churchContext } from './churchContext';
import { getChurchAliases, normalizeChurch } from './churches';
import type { GroupAppointment } from '../shared/accessControl';

// Read the appointment itself on every request. Display names and account roles
// never create a group appointment, and removing a slot needs no grant cleanup.
export async function activeGroupAppointments(userId: string): Promise<GroupAppointment[]> {
  const own = (await pool.query('SELECT church FROM users WHERE id=$1', [userId])).rows[0];
  const church = normalizeChurch(own?.church);
  if (!church || (churchContext() && churchContext()?.selectedChurch !== church)) return [];
  const groups = (await pool.query(`SELECT id,name,church,leader_user_id,co_leader_user_id,pastor_user_id
    FROM small_groups WHERE is_active AND lifecycle IN ('active','paused') AND church=ANY($2::text[])
      AND (leader_user_id=$1 OR co_leader_user_id=$1 OR pastor_user_id=$1)`, [userId, getChurchAliases(church)])).rows;
  return groups.filter(g => normalizeChurch(g.church) === church).map(g => ({
    groupId: g.id, groupName: g.name,
    role: g.leader_user_id === userId || g.co_leader_user_id === userId ? 'group_leader' : 'pastor',
  }));
}
