import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { fetchTenant, fetchServices, fetchBays } from '../api'

interface AdminBooking {
  id: string
  tenant_id: string
  starts_at: string
  ends_at: string
  customer_name: string
  customer_phone: string
  car: string
  status: string
  services: { name: string; price: number } | null
  bays: { name: string } | null
}

function fmtDay(d: Date) {
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export default function Admin() {
  const { tenant = '' } = useParams()
  const qc = useQueryClient()
  const [session, setSession] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [shift, setShift] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const { data: t } = useQuery({ queryKey: ['tenant', tenant], queryFn: () => fetchTenant(tenant) })
  const tenantId = t?.id ?? ''

  const { data: services } = useQuery({
    queryKey: ['services', tenantId], queryFn: () => fetchServices(tenantId), enabled: !!tenantId,
  })
  const { data: bays } = useQuery({
    queryKey: ['bays', tenantId], queryFn: () => fetchBays(tenantId), enabled: !!tenantId,
  })

  const [from, to] = useMemo(() => {
    const now = new Date()
    if (mode === 'day') {
      const f = new Date(now); f.setDate(f.getDate() + shift); f.setHours(0, 0, 0, 0)
      const e = new Date(f); e.setHours(23, 59, 59, 999)
      return [f, e]
    }
    const monday = new Date(now)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + shift * 7)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return [monday, sunday]
  }, [mode, shift])

  const { data: bookings, isLoading, refetch } = useQuery({
    queryKey: ['admin-bookings', tenantId, from.toISOString()],
    enabled: !!session && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, services(name, price), bays(name)')
        .eq('tenant_id', tenantId)
        .gte('starts_at', from.toISOString())
        .lte('starts_at', to.toISOString())
        .order('starts_at')
      if (error) throw error
      return data as AdminBooking[]
    },
  })

  const { data: payments } = useQuery({
    queryKey: ['admin-payments', tenantId, from.toISOString()],
    enabled: !!session && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments').select('amount, kind')
        .eq('tenant_id', tenantId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
      if (error) throw error
      return data as { amount: number; kind: string }[]
    },
  })

  async function login(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert('Не удалось войти: ' + error.message)
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id)
    if (error) { alert('Не удалось изменить: ' + error.message); return }
    refetch()
  }

  async function addMoney(b: AdminBooking, kind: 'payment' | 'refund') {
    const def = b.services?.price ?? 0
    const input = window.prompt(
      kind === 'payment' ? 'Сумма оплаты (₽):' : 'Сумма возврата (₽):', String(def))
    if (input === null) return
    const amount = Number(input)
    if (!amount || amount <= 0) { alert('Введите число больше 0'); return }
    const { error } = await supabase.from('payments').insert({
      tenant_id: b.tenant_id, booking_id: b.id, amount, kind,
    })
    if (error) { alert('Ошибка: ' + error.message); return }
    qc.invalidateQueries({ queryKey: ['admin-payments'] })
  }

  async function addBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const serviceId = String(f.get('service'))
    const bayId = String(f.get('bay'))
    const dateStr = String(f.get('date'))
    const timeStr = String(f.get('time'))
    const svc = (services ?? []).find((s) => s.id === serviceId)
    if (!svc || !tenantId || !dateStr || !timeStr) return
    const startsAt = new Date(`${dateStr}T${timeStr}:00`)
    const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60000)
    const { error } = await supabase.from('bookings').insert({
      tenant_id: tenantId,
      service_id: serviceId,
      bay_id: bayId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      customer_name: String(f.get('name')),
      customer_phone: String(f.get('phone')),
      car: String(f.get('car')),
    })
    if (error) { alert('Не удалось создать: ' + error.message); return }
    e.currentTarget.reset()
    refetch()
  }

  if (authLoading) return <main className="container"><p className="muted">Загрузка…</p></main>

  if (!session) return (
    <main className="container" style={{ maxWidth: 380, paddingTop: 60 }}>
      <h1>Кабинет владельца</h1>
      <form onSubmit={login}>
        <label>Почта
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>Пароль
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        <button className="btn" type="submit">Войти</button>
      </form>
    </main>
  )

  const active = (bookings ?? []).filter((b) => b.status !== 'cancelled')
  const done = active.filter((b) => b.status === 'done').length
  const money = (payments ?? []).reduce(
    (s, p) => s + (p.kind === 'payment' ? p.amount : -p.amount), 0)

  return (
    <main className="container">
      <h1>{t?.name ?? 'Кабинет'}</h1>

      <div className="card">
        <p>Заездов: <strong>{active.length}</strong></p>
        <p>Завершено: <strong>{done}</strong></p>
        <p>Получено денег: <strong>{money.toLocaleString('ru-RU')} ₽</strong></p>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="card" style={{ cursor: 'pointer', padding: '8px 12px',
          borderColor: mode === 'day' ? 'var(--accent)' : 'var(--border)' }}
          onClick={() => setMode('day')}>День</button>
        <button className="card" style={{ cursor: 'pointer', padding: '8px 12px',
          borderColor: mode === 'week' ? 'var(--accent)' : 'var(--border)' }}
          onClick={() => setMode('week')}>Неделя</button>
        <button className="card" style={{ cursor: 'pointer', padding: '8px 12px' }}
          onClick={() => setShift((s) => s - 1)}>←</button>
        <button className="card" style={{ cursor: 'pointer', padding: '8px 12px' }}
          onClick={() => setShift(0)}>Сегодня</button>
        <button className="card" style={{ cursor: 'pointer', padding: '8px 12px' }}
          onClick={() => setShift((s) => s + 1)}>→</button>
      </div>
      <p className="muted">
        {fmtDay(from)}{mode === 'week' ? ` — ${fmtDay(to)}` : ''}
      </p>

      {isLoading && <p className="muted">Загрузка…</p>}
      {(bookings ?? []).map((b) => (
        <div key={b.id} className="card">
          <p><strong>{b.services?.name}</strong> — {b.services?.price.toLocaleString('ru-RU')} ₽</p>
          <p className="muted">{fmtDay(new Date(b.starts_at))} · {fmtTime(b.starts_at)}–{fmtTime(b.ends_at)} · {b.bays?.name}</p>
          <p className="muted">{b.customer_name}, {b.customer_phone}, {b.car}</p>
          <p><strong>{
            b.status === 'booked' ? 'Записана' :
            b.status === 'accepted' ? 'Машина принята' :
            b.status === 'done' ? 'Готова' : 'Отменена'
          }</strong></p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {b.status === 'booked' && (
              <button className="btn secondary" style={{ width: 'auto' }}
                onClick={() => setStatus(b.id, 'accepted')}>Принять машину</button>
            )}
            {b.status === 'accepted' && (
              <button className="btn secondary" style={{ width: 'auto' }}
                onClick={() => setStatus(b.id, 'done')}>Работа готова</button>
            )}
            {b.status !== 'cancelled' && b.status !== 'done' && (
              <button className="btn secondary" style={{ width: 'auto' }}
                onClick={() => { if (window.confirm('Отменить запись?')) setStatus(b.id, 'cancelled') }}>
                Отменить</button>
            )}
            <button className="btn secondary" style={{ width: 'auto' }}
              onClick={() => addMoney(b, 'payment')}>Оплата</button>
            <button className="btn secondary" style={{ width: 'auto' }}
              onClick={() => addMoney(b, 'refund')}>Возврат</button>
          </div>
        </div>
      ))}
      {!isLoading && (bookings ?? []).length === 0 && (
        <p className="muted">Записей за этот период нет.</p>
      )}

      <h2>Добавить запись вручную</h2>
      <form className="card" onSubmit={addBooking}>
        <label>Услуга
          <select name="service" required>
            <option value="">— выберите —</option>
            {(services ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({Math.round(s.duration_minutes / 60)} ч)</option>
            ))}
          </select>
        </label>
        <label>Бокс
          <select name="bay" required>
            <option value="">— выберите —</option>
            {(bays ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label>Дата<input name="date" type="date" required /></label>
        <label>Время<input name="time" type="time" required /></label>
        <label>Имя клиента<input name="name" required /></label>
        <label>Телефон<input name="phone" required /></label>
        <label>Автомобиль<input name="car" required /></label>
        <button className="btn" type="submit">Создать запись</button>
      </form>

      <p><Link className="btn secondary" to={`/${tenant}/admin/settings`}>Настройки студии</Link></p>
      <p>
        <button className="btn secondary" onClick={() => supabase.auth.signOut()}>
          Выйти
        </button>
      </p>
    </main>
  )
}
