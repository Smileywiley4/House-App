/**
 * PropertyPulse API — single entry point for all backend operations.
 * Use this instead of importing base44 or Supabase directly so you can switch backends.
 * Safe to use from React (web) and React Native.
 *
 * Backend selection (first match wins):
 * - VITE_USE_PYTHON_BACKEND=true → Python FastAPI backend (VITE_API_BASE_URL, Supabase for auth)
 * - VITE_USE_SUPABASE=true → Supabase client-only (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 * - Otherwise → Base44 (current default)
 */
import { base44Adapter } from './adapters/base44Adapter.js';
import { createSupabaseAdapter } from './adapters/supabaseAdapter.js';
import { createPythonBackendAdapter } from './adapters/pythonBackendAdapter.js';

const usePythonBackend = import.meta.env.VITE_USE_PYTHON_BACKEND === 'true';
const useSupabase = import.meta.env.VITE_USE_SUPABASE === 'true';

export const api = usePythonBackend
  ? createPythonBackendAdapter()
  : useSupabase
    ? createSupabaseAdapter()
    : base44Adapter;

// Re-export types for consumers
export * from './types.js';
