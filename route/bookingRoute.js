import express from "express";
import authenticateToken from "../utils/authMiddleware.js";
import authorizeAdmin from "../utils/authorizeAdmin.js";

import {
  addBooking,
  getBookings,
  getBookingById,
  updateBooking,
  cancelBooking,
  deleteBooking,
} from "../controller/bookingcontroller.js";

const router = express.Router();

router.post("/", authenticateToken, addBooking);
router.get("/", authenticateToken, getBookings);
router.get("/:id", authenticateToken, getBookingById);
router.put("/:id", authenticateToken, updateBooking);
router.patch("/:id/cancel", authenticateToken, cancelBooking);
router.delete("/:id", authenticateToken, authorizeAdmin, deleteBooking);

export default router;