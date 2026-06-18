import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { JobsListPage } from './pages/JobsListPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { PlaygroundPage } from './pages/PlaygroundPage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="jobs" element={<JobsListPage />} />
        <Route path="jobs/:id" element={<JobDetailPage />} />
        <Route path="playground" element={<PlaygroundPage />} />
      </Route>
    </Routes>
  )
}

export default App
