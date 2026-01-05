// backend/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const {
  getUsers,
  updateUser,
  deleteUser,
  getAdminOverview,
  getAdminMetrics,
  getUserById,
  getSubscriptionMetrics,
  suspendUser,
  restoreUser,
} = require("../controllers/adminController");

router.use(auth);
router.use((req, res, next) => {
  if (req.user.role !== "superadmin") {
    return res.status(403).json({ msg: "Acceso denegado: solo superadmin" });
  }
  next();
});

router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.post("/users/:id/suspend", suspendUser);
router.post("/users/:id/restore", restoreUser);
router.get("/dashboard/overview", getAdminOverview);
router.get("/dashboard/metrics", getAdminMetrics);
router.get("/dashboard/subscriptions", getSubscriptionMetrics);

module.exports = router;
