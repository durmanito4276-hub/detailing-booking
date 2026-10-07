import { useEffect, useMemo, useRef, useState } from 'react'
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
  const rootRef = useRef<HTMLElement>(null)

  const { data: t, isLoading: tLoad } = useQuery({ queryKey: ['tenant', tenant], queryFn: () => fetchTenant(tenant) })
  const tenantId = t?.id ?? ''
  const { data: services } = useQuery({ queryKey: ['services', tenantId], queryFn: () => fetchServices(tenantId), enabled: !!tenantId })
  const { data: bays } = useQuery({ queryKey: ['bays', tenantId], queryFn: () => fetchBays(tenantId), enabled: !!tenantId })
  const { data: photos } = useQuery({ queryKey: ['photos', tenantId], queryFn: () => fetchPhotos(tenantId), enabled: !!tenantId })
  const { data: cards } = useQuery({ queryKey: ['cards', tenantId], queryFn: () => fetchInfoCards(tenantId), enabled: !!tenantId })

  const [tab, setTab] = useState<'home' | 'services' | 'booking'>('home')
  const [serviceIdx, setServiceIdx] = useState<number | null>(null)
  const [dayOffset, setDayOffset] = useState(0)
  const [bayIdx, setBayIdx] = useState<number | null>(null)
  const [slot, setSlot] = useState<Date | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [car, setCar] = useState('')
  const [sending, setSending] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  // ===== СЛЕД-ТОЧКА ЗА КУРСОРОМ (только для мыши) =====
  useEffect(() => {
    const dot = document.createElement('div'); dot.className = 'cursor-dot'
    const ring = document.createElement('div'); ring.className = 'cursor-ring'
    document.body.append(dot, ring)
    let rx = 0, ry = 0, tx = 0, ty = 0, raf = 0
    const onMove = (e: MouseEvent) => {
      tx = e.clientX; ty = e.clientY
      dot.style.transform = `translate(${tx - 5}px, ${ty - 5}px)`
      const target = e.target as HTMLElement
      const interactive = !!target.closest('button, a, .service-item, .chip, .avatar, input')
      ring.style.width = interactive ? '48px' : '34px'
      ring.style.height = interactive ? '48px' : '34px'
    }
    const loop = () => {
      rx += (tx - rx) * 0.16; ry += (ty - ry) * 0.16
      ring.style.transform = `translate(${rx - (parseFloat(ring.style.width || '34') / 2)}px, ${ry - (parseFloat(ring.style.height || '34') / 2)}px)`
      raf = requestAnimationFrame(loop)
    }
    window.addEventListener('mousemove', onMove)
    raf = requestAnimationFrame(loop)
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); dot.remove(); ring.remove() }
  }, [])

  // ===== ПЛАВНОЕ ПОЯВЛЕНИЕ СЕКЦИЙ ПРИ ПРОКРУТКЕ/СВАЙПЕ =====
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target) } }),
      { threshold: 0.08 }
    )
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [t, services, photos, cards])

  const day = useMemo(() => addDays(new Date(), dayOffset), [dayOffset])
  const service = serviceIdx !== null && services ? services[serviceIdx] : undefined
  const bay = bayIdx !== null && bays ? bays[bayIdx] : undefined
  const duration = service?.duration_minutes ?? 60
  const minPrice = services && services.length ? Math.min(...services.map(s => s.price)) : 0

  const { data: busy } = useQuery({
    queryKey: ['busy', bay?.id ?? '', day.toDateString()],
    queryFn: () => fetchBusy(bay!.id, day),
    enabled: !!bay,
  })

  const slots = useMemo(() => slotsForDay(day, duration), [day, duration])

  function scrollTo(id: string, newTab: 'home' | 'services' | 'booking') {
    setTab(newTab)
    if (id === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  function scrollToContacts() {
    document.getElementById('contacts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function submit() {
    if (!service || !bay || !slot || !tenantId) return
    if (!name.trim() || !phone.trim() || !car.trim()) { setErrMsg('Заполните имя, телефон и автомобиль'); return }
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
          ? 'Это время только что заняли. Выберите другое.'
          : 'Не удалось создать запись. Попробуйте ещё раз.'
      )
    } finally { setSending(false) }
  }

  if (tLoad) return <main className="container"><p className="muted">Загрузка…</p></main>
  if (!t) return <main className="container"><h1>Студия не найдена</h1><Link className="btn" to="/">На главную</Link></main>

  const hero = (t.settings as Record<string, string | undefined>)?.heroImage

  return (
    <main className="page" ref={rootRef}>
      <header className="app-header">
        <div className="brand" onClick={() => scrollTo('top', 'home')} title="Наверх">
          <div className="brand-dot" />
          <span className="brand-name">{t.name}</span>
        </div>
        <div className="avatar" onClick={scrollToContacts} title="Контакты студии">A</div>
      </header>
      <div className="divider" />

      {hero && (
        <section className="hero reveal">
          <div className="hero-img-wrap">
            <img src={hero} alt={t.name} />
            <div className="hero-overlay" />
            <div className="hero-glow" />
            <h1 className="hero-title">{t.name}</h1>
            {t.settings.about && <p className="hero-sub">{t.settings.about}</p>}
            <button className="book-btn" onClick={() => scrollTo('booking', 'booking')}>
              <span>Записаться</span>
              <span className="arrow">→</span>
            </button>
          </div>
        </section>
      )}

      <div className="container">
        <div className="stats-row reveal">
          <div className="stat-card" onClick={() => scrollTo('services', 'services')} title="Перейти к услугам">
            <strong>{services?.length ?? 0}</strong>
            <span>Услуги</span>
          </div>
          <div className="stat-card" onClick={() => scrollTo('booking', 'booking')} title="Перейти к записи">
            <strong>{bays?.length ?? 0}</strong>
            <span>Бокса</span>
          </div>
          <div className="stat-card wide" onClick={() => scrollTo('services', 'services')} title="Смотреть прайс">
            <strong>От {minPrice.toLocaleString('ru-RU')} ₽</strong>
            <span>за услугу</span>
          </div>
        </div>

        {cards && cards.length > 0 && (
          <div className="info-row reveal">
            {cards.map((c) => (
              <div key={c.id} className="info-card" title={c.title}>
                <strong>{c.title}</strong>
                <span>{c.body}</span>
              </div>
            ))}
          </div>
        )}

        <section id="services" className="reveal">
          <h2 className="section-title">Услуги</h2>
          <div className="service-list">
            {(services ?? []).map((s, i) => (
              <button key={s.id}
                className={serviceIdx === i ? 'service-item selected' : 'service-item'}
                onClick={() => { setServiceIdx(i); setSlot(null); setBayIdx(null); document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
                <div className="service-info">
                  <div className="service-name">{s.name}</div>
                  <div className="service-dur">{Math.round(s.duration_minutes / 60)} ч</div>
                </div>
                <div className="service-right">
                  <div className="service-price">{s.price.toLocaleString('ru-RU')} ₽</div>
                  <span className="mini-book">Записаться</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {photos && photos.length > 0 && (
          <section className="reveal">
            <h2 className="section-title">Наши работы</h2>
            <div className="gallery">
              {photos.map((p) => (
                <figure key={p.id}>
                  <img src={p.url} alt={p.caption} loading="lazy" />
                  <figcaption>{p.caption}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        <section id="booking" className="reveal">
          <h2 className="booking-title">Запись в студию</h2>

          <div className="step-label">1. Выберите услугу</div>
          <div className="chip-row">
            {(services ?? []).map((s, i) => (
              <button key={s.id}
                className={serviceIdx === i ? 'chip selected' : 'chip'}
                onClick={() => { setServiceIdx(i); setSlot(null); setBayIdx(null) }}>
                {s.name}
              </button>
            ))}
          </div>

          {service && (
            <>
              <div className="step-label">2. День</div>
              <div className="chip-row">
                {[0, 1, 2, 3, 4, 5, 6].map((n) => {
                  const d = addDays(new Date(), n)
                  const hasSlots = slotsForDay(d, duration).length > 0
                  return (
                    <button key={n} disabled={!hasSlots}
                      className={dayOffset === n ? 'chip selected' : 'chip'}
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
              <div className="step-label">3. Бокс</div>
              <div className="chip-row">
                {bays!.map((b, i) => (
                  <button key={b.id}
                    className={bayIdx === i ? 'chip selected' : 'chip'}
                    onClick={() => { setBayIdx(i); setSlot(null) }}>
                    {b.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {service && bay && (
            <>
              <div className="step-label">4. Время <span className="hint">— серым занятое</span></div>
              {busy === undefined ? <p className="muted">Проверяем занятость…</p> : (
                <div className="chip-row">
                  {slots.map((s) => {
                    const busySlot = slotBusy(s, duration, busy ?? [])
                    return (
                      <button key={s.getTime()} disabled={busySlot}
                        className={slot?.getTime() === s.getTime() ? 'chip selected' : busySlot ? 'chip busy' : 'chip'}
                        onClick={() => setSlot(s)}>
                        {fmtTime(s)}
                      </button>
                    )
                  })}
                  {slots.length === 0 && <p className="muted">Нет свободных слотов — услуга до {CLOSE_HOUR}:00 не помещается.</p>}
                </div>
              )}
            </>
          )}

          {service && bay && slot && (
            <>
              <div className="step-label">5. Ваши данные</div>
              <div className="card">
                <label>Имя<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван" /></label>
                <label>Телефон<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 900 123-45-67" inputMode="tel" /></label>
                <label>Автомобиль<input value={car} onChange={(e) => setCar(e.target.value)} placeholder="BMW X5, чёрный" /></label>
                <p className="muted summary">
                  {service.name} · {bay.name} · {fmtDay(day)} в {fmtTime(slot)} · {service.price.toLocaleString('ru-RU')} ₽
                </p>
                {errMsg && <p className="error">{errMsg}</p>}
                <button className="btn" onClick={submit} disabled={sending}>
                  {sending ? 'Отправляем…' : 'Подтвердить запись'}
                </button>
              </div>
            </>
          )}
        </section>

        <section id="contacts" className="contacts reveal">
          <h2 className="section-title">Как нас найти</h2>
          <p className="muted">📍 {t.settings.address}</p>
          <p className="muted">🕘 Пн–Сб 10:00–20:00, Вс — выходной</p>
          {t.settings.phone && <p className="muted">📞 {t.settings.phone}</p>}
        </section>
      </div>

      <nav className="bottom-nav">
        <button className={tab === 'home' ? 'nav-item active' : 'nav-item'} onClick={() => scrollTo('top', 'home')}>
          <span className="nav-icon">🏠</span>Главная
        </button>
        <button className={tab === 'services' ? 'nav-item active' : 'nav-item'} onClick={() => scrollTo('services', 'services')}>
          <span className="nav-icon">🛠</span>Услуги
        </button>
        <button className={tab === 'booking' ? 'nav-item active' : 'nav-item'} onClick={() => scrollTo('booking', 'booking')}>
          <span className="nav-icon">📅</span>Моя запись
        </button>
      </nav>
    </main>
  )
}
