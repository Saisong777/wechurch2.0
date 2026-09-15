const key = 'wechurch:pending-group-invite';
export function groupInvitationFromHash(hash: string) {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('invite') || '';
  return /^[a-f0-9]{48}$/.test(token) ? token : '';
}
export function pendingGroupInvitation() {
  const token = groupInvitationFromHash(window.location.hash);
  try {
    if (token) sessionStorage.setItem(key, token);
    return token || sessionStorage.getItem(key) || '';
  } catch { return token; }
}
export function clearGroupInvitation() {
  try { sessionStorage.removeItem(key); } catch { /* No persistent browser storage. */ }
}
