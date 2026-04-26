# Quantavium — Онлайн платформа подготовки к экзаменам

Веб-приложение для подготовки к ЕГЭ и ОГЭ с системой авторизации, личным кабинетом и доступом к учебным материалам.

Проект реализует полный цикл работы онлайн-школы: регистрация пользователей, покупка курсов (тестовая логика), доступ к материалам и управление профилем.

---

## Функциональность

- Регистрация и авторизация пользователей (cookie + session)
- Хеширование паролей (bcrypt)
- Личный кабинет пользователя
- Покупка курсов (тестовая логика)
- Ограничение доступа к материалам
- Проверка доступа к курсам
- Защищённые API endpoints
- Работа с MongoDB
- Динамическое обновление интерфейса

---

## Технологии

### Backend
- Node.js
- Express
- MongoDB (mongoose)
- express-session
- bcrypt
- helmet
- rate-limit

### Frontend
- HTML / CSS / JavaScript
- Fetch API
- Cookie-based authentication

### Инфраструктура
- Docker
- Docker Compose

---

## Структура проекта

backend/
├── src/
│   ├── middleware/
│   ├── models/
│   └── server.js
├── Dockerfile

frontend/
├── index.html
├── profile.html
├── ege.html
├── oge.html
├── js/

docker-compose.yml

---

## Запуск проекта

### 1. Клонирование

git clone https://github.com/YAroslav10Ti/quantavium.git  
cd quantavium

---

### 2. Создание .env

Создай файл `.env` в папке backend:

MONGODB_URI=mongodb://mongo:27017/quantavium  
SESSION_SECRET=your_secret_key  
PORT=3000  

---

### 3. Запуск

docker compose up -d

---

### 4. Открыть в браузере

http://localhost:3000

---

## Основные API

- POST /api/auth/register — регистрация
- POST /api/auth/login — авторизация
- GET /api/auth/me — текущий пользователь
- POST /api/purchase — покупка курса
- GET /api/courses — получение курсов

---

## Особенности реализации

- Cookie-based авторизация (session)
- Хеширование паролей
- Защита от CSRF
- Ограничение количества запросов (rate limiting)
- Проверка доступа к курсам на backend и frontend

---

## Статус проекта

Проект был задеплоен и доступен в интернете.  
Платформа тестировалась примерно 50 пользователями, включая учеников.

В рамках проекта я полностью отвечал за техническую часть: backend, работу с базой данных, авторизацию и доступ к учебным материалам.

---

## Возможные улучшения

- Интеграция реальной платежной системы
- Админ-панель
- Переход на React
- Логи и мониторинг

---

## Автор

YAroslav10Ti