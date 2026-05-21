# 🦾 Servo Robotic Arm

> A multi-DOF robotic arm controlled wirelessly via a browser interface, powered by ESP32.

[![ESP32](https://img.shields.io/badge/ESP32-E7352C?style=flat-square&logo=espressif&logoColor=white)](https://www.espressif.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)]()

---

## 📌 Overview

A servo-actuated robotic arm controlled entirely through a browser. The ESP32 runs a lightweight web server that receives joint angle commands from a web UI and drives servo motors in real time — no dedicated app or software needed.

## ✨ Features

- **Browser-based control** — Control all joints from any device with a browser
- **Real-time servo response** — Commands sent over HTTP/WebSocket, executed instantly
- **Multi-joint control** — Shoulder, elbow, wrist, and gripper independently controlled
- **Smooth motion** — Software interpolation prevents jerky movements
- **Wi-Fi hosted** — No external server needed, ESP32 serves the UI directly

## 🛠️ Hardware

| Component | Part |
|---|---|
| MCU | ESP32 DevKit V1 |
| Servos | SG90 / MG996R (per joint) |
| Power | 5V regulated supply |
| Structure | 3D-printed arm linkages |

## 🚀 Getting Started

```bash
git clone https://github.com/CodingMain-Ath/Moving-Arm.git
cd Moving-Arm
# Flash to ESP32 via PlatformIO
# Connect to ESP32 Wi-Fi hotspot
# Navigate to 192.168.4.1 in browser
```

## 🕹️ Control Interface

The web UI provides sliders for each joint:
- **Base rotation** — 0° to 180°
- **Shoulder** — 0° to 180°
- **Elbow** — 0° to 135°
- **Gripper** — Open / Close

## 📄 License
MIT © Atharv Huilgol
