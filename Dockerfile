# ARG BUILD_FROM
# FROM $BUILD_FROM
FROM node

WORKDIR /home/node/app

COPY package*.json ./

RUN npm i

COPY . .

RUN npm run build

CMD [ "npm", "start" ]