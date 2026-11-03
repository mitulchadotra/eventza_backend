
import express from "express";

import {
  startLoginOtp,
  verifyLoginOtp,
  resendLoginOtp,
} from "../controller/otpAuthController.js";

const router = express.Router();

// Step 1: Verify password and send OTP.
router.post("/login", startLoginOtp);

// Step 2: Verify OTP and generate JWT.
router.post("/verify-login-otp", verifyLoginOtp);

// Step 3: Resend OTP.
router.post("/resend-login-otp", resendLoginOtp);

export default router;
