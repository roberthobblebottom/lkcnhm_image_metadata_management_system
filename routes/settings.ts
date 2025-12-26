const express = require("express");
const router = express.Router();
import { RowDataPacket } from "mysql2";
import { db } from "./db";
import { Session, User,Request } from "../@types/types";

import crypto from "crypto";
import { emailRegex, formatDisplayDate } from "../middleware/utils";
const { isAuthenticated } = require("../middleware/auth");

router.get(
  "/change-password",
  isAuthenticated,
  (
    req: {
      session: Session;
    },
    res: {
      redirect: (arg0: string) => any;
      render: (
        arg0: string,
        arg1: { currentUser: User; title: string }
      ) => void;
    }
  ) => {
    if (!req.session.passport.user) {
      return res.redirect("/login");
    }

    res.render("settings/change-password", {
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
      session: Session;
      body: {email:string,oldPassword:string,newPassword:string,confirmNewPassword:string};
    },
    res: {
      status: Function;
      json: (arg0: {
        success: boolean;
        message: string;
      }) => void | PromiseLike<void>;
    }  ) => {
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
router.get(
  "/profile",
  isAuthenticated,
  async (
    req:Request,
    res: {
      render: (
        arg0: string,
        arg1: { currentUser: RowDataPacket; registeredDate: string|null }
      ) => void;
    }
  ) => {
    const query = "SELECT * FROM User WHERE User.UserID = ?";
    const result = (
      await db
        .promise()
        .query<RowDataPacket[]>(query, [req.session.passport.user.UserID])
    )[0][0];
    res.render("settings/profile", {
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
      session: Session;
      body: {
        userID: number;
        email: string;
        fullName: string;
        contactNumber: string;
        organisation: string;
        comments: string;
        originalEmail: string;
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
        json: any;
      };
      json: (arg0: {
        success: boolean;
        message: string;
        redirectUrl: string;
      }) => void;
    }
  ) => {
    const { userID, email, fullName, contactNumber, organisation, comments,originalEmail } =
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
      redirectUrl: "/settings/profile",
    });
  }
);


module.exports = router;
