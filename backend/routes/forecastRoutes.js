
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");

const Meter = require("../models/Meter");
const Reading = require("../models/Reading");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";

router.get("/:meterId", authMiddleware, async (req, res) => {
  try {
    const { meterId } = req.params;

    if (!mongoose.isValidObjectId(meterId)) {
      return res.status(400).json({
        message: "Invalid meter ID.",
      });
    }

    const meter = await Meter.findOne({
      _id: meterId,
      owner: req.userId,
    });

    if (!meter) {
      return res.status(404).json({
        message: "Meter not found.",
      });
    }

    const readings = await Reading.find({
      meter: meter._id,
    })
      .select("measuredAt energy")
      .sort({ measuredAt: 1 })
      .lean();

    if (readings.length < 2) {
      return res.status(400).json({
        message: "At least two readings are required for forecasting.",
      });
    }

    const response = await axios.post(
      `${ML_SERVICE_URL}/forecast`,
      {
        readings: readings.map((reading) => ({
          measuredAt: reading.measuredAt,
          energy: reading.energy,
        })),
      },
      { timeout: 20000 }
    );

    return res.json({
      meterId: meter.meterId,
      meterName: meter.name,
      ...response.data,
    });
  } catch (error) {
    console.error(
      "Forecast error:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 502).json({
      message:
        error.response?.data?.detail ||
        "Unable to generate the energy forecast.",
    });
  }
});

module.exports = router;
