
const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

const PORT = process.env.SIMULATOR_PORT || 6000;
const BACKEND_URL =
  process.env.BACKEND_URL || "http://localhost:5000/api";

let token = null;
let latestReading = null;
let energy = 0;
let simulationTimer = null;
let lastReadingTime = null;
let running = false;

const backend = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10000,
});

// Log in to the existing Energy Meter backend
async function loginToBackend() {
  const response = await backend.post("/auth/login", {
    email: process.env.AUTH_EMAIL,
    password: process.env.AUTH_PASSWORD,
  });

  token = response.data.token;

  if (!token) {
    throw new Error("Login succeeded without returning a token.");
  }

  console.log("Simulator authenticated with backend.");
}

// Load the latest cumulative energy to avoid resetting it
async function loadPreviousEnergy() {
  const response = await backend.get(
    `/readings/${process.env.METER_ID}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const readings = response.data.readings || [];

  if (readings.length > 0) {
    energy = Number(readings[0].energy);
  }

  console.log("Starting cumulative energy:", energy, "kWh");
}

// Generate one simulated sensor reading
async function generateReading() {
  try {
    const now = Date.now();

    const elapsedSeconds = lastReadingTime
      ? (now - lastReadingTime) / 1000
      : 0;

    lastReadingTime = now;

    // Simulate a household electrical supply and changing load
    const voltage = 228 + Math.random() * 4;
    const current = 0.2 + Math.random() * 1.8;
    const power = voltage * current;

    // Integrate power over elapsed time to calculate energy
    energy += (power * elapsedSeconds) / 3600000;

    const reading = {
      voltage: Number(voltage.toFixed(1)),
      current: Number(current.toFixed(3)),
      power: Number(power.toFixed(1)),
      energy: Number(energy.toFixed(6)),
      measuredAt: new Date(now).toISOString(),
    };

    await backend.post(
      `/readings/${process.env.METER_ID}`,
      reading,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    latestReading = reading;

    console.log(
      `[${reading.measuredAt}]`,
      `Voltage: ${reading.voltage} V |`,
      `Current: ${reading.current} A |`,
      `Power: ${reading.power} W |`,
      `Energy: ${reading.energy} kWh`
    );
  } catch (error) {
    console.error(
      "Reading submission failed:",
      error.response?.data || error.message
    );
  }
}

// Start the simulator
async function startSimulation() {
  if (running) return;

  if (
    !process.env.METER_ID ||
    !process.env.AUTH_EMAIL ||
    !process.env.AUTH_PASSWORD
  ) {
    throw new Error(
      "Set METER_ID, AUTH_EMAIL and AUTH_PASSWORD in .env"
    );
  }

  await loginToBackend();
  await loadPreviousEnergy();

  running = true;
  lastReadingTime = null;

  // Send the first reading, then continue every 10 seconds
  await generateReading();

  simulationTimer = setInterval(generateReading, 10000);
  console.log("ESP32 simulator is running.");
}

// Simulator health/status endpoint
app.get("/health", (req, res) => {
  res.json({
    server: "ESP32 Simulator",
    running,
    latestReading,
  });
});

// Start and stop controls for local testing
app.post("/start", async (req, res) => {
  try {
    await startSimulation();
    res.json({ message: "Simulation started." });
  } catch (error) {
    console.error("Could not start simulator:", error.message);
    res.status(500).json({
      message: "Could not start simulator. Check the backend and .env.",
    });
  }
});

app.post("/stop", (req, res) => {
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }

  running = false;
  res.json({ message: "Simulation stopped." });
});

app.listen(PORT, async () => {
  console.log(`ESP32 Simulator API: http://localhost:${PORT}`);

  try {
    await startSimulation();
  } catch (error) {
    console.error("Automatic startup failed:", error.message);
    console.log("Fix the configuration, then POST to /start.");
  }
});
