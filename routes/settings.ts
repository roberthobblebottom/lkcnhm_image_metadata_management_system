const express = require("express");
const router = express.Router();
import { RowDataPacket } from "mysql2";
import { db } from "./db";
import { Request, Response } from "express";
import crypto from "crypto";
import {
  emailRegex,
  formatDisplayDate,
  staffTypesEnumeration,
} from "../middleware/utils";
const { isAuthenticated } = require("../middleware/auth");

router.get(
  "/change-password",
  isAuthenticated,
  (req: Request, res: Response) => {
    if (!req.session.passport.user) {
      return res.redirect("/login");
    }

    res.render("settings/change-password", {
      currentUser: req.session.passport.user,
      title: "Change Password",
    });
  }
);

router.post(
  "/change-password",
  isAuthenticated,
  async (req: Request, res: Response) => {
    // This may not be the best way to change passwords.
    const username = req.body.email;
    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;
    const confirmNewPassword = req.body.confirmNewPassword;

    if (newPassword != confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "the new passwords does not match",
      });
    }

    console.log("📩 Change Password Request for:", username);
    console.log("🧾 Request Body:", req.body);
    const query =
      "SELECT SaltedPassword,PasswordSalt FROM User WHERE Email = ?";
    const results = (
      await db.promise().query<RowDataPacket[]>(query, [username])
    )[0][0];
    const currentSaltedPassword = results.SaltedPassword;
    const currentPasswordSalt = results.PasswordSalt;
    try {
      const newPasswordSalt = crypto.randomBytes(16).toString("hex");
      // first hash to see if old password matches and
      // then second hash is used for updating the db with the new salted password.
      crypto.pbkdf2(
        oldPassword,
        currentPasswordSalt,
        310000,
        32,
        "sha256",
        async function (err, hashedPassword) {
          if (!crypto.timingSafeEqual(hashedPassword, currentSaltedPassword)) {
            console.log("old passwords matched");
            return res.json({
              success: false,
              message: "old password is incorrect",
            });
          }

          crypto.pbkdf2(
            newPassword,
            newPasswordSalt,
            310000,
            32,
            "sha256",
            async function (err, hashedPassword) {
              console.log("inside password hashed functions");
              const updatePasswordQuery =
                "UPDATE User SET SaltedPassword = ?, PasswordSalt = ? WHERE Email = ?";
              await db
                .promise()
                .query<RowDataPacket[]>(updatePasswordQuery, [
                  hashedPassword,
                  newPasswordSalt,
                  username,
                ]);
              return res.json({
                success: true,
                message: "sucessfully changed password",
              });
            }
          );
        }
      );
    } catch (error) {
      console.error("password change error:", error);
      return res.json({
        success: false,
        message: `❌ Password change Failed: ${error} `,
      });
    }
    return;
  }
);
router.get("/profile", isAuthenticated, async (req: Request, res: Response) => {
  const query = "SELECT * FROM User WHERE User.UserID = ?";
  const result = (
    await db
      .promise()
      .query<RowDataPacket[]>(query, [req.session.passport.user.UserID])
  )[0][0];
  res.render("settings/profile", {
    currentUser: result,
    registeredDate: formatDisplayDate(result.RegisteredDate),
    staffTypes: Object.values(staffTypesEnumeration()),
  });
});

router.post(
  "/profile",
  isAuthenticated,
  async (req: Request, res: Response) => {
    const {
      userID,
      email,
      fullName,
      contactNumber,
      staffType,
      comments,
      originalEmail,
    } = req.body;
    const missingFields = [];
    //validation
    if (!userID) missingFields.push("userID");
    if (!email) missingFields.push("email");
    if (!fullName) missingFields.push("fullName");
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: " + missingFields.join(", "),
      });
    }
    if (!emailRegex.test(email))
      return res.status(400).json({
        success: false,
        message:
          "invalid email, email value does not have '@' or '.' character(s).",
      });
    if (email != originalEmail) {
      const result = await db
        .promise()
        .query("SELECT 1 FROM User WHERE Email = ? AND Email != ? LIMIT 1;", [
          email,
          originalEmail,
        ]);
      if (result[0]) {
        return res.status(400).json({
          success: false,
          message: "Email already exist",
        });
      }
    }
    if (!Object.values(staffTypesEnumeration()).includes(staffType)) {
      return res.status(400).json({
        success: false,
        message:
          "invalid staff type that is not these values: " +
          Object.values(staffTypesEnumeration()),
      });
    }
    const query = `
   UPDATE User SET
      Email =?,
      FullName = ?,
      ContactNumber = ?,
      StaffType =?,
      Comments = ?
   WHERE UserID = ?
  `;
    const params = [
      email,
      fullName,
      contactNumber,
      staffType,
      comments,
      userID,
    ];
    await db.promise().query<RowDataPacket[]>(query, params);
    req.session.passport.user.Email = email;
    req.session.passport.user.FullName = fullName;
    req.session.save();
    res.json({
      success: true,
      message: "sucessfully edited user profile",
      redirectUrl: "/settings/profile",
    });
  }
);

module.exports = router;
