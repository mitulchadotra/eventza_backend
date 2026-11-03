
import express from "express";
import upload from "../utils/uploadmiddleware.js";

import {
  adduser,
  loginUser,
  verifyLoginOtp,
  getUser,
  getSingleUser,
  UpdateUser,
  DeleteUser,
} from "../controller/userDatacontroller.js";

const router = express.Router();

// Register
router.post(
  "/api/register",
  upload.single("image"),
  adduser
);

// Login - password check and send Gmail OTP
router.post(
  "/api/login",
  loginUser
);

// Verify Gmail OTP
router.post(
  "/api/verify-login-otp",
  verifyLoginOtp
);

// Get all users
router.get(
  "/api/users",
  getUser
);

// Get single user
router.get(
  "/api/users/:uid",
  getSingleUser
);

// Update user
router.put(
  "/api/users/:id",
  upload.single("image"),
  UpdateUser
);

// Delete user
router.delete(
  "/api/users/:uid",
  DeleteUser
);

export default router;
