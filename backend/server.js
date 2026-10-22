
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const meterRoutes = require("./routes/meterRoutes");
const authRoutes = require("./routes/authRoutes");
require("dotenv").config();
const readingRoutes = require("./routes/readingRoutes");
const consumptionRoutes = require("./routes/consumptionRoutes");
const forecastRoutes = require("./routes/forecastRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Smart Energy Meter API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/meters", meterRoutes);
app.use("/api/readings", readingRoutes);
app.use("/api/consumption", consumptionRoutes);  
app.use("/api/forecast", forecastRoutes);
// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});


// Connect to MongoDB and start the server
const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
