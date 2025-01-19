import { createClient } from '@supabase/supabase-js';
import dotenv from '../../utils/dotenv';

// Initialize Supabase client
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);