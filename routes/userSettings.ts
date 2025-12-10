const express = require("express");
const router = express.Router();
import { RowDataPacket } from "mysql2";
import { db } from "./db";
import { Passport, User } from "../@types/types";
import passport from "passport";

import crypto from "crypto";
import { Router } from "express";
import { formatDisplayDate } from "../middleware/utils";
const { isAuthenticated, isAdmin } = require("../middleware/auth");

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
    res: {
      status: any;
      json: (arg0: {
        success: boolean;
        message: string;
      }) => void | PromiseLike<void>;
    },
    next: any
  ) => {
    // This may not be the best way to change passwords.
    const username = req.body.email;
    const old_password = req.body.old_password;
    const new_password = req.body.new_password;
    const confirm_new_password = req.body.confirm_new_password;

    if (new_password != confirm_new_password) {
      return res.status(400).json({
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
  }
);
router.get(
  "/profile",
  isAuthenticated,
  async (
    req: {
      session: { passport: Passport };
    },
    res: {
      render: (
        arg0: string,
        arg1: { currentUser: RowDataPacket; registeredDate: string }
      ) => void;
    }
  ) => {
    const query = "SELECT * FROM User WHERE User.UserID = ?";
    const result = (
      await db
        .promise()
        .query<RowDataPacket[]>(query, [req.session.passport.user.UserID])
    )[0][0];
    res.render("profile", {
      currentUser: result,
      registeredDate: formatDisplayDate(result.RegisteredDate),
    });
  }
);

router.post(
  "/profile",
  isAuthenticated,
  async (
    req: {
      session: any;
      body: {
        userID: any;
        email: any;
        fullName: any;
        contactNumber: any;
        organisation: any;
        comments: any;
      };
    },
    res: {
      
      status: {
        (arg0: number): {
          (): any;
          new (): any;
          json: {
            (arg0: { success: boolean; message: string }): any;
            new (): any;
          };
        };
        (arg0: number): {
          (): any;
          new (): any;
          json: {
            (arg0: { success: boolean; message: string }): any;
            new (): any;
          };
        };
        json: any;
      };
      json: (arg0: {
        success: boolean;
        message: string;
        redirectUrl: string;
      }) => void;
    }
  ) => {
    console.log("req.body", req.body);
    const { userID, email, fullName, contactNumber, organisation, comments } =
      req.body;

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
    const query = `
   UPDATE User SET
      Email =?,
      FullName = ?,
      ContactNumber = ?,
      Organisation =?,
      Comments = ?
   WHERE UserID = ?
  `;
    const params = [
      email,
      fullName,
      contactNumber,
      organisation,
      comments,
      userID,
    ];
    await db.promise().query<RowDataPacket[]>(query, params);
    req.session.passport.user.Email = email
    req.session.passport.user.FullName = fullName

    console.log(req.session.passport.user)
    req.session.save()
    res.json({
      success: true,
      message: "sucessfully edited user profile",
      redirectUrl: "/user-settings/profile",
    });
  }
);
module.exports = router;
