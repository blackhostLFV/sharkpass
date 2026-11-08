// Private hosting diagnostic only. It never changes accounts or assigns roles.
export function reportPlatformAdminCandidate(store, username, log = console.log) {
  if (!username) return;
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) throw new Error("Invalid private account lookup.");
  const candidate = store.get("SELECT id FROM users WHERE username=?", username);
  log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "INFO",
    message: JSON.stringify({operation: "platform_admin_lookup", userId: candidate?.id ?? null}),
  }));
}
