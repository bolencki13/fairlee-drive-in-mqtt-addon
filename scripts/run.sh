#!/usr/bin/with-contenv bashio

cd /app

# Create main config
CONFIG_MQTT_HOST=$(bashio::config 'mqtt_host')
CONFIG_MQTT_USERNAME=$(bashio::config 'mqtt_username')
CONFIG_MQTT_PASSWORD=$(bashio::config 'mqtt_password')

# Launch server
MQTT_HOST="${CONFIG_MQTT_HOST}" MQTT_USERNAME="${CONFIG_MQTT_USERNAME}" MQTT_PASSWORD="${CONFIG_MQTT_PASSWORD}" npm start