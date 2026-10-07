import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { fetchTenant, fetchServices, fetchBays, fetchPhotos, fetchInfoCards } from '../api'

export default function Settings() {
  const { tenant = '' } = useParams()
  const qc = useQueryClient()
  const [saved, setSaved] = useState('')

  const { data: t } = useQuery({ queryKey: ['tenant', tenant], queryFn: () => fetchTenant(tenant) })
  const tenantId = t?.id ?? ''
  const { data: services } = useQuery({ queryKey: ['services', tenantId], queryFn: () => fetchServices(tenantId), enabled: !!tenantId })
  const { data: bays } = useQuery({ queryKey: ['bays', tenantId], queryFn: () => fetchBays(tenantId), enabled: !!tenantId })
  const { data: photos } = useQuery({ queryKey: ['photos', tenantId], queryFn: () => fetchPhotos(tenantId), enabled: !!tenantId })
  const { data: cards } = useQuery({ queryKey: ['cards', tenantId], queryFn: () => fetchInfoCards(tenantId), enabled: !!tenantId })

  function ok(msg = 'Сохранено ✓') { setSaved(msg); qc.invalidateQueries(); setTimeout(() => setSaved(''), 2000) }
  function fail(e: { message: string }) { alert('Ошибка: ' + e.message) }

  async function saveTenant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!t) return
    const f = new FormData(e.currentTarget)
    const settings = {
      ...(t.settings ?? {}),
      phone: String(f.get('phone')),
      address: String(f.get('address')),
      about: String(f.get('about')),
    }
    const { error } = await supabase
      .from('tenants').update({ name: String(f.get('name')), settings }).eq('id', t.id)
    error ? fail(error) : ok()
  }

  async function saveService(id: string, name: string, price: number, dur: number) {
    const { error } = await supabase.from('services')
      .update({ name, price, duration_minutes: dur }).eq('id', id)
    error ? fail(error) : ok()
  }
  async function addService() {
    const name = window.prompt('Название услуги:')
    if (!name) return
    const price = Number(window.prompt('Цена (₽):') ?? '0')
    const dur = Number(window.prompt('Длительность в минутах (напр. 480 = 8 часов):') ?? '60')
    if (!price || !dur) { alert('Нужны цена и длительность'); return }
    const { error } = await supabase.from('services')
      .insert({ tenant_id: tenantId, name, price, duration_minutes: dur, sort: (services?.length ?? 0) })
    error ? fail(error) : ok()
  }
  async function delService(id: string) {
    if (!window.confirm('Удалить услугу?')) return
    const { error } = await supabase.from('services').delete().eq('id', id)
    error ? fail(error) : ok()
  }

  async function addBay() {
    const name = window.prompt('Название бокса:')
    if (!name) return
    const { error } = await supabase.from('bays')
      .insert({ tenant_id: tenantId, name, sort: (bays?.length ?? 0) })
    error ? fail(error) : ok()
  }
  async function renameBay(id: string, old: string) {
    const name = window.prompt('Новое название:', old)
    if (!name || name === old) return
    const { error } = await supabase.from('bays').update({ name }).eq('id', id)
    error ? fail(error) : ok()
  }
  async function delBay(id: string) {
    if (!window.confirm('Удалить бокс? Если в нём есть записи, они останутся в истории.')) return
    const { error } = await supabase.from('bays').delete().eq('id', id)
    error ? fail(error) : ok()
  }

  async function saveCard(id: string, title: string, body: string) {
    const { error } = await supabase.from('info_cards').update({ title, body }).eq('id', id)
    error ? fail(error) : ok()
  }
  async function addCard() {
    const title = window.prompt('Заголовок (напр. «Гарантия»):')
    if (!title) return
    const body = window.prompt('Текст:') ?? ''
    const { error } = await supabase.from('info_cards')
      .insert({ tenant_id: tenantId, title, body, sort: (cards?.length ?? 0) })
    error ? fail(error) : ok()
  }

  async function addPhoto() {
    const url = window.prompt('Ссылка на фото (загрузите фото в Supabase → Storage → скопируйте Public URL):')
    if (!url) return
    const caption = window.prompt('Подпись под фото:') ?? ''
    const { error } = await supabase.from('work_photos')
      .insert({ tenant_id: tenantId, url, caption, sort: (photos?.length ?? 0) })
    error ? fail(error) : ok()
  }
  async function replacePhoto(id: string, oldUrl: string) {
    const url = window.prompt('Новая ссылка на фото:', oldUrl)
    if (!url || url === oldUrl) return
    const { error } = await supabase.from('work_photos').update({ url }).eq('id', id)
    error ? fail(error) : ok()
  }
  async function editCaption(id: string, old: string) {
    const caption = window.prompt('Новая подпись:', old)
    if (caption === null || caption === old) return
    const { error } = await supabase.from('work_photos').update({ caption }).eq('id', id)
    error ? fail(error) : ok()
  }
  async function delPhoto(id: string) {
    if (!window.confirm('Удалить эту фотографию? Остальные останутся.')) return
    const { error } = await supabase.from('work_photos').delete().eq('id', id)
    error ? fail(error) : ok()
  }

  if (!t) return <main className="container"><p className="muted">Загрузка…</p></main>

  return (
    <main className="container">
      <h1>Настройки: {t.name}</h1>
      {saved && <p className="success">{saved}</p>}

      <form className="card" onSubmit={saveTenant}>
        <h2>Студия</h2>
        <label>Название<input name="name" defaultValue={t.name} required /></label>
        <label>Телефон<input name="phone" defaultValue={t.settings?.phone ?? ''} /></label>
        <label>Адрес<input name="address" defaultValue={t.settings?.address ?? ''} /></label>
        <label>Описание<input name="about" defaultValue={t.settings?.about ?? ''} /></label>
        <button className="btn" type="submit">Сохранить</button>
      </form>

      <div className="card">
        <h2>Услуги и цены</h2>
        {(services ?? []).map((s) => (
          <form key={s.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}
            onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget)
              saveService(s.id, String(f.get('name')), Number(f.get('price')), Number(f.get('dur'))) }}>
            <label>Название<input name="name" defaultValue={s.name} required /></label>
            <label>Цена, ₽<input name="price" type="number" defaultValue={s.price} required /></label>
            <label>Длительность, минут<input name="dur" type="number" defaultValue={s.duration_minutes} required /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" type="submit">Сохранить</button>
              <button className="btn secondary" type="button" onClick={() => delService(s.id)}>Удалить</button>
            </div>
          </form>
        ))}
        <p><button className="btn secondary" onClick={addService}>+ Добавить услугу</button></p>
      </div>

      <div className="card">
        <h2>Боксы</h2>
        {(bays ?? []).map((b) => (
          <p key={b.id} style={{ display: 'flex', gap: 8 }}>
            <span style={{ flex: 1 }}>{b.name}</span>
            <button className="btn secondary" style={{ width: 'auto' }} onClick={() => renameBay(b.id, b.name)}>Переименовать</button>
            <button className="btn secondary" style={{ width: 'auto' }} onClick={() => delBay(b.id)}>Удалить</button>
          </p>
        ))}
        <p><button className="btn secondary" onClick={addBay}>+ Добавить бокс</button></p>
      </div>

      <div className="card">
        <h2>Карточки на главной</h2>
        {(cards ?? []).map((c) => (
          <form key={c.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}
            onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget)
              saveCard(c.id, String(f.get('title')), String(f.get('body'))) }}>
            <label>Заголовок<input name="title" defaultValue={c.title} required /></label>
            <label>Текст<input name="body" defaultValue={c.body} required /></label>
            <button className="btn" type="submit">Сохранить</button>
          </form>
        ))}
        <p><button className="btn secondary" onClick={addCard}>+ Добавить карточку</button></p>
      </div>

      <div className="card">
        <h2>Фото работ</h2>
        {(photos ?? []).map((p) => (
          <div key={p.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
            <img src={p.url} alt={p.caption} style={{ width: '100%', borderRadius: 10 }} />
            <p className="muted">{p.caption}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn secondary" style={{ width: 'auto' }} onClick={() => replacePhoto(p.id, p.url)}>Заменить фото</button>
              <button className="btn secondary" style={{ width: 'auto' }} onClick={() => editCaption(p.id, p.caption)}>Изменить подпись</button>
              <button className="btn secondary" style={{ width: 'auto' }} onClick={() => delPhoto(p.id)}>Удалить</button>
            </div>
          </div>
        ))}
        <p><button className="btn secondary" onClick={addPhoto}>+ Добавить фото</button></p>
      </div>

      <p><Link className="btn secondary" to={`/${tenant}/admin`}>← Назад в кабинет</Link></p>
    </main>
  )
}
