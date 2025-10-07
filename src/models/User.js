const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    pin: {
      type: String,
      required: true,
      // REMOVE maxlength - we store hashed pin (60 chars), not plain pin (4 chars)
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["owner", "waitress", "kitchen", "juicebar"],
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Hash PIN before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("pin")) return next();

  // Validate plain pin is 4 digits before hashing
  if (!/^\d{4}$/.test(this.pin)) {
    throw new Error("PIN must be exactly 4 digits");
  }

  this.pin = await bcrypt.hash(this.pin, 12);
  next();
});

// Compare PIN
userSchema.methods.comparePin = async function (candidatePin) {
  return await bcrypt.compare(candidatePin, this.pin);
};

module.exports = mongoose.model("User", userSchema);
