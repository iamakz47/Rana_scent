import "server-only";

// Reporting window for the finance page (request-time; Kuwait is UTC+3).
export function financeWindow() {
  const now = Date.now();
  return {
    since30Days: now - 30 * 24 * 3600_000,
    todayKuwait: new Date(now + 3 * 3600_000).toISOString().slice(0, 10),
  };
}
