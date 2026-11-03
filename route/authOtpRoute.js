
import express from "express";
import { startLoginOtp } from "../controller/otpAuthController.js";

const router = express.Router();

// Direct login - OTP is disabled in controller
router.post("/login", startLoginOtp);

// OTP endpoints are disabled.
// router.post("/verify-login-otp", verifyLoginOtp);
// router.post("/resend-login-otp", resendLoginOtp);

export default router;
