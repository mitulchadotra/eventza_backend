
import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import Payment from "../model/payment.js";
import Booking from "../model/booking.js";

const getUserId = (req) =>
  req.user?._id || req.user?.id || req.user?.userId;

const getPaymentMethod = (method) => {
  const value = String(method || "").toLowerCase();

  const methods = {
    upi: "UPI",
    card: "Card",
    netbanking: "Netbanking",
    wallet: "Wallet",
    emi: "EMI",
    paylater: "Wallet",
  };

  return methods[value] || "UPI";
};

// ========================================
// CREATE RAZORPAY ORDER
// ========================================

export const createPaymentOrder = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { bookingId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      userId,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (
      String(booking.paymentStatus || "").toLowerCase() === "paid"
    ) {
      return res.status(400).json({
        success: false,
        message: "This booking is already paid",
      });
    }

    const amount = Number(
      booking.totalAmount ??
      (Number(booking.price) * Number(booking.quantity || 1))
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking amount",
      });
    }

    // Amount is stored in rupees; Razorpay requires paise.
    const amountInPaise = Math.round(amount * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `booking_${booking._id}`,
      notes: {
        bookingId: String(booking._id),
        userId: String(userId),
      },
    });

    const payment = await Payment.create({
      bookingId: booking._id,
      userId,
      eventId: booking.eventId || null,
      userName: req.user.name || booking.userName || "",
      email: req.user.email || booking.email || "",
      eventTitle: booking.eventTitle || "",
      amount,
      currency: "INR",
      paymentMethod: "UPI",
      razorpayOrderId: order.id,
      paymentStatus: "pending",
      description: `Payment for ${booking.eventTitle || "Event booking"}`,
    });

    return res.status(201).json({
      success: true,
      message: "Razorpay order created",
      key: process.env.RAZORPAY_KEY_ID,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      paymentId: payment._id,
    });
  } catch (error) {
    console.error("Create payment order error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to create payment order",
    });
  }
};

// ========================================
// VERIFY RAZORPAY PAYMENT
// ========================================

export const verifyPayment = async (req, res) => {
  try {
    const userId = getUserId(req);

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification details are missing",
      });
    }

    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
      userId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    if (payment.paymentStatus === "success") {
      return res.json({
        success: true,
        message: "Payment already verified",
        payment,
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const signatureBuffer = Buffer.from(generatedSignature);
    const receivedBuffer = Buffer.from(razorpay_signature);

    if (
      signatureBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, receivedBuffer)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // Verify payment details directly with Razorpay.
    const razorpayPayment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    if (
      razorpayPayment.order_id !== razorpay_order_id ||
      Number(razorpayPayment.amount) !== Math.round(payment.amount * 100) ||
      razorpayPayment.currency !== payment.currency
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment details do not match",
      });
    }

    // Do not mark authorized payments as successful.
    if (razorpayPayment.status !== "captured") {
      return res.status(409).json({
        success: false,
        message: `Payment is not captured. Current status: ${razorpayPayment.status}`,
      });
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.transactionId = razorpay_payment_id;
    payment.paymentMethod = getPaymentMethod(razorpayPayment.method);
    payment.paymentStatus = "success";
    payment.paymentDate = new Date();

    await payment.save();

    const booking = await Booking.findOneAndUpdate(
      {
        _id: payment.bookingId,
        userId,
      },
      {
        $set: {
          paymentStatus: "Paid",
          status: "Confirmed",
        },
      },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Payment verified, but booking was not found",
      });
    }

    return res.json({
      success: true,
      message: "Payment verified successfully",
      payment,
      booking,
    });
  } catch (error) {
    console.error("Verify payment error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Payment verification failed",
    });
  }
};

// ========================================
// GET LOGGED-IN USER PAYMENTS
// ========================================

export const getMyPayments = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const payments = await Payment.find({ userId })
      .populate("bookingId")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (error) {
    console.error("Get my payments error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ========================================
// ADMIN: GET ALL PAYMENTS
// ========================================

export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("bookingId")
      .sort({ createdAt: -1 });

    const totalRevenue = payments
      .filter((p) => p.paymentStatus === "success")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const totalPending = payments.filter(
      (p) => p.paymentStatus === "pending"
    ).length;

    return res.json({
      success: true,
      count: payments.length,
      totalRevenue,
      totalPending,
      payments,
    });
  } catch (error) {
    console.error("Get all payments error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
