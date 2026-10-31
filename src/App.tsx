import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import PlaceholderPage from './pages/PlaceholderPage';
import { SPECIALTIES } from './config/specialties';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={
            <PlaceholderPage title="Обзор" stage={6}>
              <p className="mb-3">Цветовая кодировка направлений:</p>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {SPECIALTIES.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <span className="size-3 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </li>
                ))}
              </ul>
            </PlaceholderPage>
          }
        />
        <Route path="/labs" element={<PlaceholderPage title="Анализы" stage={6} />} />
        <Route path="/timeline" element={<PlaceholderPage title="Хронология" stage={6} />} />
        <Route path="/documents" element={<PlaceholderPage title="Документы" stage={7} />} />
        <Route path="/specialties" element={<PlaceholderPage title="Направления" stage={7} />} />
        <Route path="/visit" element={<PlaceholderPage title="Визит к врачу" stage={7} />} />
        <Route path="/plan" element={<PlaceholderPage title="План" stage={7} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
