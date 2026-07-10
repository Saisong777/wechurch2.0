export const UNASSIGNED_CHURCH_ID = "__unassigned";

export const churchCatalog = [
  {
    id: "IM 行動教會",
    name: "IM 行動教會",
    aliases: ["IM行動教會", "iM行動教會", "iM 行動教會", "i'M church", "i’M church", "Im", "IM"],
  },
  {
    id: "火樂",
    name: "火樂",
    aliases: ["火樂教會"],
  },
  {
    id: "WeChurch 桃園",
    name: "WeChurch 桃園",
    aliases: ["WeChurch桃園", "wechurch 桃園"],
  },
] as const;

const compactChurchName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s'’]/g, "");

export function normalizeChurch(church?: string | null): string | null {
  const trimmed = typeof church === "string" ? church.trim() : "";
  if (!trimmed) return null;
  if (trimmed === UNASSIGNED_CHURCH_ID) return UNASSIGNED_CHURCH_ID;

  const compacted = compactChurchName(trimmed);
  for (const item of churchCatalog) {
    const candidates = [item.id, ...item.aliases];
    if (candidates.some((candidate) => compactChurchName(candidate) === compacted)) {
      return item.id;
    }
  }

  return trimmed;
}

export function getChurchAliases(church?: string | null): string[] {
  const normalized = normalizeChurch(church);
  if (!normalized || normalized === UNASSIGNED_CHURCH_ID) return [];

  const catalogItem = churchCatalog.find((item) => item.id === normalized);
  return catalogItem ? [catalogItem.id, ...catalogItem.aliases] : [normalized];
}

export function getKnownChurchOptions() {
  return churchCatalog.map(({ id, name }) => ({ id, name }));
}
