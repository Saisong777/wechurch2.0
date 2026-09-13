// Both invitation access and answer sharing require the current group relationship.
export const mentoringGroupEligibleSql=`EXISTS(SELECT 1 FROM small_groups g WHERE g.id=c.group_id AND g.is_active
  AND (g.leader_user_id=c.mentor_id OR g.pastor_user_id=c.mentor_id)
  AND (g.leader_user_id=c.learner_id OR g.pastor_user_id=c.learner_id OR EXISTS(SELECT 1 FROM small_group_members m WHERE m.group_id=g.id AND m.user_id=c.learner_id AND m.is_active)))`;
