import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ExcalidrawLoader from './components/common/ExcalidrawLoader';

// Lazy-load page components for ultra-fast initial bundle and routing
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const WorkspaceDetail = lazy(() => import('./pages/WorkspaceDetail'));
const BoardPage = lazy(() => import('./pages/BoardPage'));
const JoinRoom = lazy(() => import('./pages/JoinRoom'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <ExcalidrawLoader fullScreen={true} />;
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <ExcalidrawLoader fullScreen={true} />;
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return <ExcalidrawLoader fullScreen={true} />;
  }
  // If user is already logged in, take them straight to their workspaces / dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<ExcalidrawLoader fullScreen={true} />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/workspace/:id" element={<ProtectedRoute><WorkspaceDetail /></ProtectedRoute>} />
        <Route path="/board/:id" element={<BoardRoute><BoardPage /></BoardRoute>} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/join/:code" element={<JoinRoom />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

/** Allows both authenticated users AND guests (via sessionStorage) */
function BoardRoute({ children }) {
  const { user, loading } = useAuth();
  const guestName = sessionStorage.getItem('guestName');

  if (loading) {
    return <ExcalidrawLoader fullScreen={true} />;
  }

  // Authenticated user or guest with a name — allow access
  if (user || guestName) return children;

  // Not authenticated and not a guest — redirect to login page
  return <Navigate to="/login" replace />;
}

export default function App() {
  useEffect(() => {
    // Idle prefetch of primary pages so page opens feel instantaneous
    const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    idleCallback(() => {
      import('./pages/Dashboard');
      import('./pages/BoardPage');
    });
  }, []);

  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <AppRoutes />
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                },
              }}
            />
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
