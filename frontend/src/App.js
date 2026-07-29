import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import OfflineIndicator from './components/OfflineIndicator';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import './assets/css/App.css';

// ChunkLoadError tuzatish — yuklanmasa sahifani avtomatik reload qiladi
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      // ChunkLoadError bo'lsa — sahifani reload qilish (1 marta)
      if (!window.__chunkRetried) {
        window.__chunkRetried = true;
        window.location.reload();
      }
      throw error;
    }
  });

// Lazy loading — sahifalar kerak bo'lgandagina yuklanadi
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const TestDetail = lazyWithRetry(() => import('./pages/TestDetail'));
const TakeTest = lazyWithRetry(() => import('./pages/TakeTest'));
const Results = lazyWithRetry(() => import('./pages/Results'));
const Portfolio = lazyWithRetry(() => import('./pages/Portfolio'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Leaderboard = lazyWithRetry(() => import('./pages/Leaderboard'));
const Students = lazyWithRetry(() => import('./pages/Students'));
const StudentPortfolio = lazyWithRetry(() => import('./pages/StudentPortfolio'));
const Lessons = lazyWithRetry(() => import('./pages/Lessons'));
const LessonDetail = lazyWithRetry(() => import('./pages/LessonDetail'));
const Journal = lazyWithRetry(() => import('./pages/Journal'));
const AIAnalytics = lazyWithRetry(() => import('./pages/AIAnalytics'));
const Forum = lazyWithRetry(() => import('./pages/Forum'));
const ForumPost = lazyWithRetry(() => import('./pages/ForumPost'));
const NewPost = lazyWithRetry(() => import('./pages/NewPost'));
const ExperimentStats = lazyWithRetry(() => import('./pages/ExperimentStats'));
const AdminUsers = lazyWithRetry(() => import('./pages/AdminUsers'));
const Survey = lazyWithRetry(() => import('./pages/Survey'));
const DiagnosticTest = lazyWithRetry(() => import('./pages/DiagnosticTest'));

// Loading fallback
const PageLoader = () => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '60vh', gap: '1rem'
  }}>
    <div className="spinner"></div>
    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Yuklanmoqda...</p>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Navbar />
          <OfflineIndicator />
          <div className="main-content">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route 
                  path="/dashboard" 
                  element={<PrivateRoute><Dashboard /></PrivateRoute>} 
                />
                <Route path="/tests" element={<Navigate to="/lessons" replace />} />
                <Route 
                  path="/tests/:id" 
                  element={<PrivateRoute><TestDetail /></PrivateRoute>} 
                />
                <Route 
                  path="/take-test/:id" 
                  element={<PrivateRoute><TakeTest /></PrivateRoute>} 
                />
                <Route 
                  path="/results" 
                  element={<PrivateRoute><Results /></PrivateRoute>} 
                />
                <Route 
                  path="/portfolio" 
                  element={<PrivateRoute><Portfolio /></PrivateRoute>} 
                />
                <Route 
                  path="/profile" 
                  element={<PrivateRoute><Profile /></PrivateRoute>} 
                />
                <Route 
                  path="/leaderboard" 
                  element={<PrivateRoute><Leaderboard /></PrivateRoute>} 
                />
                <Route 
                  path="/students" 
                  element={<PrivateRoute><Students /></PrivateRoute>} 
                />
                <Route 
                  path="/students/:userId/portfolio" 
                  element={<PrivateRoute><StudentPortfolio /></PrivateRoute>} 
                />
                <Route 
                  path="/lessons" 
                  element={<PrivateRoute><Lessons /></PrivateRoute>} 
                />
                <Route 
                  path="/lessons/:id" 
                  element={<PrivateRoute><LessonDetail /></PrivateRoute>} 
                />
                <Route 
                  path="/journal" 
                  element={<PrivateRoute><Journal /></PrivateRoute>} 
                />
                <Route 
                  path="/ai-analytics" 
                  element={<PrivateRoute><AIAnalytics /></PrivateRoute>} 
                />
                <Route 
                  path="/forum" 
                  element={<PrivateRoute><Forum /></PrivateRoute>} 
                />
                <Route 
                  path="/forum/post/:id" 
                  element={<PrivateRoute><ForumPost /></PrivateRoute>} 
                />
                <Route 
                  path="/forum/new" 
                  element={<PrivateRoute><NewPost /></PrivateRoute>} 
                />
                <Route 
                  path="/experiment" 
                  element={<PrivateRoute><ExperimentStats /></PrivateRoute>} 
                />
                <Route 
                  path="/admin-users" 
                  element={<PrivateRoute><AdminUsers /></PrivateRoute>} 
                />
                <Route 
                  path="/survey" 
                  element={<PrivateRoute><Survey /></PrivateRoute>} 
                />
                <Route 
                  path="/diagnostic" 
                  element={<PrivateRoute><DiagnosticTest /></PrivateRoute>} 
                />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
