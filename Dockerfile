ARG BUILD_FROM
FROM $BUILD_FROM

# Install requirements for add-on
RUN \
  apk add --no-cache nodejs npm

WORKDIR /home/node/app

COPY package*.json ./

RUN npm i

COPY . .

RUN npm run build

CMD [ "npm", "start" ]