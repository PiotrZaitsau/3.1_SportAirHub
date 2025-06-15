import React from 'react';
import { Box, Typography, Container, Grid, Link } from '@mui/material';
import { SportsTennis as SportsIcon } from '@mui/icons-material';

const Footer: React.FC = () => {
  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: '#faf3df',
        borderTop: '1px solid rgba(230, 168, 129, 0.2)',
        py: 4,
        mt: 4,
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* Brand */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <SportsIcon sx={{ mr: 1, color: '#e6a881' }} />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: '#333333',
                  letterSpacing: '-0.5px',
                }}
              >
                SportAirHub
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Современный спортивный комплекс с автоматизированной системой бронирования кортов.
              Играйте в теннис в комфортных условиях с контролем микроклимата.
            </Typography>
          </Grid>

          {/* Quick Links */}
          <Grid item xs={12} md={4}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#333333' }}>
              Быстрые ссылки
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link href="/courts" color="inherit" underline="hover">
                Корты
              </Link>
              <Link href="/subscription" color="inherit" underline="hover">
                Абонементы
              </Link>
              <Link href="/passes" color="inherit" underline="hover">
                Пропуска
              </Link>
              <Link href="/contact" color="inherit" underline="hover">
                Контакты
              </Link>
            </Box>
          </Grid>

          {/* Contact Info */}
          <Grid item xs={12} md={4}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#333333' }}>
              Контакты
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              📧 info@sportairhub.com
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              📞 +48 123 456 789
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              📍 ул. Спортивная, 123, Варшава
            </Typography>
            <Typography variant="body2" color="text.secondary">
              🕒 Пн-Вс: 06:00 - 23:00
            </Typography>
          </Grid>
        </Grid>

        {/* Copyright */}
        <Box
          sx={{
            mt: 4,
            pt: 2,
            borderTop: '1px solid rgba(230, 168, 129, 0.2)',
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            © 2024 SportAirHub. Все права защищены.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer; 