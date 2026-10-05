export function groupLeaderNames(group: { leaderName?: string | null; coLeaderName?: string | null }): string {
  return [group.leaderName, group.coLeaderName].filter(Boolean).join('、') || '尚未指派';
}
