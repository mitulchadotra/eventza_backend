
import express from "express";
import upload from "../utils/uploadmiddleware.js";

import {
  adduser,
  loginUser,
  getUser,
  getSingleUser,
  UpdateUser,
  DeleteUser,
} from "../controller/userDatacontroller.js";

const router = express.Router();

// Register and login
router.post("/api/register",upload.single("image"), adduser);
router.post("/api/login", loginUser);

// Get all users
router.get("/api/users", getUser);

// Get single user
router.get("/api/users/:uid", getSingleUser);

// Update user
router.put("/api/users/:id", UpdateUser);

// Delete user
router.delete("/api/users/:uid", DeleteUser);

export default router;
