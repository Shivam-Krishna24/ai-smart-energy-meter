
const mongoose = require("mongoose");

const readingSchema = new mongoose.Schema(
  {
    meter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meter",
      required: true,
      index: true,
    },

    voltage: {
      type: Number,
      required: true,
      min: 0,
    },

    current: {
      type: Number,
      required: true,
      min: 0,
    },

    power: {
      type: Number,
      required: true,
      min: 0,
    },

    energy: {
      type: Number,
      required: true,
      min: 0,
    },

    measuredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: true }
);

readingSchema.index({ meter: 1, measuredAt: -1 });

module.exports = mongoose.model("Reading", readingSchema);
