// Users with access to beta / unreleased features.
// To grant access, add the user's Supabase user ID here.
// When features move to paid tiers, swap this check for a subscription_tier check.
const NETWORK_BETA_USERS = new Set([
  "2d3c3b87-d105-49b1-b2e0-f4cbbdad2a0f",
]);

export function canAccessNetwork(userId: string | undefined): boolean {
  return !!userId && NETWORK_BETA_USERS.has(userId);
}
