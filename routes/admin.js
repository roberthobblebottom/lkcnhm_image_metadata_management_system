const express = require("express");
const router = express.Router();
const path = require("path");
const db = require("./db"); // Database connection
const { isAuthenticated, isAdmin } = require("../middleware/auth"); // Middleware

// 📌 Serve Admin Users Page (HTML)
router.get("/admin-users", isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, "../views/admin-users.html"));
});

// 📌 API: Fetch Users Data
router.get("/api/users", isAuthenticated, isAdmin, (req, res) => {
    const query = "SELECT LoginUserID as id, LoginUserName as name, Email as email, LoginUserType as role FROM LoginUser WHERE IsDelete = 0";

    db.query(query, (err, results) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

module.exports = router;
