
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

import Event from "../model/event.js";
import Booking from "../model/booking.js";
import Payment from "../model/payment.js";
import User from "../model/user.js";

// ==================================================
// GEMINI CONFIGURATION
// ==================================================

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const getGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing in backend environment variables.");
  }

  return new GoogleGenAI({ apiKey });
};

// ==================================================
// COMMON HELPERS
// ==================================================

const getUserId = (req) => {
  return req.user?.id || req.user?._id || req.user?.userId;
};

const safeJSON = (data) => {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (
        key === "password" ||
        key === "__v" ||
        key === "token" ||
        key === "resetToken"
      ) {
        return undefined;
      }

      return value;
    })
  );
};

const getIndiaDayRange = () => {
  const now = new Date();

  const indiaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const start = new Date(`${indiaDate}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
};

// ==================================================
// GEMINI AI RESPONSE FUNCTION
// ==================================================

const getAIAnswer = async (message, history = [], context = "") => {
  const ai = getGemini();

  const previousMessages = Array.isArray(history)
    ? history
        .slice(-10)
        .filter((item) => {
          const content = String(
            item.content || item.message || ""
          ).trim();

          // Ignore old fixed help-menu responses.
          return (
            content &&
            !content.includes("I can help you with:") &&
            !content.includes("Try asking: How many users logged in today?")
          );
        })
        .map((item) => ({
          role:
            item.role === "assistant" || item.role === "model"
              ? "model"
              : "user",
          parts: [
            {
              text: String(
                item.content || item.message || ""
              ).slice(0, 3000),
            },
          ],
        }))
    : [];

  const prompt = `
You are Eventzaa AI Assistant.

ABOUT EVENTZAA:

Eventzaa is an event management platform.

The platform allows users to:
- Explore available events.
- View event names and descriptions.
- Check event dates and locations.
- Check event ticket prices.
- Register and create an account.
- Login to their account.
- Book tickets for events.
- View their own booking details.
- Check their booking status.
- Check their payment status.
- View and manage their profile.

YOUR MAIN JOB:

Answer questions about Eventzaa intelligently.

Users can ask ANY question related to Eventzaa.
Do not restrict answers to a fixed list of questions.

For example, answer questions about:
- What is Eventzaa?
- How does Eventzaa work?
- How can I register?
- How can I login?
- How can I book an event?
- How can I find an event?
- How can I check event prices?
- How can I check my booking?
- How can I check payment status?
- What features does Eventzaa provide?
- What is the purpose of Eventzaa?
- How do I use the Eventzaa platform?

IMPORTANT INSTRUCTIONS:

1. Never display a fixed help menu.
2. Never say "I can help you with:".
3. Never ask the user to select from a predefined list.
4. Understand the complete question before answering.
5. Answer general knowledge questions too.
6. Answer in the same language as the user.
7. Supported languages: English, Hindi and Gujarati.
8. Give step-by-step instructions when required.
9. Use the supplied database information for actual event details.
10. Never invent event dates, prices, locations or booking records.
11. For normal-user chats, only discuss the authenticated user's own bookings.
12. Never reveal other users' personal information in normal-user chats. Admin chats may report user profile details supplied in the admin database context.
13. Never reveal passwords, API keys or authentication tokens.
14. Do not expose admin-only statistics to normal users.
15. If a requested feature is not confirmed by the supplied information, do not claim that it exists.
16. If database information is unavailable, explain that clearly.
17. Keep the answer friendly, useful and direct.
18. Do not repeat the same fixed response for different questions.

EVENTZAA DATABASE INFORMATION:

${context || "No additional database information is available."}

USER QUESTION:

${message}
`;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      ...previousMessages,
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  const answer = result.text?.trim();

  if (!answer) {
    return "Sorry, I could not generate an answer. Please try again.";
  }

  return answer;
};

// ==================================================
// USER CHATBOT
// ==================================================

export const userChat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { message, history = [] } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to use the chatbot.",
      });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a message.",
      });
    }

    // Fetch published events.
    const events = await Event.find({
      status: { $regex: /^published$/i },
    })
      .select("title name description category location date price status")
      .sort({ date: 1 })
      .limit(100)
      .lean();

    // Fetch only the authenticated user's bookings.
    const bookings = await Booking.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const eventDetails = events.map((event) => ({
      eventId: event._id,
      title: event.title || event.name || "Not specified",
      description: event.description || "Not specified",
      category: event.category || "Not specified",
      location: event.location || "Not specified",
      date: event.date || "Not specified",
      price: event.price ?? "Not specified",
      status: event.status || "Not specified",
    }));

    const bookingDetails = bookings.map((booking) => ({
      bookingId: booking._id,
      event:
        booking.eventName ||
        booking.eventTitle ||
        booking.eventId ||
        "Event name not stored",
      quantity: booking.quantity || booking.tickets || 1,
      amount:
        booking.totalAmount ??
        booking.amount ??
        booking.price ??
        null,
      bookingStatus:
        booking.status ||
        booking.bookingStatus ||
        "Not specified",
      paymentStatus:
        booking.paymentStatus ||
        "Not specified",
      bookingDate: booking.createdAt || null,
    }));

    const context = `
EVENTZAA PLATFORM INFORMATION:

Eventzaa is an event management platform.
Users can explore events, register, login, book tickets and view their own bookings.

AVAILABLE PUBLISHED EVENTS:

${JSON.stringify(safeJSON(eventDetails), null, 2)}

AUTHENTICATED USER'S BOOKING DETAILS:

${JSON.stringify(safeJSON(bookingDetails), null, 2)}

TOTAL AVAILABLE PUBLISHED EVENTS: ${events.length}

TOTAL BOOKINGS OF AUTHENTICATED USER: ${bookings.length}

IMPORTANT DATABASE RULES:

- The event records above are actual published events from the database.
- The booking records above belong only to the authenticated user.
- If asked how many events are available, use the published event count.
- If asked how many bookings the user has, use the booking count.
- If asked which events the user booked, list the event names from their bookings.
- If asked about booking status, use bookingStatus.
- If asked about payment status, use paymentStatus.
- Never confuse booking status with payment status.
- Never show another user's bookings.
- Never expose admin statistics.
- If an event or booking field is missing, say it is not available.
`;

    const answer = await getAIAnswer(message, history, context);

    return res.status(200).json({
      success: true,
      answer,
      reply: answer,
      bookingCount: bookings.length,
      eventCount: events.length,
    });
  } catch (error) {
    console.error("User chatbot error:", error);

    return res.status(500).json({
      success: false,
      message: "Chatbot error. Please try again later.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

// ==================================================
// ADMIN CHATBOT
// ==================================================

export const adminChat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a message.",
      });
    }

    // Admin role verification.
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required.",
      });
    }

    const { start, end } = getIndiaDayRange();

    const [
      totalUsers,
      totalEvents,
      totalBookings,
      totalPayments,
      publishedEvents,
      todayRegistrations,
      todayUsers,
      userRecords,
      paymentRecords,
      bookingRecords,
    ] = await Promise.all([
      User.countDocuments(),

      Event.countDocuments(),

      Booking.countDocuments(),

      Payment.countDocuments(),

      Event.countDocuments({
        status: { $regex: /^published$/i },
      }),

      User.countDocuments({
        createdAt: { $gte: start, $lt: end },
      }),

      User.countDocuments({
        lastLoginAt: { $gte: start, $lt: end },
      }),

      User.find({ role: "user" })
        .select("name email phone address createdAt")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),

      Payment.find({})
        .select("amount totalAmount status paymentStatus createdAt")
        .limit(1000)
        .lean(),

      Booking.find({})
        .select(
          "eventName eventTitle eventId quantity tickets totalAmount amount price status bookingStatus paymentStatus createdAt"
        )
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const normalizeStatus = (record) =>
      String(
        record.status || record.paymentStatus || ""
      ).toLowerCase();

    const successfulPayments = paymentRecords.filter((payment) =>
      [
        "success",
        "successful",
        "paid",
        "completed",
        "captured",
      ].includes(normalizeStatus(payment))
    );

    const pendingPayments = paymentRecords.filter((payment) =>
      ["pending", "created", "processing"].includes(
        normalizeStatus(payment)
      )
    );

    const failedPayments = paymentRecords.filter((payment) =>
      ["failed", "failure"].includes(normalizeStatus(payment))
    );

    const refundedPayments = paymentRecords.filter((payment) =>
      ["refunded", "refund"].includes(normalizeStatus(payment))
    );

    const totalRevenue = successfulPayments.reduce(
      (sum, payment) => {
        const amount = Number(
          payment.totalAmount ?? payment.amount ?? 0
        );

        return sum + (
          Number.isFinite(amount) ? amount : 0
        );
      },
      0
    );

    const recentBookings = bookingRecords.map((booking) => ({
      bookingId: booking._id,
      event:
        booking.eventName ||
        booking.eventTitle ||
        booking.eventId ||
        "Not specified",
      quantity: booking.quantity || booking.tickets || 1,
      amount:
        booking.totalAmount ??
        booking.amount ??
        booking.price ??
        null,
      bookingStatus:
        booking.status ||
        booking.bookingStatus ||
        "Not specified",
      paymentStatus:
        booking.paymentStatus ||
        "Not specified",
      date: booking.createdAt || null,
    }));

    const userDetails = userRecords.map((user) => ({
      name: user.name || "Not specified",
      email: user.email || "Not specified",
      phone: user.phone || "Not specified",
      address: user.address || "Not specified",
      registeredAt: user.createdAt || null,
    }));

    const adminContext = `
LIVE EVENTZAA ADMIN DATABASE STATISTICS:

Total registered users: ${totalUsers}

Users registered today (India time): ${todayRegistrations}

Total events: ${totalEvents}

Published events: ${publishedEvents}

Total bookings: ${totalBookings}

Total payment records: ${totalPayments}

Successful payments: ${successfulPayments.length}

Pending payments: ${pendingPayments.length}

Failed payments: ${failedPayments.length}

Refunded payments: ${refundedPayments.length}

Successful payment revenue raw amount: ${totalRevenue}

Users logged in today: ${todayUsers}

LATEST REGISTERED USER DETAILS (maximum 100 records):

${JSON.stringify(safeJSON(userDetails), null, 2)}

RECENT BOOKING RECORDS:

${JSON.stringify(safeJSON(recentBookings), null, 2)}

ADMIN INSTRUCTIONS:

- Answer using the live database numbers above.
- When asked for user details, use only the user records above and explain that the list is limited to the latest 100 users.
- User profile details may be shown only because this request is on the authenticated admin endpoint.
- Distinguish users registered today from users who logged in today.
- If asked for booking details, list the relevant booking records.
- Never invent statistics or records.
- Payment revenue is the raw sum of the successful payment amount fields.
- Confirm the payment model's currency unit before describing this amount as rupees.
- If a requested field is unavailable, explain that clearly.
`;

    const answer = await getAIAnswer(
      message,
      history,
      adminContext
    );

    return res.status(200).json({
      success: true,
      answer,
      reply: answer,
      statistics: {
        totalUsers,
        todayRegistrations,
        totalEvents,
        publishedEvents,
        totalBookings,
        totalPayments,
        successfulPayments: successfulPayments.length,
        pendingPayments: pendingPayments.length,
        failedPayments: failedPayments.length,
        refundedPayments: refundedPayments.length,
        totalRevenue,
        todayUsers,
      },
    });
  } catch (error) {
    console.error("Admin chatbot error:", error);

    return res.status(500).json({
      success: false,
      message: "Admin chatbot error. Please try again later.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};
