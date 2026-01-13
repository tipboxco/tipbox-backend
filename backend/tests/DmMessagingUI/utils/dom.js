// DOM Utility Functions
export function setLoading(button, loading) {
  if (!button) return;
  button.disabled = loading;
  button.dataset.loading = loading ? 'true' : 'false';
}

