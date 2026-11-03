
import express from "express";

import {
  startLoginOtp,
  verifyLoginOtp,
  resendLoginOtp,
} from "../controller/otpAuthController.js";

const router = express.Router();

router.post("/auth/login", startLoginOtp);

// OTP endpoints are retained but disabled
router.post("/auth/verify-login-otp", verifyLoginOtp);
router.post("/auth/resend-login-otp", resendLoginOtp);

export default router;
