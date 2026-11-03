
import userData from "../model/user.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/jwtutils.js";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";

// =============================================
// CLOUDINARY IMAGE UPLOAD
// =============================================

const uploadImageToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "user_images" },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

// =============================================
// REGISTER USER
// =============================================

export const adduser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      address
    } = req.body ?? {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Name, email and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing user
    const existingUser = await userData.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        status: 0,
        success: false,
        message: "Email already registered"
      });
    }

    // Upload profile image
    let imageUrl = "";

    if (req.file) {
      const result = await uploadImageToCloudinary(
        req.file.buffer
      );

      imageUrl = result.secure_url;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    // Create user
    const savedUser = await userData.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone || "",
      address: address || "",
      password: hashedPassword,
      role: "user",
      image: imageUrl,
      lastLoginAt: null
    });

    const safeUser = savedUser.toObject();

    delete safeUser.password;

    return res.status(201).json({
      status: 1,
      success: true,
      message: "User registered successfully",
      user: safeUser,
      data: safeUser
    });

  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: 0,
        success: false,
        message: "Email already registered"
      });
    }

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Registration failed"
    });
  }
};

// =============================================
// LOGIN USER
// =============================================

export const loginUser = async (req, res) => {
  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const password = req.body?.password;
    const requestedRole = req.body?.role;

    // Validate input
    if (
      !email ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Email and password are required"
      });
    }

    // Find user and include password
    const foundUser = await userData
      .findOne({ email })
      .select("+password");

    if (!foundUser) {
      return res.status(401).json({
        status: 0,
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check stored password
    if (
      typeof foundUser.password !== "string" ||
      !foundUser.password
    ) {
      console.error("Password hash missing for user:", email);

      return res.status(500).json({
        status: 0,
        success: false,
        message: "Stored password hash is missing"
      });
    }

    // Compare password
    const passwordMatches = await bcrypt.compare(
      password,
      foundUser.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        status: 0,
        success: false,
        message: "Invalid email or password"
      });
    }

    // Verify role
    if (
      requestedRole &&
      !["user", "admin"].includes(requestedRole)
    ) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Invalid account role"
      });
    }

    if (
      requestedRole &&
      foundUser.role !== requestedRole
    ) {
      return res.status(403).json({
        status: 0,
        success: false,
        message: `This account is not registered as ${requestedRole}`
      });
    }

    // Update last login
    foundUser.lastLoginAt = new Date();

    await foundUser.save();

    // Generate JWT
    const token = generateToken(foundUser);

    // Remove password
    const safeUser = foundUser.toObject();

    delete safeUser.password;

    return res.status(200).json({
      status: 1,
      success: true,
      message: "Login successful",
      token,
      user: safeUser,
      data: safeUser
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Login failed due to a server error"
    });
  }
};

// =============================================
// GET ALL USERS
// =============================================

export const getUser = async (req, res) => {
  try {
    const users = await userData
      .find()
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 1,
      success: true,
      message: "Users retrieved successfully",
      data: users
    });

  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Failed to retrieve users"
    });
  }
};

// =============================================
// GET SINGLE USER
// =============================================

export const getSingleUser = async (req, res) => {
  try {
    const { uid } = req.params;

    if (!mongoose.isValidObjectId(uid)) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await userData
      .findById(uid)
      .select("-password");

    if (!user) {
      return res.status(404).json({
        status: 0,
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      status: 1,
      success: true,
      message: "User retrieved successfully",
      data: user
    });

  } catch (error) {
    console.error("Get single user error:", error);

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Failed to retrieve user"
    });
  }
};

// =============================================
// UPDATE USER
// =============================================

export const UpdateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Invalid user ID"
      });
    }

    const {
      name,
      email,
      phone,
      address
    } = req.body ?? {};

    const updates = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        return res.status(400).json({
          status: 0,
          success: false,
          message: "Name cannot be empty"
        });
      }

      updates.name = name.trim();
    }

    if (email !== undefined) {
      if (
        typeof email !== "string" ||
        !email.trim()
      ) {
        return res.status(400).json({
          status: 0,
          success: false,
          message: "Email cannot be empty"
        });
      }

      updates.email = email.trim().toLowerCase();
    }

    if (phone !== undefined) {
      updates.phone = phone;
    }

    if (address !== undefined) {
      updates.address = address;
    }

    // Upload new image if provided
    if (req.file) {
      const result = await uploadImageToCloudinary(
        req.file.buffer
      );

      updates.image = result.secure_url;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "No fields provided to update"
      });
    }

    const updatedUser = await userData
      .findByIdAndUpdate(
        id,
        { $set: updates },
        {
          returnDocument: "after",
          runValidators: true
        }
      )
      .select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        status: 0,
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      status: 1,
      success: true,
      message: "User updated successfully",
      data: updatedUser
    });

  } catch (error) {
    console.error("Update user error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: 0,
        success: false,
        message: "Email already registered"
      });
    }

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Failed to update user"
    });
  }
};

// =============================================
// DELETE USER
// =============================================

export const DeleteUser = async (req, res) => {
  try {
    const { uid } = req.params;

    if (!mongoose.isValidObjectId(uid)) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Invalid user ID"
      });
    }

    const deletedUser = await userData.findByIdAndDelete(uid);

    if (!deletedUser) {
      return res.status(404).json({
        status: 0,
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      status: 1,
      success: true,
      message: "User deleted successfully"
    });

  } catch (error) {
    console.error("Delete user error:", error);

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Failed to delete user"
    });
  }
};
