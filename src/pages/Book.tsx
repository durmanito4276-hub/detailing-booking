import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { fetchTenant, fetchServices, fetchBays, fetchPhotos, fetchInfoCards } from '../api'
import { slotsForDay, fmtTime, fetchBusy, slotBusy, createBooking, CLOSE_HOUR } from '../booking'

function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}
function fmtDay(d: Date): string {
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function Book() {
  const { tenant = '' } = useParams()
  const navigate = useNavigate()

  const { data: t, isLoading: tLoad } = useQuery({ queryKey: ['tenant', tenant], queryFn: () => fetchTenant(tenant) })
  const tenantId = t?.id ?? ''
  const { data: services } = useQuery({ queryKey: ['services', tenantId], queryFn: () => fetchServices(tenantId), enabled: !!tenantId })
  const { data: bays } = useQuery({ queryKey: ['bays', tenantId], queryFn: () => fetchBays(tenantId), enabled: !!tenantId })
  const { data: photos } = useQuery({ queryKey: ['photos', tenantId], queryFn: () => fetchPhotos(tenantId), enabled: !!tenantId })
  const { data: cards } = useQuery({ queryKey: ['cards', tenantId], queryFn: () => fetchInfoCards(tenantId), enabled: !!tenantId })

  const [serviceIdx, setServiceIdx] = useState<number | null>(null)
  const [dayOffset, setDayOffset] = useState(0)
  const [bayIdx, setBayIdx] = useState<number | null>(null)
  const [slot, setSlot] = useState<Date | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [car, setCar] = useState('')
  const [sending, setSending] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const day = useMemo(() => addDays(new Date(), dayOffset), [dayOffset])
  const service = serviceIdx !== null && services ? services[serviceIdx] : undefined
  const bay = bayIdx !== null && bays ? bays[bayIdx] : undefined
  const duration = service?.duration_minutes ?? 60

  const { data: busy } = useQuery({
    queryKey: ['busy', bay?.id ?? '', day.toDateString()],
    queryFn: () => fetchBusy(bay!.id, day),
    enabled: !!bay,
  })

  const slots = useMemo(() => slotsForDay(day, duration), [day, duration])

  async function submit() {
    if (!service || !bay || !slot || !tenantId) return
    if (!name.trim() || !phone.trim() || !car.trim()) {
      setErrMsg('Заполните имя, телефон и автомобиль')
      return
    }
    setSending(true); setErrMsg('')
    try {
      const key = crypto.randomUUID()
      const token = await createBooking({
        tenantId, service, bay, startsAt: slot,
        customerName: name.trim(), customerPhone: phone.trim(), car: car.trim(),
        idempotencyKey: key,
      })
      navigate(`/${tenant}/booking/${token}`)
    } catch (e) {
      const msg = String((e as Error).message ?? e)
      setErrMsg(
        msg.includes('no_time_overlap') || msg.includes('duplicate')
          ? 'Увы, это время только что заняли. Выберите другое.'
          : 'Не удалось создать запись. Попробуйте ещё раз.'
      )
    } finally {
      setSending(false)
    }
  }

  if (tLoad) return <main className="container"><p className="muted">Загрузка…</p></main>
  if (!t) return <main className="container"><h1>Студия не найдена</h1><Link className="btn" to="/">На главную</Link></main>

  return (
    <main className="container">
      <h1>{t.name}</h1>
      {t.settings.about && <p className="muted">{t.settings.about}</p>}

      {cards && cards.length > 0 && (
        <div className="card">
          {cards.map((c) => (
            <p key={c.id}><strong>{c.title}:</strong> <span className="muted">{c.body}</span></p>
          ))}
        </div>
      )}

      <h2>1. Услуга</h2>
      {(services ?? []).map((s, i) => (
        <button key={s.id}
          className="card" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'block',
            borderColor: serviceIdx === i ? 'var(--accent)' : 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
          onClick={() => { setServiceIdx(i); setSlot(null); setBayIdx(null) }}>
          {s.name} — {s.price.toLocaleString('ru-RU')} ₽ · {Math.round(s.duration_minutes / 60)} ч
        </button>
      ))}

      {service && (
        <>
          <h2>2. День</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => {
              const d = addDays(new Date(), n)
              const hasSlots = slotsForDay(d, duration).length > 0
              return (
                <button key={n} disabled={!hasSlots}
                  className="card" style={{ flex: '1 1 80px', textAlign: 'center', cursor: 'pointer',
                    borderColor: dayOffset === n ? 'var(--accent)' : 'var(--border)',
                    background: 'var(--card)', color: 'var(--text)', padding: '10px 4px' }}
                  onClick={() => { setDayOffset(n); setSlot(null); setBayIdx(null) }}>
                  {fmtDay(d)}
                </button>
              )
            })}
          </div>
        </>
      )}

      {service && (bays ?? []).length > 0 && (
        <>
          <h2>3. Бокс</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {bays!.map((b, i) => (
              <button key={b.id}
                className="card" style={{ cursor: 'pointer',
                  borderColor: bayIdx === i ? 'var(--accent)' : 'var(--border)',
                  background: 'var(--card)', color: 'var(--text)', padding: '10px 16px' }}
                onClick={() => { setBayIdx(i); setSlot(null) }}>
                {b.name}
              </button>
            ))}
          </div>
        </>
      )}

      {service && bay && (
        <>
          <h2>4. Время</h2>
          {busy === undefined ? <p className="muted">Проверяем занятость…</p> : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {slots.map((s) => {
                const busySlot = slotBusy(s, duration, busy ?? [])
                return (
                  <button key={s.getTime()} disabled={busySlot}
                    className="card" style={{ cursor: busySlot ? 'not-allowed' : 'pointer', opacity: busySlot ? 0.4 : 1,
                      borderColor: slot?.getTime() === s.getTime() ? 'var(--accent)' : 'var(--border)',
                      background: 'var(--card)', color: 'var(--text)', padding: '10px 14px' }}
                    onClick={() => setSlot(s)}>
                    {fmtTime(s)}{busySlot ? ' (занято)' : ''}
                  </button>
                )
              })}
              {slots.length === 0 && <p className="muted">Нет доступных слотов (услуга до {CLOSE_HOUR}:00 не помещается).</p>}
            </div>
          )}
        </>
      )}

      {service && bay && slot && (
        <>
          <h2>5. Ваши данные</h2>
          <label>Имя<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван" /></label>
          <label>Телефон<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 900 123-45-67" inputMode="tel" /></label>
          <label>Автомобиль<input value={car} onChange={(e) => setCar(e.target.value)} placeholder="BMW X5, чёрный" /></label>
          <div className="card">
            <p><strong>{service.name}</strong></p>
            <p className="muted">{bay.name} · {fmtDay(day)} в {fmtTime(slot)} · {service.price.toLocaleString('ru-RU')} ₽</p>
          </div>
          {errMsg && <p className="error">{errMsg}</p>}
          <button className="btn" onClick={submit} disabled={sending}>
            {sending ? 'Отправляем…' : 'Записаться'}
          </button>
        </>
      )}

      {photos && photos.length > 0 && (
        <>
          <h2>Наши работы</h2>
          {photos.map((p) => (
            <div key={p.id} className="card">
              <img src={p.url} alt={p.caption} style={{ width: '100%', borderRadius: '10px' }} />
              <p className="muted">{p.caption}</p>
            </div>
          ))}
        </>
      )}

      {t.settings.phone && <p className="muted">Вопросы? Звоните: {t.settings.phone}</p>}
    </main>
  )
}
