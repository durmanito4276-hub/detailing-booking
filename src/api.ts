import { supabase } from './supabase'
import type { Tenant, Service, Bay, WorkPhoto, InfoCard } from './types'

export async function fetchTenants(): Promise<Tenant[]> {
  const { data, error } = await supabase.from('tenants').select('id, slug, name, settings')
  if (error) throw error
  return data as Tenant[]
}

export async function fetchTenant(slug: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name, settings')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data as Tenant | null
}

export async function fetchServices(tenantId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('sort')
  if (error) throw error
  return data as Service[]
}

export async function fetchBays(tenantId: string): Promise<Bay[]> {
  const { data, error } = await supabase
    .from('bays')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .order('sort')
  if (error) throw error
  return data as Bay[]
}

export async function fetchPhotos(tenantId: string): Promise<WorkPhoto[]> {
  const { data, error } = await supabase
    .from('work_photos')
    .select('id, url, caption')
    .eq('tenant_id', tenantId)
    .order('sort')
  if (error) throw error
  return data as WorkPhoto[]
}

export async function fetchInfoCards(tenantId: string): Promise<InfoCard[]> {
  const { data, error } = await supabase
    .from('info_cards')
    .select('id, title, body')
    .eq('tenant_id', tenantId)
    .order('sort')
  if (error) throw error
  return data as InfoCard[]
}
