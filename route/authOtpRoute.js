
import express from "express";

import {
  startLoginOtp,
  verifyLoginOtp,
  resendLoginOtp,
} from "../controller/otpAuthController.js";

const router = express.Router();

// ================= OTP AUTH ROUTES =================

// Login and send OTP
router.post("/login", startLoginOtp);

// Verify OTP and complete login
router.post("/verify-login-otp", verifyLoginOtp);

// Resend OTP
router.post("/resend-login-otp", resendLoginOtp);

export default router;
