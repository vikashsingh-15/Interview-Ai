import axios from 'axios';

const api = axios.create({ baseURL:'/api', withCredentials:true });
export default api;

export const QUESTION_GENERATION_ERROR = "We couldn't generate interview questions right now. Please try again in a moment.";
export function logQuestionGenerationError(operation: string, error: any): string {
  const response = error?.response;
  const event = { operation, category: response ? `http_${response.status}` : error?.code === 'ECONNABORTED' ? 'timeout' : 'network_or_runtime', status: response?.status, code: error?.code, requestId: response?.headers?.['x-request-id'] || error?.config?.headers?.['X-Request-ID'] };
  console.error('[QUESTION_GENERATION_FAILURE]', event);
  void fetch('/api/client-errors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event), keepalive: true }).catch(() => undefined);
  return QUESTION_GENERATION_ERROR;
}

// Correlation: every backend failure can be traced to the exact Render log
// line that shares this request ID. The backend accepts an inbound
// X-Request-ID and returns it as a response header.
export function randomRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

api.interceptors.request.use((config) => {
  if (!config.headers['X-Request-ID']) config.headers['X-Request-ID'] = randomRequestId();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestId = error.config?.headers?.['X-Request-ID'];
    const method = error.config?.method?.toUpperCase();
    const url = error.config?.url;
    const status = error.response?.status;
    console.error('[API_FAILURE]', { method, url, status: status || 'no-response', requestId: requestId || 'none' });
    void fetch('/api/client-errors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: `${method || 'UNKNOWN'} ${url || 'unknown'}`, category: status ? `http_${status}` : 'network_or_runtime', status, requestId: requestId || 'none' }), keepalive: true }).catch(() => undefined);
    // Prefer the server's own id when present; the client id is a fallback so
    // even a response without a body can still be reported.
    if (requestId && error.response?.data && typeof error.response.data === 'object'
      && !(error.response.data as any).requestId) {
      (error.response.data as any).requestId = requestId;
    }
    return Promise.reject(error);
  },
);

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
