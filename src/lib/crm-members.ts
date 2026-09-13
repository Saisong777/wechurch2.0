import type { AppRole } from '@/hooks/useUserRole';
import type { PotentialMember, UnifiedMember } from '@/hooks/useUnifiedMembers';

export interface CrmUser {
  id: string;
  email: string | null;
  displayName: string | null;
  church: string | null;
  createdAt: string;
}

export interface CrmSnapshot {
  users: CrmUser[];
  roles: { userId: string; role: AppRole }[];
  potentialMembers: PotentialMember[];
}

export const crmRoleLabels: Record<AppRole, string> = {
  admin: '系統管理員', senior_pastor: '主任牧師', pastor: '牧師',
  minister: '傳道人', group_leader: '小組長', leader: '小組長',
  future_leader: '儲備領袖', member: '會友 成員',
};
const statusLabels = { pending: '待跟進', member: '已轉換', declined: '已婉拒' };
const roleOrder: Record<AppRole, number> = {
  admin: 0, senior_pastor: 1, pastor: 2, minister: 3, group_leader: 4,
  leader: 4, future_leader: 5, member: 6,
};

export function mergeCrmMembers({ users, roles, potentialMembers }: CrmSnapshot): UnifiedMember[] {
  const roleByUser = new Map(roles.map(row => [row.userId, row.role]));
  const contactByUser = new Map<string, PotentialMember>();
  for (const contact of potentialMembers) {
    if (contact.userId && !contactByUser.has(contact.userId)) contactByUser.set(contact.userId, contact);
  }
  const members: UnifiedMember[] = users.map(user => {
    const contact = contactByUser.get(user.id);
    return {
      id: user.id, type: 'registered', userId: user.id,
      email: user.email || '', name: user.displayName || user.email?.split('@')[0] || '',
      gender: contact?.gender || null, church: user.church || contact?.church || null,
      role: roleByUser.get(user.id) || 'member', status: 'member',
      subscribed: contact?.subscribed ?? true, sessionsCount: contact?.sessionsCount || 0,
      firstJoinedAt: user.createdAt, lastSessionAt: contact?.lastSessionAt || null,
      createdAt: user.createdAt, potentialMemberId: contact?.id || null,
    };
  });
  for (const contact of potentialMembers) {
    if (contact.userId) continue;
    members.push({ ...contact, type: 'potential', role: null, userId: null, potentialMemberId: contact.id });
  }
  return members.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'registered' ? -1 : 1;
    const order = (a.role ? roleOrder[a.role] : 6) - (b.role ? roleOrder[b.role] : 6);
    return order || a.name.localeCompare(b.name, 'zh-Hant');
  });
}

export function filterCrmMembers(members: UnifiedMember[], filters: {
  tab: 'all' | 'registered' | 'potential' | 'incomplete';
  status?: PotentialMember['status'] | 'all'; role?: AppRole | 'all';
  subscribed?: boolean | 'all'; search?: string;
}) {
  const words = (filters.search || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return members.filter(member => {
    if (filters.tab === 'incomplete') return false;
    if (filters.tab !== 'all' && member.type !== filters.tab) return false;
    if (filters.status && filters.status !== 'all' && member.status !== filters.status) return false;
    if (filters.role && filters.role !== 'all') {
      const matchingRole = filters.role === 'group_leader'
        ? member.role === 'group_leader' || member.role === 'leader'
        : member.role === filters.role;
      if (!matchingRole) return false;
    }
    if (filters.subscribed !== undefined && filters.subscribed !== 'all' && member.subscribed !== filters.subscribed) return false;
    const haystack = [member.name, member.email, member.church, member.gender,
      member.role, member.role ? crmRoleLabels[member.role] : '', member.status,
      statusLabels[member.status], member.type === 'registered' ? '已註冊 會員' : '潛在會員',
    ].join(' ').toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  });
}

export function getCrmStats(snapshot: CrmSnapshot, members: UnifiedMember[], now = Date.now()) {
  const { users, potentialMembers: contacts } = snapshot;
  const since = (date: string | null, days: number) => !!date && Date.parse(date) >= now - days * 86400000 && Date.parse(date) <= now;
  const registered = members.filter(member => member.type === 'registered');
  const potential = members.filter(member => member.type === 'potential');
  return {
    totalCount: members.length, registeredCount: users.length,
    adminCount: registered.filter(m => m.role === 'admin' || m.role === 'senior_pastor').length,
    leaderCount: registered.filter(m => m.role && ['pastor', 'minister', 'group_leader', 'leader', 'future_leader'].includes(m.role)).length,
    potentialTotal: contacts.length,
    unlinkedCount: potential.length,
    linkedCount: contacts.filter(contact => !!contact.userId).length,
    pendingCount: potential.filter(m => m.status === 'pending').length,
    avgAttendance: contacts.length ? Math.round(contacts.reduce((sum, c) => sum + c.sessionsCount, 0) / contacts.length * 10) / 10 : 0,
    newThisWeek: members.filter(m => since(m.firstJoinedAt || m.createdAt, 7)).length,
    newThisMonth: members.filter(m => since(m.firstJoinedAt || m.createdAt, 30)).length,
    newRegisteredWeek: registered.filter(m => since(m.createdAt, 7)).length,
    newPotentialWeek: potential.filter(m => since(m.firstJoinedAt || m.createdAt, 7)).length,
  };
}

export function getMemberPage<T>(members: T[], requestedPage: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(members.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  return { page, pageCount, rows: members.slice((page - 1) * pageSize, page * pageSize) };
}

export type CrmBatchAction = { type: 'update'; updates: { status?: PotentialMember['status']; subscribed?: boolean } } | { type: 'delete' };

export async function runCrmBatch(ids: string[], action: CrmBatchAction, request: typeof fetch = fetch) {
  const succeeded: string[] = [];
  const failed: string[] = [];
  // Sequential writes keep database load bounded and each failure attributable.
  for (const id of new Set(ids)) {
    try {
      const response = await request(`/api/potential-members/${encodeURIComponent(id)}`, action.type === 'delete'
        ? { method: 'DELETE' }
        : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action.updates) });
      (response.ok ? succeeded : failed).push(id);
    } catch { failed.push(id); }
  }
  return { succeeded, failed };
}
