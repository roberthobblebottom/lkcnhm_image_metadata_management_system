const express = require("express");
const router = express.Router();
const path = require("path");
const db = require("../db"); // Database connection
const { isAuthenticated, isAdmin } = require("../../middleware/auth"); // Middleware

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

// 🔒 Admin Routes (Protected)
router.get("/dashboard", isAuthenticated, isAdmin, (req, res) => {
    console.log("🟢 Accessing Admin Dashboard - Session Data:", req.session.user);
    res.render("admin/admin-dashboard", { user: req.session.user, title: "Admin Dashboard" });
});

//change-password.ejs
router.get('/change-password', isAuthenticated, isAdmin, (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    res.render('change-password', { user: req.session.user.Email }); // ✅ pass `user` to EJS
});

router.post('/change-password', isAuthenticated, (req, res) => {
    const email = req.session.user.Email;
    const { old_password, new_password } = req.body;

    console.log("📩 Change Password Request for:", email);
    console.log("🧾 Request Body:", req.body);

    const checkQuery = 'SELECT Password FROM User WHERE Email = ?';

    db.query(checkQuery, [email], (err, results) => {
        if (err) {
            console.error("❌ MySQL SELECT error:", err);
            return res.json({ success: false, message: "❌ Database error" });
        }

        if (results.length === 0) {
            return res.json({ success: false, message: "❌ Email not found" });
        }

        const currentPassword = results[0].Password;

        if (old_password !== currentPassword) {
            return res.json({ success: false, message: "❌ Old password is incorrect" });
        }

        if (old_password === new_password) {
            return res.json({ success: false, message: "❌ New password must be different from old password" });
        }

        const updateQuery = 'UPDATE User SET Password = ?, UpdatedDate = NOW() WHERE Email = ?';

        db.query(updateQuery, [new_password, email], (err, updateResult) => {
            if (err) {
                console.error("❌ MySQL UPDATE error:", err);
                return res.json({ success: false, message: "❌ Failed to update password" });
            }

            if (updateResult.affectedRows === 0) {
                return res.json({ success: false, message: "❌ No rows were updated" });
            }

            console.log("✅ Password updated for:", email);
            return res.json({ success: true, message: "✅ Password changed successfully!" });

        });
    });
});

router.get('/get-user', isAuthenticated, (req, res) => {
    const getRequestors = "SELECT UserID, Email FROM User WHERE UserType = 'photographer'";
    const getPhotographers = "SELECT UserID, Email FROM User WHERE UserType = 'requestor'";

    db.query(getRequestors, (err1, requestors) => {
        if (err1) {
            console.error("Error loading requestors:", err1);
            return res.status(500).json({
                success: false,
                message: "Error loading requestors"
            });
        }

        db.query(getPhotographers, (err2, photographers) => {
            if (err2) {
                console.error("Error loading photographers:", err2);
                return res.status(500).json({
                    success: false,
                    message: "Error loading photographers"
                });
            }

            res.json({
                success: true,
                requestors: requestors,
                photographers: photographers
            });
        });
    });
});

module.exports = router;
