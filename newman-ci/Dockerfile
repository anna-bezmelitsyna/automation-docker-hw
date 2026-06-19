# Образ із Newman + htmlextra-репортером для прогону Postman-колекцій.
FROM node:20-alpine

WORKDIR /app

# Спочатку лише маніфести — щоб шар із npm-install кешувався,
# поки package.json / package-lock.json не змінюються.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Потім колекції, оточення, тест-дані та сам раннер.
COPY . .

# Звіти пишуться сюди; каталог монтується назовні (Jenkins / docker compose).
# 777 — щоб контейнер міг писати під будь-яким UID (docker run -u ...).
RUN mkdir -p /app/reports && chmod -R 777 /app/reports
ENV REPORTS_DIR=/app/reports

# За замовчуванням — прогнати весь активний тест-план.
CMD ["node", "run-tests.js"]
