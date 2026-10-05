import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { RequireAuth } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import Team from './pages/Team.jsx'
import Tools from './pages/Tools.jsx'
import ToolDetail from './pages/ToolDetail.jsx'
import Apply from './pages/Apply.jsx'
import Login from './pages/Login.jsx'
import SetPassword from './pages/SetPassword.jsx'
import Account from './pages/Account.jsx'
import Book from './pages/Book.jsx'
import Admin from './pages/Admin.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="team" element={<Team />} />
        <Route path="tools" element={<Tools />} />
        <Route path="tools/:id" element={<ToolDetail />} />
        <Route path="apply" element={<Apply />} />
        <Route path="login" element={<Login />} />
        <Route path="set-password" element={<SetPassword />} />
        <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="book" element={<RequireAuth><Book /></RequireAuth>} />
        <Route path="admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
