import { Navigate, Route, Routes } from 'react-router-dom';
import { HealthDataProvider, useHealthData } from './context/HealthDataContext';
import Layout from './components/Layout';
import LockScreen from './components/LockScreen';
import OverviewPage from './pages/OverviewPage';
import LabsPage from './pages/LabsPage';
import TimelinePage from './pages/TimelinePage';
import DocumentsPage from './pages/DocumentsPage';
import SpecialtiesPage from './pages/SpecialtiesPage';
import VisitPrepPage from './pages/VisitPrepPage';
import PlanPage from './pages/PlanPage';

function AppRoutes() {
  const { status } = useHealthData();

  if (status !== 'unlocked') {
    return <LockScreen />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/labs" element={<LabsPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/specialties" element={<SpecialtiesPage />} />
        <Route path="/visit" element={<VisitPrepPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <HealthDataProvider>
      <AppRoutes />
    </HealthDataProvider>
  );
}
