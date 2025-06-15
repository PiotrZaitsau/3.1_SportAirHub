# SportAirHub - Автоматизированная система управления теннисным комплексом

SportAirHub - это современная веб-платформа для автоматизированного управления спортивными объектами и онлайн-бронирования кортов с 22 основными функциональными областями.

## 🏗️ Архитектура

### Backend (Node.js + Express)
- **API Routes**: Полный REST API для всех функций
- **Authentication**: JWT-токены с refresh механизмом
- **Database**: MongoDB с Mongoose ODM
- **Real-time**: Socket.io для уведомлений и аналитики
- **Payments**: Интеграция со Stripe
- **IoT Integration**: MQTT для управления климатом и доступом
- **Email**: Nodemailer для уведомлений
- **Security**: Rate limiting, CORS, helmet

### Frontend (React + TypeScript)
- **UI Framework**: Material-UI с кастомной темой SportAirHub
- **State Management**: React Context API
- **Routing**: React Router v6
- **Forms**: Controlled components с валидацией
- **Real-time**: Socket.io client
- **Payments**: Stripe Elements

### Основные возможности
- ✅ Система аутентификации и авторизации
- ✅ Управление кортами и бронированием
- ✅ Интеграция платежей (Stripe)
- ✅ Система абонементов (300 zł/год, макс. 300 пользователей)
- ✅ Карты посещений (500 zł за 10 посещений, макс. 500 карт)
- ✅ IoT контроль климата и доступа
- ✅ Real-time уведомления
- ✅ Программа лояльности (Bronze/Silver/Gold)
- ✅ Административная панель
- ✅ Аналитика и отчетность
- ✅ QR-коды для доступа
- ✅ Автоматические напоминания

## 🚀 Быстрый старт

### Предварительные требования
- Node.js 18+ и npm
- MongoDB 5.0+
- Redis (опционально, для кэширования)
- MQTT Broker (для IoT функций)

### Установка

1. **Клонирование репозитория**
```bash
git clone https://github.com/your-username/SportAirHub.git
cd SportAirHub
```

2. **Установка зависимостей Backend**
```bash
npm install
```

3. **Установка зависимостей Frontend**
```bash
cd client
npm install
cd ..
```

4. **Настройка переменных окружения**
```bash
cp .env.example .env
# Отредактируйте .env файл с вашими настройками
```

5. **Запуск MongoDB**
```bash
# Убедитесь, что MongoDB запущен
mongod
```

### Запуск в режиме разработки

1. **Запуск Backend сервера**
```bash
npm run dev
# Сервер запустится на http://localhost:5000
```

2. **Запуск Frontend (в новом терминале)**
```bash
cd client
npm start
# React приложение запустится на http://localhost:3000
```

3. **Запуск обоих одновременно**
```bash
npm run dev:full
```

## 📁 Структура проекта

```
SportAirHub/
├── server/                 # Backend (Node.js + Express)
│   ├── controllers/        # Контроллеры API
│   ├── middleware/         # Middleware (auth, error handling)
│   ├── models/            # MongoDB модели (Mongoose)
│   ├── routes/            # API маршруты
│   ├── services/          # Бизнес-логика сервисов
│   │   ├── analyticsService.js    # Real-time аналитика
│   │   ├── iotService.js          # IoT управление
│   │   └── notificationService.js # Уведомления
│   ├── utils/             # Утилиты и хелперы
│   └── server.js          # Главный файл сервера
├── client/                # Frontend (React + TypeScript)
│   ├── public/            # Статические файлы
│   ├── src/
│   │   ├── components/    # React компоненты
│   │   ├── contexts/      # React Context (Auth, Notifications, Socket)
│   │   ├── pages/         # Страницы приложения
│   │   ├── services/      # API клиент
│   │   ├── types/         # TypeScript типы
│   │   └── App.tsx        # Главный компонент
├── package.json           # Backend зависимости
└── README.md
```

## 🎨 Дизайн-система

### Цветовая палитра SportAirHub
- **Основной фон**: `#fffdf6` (кремово-белый)
- **Вторичный фон**: `#faf3df` (светло-бежевый)
- **Акцентный цвет**: `#e6a881` (теплый персиковый)
- **Темный акцент**: `#e8ceb5` (светло-коричневый)
- **Текст**: `#333333` (темно-серый)

### Компоненты UI
- Material-UI с кастомной темой
- Адаптивный дизайн (mobile-first)
- Современные карточки с тенями
- Плавные анимации и переходы

## 🔧 API Endpoints

### Аутентификация
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `POST /api/auth/logout` - Выход
- `GET /api/auth/me` - Профиль пользователя
- `POST /api/auth/refresh` - Обновление токена

### Корты
- `GET /api/courts` - Список кортов
- `GET /api/courts/:id` - Детали корта
- `GET /api/courts/:id/availability` - Доступность корта

### Бронирования
- `GET /api/bookings` - Мои бронирования
- `POST /api/bookings` - Создать бронирование
- `PUT /api/bookings/:id` - Обновить бронирование
- `DELETE /api/bookings/:id` - Отменить бронирование
- `GET /api/bookings/:id/qr` - QR-код бронирования

### Платежи
- `POST /api/payments/booking/:id/intent` - Создать платеж за бронирование
- `POST /api/payments/subscription/intent` - Создать платеж за абонемент
- `POST /api/payments/pass/intent` - Создать платеж за карту посещений

### Пользователи
- `GET /api/users/profile` - Профиль
- `PUT /api/users/profile` - Обновить профиль
- `GET /api/users/subscription` - Информация об абонементе
- `GET /api/users/passes` - Карты посещений
- `GET /api/users/loyalty` - Программа лояльности

### Администрирование
- `GET /api/admin/dashboard` - Статистика админ-панели
- `GET /api/admin/users` - Управление пользователями
- `GET /api/admin/bookings` - Управление бронированиями
- `GET /api/admin/analytics` - Аналитика

## 🔌 IoT Интеграция

### MQTT Topics
- `sportairhub/climate/+/temperature` - Температура по кортам
- `sportairhub/climate/+/humidity` - Влажность
- `sportairhub/access/+/door` - Контроль доступа
- `sportairhub/pressure/+/level` - Давление в системе

### Автоматизация
- Автоматическое поддержание климата
- Контроль доступа по QR-кодам
- Мониторинг оборудования
- Уведомления о неисправностях

## 📊 Аналитика

### Real-time метрики
- Активные пользователи
- Сегодняшние бронирования и доходы
- Загрузка кортов
- Системная нагрузка

### Отчеты
- Ежедневная статистика
- Почасовая аналитика
- Пользовательская активность
- Финансовые отчеты

## 🔐 Безопасность

- JWT аутентификация с refresh токенами
- Rate limiting для API
- CORS настройки
- Валидация входных данных
- Хеширование паролей (bcrypt)
- Защищенные маршруты

## 🚀 Деплой

### Подготовка к продакшену
1. Настройте переменные окружения для продакшена
2. Соберите React приложение: `cd client && npm run build`
3. Настройте MongoDB Atlas или собственный сервер
4. Настройте Stripe webhooks
5. Настройте SMTP для email уведомлений

### Рекомендуемый стек для деплоя
- **Hosting**: Render, Heroku, или VPS
- **Database**: MongoDB Atlas
- **File Storage**: AWS S3
- **Email**: SendGrid или Gmail SMTP
- **Monitoring**: LogRocket, Sentry

## 📝 Лицензия

MIT License - см. файл LICENSE

## 🤝 Вклад в проект

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📞 Поддержка

Если у вас есть вопросы или предложения:
- Создайте Issue в GitHub
- Email: support@sportairhub.com
- Telegram: @sportairhub_support

---

**SportAirHub** - Современные технологии для современного спорта! 🎾 