import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchTenants } from '../api'

export default function Home() {
  const { data: tenants, isLoading, isError } = useQuery({
    queryKey: ['tenants'],
    queryFn: fetchTenants,
  })

  if (isLoading) return <div className="container"><p className="muted">Загрузка…</p></div>
  if (isError) return <div className="container"><p className="error">Ошибка загрузки</p></div>

  return (
    <main className="container">
      <h1>Студии детейлинга</h1>
      {tenants.length === 0 && (
        <p className="muted">Пока нет ни одной студии.</p>
      )}
      {tenants.map((t) => (
        <div key={t.id} className="card">
          <h2>{t.name}</h2>
          {t.settings.about && <p className="muted">{t.settings.about}</p>}
          {t.settings.address && <p className="muted">{t.settings.address}</p>}
          <Link className="btn" to={`/${t.slug}/book`}>Записаться</Link>
        </div>
      ))}
    </main>
  )
}
