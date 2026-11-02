
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const gmailUser = process.env.GMAIL_USER;
const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

if (!gmailUser || !gmailPassword) {
  throw new Error("GMAIL_USER or GMAIL_APP_PASSWORD missing in .env");
}

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

export const testGmailConnection = async () => {
  try {
    await transporter.verify();
    console.log("GMAIL SMTP CONNECTION SUCCESSFUL");
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

export const sendOtpEmail = async (email, otp) => {
  try {
    const result = await transporter.sendMail({
      from: `"Eventzaa" <${gmailUser}>`,
      to: email,
      subject: "Your Eventzaa Login OTP",
      text: `Your Eventzaa login OTP is ${otp}. It expires in 5 minutes. Do not share this OTP with anyone.`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px">
          <h2>Eventzaa Login Verification</h2>
          <p>Your login verification code is:</p>
          <h1 style="letter-spacing:8px">${otp}</h1>
          <p>This OTP expires in 5 minutes.</p>
          <p>Do not share this OTP with anyone.</p>
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
