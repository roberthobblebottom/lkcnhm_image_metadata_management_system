const express = require("express");
const router = express.Router();

import { RowDataPacket } from "mysql2";
import { db } from "../db"
const { isAuthenticated, isAdmin } = require("../../middleware/auth"); // Middleware
const userTypesEnumeration = require('../../middleware/utils').userTypesEnum;





//✅ API to Fetch All Users
router.get("/view-all", isAuthenticated, isAdmin, (req, res) => {
    console.log("Route /admin-users hit"); // Debug log 1
    const query = `SELECT UserID, Email,UserType,FullName,Organisation,
    RegisteredDate, LastLoginDate, RequestStatus, IsDeleted  FROM User`;

    db.query(query, (err, result) => {
        console.log("Query executed", { err, result }); // Debug log 2
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        console.log("Rendering template"); // Debug log 3
        res.render("admin/view-all", {
            users: result,
            title: "User Management"
        });
    });
});

//refactored from server.js, not tested and may not be needed
router.get('/view/:user_id', isAuthenticated, (req, res) => {
    const { user_id } = req.params;
    const isAdminRequestor = req.session.passport.user?.UserType === userTypesEnumeration.admin;
    const isAdmin = req.session.passport.user.UserType === userTypesEnumeration.admin;

    const query = `
        SELECT 
            u.*, 
            creator.Email AS CreatedByName,
            updater.Email AS UpdatedByName,
            ut.UserTypeName,
            u.RequestStatus
        FROM User u
        LEFT JOIN User creator ON u.CreatedByID = creator.UserID
        LEFT JOIN User updater ON u.updated_by = updater.UserID
        LEFT JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
        WHERE u.UserID = ? AND u.IsDeleted = 0
    `;

    db.query(query, [user_id], (err, results:any) => {
        if (err) {
            console.error('❌ Error fetching user with joins:', err);
            return res.status(500).send('Error fetching user.');
        }

        if (results.length === 0) {
            return res.status(404).send('User not found or has been deleted.');
        }

        console.log("📄 User Data Fetched:", results[0]);
        res.render('view', { user: results[0], isAdminRequestor, isAdmin, title: "Imaging User Details" });
    });
});
//update user details
// Render edit user page (support both singular and plural URLs)
router.get("/edit/:userID", isAuthenticated, isAdmin,async (req, res) => {
    const userId = req.params.userID;
    const query = "SELECT * FROM User WHERE UserID = ?";

    const result = (await db.promise().query<RowDataPacket[]>(query, [userId]         ))[0];
    const result = (await db.promise().query<RowDataPacket[]>(query, [userId]         ))[0];
    if (result.length === 0) {
            return res.render("admin/edit", {
                title: "User Not Found",
                message: {
                    type: 'error',
                    text: 'User not found or has been deleted'
                },
                user: null
            });
        }

        const message = req.session.message || { type: '', text: '' };

        res.render("edit-user", {
            user: result[0],
            title: `Edit User - ${result[0].Email}`,
            message: message
        });

        if (req.session.message) {
            delete req.session.message;
        }
});


// Handle form submission (support both singular and plural URLs)
// TODO more User Attributes need to be updated here.
router.post(["/update-user/:id", "/update-users/:id"], isAuthenticated, isAdmin, (req, res) => {
    const userId = req.params.id;
    const { TemporaryPassword, UserType, IsDeleted } = req.body;

    const query = `
        UPDATE User 
        SET TemporaryPassword = ?, 
            UserType = ?, 
            IsDeleted = ?,
            UpdatedDate = NOW()
        WHERE UserID = ? 
    `;

    db.query(query, [TemporaryPassword, UserType, IsDeleted, userId], (err, result:any) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({
                success: false,
                message: 'Failed to update user: ' + err.message
            });
        } else if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found or already deleted'
            });
        } else {
            return res.json({
                success: true,
                message: 'User updated successfully!'
            });
        }
    });
});



// ✅ API to Fetch a Single User by ID
router.get("/admin-users/:id", isAuthenticated, isAdmin, (req, res) => {
    const userId = req.params.id;
    const query = "SELECT UserID, Email, Password, TemporaryPassword FROM User WHERE UserID = ? AND IsDeleted = 0";

    db.query(query, [userId], (err, result:any) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ success: true, user: result[0] });
    });
});

// ✅ API to Edit User Details
router.put("/admin-users/:id", isAuthenticated, isAdmin, (req, res) => {
    const userId = req.params.id;
    const { Email, Password, TemporaryPassword } = req.body;

    const query = `
        UPDATE User 
        SET Email = ?, Password = ?, TemporaryPassword = ?, UpdatedDate = NOW() 
        WHERE UserID = ? AND IsDeleted = 0
    `;

    db.query(query, [Email, Password, TemporaryPassword, userId], (err, result) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        res.json({ success: true, message: "User updated successfully" });
    });
});

// ✅ Delete User (Soft Delete - Update IsDeleted to 1)
router.post("/delete/:userID", isAuthenticated,isAdmin,(req, res) => {
    const userId = req.params.userID;
    const query = "UPDATE User SET IsDeleted = 1 WHERE UserID = ?";

    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ success: false, error: "Database error" });
        }
        console.log(`🗑️ User ${userId} marked as deleted`);

        res.redirect('/admin/user-management/view-all');
    });
});



router.post("/restore/:userID", isAuthenticated, isAdmin, (req, res) => {
    const userID = req.params.userID;
    db.query("UPDATE User SET IsDeleted = 0 WHERE UserID = ?",
        [userID], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Error recovering user" });
        }
        console.log(`✅ User with ID ${userID} recovered`);
        res.redirect('/admin/user-management/view-all'); // Redirect to admin page after recovery
    });
});



module.exports = router;