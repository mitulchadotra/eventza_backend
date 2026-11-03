import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

let transporter;

const getGmailTransporter = () => {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

  if (!gmailUser || !gmailAppPassword) {
    const error = new Error(
      "Gmail SMTP is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD."
    );
    error.status = 503;
    throw error;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  return { transporter, gmailUser };
};

// Gmail SMTP connection test
export const testGmailConnection = async () => {
  const { transporter: gmailTransporter } = getGmailTransporter();

  await gmailTransporter.verify();

  console.log("GMAIL SMTP CONNECTION SUCCESSFUL");

  return true;
};

// Send OTP to any valid user email
export const sendOtpEmail = async (email, otp) => {
  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ||
    typeof otp !== "string" ||
    !/^\d{6}$/.test(otp)
  ) {
    const error = new Error(
      "A valid recipient email and six-digit OTP are required."
    );
    error.status = 400;
    throw error;
  }

  try {
    const { transporter: gmailTransporter, gmailUser } =
      getGmailTransporter();

    const result = await gmailTransporter.sendMail({
      from: `"Eventzaa" <${gmailUser}>`,
      to: email.trim().toLowerCase(),
      subject: "Your Eventzaa Login OTP",

      text: `Your Eventzaa login OTP is ${otp}.

It expires in 5 minutes.
Do not share this OTP with anyone.`,

      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:25px;border:1px solid #e5e7eb;border-radius:12px;background:#fff">
          <h2 style="color:#2563eb">Eventzaa Login Verification</h2>
          <p>Your login verification code is:</p>

          <h1 style="letter-spacing:8px;color:#2563eb;background:#eff6ff;padding:15px;text-align:center;border-radius:8px">
            ${otp}
          </h1>

          <p>This OTP expires in <b>5 minutes</b>.</p>
          <p style="color:#dc2626">Do not share this OTP with anyone.</p>

          <hr />

          <p style="color:#6b7280;font-size:12px">
            This is an automated email from Eventzaa. Please do not reply.
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
      responseCode: error.responseCode,
    });

    if (error.status) {
      throw error;
    }

    const deliveryError = new Error(
      "Gmail could not send OTP. Check your Gmail App Password and SMTP configuration."
    );

    deliveryError.status = 503;

    throw deliveryError;
  }
};

export const sendLoginOtp = sendOtpEmail;

export default sendOtpEmail;