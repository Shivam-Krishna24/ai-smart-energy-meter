
const express = require("express");
const mongoose = require("mongoose");
const Reading = require("../models/Reading");
const Meter = require("../models/Meter");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Save a reading for an owned meter
router.post("/:meterId", authMiddleware, async (req, res) => {
  try {
    const { meterId } = req.params;
    const { voltage, current, power, energy, measuredAt } = req.body;

    if (!mongoose.isValidObjectId(meterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid meter ID",
      });
    }

    const values = [voltage, current, power, energy];

    if (
      values.some(
        (value) =>
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Voltage, current, power and energy must be non-negative numbers",
      });
    }

    let timestamp = new Date();

    if (measuredAt !== undefined) {
      if (
        typeof measuredAt !== "string" ||
        !measuredAt.trim() ||
        !Number.isFinite(Date.parse(measuredAt))
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid measuredAt timestamp",
        });
      }

      timestamp = new Date(measuredAt);
    }

    const meter = await Meter.findOne({
      _id: meterId,
      owner: req.userId,
    });

    if (!meter) {
      return res.status(404).json({
        success: false,
        message: "Meter not found or access denied",
      });
    }

    const reading = await Reading.create({
      meter: meter._id,
      voltage,
      current,
      power,
      energy,
      measuredAt: timestamp,
    });

    res.status(201).json({
      success: true,
      message: "Reading saved successfully",
      reading,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to save reading",
    });
  }
});

// Retrieve readings for an owned meter
router.get("/:meterId", authMiddleware, async (req, res) => {
  try {
    const { meterId } = req.params;

    if (!mongoose.isValidObjectId(meterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid meter ID",
      });
    }

    const meter = await Meter.findOne({
      _id: meterId,
      owner: req.userId,
    });

    if (!meter) {
      return res.status(404).json({
        success: false,
        message: "Meter not found or access denied",
      });
    }

    const readings = await Reading.find({
      meter: meter._id,
    })
      .sort({ measuredAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      count: readings.length,
      readings,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve readings",
    });
  }
});

module.exports = router;
