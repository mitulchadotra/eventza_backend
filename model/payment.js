
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    // Aapke existing user model ka naam userData hai.
    // Agar actual mongoose.model name "User" hai,
    // to ref ko "User" kar dein.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userData",
      required: true,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
    },

    userName: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    eventTitle: { type: String, default: "", trim: true },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
    },

    paymentMethod: {
      type: String,
      enum: ["UPI", "Card", "Cash", "Netbanking", "Wallet", "EMI"],
      default: "UPI",
    },

    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },

    razorpayOrderId: {
      type: String,
      unique: true,
      sparse: true,
    },

    razorpayPaymentId: {
      type: String,
      default: "",
    },

    razorpaySignature: {
      type: String,
      default: "",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed", "refunded"],
      default: "pending",
    },

    paymentDate: {
      type: Date,
      default: null,
    },

    description: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const Payment =
  mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);

export default Payment;
