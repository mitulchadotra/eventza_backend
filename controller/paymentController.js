
import crypto from "crypto";

import razorpay from "../config/razorpay.js";
import Payment from "../model/Payment.js";
import Booking from "../model/booking.js";

// Get logged-in user ID
const getUserId = (req) =>
  req.user?._id || req.user?.id || req.user?.userId;

// Normalize payment method
const getPaymentMethod = (method) => {
  const value = String(method || "").toLowerCase();

  if (value === "card") return "Card";
  if (value === "upi") return "UPI";

  return "UPI";
};

// --------------------------------------------------
// CREATE RAZORPAY ORDER
// POST /api/payments/create-order
// --------------------------------------------------

export const createPaymentOrder = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { bookingId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required.",
      });
    }

    // Only find this user's booking
    const booking = await Booking.findOne({
      _id: bookingId,
      userId,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    if (
      String(booking.paymentStatus || "").toLowerCase() === "paid"
    ) {
      return res.status(400).json({
        success: false,
        message: "This booking is already paid.",
      });
    }

    const amount = Number(
      booking.totalAmount ?? booking.price
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking amount.",
      });
    }

    // Razorpay accepts amount in paise
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
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
      userName: booking.userName || req.user.name || "",
      email: req.user.email || "",
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
      message: "Razorpay order created successfully.",
      key: process.env.RAZORPAY_KEY_ID,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      paymentId: payment._id,
    });
  } catch (error) {
    console.error("CREATE PAYMENT ORDER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create payment order.",
      error: error.message,
    });
  }
};

// --------------------------------------------------
// VERIFY RAZORPAY PAYMENT
// POST /api/payments/verify
// --------------------------------------------------

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
        message: "Please login first.",
      });
    }

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Razorpay verification details are missing.",
      });
    }

    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
      userId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found.",
      });
    }

    if (payment.paymentStatus === "success") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified.",
        payment,
      });
    }

    const body =
      razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(body)
      .digest("hex");

    const signaturesMatch =
      expectedSignature.length === razorpay_signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpay_signature)
      );

    if (!signaturesMatch) {
      payment.paymentStatus = "failed";
      await payment.save();

      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed.",
      });
    }

    // Fetch payment from Razorpay to confirm its status
    const razorpayPayment =
      await razorpay.payments.fetch(razorpay_payment_id);

    if (
      razorpayPayment.order_id !== razorpay_order_id ||
      Number(razorpayPayment.amount) !==
        Math.round(payment.amount * 100) ||
      razorpayPayment.currency !== payment.currency
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment details do not match the order.",
      });
    }

    if (razorpayPayment.status !== "captured") {
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      payment.paymentStatus = "pending";
      await payment.save();

      return res.status(200).json({
        success: false,
        message: "Payment is not captured yet.",
        paymentStatus: razorpayPayment.status,
      });
    }

    const method = getPaymentMethod(razorpayPayment.method);

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.transactionId = razorpay_payment_id;
    payment.paymentMethod = method;
    payment.paymentStatus = "success";
    payment.paymentDate = new Date();

    await payment.save();

    // Update only the corresponding booking
    await Booking.findOneAndUpdate(
      {
        _id: payment.bookingId,
        userId,
      },
      {
        $set: {
          paymentStatus: "Paid",
          status: "Confirmed",
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully.",
      payment,
    });
  } catch (error) {
    console.error("VERIFY PAYMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Payment verification failed.",
      error: error.message,
    });
  }
};

// --------------------------------------------------
// USER PAYMENT HISTORY
// GET /api/payments/my-payments
// --------------------------------------------------

export const getMyPayments = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      total: payments.length,
      payments,
    });
  } catch (error) {
    console.error("MY PAYMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch payment history.",
    });
  }
};

// --------------------------------------------------
// ADMIN PAYMENT TRANSACTIONS
// GET /api/payments/all
// --------------------------------------------------

export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find({})
      .populate("userId", "name email")
      .populate("bookingId")
      .sort({ createdAt: -1 })
      .lean();

    const [
      totalTransactions,
      successfulPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
      revenueResult,
    ] = await Promise.all([
      Payment.countDocuments({}),
      Payment.countDocuments({ paymentStatus: "success" }),
      Payment.countDocuments({ paymentStatus: "pending" }),
      Payment.countDocuments({ paymentStatus: "failed" }),
      Payment.countDocuments({ paymentStatus: "refunded" }),

      Payment.aggregate([
        {
          $match: {
            paymentStatus: "success",
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: "$amount",
            },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      payments,
      statistics: {
        totalTransactions,
        successfulPayments,
        pendingPayments,
        failedPayments,
        refundedPayments,
        totalRevenue: revenueResult[0]?.totalRevenue || 0,
        currency: "INR",
      },
    });
  } catch (error) {
    console.error("ALL PAYMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch transactions.",
    });
  }
};
