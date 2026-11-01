# Communication Setup

This document describes how the measurements travel from the sensors to the dashboard: a LoRa link between the two nodes, Wi-Fi and MQTT between the receiver and the backend, and MQTT over WebSocket and REST calls for the dashboard.

## 1. Data Path

1. The transmitter (Heltec LoRa32 v2) reads the three sensors and sends the values over LoRa at 868 MHz.
2. The receiver (Heltec LoRa32 v3) decodes the packet and publishes the values on the `water/quality` topic of the HiveMQ broker over Wi-Fi.
3. The Flask backend subscribes to the broker, stores each reading in MongoDB, runs the XGBoost prediction and republishes the `waterHistory` structure (last 48 measurements).
4. The React dashboard subscribes to the same broker through WebSocket (MQTT.js) and updates its charts and indicators on each message.

## 2. LoRa Link

LoRa (Long Range) is a spread-spectrum modulation developed by Semtech for low-power, long-range IoT communications. It operates in the unlicensed ISM band, at 868 MHz in Europe and Tunisia, with ranges of 2 to 15 km in open environments.


### 2.1 Radio parameters

The same parameters are configured on both nodes.

| Parameter | Value |
|---|---|
| Frequency | 868 MHz |
| Spreading factor | SF7 |
| Bandwidth | 125 kHz |
| Coding rate | 4/5 |
| Library | LoRa library by Sandeep Mistry |

### 2.2 Payload

The transmitter reads the sensors periodically and formats the data as a comma-separated string, which is sent in a LoRa packet. The receiver parses this string and publishes the decoded values to the MQTT broker as a JSON message containing the pH, TDS and temperature.

## 3. Receiver: Wi-Fi and MQTT

The receiver listens continuously for incoming LoRa packets, parses the payload and publishes the decoded values to the MQTT broker over Wi-Fi.

| Setting | Value |
|---|---|
| Protocol | MQTT |
| Broker | HiveMQ |
| Topic | `water/quality` |
| Arduino library | PubSubClient |

MQTT decouples the receiver from the rest of the system: the Flask backend and the React dashboard both subscribe to the broker and consume the incoming data independently.

## 4. Backend

The Flask backend subscribes to the broker and exposes a REST API.

| Endpoint | Description |
|---|---|
| `/measure` | Stores an incoming measurement in MongoDB |
| `/predict` | Returns the potability prediction and its confidence for the given pH and TDS values |
| `/history` | Returns the last 48 measurements |

Measurements are stored in the `measurements` collection of a local MongoDB instance (`mongodb://localhost:27017/`).

## 5. Dashboard

The dashboard connects to the HiveMQ broker through WebSocket with MQTT.js and subscribes to the `water/quality` topic. On each JSON message, the data is parsed, timestamped and stored in the state (last 48 points). The dashboard also calls the Flask API to save measurements, request predictions and load the history. If the backend is stopped, it falls back to the measurements kept in `localStorage` after a failed `/history` call.

## 6. E-mail Alerts

The transmitter is permanently connected to Wi-Fi, so it sends e-mail alerts by itself, independently of the LoRa link and of the dashboard.

| Setting | Value |
|---|---|
| Library | EMailSender |
| Server | Gmail SMTP, port 465, SSL |
| Trigger | Temperature outside 5-35 degC, pH outside 6.5-8.5, TDS above 500 mg/L |
| Content | Triggering parameter, measured value and configured threshold |
| Cooldown | 6 minutes between two alerts |

