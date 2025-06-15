import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Badge,
} from '@mui/material';
import {
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  ExitToApp as LogoutIcon,
  Dashboard as DashboardIcon,
  SportsTennis as SportsIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  const getUserInitials = (user: any) => {
    if (!user) return '';
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
  };

  return (
    <AppBar position="fixed" elevation={0}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {/* Logo and Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <SportsIcon sx={{ mr: 1, color: '#e6a881' }} />
          <Typography
            variant="h6"
            component="div"
            sx={{
              fontWeight: 700,
              color: '#333333',
              letterSpacing: '-0.5px',
            }}
          >
            SportAirHub
          </Typography>
        </Box>

        {/* Navigation Links */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
          <Button
            color="inherit"
            onClick={() => navigate('/')}
            sx={{
              fontWeight: isActive('/') ? 600 : 400,
              color: isActive('/') ? '#e6a881' : '#333333',
            }}
          >
            Главная
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/courts')}
            sx={{
              fontWeight: isActive('/courts') ? 600 : 400,
              color: isActive('/courts') ? '#e6a881' : '#333333',
            }}
          >
            Корты
          </Button>
          {user && (
            <>
              <Button
                color="inherit"
                onClick={() => navigate('/dashboard')}
                sx={{
                  fontWeight: isActive('/dashboard') ? 600 : 400,
                  color: isActive('/dashboard') ? '#e6a881' : '#333333',
                }}
              >
                Панель
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate('/my-bookings')}
                sx={{
                  fontWeight: isActive('/my-bookings') ? 600 : 400,
                  color: isActive('/my-bookings') ? '#e6a881' : '#333333',
                }}
              >
                Мои брони
              </Button>
            </>
          )}
        </Box>

        {/* User Menu */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {user ? (
            <>
              {/* Notifications */}
              <IconButton
                color="inherit"
                sx={{ color: '#333333' }}
              >
                <Badge badgeContent={0} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>

              {/* User Menu */}
              <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
                <Avatar
                  sx={{
                    bgcolor: '#e6a881',
                    color: '#333333',
                    fontWeight: 600,
                  }}
                >
                  {getUserInitials(user)}
                </Avatar>
              </IconButton>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem onClick={() => { navigate('/profile'); handleMenuClose(); }}>
                  <PersonIcon sx={{ mr: 1 }} />
                  Профиль
                </MenuItem>
                
                {user.role === 'admin' && (
                  <MenuItem onClick={() => { navigate('/admin'); handleMenuClose(); }}>
                    <DashboardIcon sx={{ mr: 1 }} />
                    Админ-панель
                  </MenuItem>
                )}
                
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon sx={{ mr: 1 }} />
                  Выйти
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/login')}
                sx={{
                  borderColor: '#e6a881',
                  color: '#e6a881',
                  '&:hover': {
                    borderColor: '#d4956b',
                    backgroundColor: 'rgba(230, 168, 129, 0.04)',
                  },
                }}
              >
                Войти
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/register')}
                sx={{
                  backgroundColor: '#e6a881',
                  color: '#333333',
                  '&:hover': {
                    backgroundColor: '#d4956b',
                  },
                }}
              >
                Регистрация
              </Button>
            </Box>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar; 