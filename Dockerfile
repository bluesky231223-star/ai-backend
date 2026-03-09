<<<<<<< HEAD
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node","server.js"]
=======
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node","server.js"]
>>>>>>> 96d210834366d341c6365d8450b96d5d09f33f5d
