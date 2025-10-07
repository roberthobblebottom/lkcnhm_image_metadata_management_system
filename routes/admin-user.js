const express = require("express");
const db = require("../db");
const router = express.Router();

// ✅ Get user details by ID
router.get("/:id", (req, res) => {
    const userId = req.params.id;
    const query = "SELECT * FROM LoginUser WHERE LoginUserID = ? AND IsDelete = 0";

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("❌ Error fetching user:", err);
            return res.status(500).json({ success: false, error: "Database error" });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, error: "User not found" });
        }
        res.json({ success: true, user: results[0] });
    });
});

// ✅ Update user details
router.put("/:id", (req, res) => {
    const userId = req.params.id;
    const { LoginUserName, Password, LoginUserType } = req.body;
    const query = "UPDATE LoginUser SET LoginUserName=?, Password=?, LoginUserType=?, UpdatedDate=NOW() WHERE LoginUserID=?";

    db.query(query, [LoginUserName, Password, LoginUserType, userId], (err, result) => {
        if (err) {
            console.error("❌ Error updating user:", err);
            return res.status(500).json({ success: false, error: "Database error" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: "User not found" });
        }
        res.json({ success: true, message: "User updated successfully" });
    });
});

module.exports = router;
