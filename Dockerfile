ARG BUILD_FROM
FROM $BUILD_FROM

# Install requirements for add-on
RUN \
  apk add --no-cache nodejs npm

WORKDIR /app

COPY . /app

# Build produciton
RUN npm -v
RUN node -v
RUN npm install

RUN npm run build

RUN chmod a+x /app/scripts/run.sh

CMD [ "/app/scripts/run.sh" ]