# your node version
FROM node:20-alpine AS deps-prod

WORKDIR /app

COPY ./package*.json .

RUN npm install --omit=dev

FROM deps-prod AS build

RUN npm install --include=dev

COPY . .

RUN npm run build

FROM node:20-alpine AS prod

# Устанавливаем tzdata для синхронизации времени
RUN apk add --no-cache tzdata

# Устанавливаем часовой пояс
ENV TZ=UTC

WORKDIR /app

COPY --from=build /app/package*.json .
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist