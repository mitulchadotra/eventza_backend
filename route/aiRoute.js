
import express from "express";

import {
  userChat,
  adminChat,
} from "../controller/aicontroller.js";

import authMiddleware from "../utils/authMiddleware.js";
import authorizeAdmin from "../utils/authorizeAdmin.js";

const aiRouter = express.Router();

// User chatbot
aiRouter.post("/api/ai/user-chat", authMiddleware, userChat);

// Old frontend route
aiRouter.post("/api/ai/chat", authMiddleware, userChat);

// Admin chatbot
aiRouter.post(
  "/api/ai/admin-chat",
  authMiddleware,
  authorizeAdmin,
  adminChat
);

export default aiRouter;
