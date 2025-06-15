import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SocketProvider } from './contexts/SocketContext';

// Components
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import LoadingSpinner from './components/common/LoadingSpinner';

// Pages
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Courts from './pages/courts/Courts';
import CourtDetails from './pages/courts/CourtDetails';
import Booking from './pages/booking/Booking';
import BookingConfirmation from './pages/booking/BookingConfirmation';
import MyBookings from './pages/bookings/MyBookings';
import Profile from './pages/profile/Profile';
import Subscription from './pages/subscription/Subscription';
import Passes from './pages/passes/Passes';
import AdminDashboard from './pages/admin/AdminDashboard';

// SportAirHub theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#e6a881',
      light: '#e8ceb5',
      dark: '#d4956b',
      contrastText: '#333333',
    },
    secondary: {
      main: '#faf3df',
      light: '#fffdf6',
      dark: '#e8dcc7',
      contrastText: '#333333',
    },
    background: {
      default: '#fffdf6',
      paper: '#faf3df',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
    },
    success: {
      main: '#4caf50',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      color: '#333333',
    },
    h2: {
      fontWeight: 600,
      color: '#333333',
    },
    h3: {
      fontWeight: 600,
      color: '#333333',
    },
    h4: {
      fontWeight: 500,
      color: '#333333',
    },
    h5: {
      fontWeight: 500,
      color: '#333333',
    },
    h6: {
      fontWeight: 500,
      color: '#333333',
    },
    body1: {
      color: '#333333',
    },
    body2: {
      color: '#666666',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 12,
          padding: '12px 24px',
        },
        contained: {
          boxShadow: '0 4px 12px rgba(230, 168, 129, 0.3)',
          '&:hover': {
            boxShadow: '0 6px 16px rgba(230, 168, 129, 0.4)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(230, 168, 129, 0.1)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#fffdf6',
          color: '#333333',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        },
      },
    },
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ 
  children, 
  adminOnly = false 
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !['admin', 'manager'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirect if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// App Layout Component
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: 'calc(100vh - 140px)', paddingTop: '80px' }}>
        {children}
      </main>
      <Footer />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <NotificationProvider>
          <SocketProvider>
            <Router>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<AppLayout><Home /></AppLayout>} />
                <Route path="/courts" element={<AppLayout><Courts /></AppLayout>} />
                <Route path="/courts/:id" element={<AppLayout><CourtDetails /></AppLayout>} />
                
                {/* Auth Routes */}
                <Route 
                  path="/login" 
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  } 
                />
                <Route 
                  path="/register" 
                  element={
                    <PublicRoute>
                      <Register />
                    </PublicRoute>
                  } 
                />
                <Route 
                  path="/forgot-password" 
                  element={
                    <PublicRoute>
                      <ForgotPassword />
                    </PublicRoute>
                  } 
                />

                {/* Protected Routes */}
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Dashboard />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/book/:courtId" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Booking />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/booking-confirmation/:bookingId" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <BookingConfirmation />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/my-bookings" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <MyBookings />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Profile />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/subscription" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Subscription />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/passes" 
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Passes />
                      </AppLayout>
                    </ProtectedRoute>
                  } 
                />

                {/* Admin Routes */}
                <Route 
                  path="/admin/*" 
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } 
                />

                {/* 404 Route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </SocketProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App; 