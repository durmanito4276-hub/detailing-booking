import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { clientForToken } from '../supabase'

interface BookingInfo {
  starts_at: string
  customer_name: string
  customer_phone: string
  car: string
  status: string
}

export default function BookingView() {
  const { tenant = '', token = '' } = useParams()
  const [booking, setBooking] = useState<BookingInfo | null>(null)
  const [serviceName, setServiceName] = useState('')
  const [price, setPrice] = useState<number | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error' | 'notfound'>('loading')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    const client = clientForToken(token)
    client
      .from('bookings')
      .select('starts_at, customer_name, customer_phone, car, status, services(name, price)')
      .limit(1)
      .then(({ data, error }) => {
        if (error) { setLoadState('error'); return }
        if (!data || data.length === 0) { setLoadState('notfound'); return }
        const row = data[0]
        setBooking({
          starts_at: row.starts_at,
          customer_name: row.customer_name,
          customer_phone: row.customer_phone,
          car: row.car,
          status: row.status,
        })
        const svc = row.services as { name: string; price: number } | null
        if (svc) { setServiceName(svc.name); setPrice(svc.price) }
        setLoadState('ok')
      })
  }, [token])

  async function cancel() {
    if (!window.confirm('Точно отменить запись?')) return
    setCancelling(true)
    const client = clientForToken(token)
    const { error } = await client
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('status', 'booked')
    if (error) {
      alert('Не удалось отменить. Попробуйте ещё раз.')
      setCancelling(false)
      return
    }
    window.location.reload()
  }

  if (loadState === 'loading') return <main className="container"><p className="muted">Загрузка…</p></main>
  if (loadState !== 'ok' || !booking) return (
    <main className="container">
      <h1>Запись не найдена</h1>
      <p className="muted">Возможно, ссылка устарела или введена с ошибкой.</p>
      <Link className="btn" to={`/${tenant}/book`}>Записаться заново</Link>
    </main>
  )

  const start = new Date(booking.starts_at)
  return (
    <main className="container">
      <h1>Ваша запись</h1>
      <div className="card">
        <p><strong>{serviceName}</strong>{price !== null && <> — {price.toLocaleString('ru-RU')} ₽</>}</p>
        <p className="muted">
          {start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })} в{' '}
          {start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="muted">{booking.car}</p>
        <p className="muted">На имя: {booking.customer_name}, {booking.customer_phone}</p>
        <p><strong>{booking.status === 'cancelled' ? '❌ Отменена' : '✅ Активна'}</strong></p>
      </div>
      {booking.status === 'booked' && (
        <button className="btn secondary" onClick={cancel} disabled={cancelling}>
          {cancelling ? 'Отменяем…' : 'Отменить запись'}
        </button>
      )}
      <p className="muted" style={{ fontSize: 12 }}>Сохраните ссылку на эту страницу — по ней вы всегда сможете посмотреть или отменить запись.</p>
      <Link className="btn" to={`/${tenant}/book`}>Записаться ещё раз</Link>
    </main>
  )
}
