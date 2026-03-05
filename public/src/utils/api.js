import axios from 'axios'
import { auth } from './firebase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
})

// ─── 401 Retry Queue ─────────────────────────────────
// Prevents infinite retry loops and serializes token refreshes
let isRefreshing = false
let failedQueue = []

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token)
    }
  })
  failedQueue = []
}

// ─── Request Interceptor ─────────────────────────────
api.interceptors.request.use(
  async (config) => {
    try {
      // Wait for Firebase Auth to initialize
      await auth.authStateReady()

      // Get current user and token
      const user = auth.currentUser
      if (user) {
        // Get valid token (automatically refreshes if expired)
        const token = await user.getIdToken()
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;

        // Tenant Slug Injection:
        // Automatically detect if we are in a tenant-scoped route (e.g., /mumaz/dashboard)
        // and prepend the slug to the API request if it's not already there.
        const pathSegments = window.location.pathname.split('/');
        const firstSegment = pathSegments[1];

        // Global routes that should NEVER be slug-prefixed
        const globalRoutes = [
          'auth', 'login', 'register', 'choose-business', 'choose-role',
          'business-registration', 'account-review', 'accept-invite',
          'marketplace', 'verify-email', 'mfa-onboarding',
          'verify-2fa', 'forgot-password', 'reset-password', 'client',
          'dashboard', 'admin', 'notifications', 'system', 'system-health',
          'share', 'pay', 'contracts',
          'account-settings', 'app-customization', 'number-format-settings',
          'clients', 'work-orders', 'invoices', 'properties', 'scheduling',
          'estimates', 'services', 'products', 'materials', 'employees',
          'crew-mobile', 'quickbooks', 'business-reports', 'reports',
          'analytics', 'audit-log', 'job-workflows',
          'undefined', 'null', ''
        ];

        let prefixApplied = false;
        // API endpoints that are global (not tenant-scoped)
        const globalApiEndpoints = [
          '/businesses', '/auth', '/admin-support', '/packages',
          '/payments', '/quickbooks', '/marketplace', '/system', '/clients'
        ];
        const isGlobalApi = globalApiEndpoints.some(endpoint => config.url.startsWith(endpoint));

        if (firstSegment && !globalRoutes.includes(firstSegment) && !isGlobalApi) {
          prefixApplied = true;
          if (!config.url.startsWith('/') && !config.url.startsWith('http')) {
            config.url = `/${firstSegment}/${config.url}`;
          } else if (config.url.startsWith('/')) {
            config.url = `/${firstSegment}${config.url}`;
          }
        }

        // Only log if something interesting happened
        if (prefixApplied || (firstSegment && !globalRoutes.includes(firstSegment))) {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
            hasToken: !!token,
            firstSegment,
            prefixApplied
          });
        }
      } else {
        // Public endpoints called before login — no token needed, suppress warning
        const publicEndpoints = [
          '/auth/login', '/auth/check-user', '/auth/google-lookup',
          '/auth/verify-firebase-token', '/auth/register'
        ];
        const isPublic = publicEndpoints.some(ep => config.url.includes(ep));
        if (!isPublic) {
          console.warn(`[API] Token missing for ${config.url}`);
        }
      }
    } catch (error) {
      console.error('Error in API request interceptor:', error);
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// ─── Response Interceptor (with retry queue) ─────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Skip retry for MFA-required responses
    const isMfaError = error.response?.data?.error === '2fa_required' ||
      error.response?.data?.error === 'mfa_required';

    if (error.response?.status === 401 && !originalRequest._retry && !isMfaError) {
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`
          return api(originalRequest)
        }).catch((err) => {
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await auth.authStateReady()
        const user = auth.currentUser

        if (user) {
          // Force refresh token to pick up latest claims
          const newToken = await user.getIdToken(true)

          // Update defaults and original request
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`

          // Resolve all queued requests with the new token
          processQueue(null, newToken)
          isRefreshing = false

          // Retry the original request
          return api(originalRequest)
        } else {
          // User is logged out — redirect to login (don't loop)
          processQueue(new Error('User not authenticated'))
          isRefreshing = false
          window.location.href = '/login'
          return Promise.reject(error)
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError)
        processQueue(refreshError)
        isRefreshing = false

        // If refresh itself fails, redirect to login (don't loop)
        if (refreshError.code === 'auth/user-token-expired' ||
          refreshError.code === 'auth/user-disabled') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }

    // Log errors for debugging
    if (error.response) {
      console.error('API Error Response:', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url
      })
    } else if (error.request) {
      console.error('API Request Error:', error.request)
    } else {
      console.error('API Error:', error.message)
    }

    return Promise.reject(error)
  }
)

export default api
