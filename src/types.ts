export interface Service {
  id: string
  name: string
  price: number
  duration_minutes: number
}

export interface Bay {
  id: string
  name: string
}

export interface WorkPhoto {
  id: string
  url: string
  caption: string
}

export interface InfoCard {
  id: string
  title: string
  body: string
}

export interface TenantSettings {
  phone?: string
  address?: string
  about?: string
}

export interface Tenant {
  id: string
  slug: string
  name: string
  settings: TenantSettings
}
