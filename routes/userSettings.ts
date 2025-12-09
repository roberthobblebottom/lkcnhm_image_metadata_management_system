const express = require("express");
const router = express.Router();
import { RowDataPacket } from "mysql2";
import { db } from "./db";
import { Passport, User } from "../@types/types";
import passport from "passport";

import crypto from "crypto";
import { Router } from "express";
const { isAuthenticated, isAdmin } = require("../middleware/auth");

//change [password] route
// app.get("/user/dashboard",isAuthenticated,(req, res) => {
//     res.sendFile(path.resolve(__dirname, "views", "user/dashboard.html"));
// });
router.get(
  "/change-password",
  isAuthenticated,
  (
    req: {
      session: { passport: Passport };
    },
    res: {
      redirect: (arg0: string) => any;
      render: (
        arg0: string,
        arg1: { user: any; currentUser: any; title: string }
      ) => void;
    }
  ) => {
    if (!req.session.passport.user) {
      return res.redirect("/login");
    }

    res.render("change-password", {
      user: req.session.passport.user.Email,
      currentUser: req.session.passport.user,
      title: "Change Password",
    }); // ✅ pass `user` to EJS
  }
);

router.post(
  "/change-password",
  isAuthenticated,
  async (
    req: {
      session: { passport: Passport };
      body: any;
      url: any;
    },
    res,
    next
  ) => {
    // This may not be the best way to change passwords.
    const username = req.body.email;
    const old_password = req.body.old_password;
    const new_password = req.body.new_password;
    const confirm_new_password = req.body.confirm_new_password;

    if (new_password != confirm_new_password) {
      return res.json({
        success: false,
        message: "the new passwords does not match",
      });
    }

    console.log("📩 Change Password Request for:", username);
    console.log("🧾 Request Body:", req.body);
    const query =
      "SELECT HashedPassword,PasswordSalt FROM User WHERE Email = ?";
    const results = (
      await db.promise().query<RowDataPacket[]>(query, [username])
    )[0][0];
    const currentHashedPassword = results.HashedPassword;
    const currentPasswordSalt = results.PasswordSalt;
    try {
      const newPasswordSalt = crypto.randomBytes(16).toString("hex");
      crypto.pbkdf2(
        old_password,
        currentPasswordSalt,
        310000,
        32,
        "sha256",
        async function (err, hashedPassword) {
          if (!crypto.timingSafeEqual(hashedPassword, currentHashedPassword)) {
            console.log("old passwords matched");
            return res.json({
              success: false,
              message: "old password is incorrect",
            });
          }

          crypto.pbkdf2(
            new_password,
            newPasswordSalt,
            310000,
            32,
            "sha256",
            async function (err, hashedPassword) {
              console.log("inside password hashed functions");
              const updatePasswordQuery =
                "UPDATE User SET HashedPassword = ?, PasswordSalt = ? WHERE Email = ?";
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

    // const checkQuery = 'SELECT Password FROM User WHERE Email = ?';

    // db.query<RowDataPacket[]>(checkQuery, [username], (err: any, results: string | any[]) => {
    //     if (err) {
    //         console.error("❌ MySQL SELECT error:", err);
    //         return res.json({ success: false, message: "❌ Database error" });
    //     }

    //     if (results.length === 0) {
    //         return res.json({ success: false, message: "❌ Email not found" });
    //     }

    //     const currentPassword = results[0].Password;
    //     if (old_password !== currentPassword) {
    //         return res.json({ success: false, message: "❌ Old password is incorrect" });
    //     }

    //     if (old_password === new_password) {
    //         return res.json({ success: false, message: "❌ New password must be different from old password" });
    //     }

    //     const updateQuery = 'UPDATE User SET Password = ?, UpdatedDate = NOW() WHERE Email = ?';

    //     db.query<RowDataPacket[]>(updateQuery, [new_password, username], (err: any, results: any) => {
    //         if (err) {
    //             console.error("❌ MySQL UPDATE error:", err);
    //             return res.json({ success: false, message: "❌ Failed to update password" });
    //         }

    //         if (results.affectedRows === 0) {
    //             return res.json({ success: false, message: "❌ No rows were updated" });
    //         }

    //         console.log("✅ Password updated for:", username);
    //         return res.json({ success: true, message: "✅ Password changed successfully!" });

    //     });
    // });
  }
);
router.post(
  "/authenticate-for-password-change",
  isAuthenticated,
  (req, res, next) => {
    console.log("/authenticate-for-password-change");
    passport.authenticate(
      "local",
      {
        successFlash: true,
        failureFlash: true,
      },
      (err: any, user: User, info: any) => {
        if (err) return next(err);
        if (!user) return res.status(401).send(info);
        console.log("user", user);
      }
    )(req, res, next);
  }
);

module.exports = router;
