
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import User from "../model/user.js";
import LoginOtp from "../model/loginOtp.js";
import { sendLoginOtp } from "../utils/mailer.js";

// ================= HELPERS =================

const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

const generateOtp = () =>
  crypto.randomInt(100000, 1000000).toString();

const hashOtp = (email, otp) => {
  const pepper = process.env.OTP_PEPPER;

  if (!pepper) {
    throw new Error("OTP_PEPPER is missing in .env");
  }

  return crypto
    .createHmac("sha256", pepper)
    .update(`${email}:${otp}`)
    .digest("hex");
};

const createLoginToken = (user) => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or invalid");
  }

  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: "24h" }
  );
};

const safeUser = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || "",
  address: user.address || "",
  image: user.image || "",
  role: user.role,
});

// ================= START LOGIN OTP =================

export const startLoginOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const requestedRole = String(req.body.role || "")
      .trim()
      .toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        status: 0,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        status: 0,
        message: "Invalid email or password",
      });
    }

    const passwordMatched = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatched) {
      return res.status(401).json({
        status: 0,
        message: "Invalid email or password",
      });
    }

    const userRole = String(user.role || "user")
      .trim()
      .toLowerCase();

    if (!["user", "admin"].includes(userRole)) {
      return res.status(403).json({
        status: 0,
        message: "Invalid account role",
      });
    }

    if (requestedRole && requestedRole !== userRole) {
      return res.status(403).json({
        status: 0,
        message: "Selected role does not match your account",
      });
    }

    // Admin and user both require OTP.

    const existingOtp = await LoginOtp.findOne({ email });

    // Prevent repeated OTP requests within 30 seconds.
    if (
      existingOtp?.lastSentAt &&
      Date.now() - new Date(existingOtp.lastSentAt).getTime() < 30000
    ) {
      return res.status(429).json({
        status: 0,
        message: "Please wait 30 seconds before requesting another OTP",
      });
    }

    const otp = generateOtp();

    const otpHash = hashOtp(email, otp);

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await LoginOtp.findOneAndUpdate(
      { email },
      {
        $set: {
          userId: user._id,
          role: userRole,
          otpHash,
          expiresAt,
          attempts: 0,
          lastSentAt: new Date(),
        },
        $setOnInsert: {
          email,
          resendCount: 0,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    try {
      await sendLoginOtp(email, otp);
    } catch (mailError) {
      await LoginOtp.deleteOne({ email });
      throw mailError;
    }

    return res.status(200).json({
      status: 1,
      success: true,
      requiresOtp: true,
      message: "OTP sent successfully to your registered email",
      email,
      role: userRole,
    });

  } catch (error) {
    console.error("Start login OTP error:", error);

    return res.status(500).json({
      status: 0,
      message: error.message || "Unable to send login OTP",
    });
  }
};

// ================= VERIFY LOGIN OTP =================

export const verifyLoginOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        status: 0,
        message: "Enter a valid six digit OTP",
      });
    }

    const otpRecord = await LoginOtp.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({
        status: 0,
        message: "OTP not found. Please login again",
      });
    }

    if (new Date(otpRecord.expiresAt).getTime() <= Date.now()) {
      await LoginOtp.deleteOne({ email });

      return res.status(400).json({
        status: 0,
        message: "OTP expired. Please request a new OTP",
      });
    }

    if (otpRecord.attempts >= 5) {
      await LoginOtp.deleteOne({ email });

      return res.status(429).json({
        status: 0,
        message: "Too many incorrect attempts. Please login again",
      });
    }

    const submittedHash = hashOtp(email, otp);

    const expectedBuffer = Buffer.from(otpRecord.otpHash, "hex");
    const submittedBuffer = Buffer.from(submittedHash, "hex");

    const otpMatched =
      expectedBuffer.length === submittedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, submittedBuffer);

    if (!otpMatched) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        status: 0,
        message: "Incorrect OTP",
        attemptsRemaining: 5 - otpRecord.attempts,
      });
    }

    const user = await User.findById(otpRecord.userId);

    if (!user) {
      await LoginOtp.deleteOne({ email });

      return res.status(404).json({
        status: 0,
        message: "User account not found",
      });
    }

    const currentRole = String(user.role || "user")
      .trim()
      .toLowerCase();

    if (currentRole !== otpRecord.role) {
      await LoginOtp.deleteOne({ email });

      return res.status(403).json({
        status: 0,
        message: "Account role changed. Please login again",
      });
    }

    const token = createLoginToken(user);

    user.lastLoginAt = new Date();
    await user.save();

    await LoginOtp.deleteOne({ email });

    return res.status(200).json({
      status: 1,
      success: true,
      message: "OTP verified successfully. Login successful",
      token,
      user: safeUser(user),
    });

  } catch (error) {
    console.error("Verify login OTP error:", error);

    return res.status(500).json({
      status: 0,
      message: error.message || "OTP verification failed",
    });
  }
};

// ================= RESEND LOGIN OTP =================

export const resendLoginOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({
        status: 0,
        message: "Email is required",
      });
    }

    const otpRecord = await LoginOtp.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({
        status: 0,
        message: "Login session expired. Please login again",
      });
    }

    const lastSent = otpRecord.lastSentAt
      ? new Date(otpRecord.lastSentAt).getTime()
      : 0;

    if (Date.now() - lastSent < 30000) {
      return res.status(429).json({
        status: 0,
        message: "Please wait 30 seconds before requesting another OTP",
      });
    }

    if ((otpRecord.resendCount || 0) >= 3) {
      return res.status(429).json({
        status: 0,
        message: "Maximum OTP resend limit reached",
      });
    }

    const user = await User.findById(otpRecord.userId);

    if (
      !user ||
      String(user.role || "user").toLowerCase() !== otpRecord.role
    ) {
      await LoginOtp.deleteOne({ email });

      return res.status(400).json({
        status: 0,
        message: "Account not found. Please login again",
      });
    }

    const otp = generateOtp();

    otpRecord.otpHash = hashOtp(email, otp);
    otpRecord.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    otpRecord.attempts = 0;
    otpRecord.lastSentAt = new Date();
    otpRecord.resendCount = (otpRecord.resendCount || 0) + 1;

    await otpRecord.save();

    try {
      await sendLoginOtp(email, otp);
    } catch (mailError) {
      await LoginOtp.deleteOne({ email });
      throw mailError;
    }

    return res.status(200).json({
      status: 1,
      success: true,
      message: "New OTP sent successfully",
    });

  } catch (error) {
    console.error("Resend login OTP error:", error);

    return res.status(500).json({
      status: 0,
      message: error.message || "Unable to resend OTP",
    });
  }
};
