# Expo dev server (Metro). Source is bind-mounted by docker compose for live reload.
FROM node:22-slim
WORKDIR /app
RUN npm install -g @expo/ngrok@4
COPY package.json package-lock.json ./
RUN npm ci
EXPOSE 8081
CMD ["sh", "-c", "npx expo start --port 8081 $EXPO_START_ARGS"]
