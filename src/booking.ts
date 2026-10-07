import { supabase } from './supabase'
import type { Service, Bay } from './types'

export const CLOSE_HOUR = 20
export const SLOT_MINUTES = 60

export function getOpenTime(date: Date): number | null {
  const day = date.getDay()
  if (day === 0) return null
  return 10
}

export function slotsForDay(date: Date, durationMinutes: number): Date[] {
  const open = getOpenTime(date)
  if (open === null) return []
  const out: Date[] = []
  let t = new Date(date)
  t.setHours(open, 0, 0, 0)
  while (true) {
    const end = new Date(t.getTime() + durationMinutes * 60000)
    if (end.getHours() > CLOSE_HOUR || (end.getHours() === CLOSE_HOUR && end.getMinutes() > 0)) break
    out.push(new Date(t))
    t = new Date(t.getTime() + SLOT_MINUTES * 60000)
  }
  return out
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export async function fetchBusy(bayId: string, day: Date): Promise<{ start: string; end: string }[]> {
  const start = new Date(day); start.setHours(0, 0, 0, 0)
  const end = new Date(day); end.setHours(23, 59, 59, 999)
  const { data, error } = await supabase
    .from('bookings')
    .select('starts_at, ends_at')
    .eq('bay_id', bayId)
    .neq('status', 'cancelled')
    .gte('starts_at', start.toISOString())
    .lte('starts_at', end.toISOString())
  if (error) throw error
  return (data as { starts_at: string; ends_at: string }[])
}

export function slotBusy(slot: Date, durationMinutes: number, busy: { start: string; end: string }[]): boolean {
  const slotEnd = slot.getTime() + durationMinutes * 60000
  return busy.some((b) => {
    const s = new Date(b.start).getTime()
    const e = new Date(b.end).getTime()
    return slot.getTime() < e && slotEnd > s
  })
}

export async function createBooking(params: {
  tenantId: string
  service: Service
  bay: Bay
  startsAt: Date
  customerName: string
  customerPhone: string
  car: string
  idempotencyKey: string
}): Promise<string> {
  const { service, bay, startsAt } = params
  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60000)
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      tenant_id: params.tenantId,
      service_id: service.id,
      bay_id: bay.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      customer_name: params.customerName,
      customer_phone: params.customerPhone,
      car: params.car,
      idempotency_key: params.idempotencyKey,
    })
    .select('cancel_token')
    .single()
  if (error) throw error
  return data.cancel_token as string
}
