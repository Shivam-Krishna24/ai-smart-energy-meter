
const express = require("express");
const mongoose = require("mongoose");
const Reading = require("../models/Reading");
const Meter = require("../models/Meter");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Configure this according to the applicable electricity tariff.
// This is an illustrative flat rate, not an official tariff.
const RATE_PER_KWH = 7;

// GET /api/consumption/:meterId?period=daily
// GET /api/consumption/:meterId?period=monthly

router.get("/:meterId", authMiddleware, async (req, res) => {
  try {
    const { meterId } = req.params;
    const period = req.query.period || "daily";

    if (!mongoose.isValidObjectId(meterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid meter ID",
      });
    }

    if (!["daily", "monthly"].includes(period)) {
      return res.status(400).json({
        success: false,
        message: "Period must be daily or monthly",
      });
    }

    // Verify that this meter belongs to the logged-in user.
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

    // Use the server's local timezone for this initial version.
    const now = new Date();
    const start = new Date(now);

    if (period === "daily") {
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    // Get the last reading before the period begins.
    const previousReading = await Reading.findOne({
      meter: meter._id,
      measuredAt: { $lt: start },
    }).sort({ measuredAt: -1 });

    // Get readings within the requested period.
    const readings = await Reading.find({
      meter: meter._id,
      measuredAt: {
        $gte: start,
        $lte: now,
      },
    }).sort({ measuredAt: 1 });

    if (readings.length === 0) {
      return res.status(200).json({
        success: true,
        meterId: meter.meterId,
        period,
        consumptionKWh: 0,
        estimatedBill: 0,
        ratePerKWh: RATE_PER_KWH,
        message: "No readings are available for this period",
      });
    }

    const baseline =
      previousReading || readings[0];

    const latestReading = readings[readings.length - 1];

    const consumptionKWh =
      latestReading.energy - baseline.energy;

    // A negative result may indicate a meter reset or bad data.
    if (consumptionKWh < 0) {
      return res.status(422).json({
        success: false,
        message:
          "Cumulative energy decreased. Check for a meter reset or inconsistent readings.",
      });
    }

    const estimatedBill = consumptionKWh * RATE_PER_KWH;

    res.status(200).json({
      success: true,
      meterId: meter.meterId,
      period,
      start,
      end: now,
      consumptionKWh: Number(consumptionKWh.toFixed(3)),
      ratePerKWh: RATE_PER_KWH,
      estimatedBill: Number(estimatedBill.toFixed(2)),
      currency: "INR",
      readingsCount: readings.length,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to calculate consumption",
    });
  }
});

module.exports = router;
