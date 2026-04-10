const express = require("express");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.get("/test", requireAuth, (req, res) => {
  res.status(200).json({
    message: "Protected route works",
    userId: req.session.userId,
  });
});

module.exports = router;
