import express from "express";

import authMiddleware from "../utils/authMiddleware.js";
import authorizeAdmin from "../utils/authorizeAdmin.js";

import {
  createPaymentOrder,
  verifyPayment,
  getMyPayments,
  getAllPayments,
} from "../controller/paymentController.js";

const paymentRoute = express.Router();

// User creates Razorpay order
paymentRoute.post(
  "/create-order",
  authMiddleware,
  createPaymentOrder
);

// User verifies payment
paymentRoute.post(
  "/verify",
  authMiddleware,
  verifyPayment
);

// User payment history
paymentRoute.get(
  "/my-payments",
  authMiddleware,
  getMyPayments
);

// Admin all transactions
paymentRoute.get(
  "/all",
  authMiddleware,
  authorizeAdmin,
  getAllPayments
);

export default paymentRoute;