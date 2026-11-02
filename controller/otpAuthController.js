
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import User from "../model/user.js";
import LoginOtp from "../model/loginOtp.js";
import { sendOtpEmail } from "../utils/mailer.js";

// Normalize email
const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

// Generate OTP hash
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

// Generate JWT
const createLoginToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in .env");
  }

  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// Remove password from response
const safeUser = (user) => {
  const data = user.toObject();
  delete data.password;
  return data;
};

// Generate six digit OTP
const generateOtp = () =>
  crypto.randomInt(100000, 1000000).toString();

// ================= START LOGIN OTP =================

export const startLoginOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

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

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        status: 0,
        message: "Invalid email or password",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing in .env");
    }

    if (!process.env.OTP_PEPPER) {
      throw new Error("OTP_PEPPER is missing in .env");
    }

    // Admin login: no OTP
    if (user.role === "admin") {
      await LoginOtp.deleteOne({ email });

      user.lastLoginAt = new Date();
      await user.save();

      return res.status(200).json({
        status: 1,
        requiresOtp: false,
        message: "Admin login successful",
        token: createLoginToken(user),
        user: safeUser(user),
      });
    }

    // Check existing OTP record
    const existingOtp = await LoginOtp.findOne({ email });

    if (existingOtp) {
      const secondsPassed =
        (Date.now() - new Date(existingOtp.lastSentAt).getTime()) /
        1000;

      if (secondsPassed < 60) {
        return res.status(429).json({
          status: 0,
          message: "Please wait before requesting another OTP",
        });
      }

      if (existingOtp.resendCount >= 3) {
        return res.status(429).json({
          status: 0,
          message: "OTP resend limit reached. Try again later.",
        });
      }
    }

    const otp = generateOtp();

    const otpHash = hashOtp(email, otp);

    const now = new Date();

    await LoginOtp.findOneAndUpdate(
      { email },
      {
        $set: {
          otpHash,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          attempts: 0,
          lastSentAt: now,
          resendCount: existingOtp
            ? existingOtp.resendCount + 1
            : 0,
        },
        $setOnInsert: { email },
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      }
    );

    try {
      await sendOtpEmail(email, otp);
    } catch (mailError) {
      await LoginOtp.deleteOne({ email });

      console.error("OTP email error:", mailError);

      return res.status(500).json({
        status: 0,
        message: "Unable to send OTP email",
      });
    }

    return res.status(200).json({
      status: 1,
      requiresOtp: true,
      message: "OTP sent successfully to your email",
    });
  } catch (error) {
    console.error("Start OTP Error:", error);

    return res.status(500).json({
      status: 0,
      message: error.message || "Login failed",
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

    if (!process.env.JWT_SECRET || !process.env.OTP_PEPPER) {
      throw new Error("JWT_SECRET or OTP_PEPPER is missing in .env");
    }

    const otpRecord = await LoginOtp.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({
        status: 0,
        message: "OTP not found. Please request a new OTP.",
      });
    }

    if (new Date(otpRecord.expiresAt).getTime() <= Date.now()) {
      await LoginOtp.deleteOne({ email });

      return res.status(400).json({
        status: 0,
        message: "OTP expired. Please request a new OTP.",
      });
    }

    if (otpRecord.attempts >= 5) {
      await LoginOtp.deleteOne({ email });

      return res.status(429).json({
        status: 0,
        message: "Too many incorrect attempts. Request a new OTP.",
      });
    }

    const submittedHash = hashOtp(email, otp);

    const expectedBuffer = Buffer.from(
      otpRecord.otpHash,
      "hex"
    );

    const submittedBuffer = Buffer.from(
      submittedHash,
      "hex"
    );

    const isValid =
      expectedBuffer.length === submittedBuffer.length &&
      crypto.timingSafeEqual(
        expectedBuffer,
        submittedBuffer
      );

    if (!isValid) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        status: 0,
        message: "Incorrect OTP",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      await LoginOtp.deleteOne({ email });

      return res.status(404).json({
        status: 0,
        message: "User not found",
      });
    }

    if (user.role === "admin") {
      await LoginOtp.deleteOne({ email });

      return res.status(403).json({
        status: 0,
        message: "Admin login does not require OTP",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = createLoginToken(user);

    await LoginOtp.deleteOne({ email });

    return res.status(200).json({
      status: 1,
      message: "OTP verified successfully",
      token,
      user: safeUser(user),
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);

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

    if (!process.env.OTP_PEPPER) {
      throw new Error("OTP_PEPPER is missing in .env");
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        status: 0,
        message: "User not found",
      });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        status: 0,
        message: "Admin login does not require OTP",
      });
    }

    const otpRecord = await LoginOtp.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({
        status: 0,
        message: "OTP session not found. Please login again.",
      });
    }

    const secondsPassed =
      (Date.now() - new Date(otpRecord.lastSentAt).getTime()) /
      1000;

    if (secondsPassed < 60) {
      return res.status(429).json({
        status: 0,
        message: "Please wait 60 seconds before resending OTP",
      });
    }

    if (otpRecord.resendCount >= 3) {
      return res.status(429).json({
        status: 0,
        message: "Maximum OTP resend limit reached",
      });
    }

    const otp = generateOtp();

    otpRecord.otpHash = hashOtp(email, otp);
    otpRecord.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    otpRecord.attempts = 0;
    otpRecord.lastSentAt = new Date();
    otpRecord.resendCount += 1;

    await otpRecord.save();

    try {
      await sendOtpEmail(email, otp);
    } catch (mailError) {
      await LoginOtp.deleteOne({ email });

      console.error("Resend OTP email error:", mailError);

      return res.status(500).json({
        status: 0,
        message: "Unable to resend OTP",
      });
    }

    return res.status(200).json({
      status: 1,
      message: "New OTP sent successfully",
    });
  } catch (error) {
    console.error("Resend OTP Error:", error);

    return res.status(500).json({
      status: 0,
      message: error.message || "Unable to resend OTP",
    });
  }
};
