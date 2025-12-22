import express from "express";
const router = express.Router();
import { db } from "./db";
import passport from "passport";
import * as passportStrategy from "passport-local";
import crypto from "crypto";
import {
  requestStatusEnumeration,
  userTypesEnumeration,
} from "../middleware/utils";
import { Response, NextFunction } from "express";

import {Request, Passport, User } from "../@types/types";
passport.use(
  new passportStrategy.Strategy(async function verify(
    username: string,
    password: crypto.BinaryLike,
    cb: (
      arg0: Error | null,
      arg1: boolean | undefined,
      arg2: { message: string } | undefined
    ) => void
  ) {
    //Do not change the variable name from username to email, it doesn't work.
    const query =
      "SELECT PasswordSalt, SaltedPassword, UserID,UserType,FullName,Email FROM User WHERE Email = ? AND IsDeleted = 0";
    const [result]: any = await db
      .promise()
      .query(query, [username])
      .catch((error: any) => {
        console.error("❌ Database Error:", error);
        return cb(null, false, { message: "Database error" });
      });


    if (result.length === 0) {
      console.log("🚫 User Not Found");
      return cb(null, false, { message: "Invalid email or password" });
    }

    const user = result[0];
    console.log("🆔 Found User:", user.Email);

    crypto.pbkdf2(
      password,
      user.PasswordSalt,
      310000,
      32,
      "sha256",
      function (err, hashedPassword) {
        if (err) return cb(err, undefined, undefined);
        if (!crypto.timingSafeEqual(user.SaltedPassword, hashedPassword)) {
          console.log("❌ Invalid Password");
          return cb(null, false, {
            message: "Incorrect username or password.",
          });
        }
        console.log("successful local strategy execution");
        return cb(null, user, undefined);
      }
    );
  })
);

// serialise user to be added into session data.
passport.serializeUser(
  (user: any, done: (arg0: any, user: User| null) => any) => {
    process.nextTick(function () {
      return done(null, {
        UserID: user.UserID,
        FullName: user.FullName,
        Email: user.Email,
        UserType: user.UserType,
      });
    });
  }
);

// retrieving session data
passport.deserializeUser((user: User, cb: (arg0: null, arg1: any) => any) => {
  process.nextTick(function () {
    return cb(null, user);
  });
});

router.post(
  "/register",
  (
    req:any,res:any 
  ) => {
    console.log("register req.body", req.body);
    const {
      email,
      password,
      confirmPassword,
      userType,
      fullName,
      contactNumber,
      organisation,
      comments,
      reasonForRequest,
    } = req.body;
    const missingFields = [];
    if (!email) missingFields.push("email");
    if (!password) missingFields.push("password");
    if (!confirmPassword) missingFields.push("confirmPassword");
    if (!userType) missingFields.push("userType");
    if (!fullName) missingFields.push("fullName");
    if (!reasonForRequest) missingFields.push("reasonForRequest");
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
    if (password != confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "the  passwords does not match",
      });
    }
    console.log(`🔹 Register Attempt: ${email}`);

    const checkEmailQuery = "SELECT * FROM User WHERE Email = ?";
    db.query(checkEmailQuery, [email], (err: any, result: any, field: any) => {
      if (err) {
        console.error("❌ Database Error:", err);
        return res.status(500).send("Database Error");
      }

      if (result.length > 0) {
        console.warn("⚠️ Email already exists:", email);
        return res
          .status(400)
          .send("Email already exists. Please enter a new email.");
      }
      const newPasswordSalt = crypto.randomBytes(16).toString("hex");
      crypto.pbkdf2(
        password,
        newPasswordSalt,
        310000,
        32,
        "sha256",
        async function (err, hashedPassword) {
          const insertUserQuery = `
            INSERT INTO User 
            (Email, SaltedPassword,PasswordSalt,  UserType, RegisteredDate,
              UpdatedDate,FullName,ContactNumber,Organisation,Comments,ReasonForRequest,RequestStatus)
            VALUES (?, ?,?,  ?, NOW(),NOW(),  ?, ?,?,?,?,?)`;
          const params = [
            email,
            hashedPassword,
            newPasswordSalt,
            userType,
            fullName,
            contactNumber,
            organisation,
            comments,
            reasonForRequest,
            requestStatusEnumeration().approved, //TODO TEMPORARY APPROVED FOR ALL USERS FOR TESTING
          ];

          db.query(insertUserQuery, params, (err: any) => {
            if (err) {
              console.error("❌ Error Registering User:", err);
              return res.status(500).send("Error Registering User");
            }
            console.log(`✅ User Registered Successfully: ${email}`);
            // 🚀 Redirect from the backend itself
            res.redirect("/login");
          });
        }
      );
    });
  }
);

// Login User
router.post("/login", (req: any, res: Response, next: NextFunction) => {
  passport.authenticate(
    "local",
    {
      successRedirect: "/", // I don't think this is doing anything.
      successFlash: true,
      failureRedirect: "/login",
      failureFlash: true,
      failureMessage: "CUSTOM", // not working
    },
    (err: any, user: User, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).send(info);
      req.login(user, (err: any) => {
        // I am not suppose to use this as password authenticate already does it, but somehow this guy's code from stackoverflow works
        if (err) return res.status(500).json({ error: "Login failed." });

        // 🔄 Update LastLoginDate
        const updateQuery =
          "UPDATE User SET LastLoginDate = NOW() WHERE UserID = ? ";
        db.query(updateQuery, [user.UserID], async (updateErr: any) => {
          if (updateErr) {
            console.error("❌ Failed to update LastLoginDate:", updateErr);
            // Not blocking login if date update fails
          } else {
            console.log("🕓 LastLoginDate updated");
          }

          const x1: any[] = await db
            .promise()
            .query("SHOW COLUMNS FROM Media LIKE 'ImageEditingTool' ");
          req.session.imageEditingTools = x1[0][0]["Type"]
            .replace("enum(", "")
            .replace(")", "")
            .replaceAll("'", "")
            .split(",");

          const x2: any[] = await db
            .promise()
            .query("SHOW COLUMNS FROM Media LIKE 'ImagingPlatform' ");
          const ip = x2[0][0]["Type"]
            .replaceAll("enum(", "")
            .replaceAll("'", "")
            .split(",");
          ip.splice(ip.length - 1, 1, ip.at(-1).replace(")", ""));
          req.session.imagingPlatforms = ip;
          const x3: any[] = await db
            .promise()
            .query("SHOW COLUMNS FROM Project LIKE 'ProjectType' ");
          const projectTypes = x3[0][0]["Type"]
            .replaceAll("enum(", "")
            .replaceAll("'", "")
            .split(",");
          projectTypes.splice(
            projectTypes.length - 1,
            1,
            projectTypes.at(-1).replace(")", "")
          );
          req.session.projectTypes = projectTypes;

          req.session.save((err: any) => {
            if (err) {
              console.error("❌ Session Save Error:", err);
              return res.status(500).json({ error: "Session error" });
            }
            return res.json({
              success: true,
              redirect:
                user.UserType === userTypesEnumeration().admin
                  ? "/admin/dashboard"
                  : "/user/dashboard",
            });
          });
        });
      });
    }
  )(req, res, next);
});

// Logout User
router.get(
  "/logout",
  (
    req: any,
    res: { redirect: (arg0: string) => any }
  ) => {
    try {
      if (!req.session.passport.user || !req.session.passport.user.UserID) {
        console.warn("⚠️ Logout Attempt Without Login");
        return res.redirect("/");
      }
      console.log(`🔹 Logout Attempt: ${req.session.passport.user.Email}`);

      req.session.destroy((err: any) => {
        if (err) {
          console.error("❌ Logout Error:", err);

          return res.redirect("/");
          // return res.status(500).json({ error: "Logout failed" });
        }
        console.log("✅ User Logged Out");
        return res.redirect("/");
      });
    } catch (error) {
      console.error("❌ Logout Try-Catch Error:", error);
      return res.redirect("/");
      // res.status(500).json({ error: "Something went wrong during logout" });
    }
  }
);

// // Get Logged-in User
// router.get("/user", (req, res) => {
//   if (!req.session.passport.user) {
//     console.warn("⚠️ Unauthorized User Info Request");
//     return res.status(401).json({ error: "Not logged in" });
//   }

//   console.log(`🔹 User Info Requested: ${req.session.passport.user.Email}`);
//   res.json({ user: req.session.passport.user });
// });

module.exports = router;
