import jwt from "jsonwebtoken";
import secretKey from "../jwtConfig.js";

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
    },
    secretKey,
    { expiresIn: "24h" }
  );
};

export default generateToken;