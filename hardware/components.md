# Hardware Components

This document lists the hardware used in the Intelligent System for Water Quality Monitoring, the reasons behind each choice and the wiring of the transmitter node.

## 1. Overview

| Component | Reference | Role |
|---|---|---|
| Transmitter board | Heltec LoRa32 v2 (ESP32) | Reads the sensors and transmits over LoRa |
| Receiver board | Heltec LoRa32 v3 (ESP32) | Receives LoRa frames and publishes them over Wi-Fi |
| Temperature sensor | DS18B20 | Water temperature |
| TDS sensor | Gravity analog TDS sensor | Total dissolved solids |
| pH sensor | SEN0161 | Acidity / alkalinity |
| ADC | ADS1115 | Reads the analog outputs of the TDS and pH sensors |

## 2. Transmitter Board - Heltec LoRa32 v2

The transmitter is built around the Heltec WiFi LoRa 32 development board, which integrates:

- an ESP32 dual-core microcontroller (240 MHz, 520 KB SRAM),
- an SX1276 LoRa transceiver,
- a 0.96" OLED display,
- a USB-to-serial interface.

This board was selected because:

- the dual-core architecture handles sensor reading and LoRa transmission concurrently without blocking,
- the LoRa transceiver is embedded, so no additional communication module is needed,
- the OLED display shows sensor readings directly on the device during field tests,
- the TDS and pH sensors provide analog voltage outputs that can be read through an ADC.

Since the board stays connected to Wi-Fi, it also sends the e-mail alerts directly, without relying on another component of the system.

## 3. Receiver Board - Heltec LoRa32 v3

The receiver only receives incoming LoRa frames and forwards the decoded data to the MQTT broker over Wi-Fi. Using Heltec LoRa32 boards for both nodes provides:

- full radio compatibility, with the same 868 MHz operation and identical modulation parameters on both sides,
- Wi-Fi connectivity for MQTT publishing, without extra hardware,
- simplified hardware management, with a single board family for both nodes (fewer spare parts, simpler firmware maintenance),
- an onboard OLED display for local feedback on the receiver side, useful during deployment and debugging.

The receiver needs no external sensor and no wiring other than its USB power cable.

## 4. Sensors

| Sensor | Parameter | Range | Interface | Protocol |
|---|---|---|---|---|
| DS18B20 | Water temperature | -55 to +125 degC | Digital | 1-Wire |
| TDS sensor (Gravity) | Total dissolved solids | 0 to 1000 ppm | Analog | ADC |
| pH sensor (SEN0161) | Acidity / alkalinity | 0 to 14 pH | Analog | ADC |

### 4.1 DS18B20 - water temperature

Water temperature affects the accuracy of the TDS and pH readings and is itself an indicator of water quality. The DS18B20 was selected because it is waterproof by design, which is mandatory for a sensor immersed in water, and because its digital 1-Wire output uses a single GPIO pin of the ESP32, leaving the analog channels to the TDS and pH sensors.

### 4.2 TDS sensor (Gravity analog)

Elevated TDS levels signal a potential contamination of the water source. The sensor provides an analog voltage output that can be read directly, with no additional conversion circuit between the sensor and the microcontroller. This simplifies the wiring and reduces the risk of interference in the measurement chain.

### 4.3 pH sensor (SEN0161)

The pH determines whether the monitored water is suitable for consumption or irrigation. The sensor outputs an analog voltage proportional to the pH value. Its signal conditioning board is integrated in the module, so no additional amplification circuit is required.

## 5. Transmitter Wiring

The transmitter node is assembled on a breadboard around the Heltec LoRa32 board.

| Device | Pin | Connected to |
|---|---|---|
| ADS1115 | VCC | 3.3 V |
| ADS1115 | GND | GND |
| ADS1115 | SDA | GPIO 4 |
| ADS1115 | SCL | GPIO 15 |
| ADS1115 | ADDR | GND |
| DS18B20 | VCC | 3.3 V |
| DS18B20 | GND | GND |
| DS18B20 | DATA | GPIO 17 |
| TDS sensor | VCC | 3.3 V |
| TDS sensor | GND | GND |
| TDS sensor | Analog output | A0 (ADS1115) |
| pH sensor (SEN0161) | VCC | 3.3 V |
| pH sensor (SEN0161) | GND | GND |
| pH sensor (SEN0161) | Analog output | A1 (ADS1115) |

## 6. Sensor Tests

Each sensor was tested individually before being integrated into the full transmitter firmware, with the following procedure:

1. Upload a minimal test sketch that reads only the target sensor.
2. Open the Serial Monitor at 115200 baud.
3. Observe the printed values for at least 30 seconds.
4. Verify that the values are within the physically expected range.
5. Apply a controlled stimulus (for example warm water or a known pH buffer solution) and confirm that the sensor response is coherent.

## 7. Alert Thresholds

The firmware compares each measurement with the following safety thresholds for irrigation water:

| Parameter | Accepted range |
|---|---|
| Temperature | 5 to 35 degC |
| pH | 6.5 to 8.5 |
| TDS | up to 500 mg/L |
