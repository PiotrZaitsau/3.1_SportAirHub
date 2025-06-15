# Установка и настройка SportAirHub

## 📋 Предварительные требования

### 1. Установка Node.js и npm

**macOS (рекомендуется через Homebrew):**
```bash
# Установка Homebrew (если не установлен)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Установка Node.js
brew install node

# Проверка установки
node --version
npm --version
```

**Альтернативный способ - через официальный сайт:**
1. Перейдите на https://nodejs.org/
2. Скачайте LTS версию (18.x или выше)
3. Установите скачанный пакет

**Windows:**
1. Скачайте Node.js с https://nodejs.org/
2. Запустите установщик
3. Перезапустите командную строку

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Установка MongoDB

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Windows:**
1. Скачайте MongoDB Community Server с https://www.mongodb.com/try/download/community
2. Установите и запустите как службу

**Linux:**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

### 3. Установка Git (если не установлен)

**macOS:**
```bash
brew install git
```

**Windows:**
Скачайте с https://git-scm.com/download/win

**Linux:**
```bash
sudo apt-get install git
```

## 🚀 Установка SportAirHub

### 1. Клонирование репозитория
```bash
git clone https://github.com/your-username/SportAirHub.git
cd SportAirHub
```

### 2. Установка зависимостей
```bash
# Установка зависимостей backend
npm install

# Установка зависимостей frontend
cd client
npm install
cd ..
```

### 3. Настройка переменных окружения

Создайте файл `.env` в корне проекта:
```bash
cp .env.example .env
```

Отредактируйте `.env` файл:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/sportairhub

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# Server
NODE_ENV=development
PORT=5000

# Email (для тестирования можно оставить пустым)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=SportAirHub <noreply@sportairhub.com>

# Stripe (для тестирования)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Frontend URL
CLIENT_URL=http://localhost:3000

# Остальные настройки можно оставить по умолчанию для разработки
```

### 4. Запуск проекта

**Запуск только backend:**
```bash
npm run dev
```

**Запуск только frontend:**
```bash
cd client
npm start
```

**Запуск обоих одновременно (рекомендуется):**
```bash
npm run dev:full
```

После запуска:
- Backend API: http://localhost:5000
- Frontend: http://localhost:3000

## 🔧 Настройка внешних сервисов

### Stripe (для платежей)

1. Зарегистрируйтесь на https://stripe.com/
2. Получите тестовые ключи в Dashboard > Developers > API keys
3. Добавьте ключи в `.env` файл

### Email (для уведомлений)

**Gmail SMTP:**
1. Включите 2FA в Google аккаунте
2. Создайте App Password: https://myaccount.google.com/apppasswords
3. Используйте App Password в EMAIL_PASS

### MongoDB Atlas (для продакшена)

1. Создайте аккаунт на https://www.mongodb.com/atlas
2. Создайте кластер
3. Получите connection string
4. Замените MONGODB_URI в `.env`

## 🐛 Решение проблем

### Ошибка "command not found: npm"
- Убедитесь, что Node.js установлен правильно
- Перезапустите терминал
- Проверьте PATH: `echo $PATH`

### Ошибка подключения к MongoDB
```bash
# Проверьте, запущен ли MongoDB
brew services list | grep mongodb  # macOS
sudo systemctl status mongod       # Linux

# Запустите MongoDB если не запущен
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### Порт уже занят
```bash
# Найдите процесс на порту 5000
lsof -i :5000

# Завершите процесс
kill -9 <PID>
```

### Ошибки установки зависимостей
```bash
# Очистите кэш npm
npm cache clean --force

# Удалите node_modules и переустановите
rm -rf node_modules client/node_modules
npm run setup
```

## 📱 Тестирование

### Создание тестового пользователя

1. Откройте http://localhost:3000
2. Нажмите "Регистрация"
3. Заполните форму:
   - Email: test@sportairhub.com
   - Пароль: Test123!
   - Имя: Test User

### Тестовые данные

Проект автоматически создаст тестовые корты при первом запуске.

### Тестовые платежи Stripe

Используйте тестовые карты:
- Успешная оплата: 4242 4242 4242 4242
- Отклоненная карта: 4000 0000 0000 0002
- Любая дата в будущем и любой CVC

## 🔄 Обновление проекта

```bash
# Получите последние изменения
git pull origin main

# Обновите зависимости
npm install
cd client && npm install && cd ..

# Перезапустите проект
npm run dev:full
```

## 📊 Мониторинг

### Логи
Логи сохраняются в `logs/app.log`

### База данных
Подключитесь к MongoDB:
```bash
mongosh sportairhub
```

### API тестирование
Используйте Postman или curl для тестирования API endpoints.

## 🚀 Готово!

После выполнения всех шагов у вас должен работать полнофункциональный SportAirHub:

1. ✅ Backend API на порту 5000
2. ✅ React frontend на порту 3000  
3. ✅ MongoDB база данных
4. ✅ Real-time уведомления через Socket.io
5. ✅ Система аутентификации
6. ✅ Интеграция с платежами

Откройте http://localhost:3000 и начните использовать SportAirHub! 