FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
COPY lang.json ./

RUN npx tsc

EXPOSE 10000

CMD ["node", "out/index.js"]
