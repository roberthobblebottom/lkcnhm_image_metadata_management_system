const express = require("express");
const router = express.Router();
import crypto from "crypto";
import { RowDataPacket } from "mysql2";
import { db } from "../db";
import {
  formatDisplayDate,
  requestStatusEnumeration,
  userTypesEnumeration,
} from "../../middleware/utils";
const { isAuthenticated, isAdmin } = require("../../middleware/auth"); // Middleware

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
      title: "User Management",
    });
  });
});

//refactored from server.js, not tested and may not be needed
router.get("/view/:user_id", isAuthenticated, (req, res) => {
  const { user_id } = req.params;
  const isAdminRequestor =
    req.session.passport.user?.UserType === userTypesEnumeration().admin;
  const isAdmin =
    req.session.passport.user.UserType === userTypesEnumeration().admin;

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

  db.query(query, [user_id], (err, results: any) => {
    if (err) {
      console.error("❌ Error fetching user with joins:", err);
      return res.status(500).send("Error fetching user.");
    }

    if (results.length === 0) {
      return res.status(404).send("User not found or has been deleted.");
    }

    console.log("📄 User Data Fetched:", results[0]);
    res.render("view", {
      user: results[0],
      isAdminRequestor,
      isAdmin,
      title: "Imaging User Details",
    });
  });
});
//update user details
// Render edit user page (support both singular and plural URLs)
router.get("/edit/:userID", isAuthenticated, isAdmin, async (req, res) => {
  const userId = req.params.userID;
  const query =
    "SELECT UserID,Email,UserType,FullName,RegisteredDate,ContactNumber,Organisation,Comments,RequestStatus,IsDeleted,ReasonForRequest FROM User WHERE UserID = ?";

  const result = (
    await db.promise().query<RowDataPacket[]>(query, [userId])
  )[0];
  if (result.length === 0) {
    return res.render("admin/edit", {
      title: "User Not Found",

      message: {
        type: "error",
        text: "User not found or has been deleted",
      },
      user: null,
    });
  }

  const message = req.session.message || { type: "", text: "" };

  res.render("admin/edit", {
    user: result[0],
    userTypes: Object.values(userTypesEnumeration()),
    requestStatuses: Object.values(requestStatusEnumeration()),
    registeredDate: formatDisplayDate(result[0].RegisteredDate),
    title: `Edit User - ${result[0].Email}`,
    message: message,
  });

  if (req.session.message) {
    delete req.session.message;
  }
});

// Handle form submission (support both singular and plural URLs)
// TODO more User Attributes need to be updated here.
router.post(
  ["/edit/:userID", "/update-users/:id"],
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    const adminID = req.params.userID;

    const {
      userID,
      email,
      password,
      confirmPassword,
      userType,
      fullName,
      contactNumber,
      organisation,
      comments,
      requestStatus,
      reasonForRequest,
    } = req.body;
    console.log(req.body);
    //Validation
    const missingFields = [];
    if (!userID) missingFields.push("userID");
    if (!email) missingFields.push("email");
    if (!fullName) missingFields.push("fullName");
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: " + missingFields.join(", "),
      });
    }
    if (!/^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/.test(email))
      return res.status(400).json({
        success: false,
        message:
          "invalid email, email value does not have '@' or '.' character(s).",
      });
    if (password != confirmPassword && password.trim() != "") {
      return res.status(400).json({
        success: false,
        message: "the new passwords does not match",
      });
    }
    const query = `
        UPDATE User 
    SET
        Email=?,
        UserType=?,
        FullName=?,
        ContactNumber=?,
        Organisation = ?,
        Comments=?,
        RequestStatus=?,
        ReasonForRequest=?,
        UpdatedDate = NOW(),
        UpdatedByID = ?
    `;

    const newPasswordSalt = crypto.randomBytes(16).toString("hex");
    try {
      crypto.pbkdf2(
        password,
        newPasswordSalt,
        310000,
        32,
        "sha256",
        async function (err, hashedPassword) {
          if (err)
            return res.json({
              success: false,
              message: `❌ Password change salting Failed: ${err} `,
            });
          const q2 =
            password.trim() != ""
              ? query + ",SaltedPassword = ?, PasswordSalt = ? WHERE UserID = ?"
              : query + "WHERE UserID = ?";
          const params =
            password.trim() != ""
              ? [
                  email,
                  userType,
                  fullName,
                  contactNumber,
                  organisation,
                  comments,
                  requestStatus,
                  reasonForRequest,
                  adminID,
                  hashedPassword,
                  newPasswordSalt,
                  userID,
                ]
              : [
                  email,
                  userType,
                  fullName,
                  contactNumber,
                  organisation,
                  comments,
                  requestStatus,
                  reasonForRequest,
                  adminID,
                  userID,
                ];

          await db.promise().query<RowDataPacket[]>(q2, params);
          return res.json({
            success: true,
            message: "User updated successfully!",
          });
        }
      );
    } catch (error) {
      console.error("password change error:", error);
      return res.json({
        success: false,
        message: `❌ Password change Failed: ${error} `,
      });
    }
  }
);

// ✅ API to Fetch a Single User by ID
router.get("/admin-users/:id", isAuthenticated, isAdmin, (req, res) => {
  const userId = req.params.id;
  const query =
    "SELECT UserID, Email, Password, TemporaryPassword FROM User WHERE UserID = ? AND IsDeleted = 0";

  db.query(query, [userId], (err, result: any) => {
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

  db.query(
    query,
    [Email, Password, TemporaryPassword, userId],
    (err, result) => {
      if (err) {
        console.error("❌ Database Error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      res.json({ success: true, message: "User updated successfully" });
    }
  );
});

// ✅ Delete User (Soft Delete - Update IsDeleted to 1)
router.post("/delete/:userID", isAuthenticated, isAdmin, (req, res) => {
  const userId = req.params.userID;
  const query = "UPDATE User SET IsDeleted = 1 WHERE UserID = ?";

  db.query(query, [userId], (err, result) => {
    if (err) {
      console.error("❌ Database Error:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    console.log(`🗑️ User ${userId} marked as deleted`);

    res.redirect("/admin/user-management/view-all");
  });
});

router.post("/restore/:userID", isAuthenticated, isAdmin, (req, res) => {
  const userID = req.params.userID;
  db.query(
    "UPDATE User SET IsDeleted = 0 WHERE UserID = ?",
    [userID],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error recovering user" });
      }
      console.log(`✅ User with ID ${userID} recovered`);
      res.redirect("/admin/user-management/view-all"); // Redirect to admin page after recovery
    }
  );
});

module.exports = router;
