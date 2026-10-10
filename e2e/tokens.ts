// Fixed secret links seeded by scripts/e2e-setup.mts. Real tokens are random; these are
// 43 URL-safe characters so they pass the same shape check.
const pad = (name: string) => name.padEnd(43, "-");

export const E2E_TOKENS = {
  owner: pad("e2e-owner-link"),
  invite: pad("e2e-invite-link"),
  revokedInvite: pad("e2e-revoked-invite"),
  expiredInvite: pad("e2e-expired-invite"),
} as const;
