
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// ================= GMAIL CONFIGURATION =================

const gmailUser = process.env.GMAIL_USER;

const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

if (!gmailUser || !gmailPassword) {
  throw new Error(
    "GMAIL_USER or GMAIL_APP_PASSWORD missing in environment variables"
  );
}

// ================= SMTP TRANSPORTER =================

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: gmailUser,
    pass: gmailPassword,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

// ================= TEST GMAIL CONNECTION =================

export const testGmailConnection = async () => {
  try {
    await transporter.verify();

    console.log("GMAIL SMTP CONNECTION SUCCESSFUL");

    return true;
  } catch (error) {
    console.error("GMAIL SMTP CONNECTION ERROR:", {
      message: error.message,
      code: error.code,
      response: error.response,
      command: error.command,
    });

    throw error;
  }
};

// ================= SEND OTP EMAIL =================

export const sendOtpEmail = async (email, otp) => {
  try {
    if (!email || !otp) {
      throw new Error("Email and OTP are required");
    }

    const result = await transporter.sendMail({
      from: `"Eventzaa" <${gmailUser}>`,
      to: email,
      subject: "Your Eventzaa Login OTP",

      text: `
Your Eventzaa login OTP is ${otp}.

It expires in 5 minutes.
Do not share this OTP with anyone.
      `,

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

          <p>
            This OTP expires in <b>5 minutes</b>.
          </p>

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
    });

    console.log("OTP EMAIL SENT:", result.messageId);

    return result;
  } catch (error) {
    console.error("GMAIL SMTP ERROR:", {
      message: error.message,
      code: error.code,
      response: error.response,
      command: error.command,
    });

    throw error;
  }
};

// ================= CONTROLLER COMPATIBILITY =================

// otpAuthController.js can import sendLoginOtp.
export const sendLoginOtp = sendOtpEmail;

export default sendOtpEmail;
