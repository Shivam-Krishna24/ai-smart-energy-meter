
const express = require("express");
const Meter = require("../models/Meter");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Register a meter for the logged-in user
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { meterId, name, location } = req.body;

    if (
      typeof meterId !== "string" ||
      !meterId.trim() ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "meterId and name are required",
      });
    }

    const meter = await Meter.create({
      meterId: meterId.trim(),
      name: name.trim(),
      location:
        typeof location === "string" ? location.trim() : "",
      owner: req.userId,
    });

    res.status(201).json({
      success: true,
      message: "Meter registered successfully",
      meter,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This meter ID already exists",
      });
    }

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to register meter",
    });
  }
});

// Retrieve only the logged-in user's meters
router.get("/", authMiddleware, async (req, res) => {
  try {
    const meters = await Meter.find({
      owner: req.userId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: meters.length,
      meters,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve meters",
    });
  }
});

module.exports = router;
