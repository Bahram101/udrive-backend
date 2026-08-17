FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --verbose

COPY . . 

RUN npx prisma generate

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]