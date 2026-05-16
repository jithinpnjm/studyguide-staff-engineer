import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Library from './pages/Library';
import Document from './pages/Document';
import Settings from './pages/Settings';
import Admin from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/library" replace />} />
      <Route path="/library" element={<Library />} />
      <Route path="/documents/:id" element={<Document />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}
