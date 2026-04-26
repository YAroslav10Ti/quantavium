const mongoose = require('mongoose');

const PurchaseSchema = new mongoose.Schema(
  {
    course: { type: String, required: true }, // "егэ" | "огэ"
    purchasedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    // Имя не обязательно (оставляем только email + пароль)
    name: { type: String, default: '', trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    purchases: { type: [PurchaseSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);