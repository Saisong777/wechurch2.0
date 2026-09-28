export const UNASSIGNED_CHURCH_ID = '__unassigned';

// Keep the persisted identifier stable; display names can change independently.
export const churchCatalog = [{
  id: 'IM 行動教會',
  name: 'iM行動教會',
  aliases: ['IM行動教會', 'iM行動教會', 'iM 行動教會', "i'M church", 'i’M church', 'Im', 'IM'],
}] as const;

const compact = (value: string) => value.trim().toLowerCase().replace(/[\s'’]/g, '');

export function normalizeChurch(church?: string | null): string | null {
  const value = typeof church === 'string' ? church.trim() : '';
  if (!value) return null;
  const item = churchCatalog.find(c => [c.id, ...c.aliases].some(alias => compact(alias) === compact(value)));
  // Unknown historical scopes must never be silently reassigned to the active church.
  return item?.id || value;
}

export function getChurchAliases(church?: string | null): string[] {
  const id = normalizeChurch(church);
  if (!id || id === UNASSIGNED_CHURCH_ID) return [];
  const item = churchCatalog.find(c => c.id === id);
  return item ? [item.id, ...item.aliases] : [id];
}

export function getKnownChurchOptions() {
  return churchCatalog.map(({ id, name }) => ({ id, name }));
}

export function churchDisplayName(church?: string | null): string {
  const id = normalizeChurch(church);
  return churchCatalog.find(c => c.id === id)?.name || church || '';
}
