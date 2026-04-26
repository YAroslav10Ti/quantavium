FROM node:20-alpine

WORKDIR /app

# backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# copy sources
COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend

EXPOSE 3000

CMD ["node", "src/server.js"]
