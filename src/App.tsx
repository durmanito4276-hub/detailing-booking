import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Book from './pages/Book'
import BookingView from './pages/BookingView'
import Admin from './pages/Admin'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/:tenant/book" element={<Book />} />
      <Route path="/:tenant/booking/:token" element={<BookingView />} />
      <Route path="/:tenant/admin" element={<Admin />} />
      <Route path="/:tenant/admin/settings" element={<Settings />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
