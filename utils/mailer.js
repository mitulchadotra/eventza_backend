
import dotenv from "dotenv";
dotenv.config();

const RESEND_API_URL = "https://api.resend.com/emails";

export const sendLoginOtp = async (to, otp) => {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    // API key validation
    if (!apiKey) {
      console.error("RESEND_API_KEY is missing.");
      throw new Error("Email service is not configured.");
    }

    if (!to || !otp) {
      throw new Error("Recipient email or OTP is missing.");
    }

    // Default sender for Resend testing
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      "Eventzaa <onboarding@resend.dev>";

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: "Your Eventzaa Login OTP",
        html: `
          <div style="font-family:Arial;padding:25px;">
            <h2 style="color:#263b80;">Eventzaa</h2>
            <h3>Login Verification</h3>
            <p>Your login OTP is:</p>
            <h1 style="letter-spacing:8px;color:#263b80;">${String(otp).replace(/[&<>"']/g, "")}</h1>
            <p>This OTP is valid for 5 minutes.</p>
            <p>Do not share your OTP with anyone.</p>
          </div>
        `,
      }),
      signal: AbortSignal.timeout(20000),
    });

    const responseText = await response.text();

    let result;
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      result = { message: responseText };
    }

    if (!response.ok) {
      console.error("RESEND STATUS:", response.status);
      console.error("RESEND RESPONSE:", result);
      throw new Error("Resend rejected the email.");
    }

    console.log("OTP EMAIL SENT:", result.id);
    return result;

  } catch (error) {
    console.error("OTP EMAIL ERROR:", error.message);
    throw new Error("Unable to send OTP. Please try again later.");
  }
};

export const sendOtpEmail = sendLoginOtp;

export const testGmailConnection = async () => {
  return Boolean(process.env.RESEND_API_KEY);
};

export default {
  sendLoginOtp,
  sendOtpEmail,
  testGmailConnection,
};
