import dotenv from "dotenv";

dotenv.config();

const secretKey = process.env.JWT_SECRET;

if (!secretKey || secretKey.length < 32) {
  throw new Error(
    "JWT_SECRET must be at least 32 characters in .env"
  );
}

export default secretKey;