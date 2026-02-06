// Utility to get the correct API base URL
export function getApiUrl(path: string): string {
  // If VITE_API_URL is set (ngrok/production), use it
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}${path}`;
  }
  
  // Otherwise use relative URL (works with Vite proxy in local dev)
  return path;
}
