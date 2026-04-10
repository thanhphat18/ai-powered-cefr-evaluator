const User = require("../models/User");

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({
          message: "Not authenticated",
        });
      }

      const user = await User.findById(req.session.userId).select("email role username");

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      const role = user.role || "student";

      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          message: "You do not have permission to access this resource",
        });
      }

      req.currentUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = requireRole;
