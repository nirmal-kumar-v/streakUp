/**
 * Safely extracts a user-readable string error message from any error or API response.
 * Completely prevents React Minified Error #31 (attempting to render object as React child).
 */
export function extractErrorMessage(err: unknown, fallback: string = 'An unexpected error occurred.'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  if (typeof err === 'object') {
    const e = err as Record<string, any>;

    // Handle Axios error response
    if (e.response?.data) {
      const data = e.response.data;

      if (typeof data === 'string') return data;
      if (typeof data.error === 'string') return data.error;
      if (typeof data.error?.message === 'string') return data.error.message;
      if (typeof data.message === 'string') return data.message;
      if (typeof data.error === 'object' && data.error !== null) {
        if (typeof data.error.code === 'string') {
          return `${data.error.code}: ${data.error.message || 'Server request failed'}`;
        }
        try {
          return JSON.stringify(data.error);
        } catch {
          // fallback
        }
      }
    }

    if (typeof e.error === 'string') return e.error;
    if (typeof e.message === 'string') return e.message;
  }

  return fallback;
}
