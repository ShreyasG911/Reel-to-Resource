import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { ResourceLibraryPage } from './pages/ResourceLibraryPage';
import { AutomationSettingsPage } from './pages/AutomationSettingsPage';
import { EventLogsPage } from './pages/EventLogsPage';
import { ReplyLogsPage } from './pages/ReplyLogsPage';
import { IntegrationPage } from './pages/IntegrationPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="resources" element={<ResourceLibraryPage />} />
          <Route path="settings" element={<AutomationSettingsPage />} />
          <Route path="events" element={<EventLogsPage />} />
          <Route path="replies" element={<ReplyLogsPage />} />
          <Route path="integration" element={<IntegrationPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

