import mongoose from "mongoose";
import Booking from "../model/booking.js";

// CREATE BOOKING
export const addBooking = async (req, res) => {
  try {
    const {
      eventId,
      eventTitle,
      userName,
      email,
      date,
      location,
      quantity = 1,
      price,
      totalAmount,
    } = req.body;

    if (!req.user?._id) {
      return res.status(401).json({
        status: 0,
        success: false,
        message: "Please login first.",
      });
    }

    if (!eventTitle || !userName || !date || !location) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Required booking details are missing.",
      });
    }

    const qty = Number(quantity);
    const unitPrice = Number(price);

    if (!Number.isInteger(qty) || qty < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Invalid quantity or price.",
      });
    }

    const calculatedTotal = unitPrice * qty;
    const bookingDate = new Date(date);

    if (Number.isNaN(bookingDate.getTime())) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Invalid booking date.",
      });
    }

    const booking = await Booking.create({
      userId: req.user._id,
      userName: String(userName).trim(),
      email: email || req.user.email || "",
      eventId:
        eventId && mongoose.Types.ObjectId.isValid(eventId)
          ? eventId
          : null,
      eventTitle: String(eventTitle).trim(),
      date: bookingDate,
      location: String(location).trim(),
      quantity: qty,
      price: unitPrice,
      totalAmount: calculatedTotal,
      status: "Pending",
      paymentStatus: "Pending",
    });

    return res.status(201).json({
      status: 1,
      success: true,
      message: "Booking created successfully.",
      data: booking,
      booking,
    });
  } catch (error) {
    console.error("Add booking error:", error);

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Unable to create booking.",
      error: error.message,
    });
  }
};

// GET BOOKINGS
export const getBookings = async (req, res) => {
  try {
    const isAdmin = req.user?.role?.toLowerCase() === "admin";

    const filter = isAdmin ? {} : { userId: req.user._id };

    const bookings = await Booking.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      status: 1,
      success: true,
      count: bookings.length,
      data: bookings,
      bookings,
    });
  } catch (error) {
    console.error("Get bookings error:", error);

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Unable to fetch bookings.",
    });
  }
};

// GET SINGLE BOOKING
export const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        status: 0,
        success: false,
        message: "Booking not found.",
      });
    }

    const isAdmin = req.user?.role?.toLowerCase() === "admin";

    if (!isAdmin && booking.userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 0,
        success: false,
        message: "You cannot access this booking.",
      });
    }

    return res.status(200).json({
      status: 1,
      success: true,
      data: booking,
      booking,
    });
  } catch (error) {
    console.error("Get booking error:", error);

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Unable to fetch booking.",
    });
  }
};

// UPDATE BOOKING
export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        status: 0,
        success: false,
        message: "Booking not found.",
      });
    }

    const isAdmin = req.user?.role?.toLowerCase() === "admin";

    if (!isAdmin && booking.userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 0,
        success: false,
        message: "You cannot update this booking.",
      });
    }

    // Payment state and owner cannot be changed through this endpoint.
    const allowedFields = ["userName", "email", "date", "location", "quantity"];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        booking[field] = req.body[field];
      }
    });

    if (req.body.quantity !== undefined) {
      const qty = Number(req.body.quantity);

      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({
          status: 0,
          success: false,
          message: "Invalid quantity.",
        });
      }

      booking.quantity = qty;
      booking.totalAmount = booking.price * qty;
    }

    await booking.save();

    return res.status(200).json({
      status: 1,
      success: true,
      message: "Booking updated successfully.",
      data: booking,
      booking,
    });
  } catch (error) {
    console.error("Update booking error:", error);

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Unable to update booking.",
    });
  }
};

// CANCEL BOOKING
export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        status: 0,
        success: false,
        message: "Booking not found.",
      });
    }

    const isAdmin = req.user?.role?.toLowerCase() === "admin";

    if (!isAdmin && booking.userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 0,
        success: false,
        message: "You cannot cancel this booking.",
      });
    }

    booking.status = "Cancelled";
    await booking.save();

    return res.status(200).json({
      status: 1,
      success: true,
      message: "Booking cancelled.",
      data: booking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Unable to cancel booking.",
    });
  }
};

// DELETE BOOKING (ADMIN ONLY - route must protect this)
export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 0,
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const booking = await Booking.findByIdAndDelete(id);

    if (!booking) {
      return res.status(404).json({
        status: 0,
        success: false,
        message: "Booking not found.",
      });
    }

    return res.status(200).json({
      status: 1,
      success: true,
      message: "Booking deleted successfully.",
    });
  } catch (error) {
    console.error("Delete booking error:", error);

    return res.status(500).json({
      status: 0,
      success: false,
      message: "Unable to delete booking.",
    });
  }
};