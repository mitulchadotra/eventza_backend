
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import User from "../model/user.js";
import LoginOtp from "../model/loginOtp.js";
import { sendLoginOtp } from "../utils/otpMailer.js";

const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const hashOtp = (otp) => {
  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
};

// ================= START LOGIN OTP =================

export const startLoginOtp = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 0,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user and include password if schema uses select:false
    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        status: 0,
        message: "Invalid email or password",
      });
    }

    // Check password
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

    // Check role
    const userRole = String(user.role || "user")
      .trim()
      .toLowerCase();

    if (role && role !== userRole) {
      return res.status(403).json({
        status: 0,
        message:
          role === "admin"
            ? "This account is not an admin account"
            : "This account is not a user account",
      });
    }

    if (!["user", "admin"].includes(userRole)) {
      return res.status(403).json({
        status: 0,
        message: "Invalid account role",
      });
    }

    // Generate OTP
    const otp = generateOtp();

    const otpHash = hashOtp(otp);

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    );

    // Replace previous OTP
    await LoginOtp.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        userId: user._id,
        role: userRole,
        otpHash,
        expiresAt,
        attempts: 0,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    // Send email
    try {
      await sendLoginOtp(normalizedEmail, otp);
    } catch (mailError) {
      await LoginOtp.deleteOne({
        email: normalizedEmail,
      });

      throw mailError;
    }

    return res.status(200).json({
      status: 1,
      success: true,
      message: "OTP sent successfully to your registered email",
      email: normalizedEmail,
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
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        status: 0,
        message: "Email and OTP are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const otpRecord = await LoginOtp.findOne({
      email: normalizedEmail,
    });

    if (!otpRecord) {
      return res.status(400).json({
        status: 0,
        message: "OTP not found. Please login again",
      });
    }

    if (otpRecord.expiresAt <= new Date()) {
      await LoginOtp.deleteOne({
        email: normalizedEmail,
      });

      return res.status(400).json({
        status: 0,
        message: "OTP expired. Please request a new OTP",
      });
    }

    if (otpRecord.attempts >= 5) {
      await LoginOtp.deleteOne({
        email: normalizedEmail,
      });

      return res.status(429).json({
        status: 0,
        message: "Too many incorrect attempts. Please login again",
      });
    }

    const submittedHash = hashOtp(String(otp).trim());

    const otpMatched = crypto.timingSafeEqual(
      Buffer.from(otpRecord.otpHash, "hex"),
      Buffer.from(submittedHash, "hex")
    );

    if (!otpMatched) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        status: 0,
        message: "Incorrect OTP. Please try again",
        attemptsRemaining: 5 - otpRecord.attempts,
      });
    }

    // Find user again
    const user = await User.findById(otpRecord.userId);

    if (!user) {
      await LoginOtp.deleteOne({
        email: normalizedEmail,
      });

      return res.status(404).json({
        status: 0,
        message: "User account not found",
      });
    }

    // Ensure account role has not changed
    const currentRole = String(user.role || "user")
      .trim()
      .toLowerCase();

    if (currentRole !== otpRecord.role) {
      await LoginOtp.deleteOne({
        email: normalizedEmail,
      });

      return res.status(403).json({
        status: 0,
        message: "Account role changed. Please login again",
      });
    }

    // Generate JWT only after OTP verification
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new Error("JWT_SECRET is missing or invalid");
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: currentRole,
      },
      secret,
      {
        expiresIn: "24h",
      }
    );

    // Remove used OTP
    await LoginOtp.deleteOne({
      email: normalizedEmail,
    });

    const safeUser = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      address: user.address || "",
      image: user.image || "",
      role: currentRole,
    };

    return res.status(200).json({
      status: 1,
      success: true,
      message: "OTP verified successfully. Login successful",
      token,
      user: safeUser,
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
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 0,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const otpRecord = await LoginOtp.findOne({
      email: normalizedEmail,
    });

    if (!otpRecord) {
      return res.status(400).json({
        status: 0,
        message: "Login session expired. Please login again",
      });
    }

    // Prevent frequent resend requests
    const lastSent = otpRecord.updatedAt?.getTime() || 0;

    if (Date.now() - lastSent < 30000) {
      return res.status(429).json({
        status: 0,
        message: "Please wait 30 seconds before requesting another OTP",
      });
    }

    const user = await User.findById(otpRecord.userId);

    if (!user || String(user.role).toLowerCase() !== otpRecord.role) {
      await LoginOtp.deleteOne({
        email: normalizedEmail,
      });

      return res.status(400).json({
        status: 0,
        message: "Account not found. Please login again",
      });
    }

    const otp = generateOtp();

    otpRecord.otpHash = hashOtp(otp);
    otpRecord.expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    );
    otpRecord.attempts = 0;

    // Save new OTP before sending
    await otpRecord.save();

    await sendLoginOtp(normalizedEmail, otp);

    return res.status(200).json({
      status: 1,
      success: true,
      message: "New OTP sent successfully",
    });

  } catch (error) {
    console.error("Resend OTP error:", error);

    return res.status(500).json({
      status: 0,
      message: error.message || "Unable to resend OTP",
    });
  }
};
