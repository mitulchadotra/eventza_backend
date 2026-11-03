
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";

import connectDB from "./config/db.js";

import userRouter from "./route/userRoute.js";
import eventRouter from "./route/eventRoute.js";
import categoryRouter from "./route/categoryRoute.js";
import bookingRoute from "./route/bookingRoute.js";
import authOtpRouter from "./route/authOtpRoute.js";
import paymentRoute from "./route/paymentRoute.js";
import aiRouter from "./route/aiRoute.js";

import { testGmailConnection } from "./utils/mailer.js";

const app = express();

// ================= CORS CONFIGURATION =================

const allowedOrigins = [
  "https://eventzaa-nine.vercel.app",
  "http://localhost:3001",
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Blocked CORS origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    credentials: true,
    optionsSuccessStatus: 204,
  })
);

// ================= BODY PARSER =================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= STATIC UPLOADS =================

app.use("/uploads", express.static(path.resolve("uploads")));

// ================= HOME ROUTE =================

app.get("/", (req, res) => {
  res.status(200).json({
    status: 1,
    message: "Eventzaa backend is running successfully",
  });
});

// ================= AUTHENTICATION ROUTES =================

app.use("/api/auth", authOtpRouter);

// ================= USER, EVENT, CATEGORY =================

app.use(userRouter);
app.use(eventRouter);
app.use(categoryRouter);

// ================= AI CHATBOT =================

app.use(aiRouter);

// ================= BOOKING =================

app.use("/api/bookings", bookingRoute);

// ================= RAZORPAY PAYMENT =================

app.use("/api/payments", paymentRoute);

// ================= TEST ROUTES =================

app.get("/api/auth/test", (req, res) => {
  res.status(200).json({
    status: 1,
    message: "Authentication API working",
  });
});

app.get("/api/payments/test", (req, res) => {
  res.status(200).json({
    status: 1,
    message: "Payment API working",
  });
});

// ================= 404 HANDLER =================

app.use((req, res) => {
  res.status(404).json({
    status: 0,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ================= ERROR HANDLER =================

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    status: 0,
    message: err.message || "Internal server error",
  });
});

// ================= START SERVER =================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    console.log("MongoDB connected successfully");

    testGmailConnection().catch((error) => {
      console.error("Gmail SMTP is not ready:", error.message);
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Eventzaa backend running on port ${PORT}`);
      console.log("Authentication API: /api/auth");
      console.log("Bookings API: /api/bookings");
      console.log("Payments API: /api/payments");
      console.log("User Chatbot API: /api/ai/user-chat");
      console.log("Admin Chatbot API: /api/ai/admin-chat");
    });

  } catch (error) {
    console.error("Failed to start backend:", error.message);
    process.exit(1);
  }
};

startServer();

export default app;
