import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing in .env");
}

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default openai;