import express from "express";
import upload from "../utils/uploadmiddleware.js";
import authMiddleware from "../utils/authMiddleware.js"
import authorizeAdmin from "../utils/authorizeAdmin.js"

import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} from "../controller/eventController.js";

const router = express.Router();

// Get all events
router.get(
  "/api/Events",
  authMiddleware,
  getEvents
);

// Get one event
router.get(
  "/api/Events/:id",
  authMiddleware,
  getEventById
);

// Add event with image (Admin only)
router.post(
  "/api/Events",
  authMiddleware,
  authorizeAdmin,
  upload.single("image"),
  createEvent
);

// Update event with optional image (Admin only)
router.put(
  "/api/Events/:id",
  authMiddleware,
  authorizeAdmin,
  upload.single("image"),
  updateEvent
);

// Delete event (Admin only)
router.delete(
  "/api/Events/:id",
  authMiddleware,
  authorizeAdmin,
  deleteEvent
);

export default router;