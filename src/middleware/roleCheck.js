// backend/src/middleware/roleCheck.js

const authorize = (...roles) => {
  return (req, res, next) => {
    console.log("=== AUTHORIZATION DEBUG ===");
    console.log("Requested route:", req.originalUrl);
    console.log(
      "User:",
      req.user
        ? {
            id: req.user._id,
            username: req.user.username,
            role: req.user.role,
          }
        : "No user"
    );
    console.log("Allowed roles:", roles);
    console.log(
      "Is authorized:",
      req.user ? roles.includes(req.user.role) : false
    );
    console.log("===========================");

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${
          req.user.role
        }' is not authorized to access this route. Required roles: ${roles.join(
          ", "
        )}`,
      });
    }

    next();
  };
};

module.exports = { authorize };
