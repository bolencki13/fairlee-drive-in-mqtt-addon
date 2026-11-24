ARG BUILD_FROM
FROM $BUILD_FROM

# Install requirements for add-on
RUN apk add --no-cache nodejs npm

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . /app

# Build, then drop dev dependencies from the image
RUN npm run build && npm prune --omit=dev --ignore-scripts

RUN chmod a+x /app/scripts/run.sh

CMD [ "/app/scripts/run.sh" ]
