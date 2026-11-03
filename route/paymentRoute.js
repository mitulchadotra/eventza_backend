
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

paymentRoute.post(
  "/create-order",
  authMiddleware,
  createPaymentOrder
);

paymentRoute.post(
  "/verify",
  authMiddleware,
  verifyPayment
);

paymentRoute.get(
  "/my-payments",
  authMiddleware,
  getMyPayments
);

paymentRoute.get(
  "/all",
  authMiddleware,
  authorizeAdmin,
  getAllPayments
);

export default paymentRoute;
