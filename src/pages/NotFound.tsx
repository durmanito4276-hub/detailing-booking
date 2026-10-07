import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="container">
      <h1>Страница не найдена</h1>
      <p className="muted">Возможно, ссылка устарела.</p>
      <Link className="btn" to="/">На главную</Link>
    </main>
  )
}
