// Users with access to beta / unreleased features.
// To grant access, add the user's Supabase user ID here.
// When features move to paid tiers, swap this check for a subscription_tier check.
const NETWORK_BETA_USERS = new Set([
  "2d3c3b87-d105-49b1-b2e0-f4cbbdad2a0f",
  "635d53bc-23f9-4086-a681-14aa2604a85d", 
  "423b55df-8ca4-4bc1-b4b3-0e1708e43417",
  "851f1158-c1ed-41ef-9c14-20a919e0db18"
]);

export function canAccessNetwork(userId: string | undefined): boolean {
  return !!userId && NETWORK_BETA_USERS.has(userId);
}
