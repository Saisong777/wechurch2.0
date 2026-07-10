export type IdentitySourceType = "user" | "participant" | "potential_member" | "care_contact";

export interface IdentitySeedInput {
  sourceType: IdentitySourceType;
  sourceId: string;
  email?: string | null;
  name?: string | null;
  displayName?: string | null;
  church?: string | null;
  status?: string | null;
}

export interface PersonSeed {
  displayName: string;
  primaryEmail: string | null;
  church: string | null;
  pastoralStage: string;
  pastoralStatus: string;
}

export function normalizeIdentityEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;
  return normalized;
}

export function getIdentityMatchKey(input: IdentitySeedInput) {
  const email = normalizeIdentityEmail(input.email);
  if (email) return `email:${email}`;
  return `${input.sourceType}:${input.sourceId}`;
}

export function buildPersonSeed(input: IdentitySeedInput): PersonSeed {
  const primaryEmail = normalizeIdentityEmail(input.email);
  const displayName = (
    input.displayName?.trim()
    || input.name?.trim()
    || primaryEmail?.split("@")[0]
    || "未命名對象"
  );
  const status = input.status?.trim();

  return {
    displayName,
    primaryEmail,
    church: input.church?.trim() || null,
    pastoralStage: getDefaultPastoralStage(input.sourceType, status),
    pastoralStatus: status === "declined" ? "inactive" : "active",
  };
}

function getDefaultPastoralStage(sourceType: IdentitySourceType, status?: string | null) {
  if (status === "declined") return "inactive";
  if (status === "member") return "family";
  if (sourceType === "user") return "family";
  if (sourceType === "potential_member" || sourceType === "participant") return "friend";
  if (sourceType === "care_contact") return "follow";
  return "unknown";
}

export function scoreIdentityConfidence(input: IdentitySeedInput) {
  if (normalizeIdentityEmail(input.email)) return 100;
  if (input.displayName?.trim() || input.name?.trim()) return 60;
  return 30;
}
