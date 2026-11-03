
import dotenv from "dotenv";

dotenv.config();

// =====================================
// RESEND EMAIL CONFIGURATION
// =====================================

const RESEND_API_URL = "https://api.resend.com/emails";

const getEmailConfig = () => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error("Email service configuration is unavailable.");
    return null;
  }

  return {
    apiKey,
    from:
      process.env.RESEND_FROM_EMAIL ||
      "Eventzaa <onboarding@resend.dev>",
  };
};

// =====================================
// SEND LOGIN OTP EMAIL
// =====================================

export const sendLoginOtp = async (to, otp) => {
  try {
    if (!to || !otp) {
      throw new Error("Invalid email or OTP.");
    }

    const config = getEmailConfig();

    if (!config) {
      throw new Error("Email service unavailable.");
    }

    const response = await fetch(RESEND_API_URL, {
      method: "POST",

      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        from: config.from,
        to: [to],

        subject: "Eventzaa Login OTP Verification",

        html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial, sans-serif; background:#f4f6fb; padding:30px;">
            <div style="max-width:500px; margin:auto; background:white; padding:30px; border-radius:12px;">

              <h2 style="color:#263b80;">Eventzaa</h2>

              <h3>Login Verification</h3>

              <p>Hello,</p>

              <p>Your Eventzaa login verification OTP is:</p>

              <div style="background:#eef2ff; padding:20px; text-align:center; border-radius:8px;">
                <h1 style="letter-spacing:8px; color:#263b80;">
                  ${String(otp).replace(/[&<>"']/g, "")}
                </h1>
              </div>

              <p>This OTP is valid for <b>5 minutes</b>.</p>

              <p>Do not share this OTP with anyone.</p>

              <hr />

              <p style="color:#777; font-size:12px;">
                This is an automated email from Eventzaa.
              </p>

            </div>
          </body>
          </html>
        `,
      }),
      signal: AbortSignal.timeout(20000),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend email request failed:", data);
      throw new Error("Email delivery failed.");
    }

    console.log("OTP email sent successfully.");

    return data;

  } catch (error) {
    console.error("OTP email service error:", error.message);

    throw new Error(
      "Unable to send OTP right now. Please try again later."
    );
  }
};

// =====================================
// ALIAS FOR EXISTING CONTROLLERS
// =====================================

export const sendOtpEmail = sendLoginOtp;

export const testGmailConnection = async () => {
  return Boolean(process.env.RESEND_API_KEY);
};

export default {
  sendLoginOtp,
  sendOtpEmail,
  testGmailConnection,
};
