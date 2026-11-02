
import Event from "../model/event.js";
import Booking from "../model/booking.js";
import Payment from "../model/payment.js";
import User from "../model/user.js";

// ---------------------------------------------
// COMMON HELPERS
// ---------------------------------------------

const getUserId = (req) => {
  return req.user?._id || req.user?.id || req.user?.userId || null;
};

const getMessage = (req) => {
  const message = req.body?.message;

  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 2000
  ) {
    return null;
  }

  return message.trim();
};

const detectLanguage = (message) => {
  if (/[\u0A80-\u0AFF]/.test(message)) return "gu";
  if (/[\u0900-\u097F]/.test(message)) return "hi";
  return "en";
};

const getText = (language, english, hindi, gujarati) => {
  if (language === "hi") return hindi;
  if (language === "gu") return gujarati;
  return english;
};

const formatMoney = (amount) => {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
};

const formatDate = (date) => {
  if (!date) return "Date not available";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Date not available";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ---------------------------------------------
// INDIA TODAY DATE RANGE
// ---------------------------------------------

const getIndiaDayRange = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = {};

  parts.forEach((part) => {
    values[part.type] = part.value;
  });

  const startUTC =
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day)
    ) -
    5.5 * 60 * 60 * 1000;

  return {
    start: new Date(startUTC),
    end: new Date(startUTC + 24 * 60 * 60 * 1000),
  };
};

// ---------------------------------------------
// USER CHATBOT
// POST /api/ai/user-chat
// ---------------------------------------------

export const userChat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const message = getMessage(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid message.",
      });
    }

    const language = detectLanguage(message);
    const question = message.toLowerCase().trim();

    const { start, end } = getIndiaDayRange();

    // -----------------------------------------
    // 1. USERS WHO LOGGED IN TODAY
    // -----------------------------------------

    if (
      /(?=.*\b(?:how many|number of|count|total)\b)(?=.*\busers?\b)(?=.*\b(?:login|log\s*in|logged\s*in|sign\s*in|signin)\b)(?=.*\btoday\b)/i.test(question) ||
      /\btoday'?s?\s+(?:user\s+)?logins?\b/i.test(question) ||
      /(आज कितने यूजर.*लॉगिन|आज कितने उपयोगकर्ता.*लॉगिन|આજે કેટલા યુઝર.*લોગિન|આજે કેટલા વપરાશકર્તા.*લોગિન)/i.test(question)
    ) {
      const todayLoginCount = await User.countDocuments({
        role: "user",
        lastLoginAt: {
          $gte: start,
          $lt: end,
        },
      });

      return res.status(200).json({
        success: true,
        role: "user",
        reply: getText(
          language,
          `Today ${todayLoginCount} users logged in to Eventzaa.`,
          `आज Eventzaa में ${todayLoginCount} यूजर्स ने लॉगिन किया।`,
          `આજે Eventzaa માં ${todayLoginCount} યુઝર્સે લોગિન કર્યું.`
        ),
        data: {
          todayLoginCount,
        },
      });
    }

    // -----------------------------------------
    // 2. USERS REGISTERED TODAY
    // -----------------------------------------

    if (
      /\bhow many users? (?:are )?registered today\b/i.test(question) ||
      /\bhow many registered users? today\b/i.test(question) ||
      /\busers? registered today\b/i.test(question)
    ) {
      const registeredToday = await User.countDocuments({
        role: "user",
        createdAt: {
          $gte: start,
          $lt: end,
        },
      });

      return res.status(200).json({
        success: true,
        role: "user",
        reply: `Today ${registeredToday} new users registered in Eventzaa.`,
        data: {
          registeredToday,
        },
      });
    }

    // -----------------------------------------
    // 3. TOTAL REGISTERED USERS
    // -----------------------------------------

    if (
      /\bhow many users? (?:are )?registered\b/i.test(question) ||
      /\bhow many registered users?\b/i.test(question) ||
      /\btotal registered users?\b/i.test(question) ||
      /\bregistered users? count\b/i.test(question) ||
      /\bnumber of registered users?\b/i.test(question) ||
      /\btotal users?\b/i.test(question) ||
      /\busers? count\b/i.test(question) ||
      /(કુલ યુઝર|કેટલા યુઝર|કુલ વપરાશકર્તા|कुल यूजर|कितने यूजर)/i.test(question)
    ) {
      const totalUsers = await User.countDocuments({
        role: "user",
      });

      return res.status(200).json({
        success: true,
        role: "user",
        reply: getText(
          language,
          `Total registered users in Eventzaa: ${totalUsers}.`,
          `Eventzaa में कुल रजिस्टर्ड यूजर्स: ${totalUsers}.`,
          `Eventzaa માં કુલ રજિસ્ટર્ડ યુઝર્સ: ${totalUsers}.`
        ),
        data: {
          totalRegisteredUsers: totalUsers,
        },
      });
    }

    // -----------------------------------------
    // FETCH PUBLISHED EVENTS
    // -----------------------------------------

    const events = await Event.find({
      status: { $regex: /^published$/i },
    })
      .select("title description date location category price status")
      .sort({ date: 1 })
      .limit(30)
      .lean();

    // -----------------------------------------
    // FETCH ONLY LOGGED-IN USER BOOKINGS
    // -----------------------------------------

    const bookings = await Booking.find({ userId })
      .select(
        "bookingId eventTitle date location quantity price totalAmount status paymentStatus createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    let reply = "";

    // -----------------------------------------
    // 4. GREETING
    // -----------------------------------------

    if (
      /^(hi|hello|hey|hii|namaste|નમસ્તે|કેમ છો)/i.test(question)
    ) {
      reply = getText(
        language,
        "Hello! Welcome to Eventzaa. I can help you with events, event prices and your bookings.",
        "नमस्ते! Eventzaa में आपका स्वागत है। मैं आपको इवेंट और आपकी बुकिंग की जानकारी दे सकता हूँ।",
        "નમસ્તે! Eventzaa માં તમારું સ્વાગત છે. હું તમને ઇવેન્ટ અને તમારી બુકિંગની માહિતી આપી શકું છું."
      );
    }

    // -----------------------------------------
    // 5. MY BOOKINGS
    // -----------------------------------------

    else if (
      /(my booking|my bookings|show booking|show my booking|booking details|booking status|મારી બુકિંગ|બુકિંગ બતાવો|मेरी बुकिंग|बुकिंग दिखाओ)/i.test(question)
    ) {
      if (bookings.length === 0) {
        reply = getText(
          language,
          "You don't have any bookings yet.",
          "आपकी अभी कोई बुकिंग नहीं है।",
          "તમારી હજુ સુધી કોઈ બુકિંગ નથી."
        );
      } else {
        reply = `You have ${bookings.length} recent booking(s):`;

        bookings.forEach((booking, index) => {
          reply +=
            `\n\n${index + 1}. ${booking.eventTitle || "Event"}` +
            `\nBooking ID: ${booking.bookingId || booking._id}` +
            `\nDate: ${formatDate(booking.date)}` +
            `\nQuantity: ${booking.quantity || 1}` +
            `\nAmount: ${formatMoney(booking.totalAmount ?? booking.price)}` +
            `\nBooking Status: ${booking.status || "Pending"}` +
            `\nPayment Status: ${booking.paymentStatus || "Pending"}`;
        });
      }
    }

    // -----------------------------------------
    // 6. BOOKING COUNT
    // -----------------------------------------

    else if (
      /(how many bookings|how many booking|total bookings|total booking|booking count)/i.test(question)
    ) {
      reply = `You have ${bookings.length} recent booking(s).`;
    }

    // -----------------------------------------
    // 7. PAYMENT STATUS
    // -----------------------------------------

    else if (
      /(payment status|my payment|payment details|पेमेंट स्टेटस|मेरा पेमेंट|પેમેન્ટ સ્ટેટસ)/i.test(question)
    ) {
      if (bookings.length === 0) {
        reply = "You don't have any booking or payment records yet.";
      } else {
        reply = "Your booking payment details:";

        bookings.forEach((booking, index) => {
          reply +=
            `\n\n${index + 1}. ${booking.eventTitle || "Event"}` +
            `\nBooking ID: ${booking.bookingId || booking._id}` +
            `\nAmount: ${formatMoney(booking.totalAmount ?? booking.price)}` +
            `\nPayment Status: ${booking.paymentStatus || "Pending"}`;
        });
      }
    }

    // -----------------------------------------
    // 8. EVENT PRICE
    // -----------------------------------------

    else if (
      /(event price|event prices|price of event|event cost|इवेंट की कीमत|इवेंट प्राइस|ઇવેન્ટની કિંમત|ઇવેન્ટ પ્રાઇસ)/i.test(question)
    ) {
      if (events.length === 0) {
        reply = "Currently no published events are available.";
      } else {
        reply = "Available event prices:";

        events.forEach((event, index) => {
          reply +=
            `\n\n${index + 1}. ${event.title}` +
            `\nPrice: ${formatMoney(event.price)}` +
            `\nDate: ${formatDate(event.date)}`;
        });
      }
    }

    // -----------------------------------------
    // 9. AVAILABLE EVENTS
    // -----------------------------------------

    else if (
      /(event|events|upcoming|available|show event|event list|इवेंट|कार्यक्रम|ઇવેન્ટ|કાર્યક્રમ)/i.test(question)
    ) {
      if (events.length === 0) {
        reply = "Currently, no published events are available.";
      } else {
        reply = `Here are ${events.length} available Eventzaa events:`;

        events.forEach((event, index) => {
          reply +=
            `\n\n${index + 1}. ${event.title}` +
            `\nCategory: ${event.category || "N/A"}` +
            `\nDate: ${formatDate(event.date)}` +
            `\nLocation: ${event.location || "N/A"}` +
            `\nPrice: ${formatMoney(event.price)}`;
        });
      }
    }

    // -----------------------------------------
    // 10. HELP
    // -----------------------------------------

    else {
      reply = getText(
        language,
        "I can help you with:\n1. Available events\n2. Event prices and dates\n3. Your bookings\n4. Your booking and payment status\n5. Total registered users\n6. Users who logged in today\n\nTry asking: How many users logged in today?",
        "मैं आपकी मदद इन विषयों में कर सकता हूँ:\n1. उपलब्ध इवेंट\n2. इवेंट की कीमत और तारीख\n3. आपकी बुकिंग\n4. बुकिंग और पेमेंट स्टेटस\n5. कुल रजिस्टर्ड यूजर्स\n6. आज लॉगिन करने वाले यूजर्स\n\nपूछें: आज कितने यूजर्स ने लॉगिन किया?",
        "હું તમને આ બાબતોમાં મદદ કરી શકું છું:\n1. ઉપલબ્ધ ઇવેન્ટ\n2. ઇવેન્ટની કિંમત અને તારીખ\n3. તમારી બુકિંગ\n4. બુકિંગ અને પેમેન્ટ સ્ટેટસ\n5. કુલ રજિસ્ટર્ડ યુઝર્સ\n6. આજે લોગિન કરનારા યુઝર્સ\n\nપૂછો: આજે કેટલા યુઝર્સે લોગિન કર્યું?"
      );
    }

    return res.status(200).json({
      success: true,
      role: "user",
      reply,
      data: {
        totalAvailableEvents: events.length,
        totalMyBookings: bookings.length,
      },
    });
  } catch (error) {
    console.error("User chatbot error:", error);

    return res.status(500).json({
      success: false,
      message: "User chatbot failed.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

// ---------------------------------------------
// ADMIN CHATBOT
// POST /api/ai/admin-chat
// ---------------------------------------------

export const adminChat = async (req, res) => {
  try {
    const message = getMessage(req);

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid message.",
      });
    }

    const language = detectLanguage(message);
    const question = message.toLowerCase().trim();

    const { start, end } = getIndiaDayRange();

    const [
      totalUsers,
      totalEvents,
      publishedEvents,
      totalBookings,
      totalPayments,
      successfulPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
      todayLogins,
      revenueResult,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),

      Event.countDocuments({}),

      Event.countDocuments({
        status: { $regex: /^published$/i },
      }),

      Booking.countDocuments({}),

      Payment.countDocuments({}),

      Payment.countDocuments({
        paymentStatus: { $regex: /^success(ful)?$/i },
      }),

      Payment.countDocuments({
        paymentStatus: { $regex: /^pending$/i },
      }),

      Payment.countDocuments({
        paymentStatus: { $regex: /^failed$/i },
      }),

      Payment.countDocuments({
        paymentStatus: { $regex: /^refunded$/i },
      }),

      User.countDocuments({
        role: "user",
        lastLoginAt: {
          $gte: start,
          $lt: end,
        },
      }),

      Payment.aggregate([
        {
          $match: {
            paymentStatus: {
              $regex: /^success(ful)?$/i,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: "$amount",
            },
          },
        },
      ]),
    ]);

    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    const databaseData = {
      totalUsers,
      totalEvents,
      publishedEvents,
      totalBookings,
      totalPayments,
      successfulPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
      todayLogins,
      totalRevenue,
      currency: "INR",
    };

    let reply = "";

    // TODAY LOGIN COUNT
    if (
      /(?=.*\b(?:how many|number of|count|total)\b)(?=.*\busers?\b)(?=.*\b(?:login|log\s*in|logged\s*in|sign\s*in|signin)\b)(?=.*\btoday\b)/i.test(question) ||
      /\btoday'?s?\s+(?:user\s+)?logins?\b/i.test(question)
    ) {
      reply = `Today ${todayLogins} unique users logged in to Eventzaa.`;
    }

    // TOTAL REGISTERED USERS
    else if (
      /\b(?:total|how\s+many|count)\s+(?:registered\s+)?users?\b/i.test(question) ||
      /\bhow\s+many\s+users?\s+(?:are\s+)?registered\b/i.test(question) ||
      /\bnumber\s+of\s+registered\s+users?\b/i.test(question)
    ) {
      reply = `Total registered users: ${totalUsers}.`;
    }

    // TOTAL EVENTS
    else if (
      /(total events|how many events|event count)/i.test(question)
    ) {
      reply =
        `Total events: ${totalEvents}.\n` +
        `Published events: ${publishedEvents}.`;
    }

    // TOTAL BOOKINGS
    else if (
      /(total bookings|how many bookings|how many booking|booking count)/i.test(question)
    ) {
      reply = `Total bookings: ${totalBookings}.`;
    }

    // PAYMENT / REVENUE
    else if (
      /(revenue|total payment|total payments|transaction)/i.test(question)
    ) {
      reply =
        `Total transactions: ${totalPayments}\n` +
        `Successful payments: ${successfulPayments}\n` +
        `Pending payments: ${pendingPayments}\n` +
        `Failed payments: ${failedPayments}\n` +
        `Refunded payments: ${refundedPayments}\n` +
        `Total revenue: ${formatMoney(totalRevenue)}`;
    }

    // ALL STATISTICS
    else {
      reply =
        `Eventzaa Database Statistics:\n\n` +
        `Total Users: ${totalUsers}\n` +
        `Total Events: ${totalEvents}\n` +
        `Published Events: ${publishedEvents}\n` +
        `Total Bookings: ${totalBookings}\n` +
        `Total Transactions: ${totalPayments}\n` +
        `Successful Payments: ${successfulPayments}\n` +
        `Pending Payments: ${pendingPayments}\n` +
        `Failed Payments: ${failedPayments}\n` +
        `Total Revenue: ${formatMoney(totalRevenue)}\n` +
        `Today's User Logins: ${todayLogins}`;
    }

    return res.status(200).json({
      success: true,
      role: "admin",
      reply,
      data: databaseData,
    });
  } catch (error) {
    console.error("Admin chatbot error:", error);

    return res.status(500).json({
      success: false,
      message: "Admin chatbot failed.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};
