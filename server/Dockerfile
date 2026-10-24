FROM node:22-slim
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.js auth.js totp.js ui.js ./
USER node
EXPOSE 3000
CMD ["node", "index.js"]
