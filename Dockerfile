# Supervisor 2026.04+ builds with BuildKit and no longer passes BUILD_FROM, so default to the
# multi-platform base image. Older Supervisors that still pass BUILD_FROM keep working.
ARG BUILD_FROM=ghcr.io/home-assistant/base:latest
FROM ${BUILD_FROM}

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
