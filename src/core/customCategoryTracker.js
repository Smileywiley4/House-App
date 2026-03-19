const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function trackCustomCategory(label) {
  if (!baseUrl || !label?.trim()) return;
  fetch(`${baseUrl}/api/analytics/custom-category`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: label.trim() }),
  }).catch(() => {});
}
