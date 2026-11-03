
import express from "express";

import {
  startLoginOtp,
  verifyLoginOtp,
  resendLoginOtp,
} from "../controller/otpAuthController.js";

const router = express.Router();

router.post("/login", startLoginOtp);

router.post("/verify-login-otp", verifyLoginOtp);

router.post("/resend-login-otp", resendLoginOtp);

export default router;
