import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
} from '@mui/material';
import {
  SportsTennis as TennisIcon,
  AcUnit as AcIcon,
  QrCode as QrIcon,
  Assessment as AnalyticsIcon,
  Payment as PaymentIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const features = [
    {
      icon: <TennisIcon sx={{ fontSize: 40, color: '#e6a881' }} />,
      title: 'Современные корты',
      description: 'Теннисные корты с профессиональным покрытием и оборудованием'
    },
    {
      icon: <AcIcon sx={{ fontSize: 40, color: '#e6a881' }} />,
      title: 'Контроль климата',
      description: 'Автоматическая система поддержания оптимальной температуры и влажности'
    },
    {
      icon: <QrIcon sx={{ fontSize: 40, color: '#e6a881' }} />,
      title: 'QR-доступ',
      description: 'Удобный вход на корт по QR-коду из вашего бронирования'
    },
    {
      icon: <ScheduleIcon sx={{ fontSize: 40, color: '#e6a881' }} />,
      title: 'Онлайн бронирование',
      description: 'Быстрое и удобное бронирование кортов через веб-интерфейс'
    },
    {
      icon: <PaymentIcon sx={{ fontSize: 40, color: '#e6a881' }} />,
      title: 'Безопасные платежи',
      description: 'Интеграция с Stripe для безопасных онлайн-платежей'
    },
    {
      icon: <AnalyticsIcon sx={{ fontSize: 40, color: '#e6a881' }} />,
      title: 'Аналитика',
      description: 'Подробная статистика ваших игр и программа лояльности'
    },
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #fffdf6 0%, #faf3df 100%)',
          py: { xs: 8, md: 12 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 700,
              mb: 3,
              color: '#333333',
              fontSize: { xs: '2.5rem', md: '3.5rem' },
            }}
          >
            Добро пожаловать в{' '}
            <Box component="span" sx={{ color: '#e6a881' }}>
              SportAirHub
            </Box>
          </Typography>
          
          <Typography
            variant="h5"
            sx={{
              mb: 4,
              color: '#666666',
              fontWeight: 400,
              maxWidth: '600px',
              mx: 'auto',
            }}
          >
            Современный теннисный комплекс с инновационными технологиями
            автоматизированного управления и комфортными условиями для игры
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            {user ? (
              <>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/courts')}
                  sx={{
                    backgroundColor: '#e6a881',
                    color: '#333333',
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    '&:hover': {
                      backgroundColor: '#d4956b',
                    },
                  }}
                >
                  Забронировать корт
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate('/dashboard')}
                  sx={{
                    borderColor: '#e6a881',
                    color: '#e6a881',
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    '&:hover': {
                      borderColor: '#d4956b',
                      backgroundColor: 'rgba(230, 168, 129, 0.04)',
                    },
                  }}
                >
                  Моя панель
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/register')}
                  sx={{
                    backgroundColor: '#e6a881',
                    color: '#333333',
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    '&:hover': {
                      backgroundColor: '#d4956b',
                    },
                  }}
                >
                  Начать играть
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate('/courts')}
                  sx={{
                    borderColor: '#e6a881',
                    color: '#e6a881',
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    '&:hover': {
                      borderColor: '#d4956b',
                      backgroundColor: 'rgba(230, 168, 129, 0.04)',
                    },
                  }}
                >
                  Посмотреть корты
                </Button>
              </>
            )}
          </Box>

          {/* Key Stats */}
          <Box sx={{ mt: 6, display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#e6a881' }}>
                4
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Корта
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#e6a881' }}>
                300₺
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Годовой абонемент
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#e6a881' }}>
                24/7
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Автоматизация
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography
          variant="h3"
          component="h2"
          sx={{
            textAlign: 'center',
            fontWeight: 600,
            mb: 6,
            color: '#333333',
          }}
        >
          Наши возможности
        </Typography>

        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card
                sx={{
                  height: '100%',
                  textAlign: 'center',
                  p: 3,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 8px 25px rgba(230, 168, 129, 0.2)',
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ mb: 2 }}>
                    {feature.icon}
                  </Box>
                  <Typography
                    variant="h6"
                    component="h3"
                    sx={{ fontWeight: 600, mb: 2, color: '#333333' }}
                  >
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Pricing Section */}
      <Box sx={{ backgroundColor: '#faf3df', py: 8 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            component="h2"
            sx={{
              textAlign: 'center',
              fontWeight: 600,
              mb: 6,
              color: '#333333',
            }}
          >
            Тарифы
          </Typography>

          <Grid container spacing={4} justifyContent="center">
            {/* Guest Pricing */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  textAlign: 'center',
                  p: 3,
                  height: '100%',
                  border: '1px solid rgba(230, 168, 129, 0.2)',
                }}
              >
                <CardContent>
                  <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                    Гостевое посещение
                  </Typography>
                  <Typography variant="h3" sx={{ color: '#e6a881', fontWeight: 700, mb: 1 }}>
                    80₺
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    за час
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>✓ Доступ к корту</Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>✓ Базовое оборудование</Typography>
                    <Typography variant="body2">✓ Контроль климата</Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate('/courts')}
                    sx={{
                      borderColor: '#e6a881',
                      color: '#e6a881',
                      '&:hover': {
                        borderColor: '#d4956b',
                        backgroundColor: 'rgba(230, 168, 129, 0.04)',
                      },
                    }}
                  >
                    Забронировать
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Member Pricing */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  textAlign: 'center',
                  p: 3,
                  height: '100%',
                  border: '2px solid #e6a881',
                  position: 'relative',
                }}
              >
                <Chip
                  label="Популярно"
                  color="primary"
                  sx={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#e6a881',
                    color: '#333333',
                  }}
                />
                <CardContent>
                  <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                    Абонемент
                  </Typography>
                  <Typography variant="h3" sx={{ color: '#e6a881', fontWeight: 700, mb: 1 }}>
                    300₺
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    в год + 60₺/час
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>✓ Скидка на бронирование</Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>✓ Программа лояльности</Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>✓ Приоритетное бронирование</Typography>
                    <Typography variant="body2">✓ Аналитика игр</Typography>
                  </Box>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => navigate(user ? '/subscription' : '/register')}
                    sx={{
                      backgroundColor: '#e6a881',
                      color: '#333333',
                      '&:hover': {
                        backgroundColor: '#d4956b',
                      },
                    }}
                  >
                    {user ? 'Купить абонемент' : 'Присоединиться'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Pass Pricing */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  textAlign: 'center',
                  p: 3,
                  height: '100%',
                  border: '1px solid rgba(230, 168, 129, 0.2)',
                }}
              >
                <CardContent>
                  <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                    Карта посещений
                  </Typography>
                  <Typography variant="h3" sx={{ color: '#e6a881', fontWeight: 700, mb: 1 }}>
                    500₺
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    10 посещений
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>✓ 10 игровых сессий</Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>✓ Без дополнительной оплаты</Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>✓ Срок действия 1 год</Typography>
                    <Typography variant="body2">✓ Можно дарить</Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate(user ? '/passes' : '/register')}
                    sx={{
                      borderColor: '#e6a881',
                      color: '#e6a881',
                      '&:hover': {
                        borderColor: '#d4956b',
                        backgroundColor: 'rgba(230, 168, 129, 0.04)',
                      },
                    }}
                  >
                    {user ? 'Купить карту' : 'Зарегистрироваться'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      {!user && (
        <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
          <Typography
            variant="h4"
            component="h2"
            sx={{
              fontWeight: 600,
              mb: 3,
              color: '#333333',
            }}
          >
            Готовы начать играть?
          </Typography>
          <Typography
            variant="h6"
            sx={{
              mb: 4,
              color: '#666666',
              fontWeight: 400,
            }}
          >
            Зарегистрируйтесь сейчас и получите доступ ко всем возможностям SportAirHub
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/register')}
            sx={{
              backgroundColor: '#e6a881',
              color: '#333333',
              px: 6,
              py: 2,
              fontSize: '1.2rem',
              '&:hover': {
                backgroundColor: '#d4956b',
              },
            }}
          >
            Зарегистрироваться бесплатно
          </Button>
        </Container>
      )}
    </Box>
  );
};

export default Home; 