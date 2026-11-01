# Intelligent System for Water Quality Monitoring

Final Year Project (PFA) - National School of Electronics and Telecommunications of Sfax (ENET'Com), University of Sfax.

- Order number: PFA-GEC-26-15
- Authors: Chahd Hammadi, Aicha Damak
- Supervisor: Mr. Fathi Kallel
- Reporter: Mr. Kais Jammousi
- Defended on: 22/04/2026

## Overview

This project is a low-cost IoT system that continuously measures the physico-chemical parameters of irrigation water (temperature, total dissolved solids and pH), transmits them over long distances with LoRa, and makes them available in real time through a web dashboard.

It addresses a concrete need in Tunisia, one of the most water-stressed countries in the world, where water sources are often far from any network infrastructure. Wi-Fi and Bluetooth do not cover these areas, and laboratory analysis only provides spot measurements. LoRa offers long range and low power consumption without any network infrastructure.

## Objectives

- Design an embedded transmitter node based on the Heltec LoRa32 (ESP32) with a DS18B20 temperature sensor, a TDS sensor and a pH sensor.
- Establish a point-to-point LoRa link at 868 MHz between two nodes.
- Build a receiver node that decodes LoRa frames and publishes them over Wi-Fi to an MQTT broker (HiveMQ).
- Develop a backend that stores the measurements and predicts water potability with a machine learning model.
- Build a real-time web dashboard with live indicators, history and threshold-based alerts.
- Validate each layer of the system through unit and integration tests.

## System Architecture

The system is organised in four layers.

| Layer | Components | Role |
|---|---|---|
| Data acquisition | DS18B20, TDS sensor (Gravity), pH sensor (SEN0161), Heltec LoRa32 v2 | Read the sensors and format the data frame |
| Wireless transmission | LoRa 868 MHz, Heltec LoRa32 v3 | Carry the frame to the receiver and forward it over Wi-Fi |
| Backend | MQTT (HiveMQ), Flask, MongoDB, XGBoost | Storage, prediction, REST API |
| Visualization | React/JSX, Chart.js, MQTT.js | Real-time display of measurements, history and alerts |

Data flow: the transmitter reads the sensors and sends the values over LoRa. The receiver decodes the packet and publishes it on the `water/quality` MQTT topic. The Flask backend and the React dashboard both subscribe to the broker. The backend stores each reading in MongoDB, runs the XGBoost prediction and exposes the history through its REST API. The dashboard updates its charts and indicators on each incoming message.

## Hardware

| Element | Reference |
|---|---|
| Transmitter board | Heltec LoRa32 v2 (ESP32, SX1276, 0.96" OLED) |
| Receiver board | Heltec LoRa32 v3 (ESP32) |
| Water temperature | DS18B20, 1-Wire, -55 to +125 degC |
| Total dissolved solids | Gravity analog TDS sensor, 0 to 1000 ppm |
| pH | SEN0161, 0 to 14 pH |
| ADC | ADS1115 |

Transmitter wiring: the ADS1115 is connected on SDA = GPIO 4 and SCL = GPIO 15 (ADDR to GND), the DS18B20 data line on GPIO 17, the TDS sensor on ADS1115 channel A0 and the pH sensor on channel A1. All devices are powered at 3.3 V.

More details are given in `hardware/components.md` and `hardware/communication_setup.md`.

## Software Stack

- Embedded firmware: Arduino IDE, C++ (Arduino framework), LoRa library by Sandeep Mistry, PubSubClient, OneWire, DallasTemperature, Adafruit ADS1X15, Adafruit SSD1306, EMailSender.
- Backend: Python, Flask, PyMongo, MongoDB, XGBoost, scikit-learn, numpy, pandas.
- Dashboard: React/JSX, Chart.js, MQTT.js, react-router-dom, Node.js/npm (development toolchain only).
- Transport: MQTT with the public HiveMQ broker.

## Backend API

| Endpoint | Description |
|---|---|
| `/measure` | Stores an incoming measurement in MongoDB |
| `/predict` | Receives pH and TDS values and returns the potability prediction with a confidence percentage |
| `/history` | Returns the last 48 measurements, used to initialise the dashboard charts |

Measurements are stored in the `measurements` collection with the fields `ph`, `tds`, `temp`, `timestamp` and `created_at`. The XGBoost model is saved as `water_quality.pkl` and loaded once at Flask startup.

## Dashboard

The dashboard has four pages:

- Dashboard: current pH, TDS and temperature, number of alerts in the last 24 hours, AI prediction card (safe or unsafe with a confidence percentage), charts of the last four hours and the recent alerts feed.
- History: charts of the last 48 points, statistics (average, minimum, maximum, percentage variation) and a table with timestamp, values, status and AI prediction.
- Alerts: all generated alerts with date, message, measured value, threshold and severity.
- About: project description and technologies.

The interface supports a light and a dark theme. If the Flask backend is unavailable, the dashboard falls back to the last 48 measurements kept in `localStorage`.

## Alert Thresholds

Thresholds are defined for irrigation water.

| Parameter | Accepted range |
|---|---|
| Temperature | 5 to 35 degC |
| pH | 6.5 to 8.5 |
| TDS | up to 500 mg/L |

When a value is outside its range, the transmitter sends an e-mail through SMTP (Gmail, port 465, SSL) with the parameter, the measured value and the configured threshold. A cooldown of 6 minutes is applied between two alerts. This mechanism works independently of the LoRa link and of the dashboard.

## AI Model

The model is trained on the "Water Quality Prediction" dataset from Kaggle, reduced to the pH and Total Dissolved Solids features and the potability target (0 = not potable, 1 = potable). The data is split 70/15/15 with stratification, class imbalance is handled with `scale_pos_weight`, and the hyperparameters (`n_estimators`, `max_depth`, `learning_rate`, `subsample`) are tuned by grid search on the validation set.


On the test set, the final XGBoost model reaches an accuracy of 82.12 %. With only two features, the recall on the potable class stays moderate, so the model should be used as a secondary alert filter and not as an autonomous decision maker.



## References

The complete bibliography is given in the final report. The main sources are the Heltec LoRa32 documentation, the Semtech SX1276 datasheet, the DFRobot TDS and pH sensor datasheets, the Maxim DS18B20 datasheet, Chen and Guestrin (XGBoost, 2016), the WHO Guidelines for Drinking-water Quality and the FAO Irrigation and Drainage Paper No. 29.
