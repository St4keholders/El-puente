export function formatDistanceToNow(date: Date | string | number): string {
  const d = new Date(date);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 60) {
    return "hace un momento";
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `hace ${diffMin} min`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `hace ${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `hace ${diffDays} d`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return `hace ${diffWeeks} sem`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `hace ${diffMonths} m`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `hace ${diffYears} a`;
}
