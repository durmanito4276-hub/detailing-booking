import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Отдельный клиент с секретным токеном записи — для страницы "Моя запись"
export function clientForToken(cancelToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { 'x-cancel-token': cancelToken } },
  })
}
