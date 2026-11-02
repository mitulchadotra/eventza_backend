 const authorizeAdmin = (req, res, next) => {
  try {
    // Check whether the user is authenticated
    if (!req.user) {
      return res.status(401).json({
        status: 0,
        message: "Unauthorized. Please login first.",
      });
    }

    // Check admin role
    if (
      !req.user.role ||
      String(req.user.role).toLowerCase() !== "admin"
    ) {
      return res.status(403).json({
        status: 0,
        message: "Access denied. Admin only.",
      });
    }

    // Admin authorized
    return next();
  } catch (error) {
    console.error("AuthorizeAdmin error:", error.message);

    return res.status(500).json({
      status: 0,
      message: "Internal server error during authorization.",
    });
  }
};

export default authorizeAdmin;