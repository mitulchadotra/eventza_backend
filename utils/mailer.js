import dotenv from "dotenv";

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Eventzaa <onboarding@resend.dev>";

// ================= CHECK CONFIGURATION =================

const checkResendConfig = () => {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is missing in Render Environment");
  }
};

// ================= TEST RESEND CONFIGURATION =================

export const testGmailConnection = async () => {
  checkResendConfig();
  console.log("RESEND API CONFIGURATION SUCCESSFUL");
  return true;
};

// ================= SEND OTP EMAIL =================

export const sendOtpEmail = async (email, otp) => {
  try {
    checkResendConfig();

    if (!email || !otp) {
      throw new Error("Email and OTP are required");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject: "Your Eventzaa Login OTP",

        text: `Your Eventzaa login OTP is ${otp}.

It expires in 5 minutes.
Do not share this OTP with anyone.`,

        html: `
          <div style="
            font-family: Arial, sans-serif;
            max-width: 500px;
            margin: auto;
            padding: 25px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #ffffff;
          ">
            <h2 style="color: #2563eb;">
              Eventzaa Login Verification
            </h2>

            <p>Hello,</p>
            <p>Your login verification code is:</p>

            <h1 style="
              letter-spacing: 8px;
              color: #2563eb;
              background: #eff6ff;
              padding: 15px;
              text-align: center;
              border-radius: 8px;
            ">
              ${otp}
            </h1>

            <p>This OTP expires in <b>5 minutes</b>.</p>

            <p style="color: #dc2626;">
              Do not share this OTP with anyone.
            </p>

            <hr />

            <p style="color: #6b7280; font-size: 12px;">
              This is an automated email from Eventzaa.
              Please do not reply.
            </p>
          </div>
        `,
      }),
      signal: AbortSignal.timeout(20000),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("RESEND API ERROR:", result);

      throw new Error(
        result.message || `Email sending failed: ${response.status}`
      );
    }

    console.log("OTP EMAIL SENT:", result.id);

    return result;
  } catch (error) {
    console.error("RESEND EMAIL ERROR:", error.message);
    throw error;
  }
};

// ================= CONTROLLER COMPATIBILITY =================

export const sendLoginOtp = sendOtpEmail;

export default sendOtpEmail;