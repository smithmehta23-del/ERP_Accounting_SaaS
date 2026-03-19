const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },
  plan: {
    type: String,
    enum: ["free", "pro", "premium"],
    default: "free"
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);