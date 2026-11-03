
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../model/user.js";
import LoginOtp from "../model/loginOtp.js";

// ========================================
// HELPERS
// ========================================

const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

const normalizeRole = (role) =>
  String(role || "user").trim().toLowerCase();

const createLoginToken = (user) => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT configuration is invalid.");
  }

  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: normalizeRole(user.role),
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
  role: normalizeRole(user.role),
});

// ========================================
// DIRECT LOGIN WITHOUT OTP
// ========================================

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
        success: false,
        message: "Email and password are required",
      });
    }

    // Find registered user
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        status: 0,
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const passwordMatched = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatched) {
      return res.status(401).json({
        status: 0,
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify account role
    const userRole = normalizeRole(user.role);

    if (!["user", "admin"].includes(userRole)) {
      return res.status(403).json({
        status: 0,
        success: false,
        message: "Invalid account role",
      });
    }

    // Verify selected role
    if (requestedRole && requestedRole !== userRole) {
      return res.status(403).json({
        status: 403,
        success: false,
        message: "Selected role does not match your account",
      });
    }

    // ====================================
    // OTP VERIFICATION TEMPORARILY DISABLED
    // ====================================

    /*
    const otp = generateOtp();
    const otpHash = hashOtp(email, otp);
    await sendLoginOtp(email, otp);
    */

    // Generate JWT token
    const token = createLoginToken(user);

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Remove previous pending OTP
    await LoginOtp.deleteOne({ email });

    return res.status(200).json({
      status: 1,
      success: true,
      requiresOtp: false,
      message: "Login successful",
      token,
      user: safeUser(user),
    });

  } catch (error) {
    console.error("Direct login error:", error);

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Unable to login. Please try again.",
    });
  }
};

// ========================================
// OTP VERIFICATION DISABLED
// ========================================

export const verifyLoginOtp = async (req, res) => {
  return res.status(403).json({
    status: 0,
    success: false,
    message: "OTP verification is currently disabled.",
  });

  /*
  Previous OTP verification implementation
  is temporarily disabled.
  */
};

// ========================================
// OTP RESEND DISABLED
// ========================================

export const resendLoginOtp = async (req, res) => {
  return res.status(403).json({
    status: 0,
    success: false,
    message: "OTP resend is currently disabled.",
  });

  /*
  Previous OTP resend implementation
  is temporarily disabled.
  */
};
