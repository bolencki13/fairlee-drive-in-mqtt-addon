#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

cd /app || bashio::exit.nok "Missing /app"

# Prints an add-on option, or the fallback when it is unset/empty
option() {
  if bashio::config.has_value "$1"; then
    bashio::config "$1"
  else
    echo "$2"
  fi
}

if bashio::config.has_value 'mqtt_host'; then
  MQTT_HOST=$(bashio::config 'mqtt_host')
  MQTT_PORT=$(option 'mqtt_port' '1883')
  MQTT_USERNAME=$(option 'mqtt_username' '')
  MQTT_PASSWORD=$(option 'mqtt_password' '')
  bashio::log.info "Using MQTT broker from add-on options: ${MQTT_HOST}:${MQTT_PORT}"
elif bashio::services.available 'mqtt'; then
  MQTT_HOST=$(bashio::services 'mqtt' 'host')
  MQTT_PORT=$(bashio::services 'mqtt' 'port')
  MQTT_USERNAME=$(bashio::services 'mqtt' 'username')
  MQTT_PASSWORD=$(bashio::services 'mqtt' 'password')
  bashio::log.info "Using MQTT broker from Home Assistant: ${MQTT_HOST}:${MQTT_PORT}"
else
  bashio::exit.nok "No MQTT broker found. Install the Mosquitto broker add-on or set mqtt_host in the add-on options."
fi

export MQTT_HOST MQTT_PORT MQTT_USERNAME MQTT_PASSWORD

# exec so node receives SIGTERM and can mark the device offline on shutdown
exec node /app/dist/index.js
