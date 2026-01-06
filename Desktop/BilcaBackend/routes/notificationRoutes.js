// routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const {
  getNotifications,
  markAsRead,
  deleteNotifications,
  deleteAllNotifications
} = require("../controllers/notificationController");

router.get("/", auth, getNotifications);               // GET /api/notifications
router.post("/read", auth, markAsRead);                // POST /api/notifications/read
router.delete("/delete", auth, deleteNotifications);   // DELETE /api/notifications/delete
router.delete("/delete/all", auth, deleteAllNotifications); // DELETE /api/notifications/delete/all

module.exports = router;