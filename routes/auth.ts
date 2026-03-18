const express = require('express');
const router = express.Router();
const db = require('./db');
// import { db } from "./db";
import passport from "passport";
import * as passportStrategy from "passport-local";
import crypto from "crypto";
import {
  emailRegex,
  passwordRegex,
  staffTypesEnumeration,
  userTypesEnumeration,
} from "../middleware/utils";
import { Response, Request, NextFunction } from "express";
import { User } from "../@types/types";
const fs = require("fs");
import path from 'path';

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
      `SELECT PasswordSalt, SaltedPassword, UserID,
      UserType,FullName,Email,PasswordTries,PasswordTimeoutTill 
      FROM User WHERE Email = ? AND IsDeleted = 0`;
    const [result]: any = await db
      .query(query, [username])
      .catch((error: any) => {
        console.error("❌ Database Error:", error);
        return cb(null, false, { message: "Database error" });
      });

    if (result.length === 0 || result[0].Email == null || result[0].Email == ""
      || result[0].SaltedPassword == null || result[0].SaltedPassword == ""
    )
      return cb(null, false, { message: "Invalid email or password" });

    const user = result[0];

    //checks if user is still on timeout
    if (new Date(user.PasswordTimeoutTill) >= new Date())
      return cb(null, false, {
        message:
          "Login timeout till " + user.PasswordTimeoutTill + ".\n Please try again later."
      });

    const saltedPassword = crypto.pbkdf2Sync(
      password,
      user.PasswordSalt,
      310000,
      32,
      "sha256",
    );

    //Password timeout logic
    if (!crypto.timingSafeEqual(user.SaltedPassword, saltedPassword)) {
      const newPasswordTries = parseInt(user.PasswordTries) + 1
      const timeoutIntervalMinutes: number = 5

      //timeout for every 3 tries, and the amount of timeout accumilates
      if (newPasswordTries % 3 == 0) {
        const newTimeoutIntervalMinutes =timeoutIntervalMinutes * Math.floor(newPasswordTries / 3)
        await db.query(`UPDATE User 
                SET PasswordTries = ?, 
                PasswordTimeoutTill = (NOW() + INTERVAL ? MINUTE) 
                WHERE UserID = ?`,
          [newPasswordTries,newTimeoutIntervalMinutes,user.UserID])
        return cb(null, false, {
          message: "3 invalid passwords entered. Login timeout, please wait for "
            + newTimeoutIntervalMinutes.toString() + " minutes and try again.",
        });
      }
      await db.query('UPDATE User SET PasswordTries = ? WHERE UserID = ?',
        [newPasswordTries, user.UserID])
      return cb(null, false, { message: "Incorrect username or password.", });
    }

    //sucessful login
    return cb(null, user, { message: null });
  })
);

// serialise user to be added into session data.
passport.serializeUser(
  (user: any, done: (arg0: any, user: User | null) => any) => {
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

router.get("/register", async (req: Request, res, Response) => {
  const isEnabled = (await db.query('SELECT IsEnabled FROM IsUserRegistrationEnabled'))[0][0].IsEnabled
  if (!isEnabled)
    return res.status(400).json({
      sucess: false,
      message: "User Registration is not enabled"
    })

  return res.render('register', {
    staffTypes: Object.values(staffTypesEnumeration()),
    userTypes: [
      userTypesEnumeration().projectOwner,
      userTypesEnumeration().photographerOnly
    ]
  })
})

router.post("/register", async (req: Request, res: Response) => {
  const isUserRegistrationEnabledQuery = 'SELECT IsEnabled FROM IsUserRegistrationEnabled'
  const isUserRegistrationEnabled = (await db.query(isUserRegistrationEnabledQuery))[0][0].IsEnabled
  if (!isUserRegistrationEnabled)
    res.status(400).json({ success: false, message: "User Registration is disabled." })

  const {
    email,
    password,
    confirmPassword,
    userType,
    fullName,
    contactNumber,
    staffType,
    comments,
  } = req.body;
  const missingFields = [];
  if (!email) missingFields.push("email");
  if (!password) missingFields.push("password");
  if (!confirmPassword) missingFields.push("confirmPassword");
  if (!userType) missingFields.push("userType");
  if (!fullName) missingFields.push("fullName");

  if (missingFields.length > 0)
    return res.status(400).json({
      success: false,
      message: "Missing required fields: " + missingFields.join(", "),
    });
  if (!emailRegex.test(email))
    return res.status(400).json({
      success: false,
      message:
        "invalid email, email value does not have '@' or '.' character(s).",
    });
  if (password != confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "the passwords does not match",
    });
  }
  if (!passwordRegex.test(password))
    return res.status(400).json(
      {
        success: false,
        message: "the password doesn't match the requirements of 7 characters or more characters and at least a digit and a lower case letter"
      })
  try {
    const filePath = __dirname.replace("routes", "") + 'public/common-passwords.txt'
    const commonPasswords = fs.readFileSync(path.resolve(filePath)).toString().split('\n')
    if (commonPasswords.includes(password))
      return res.status(400).json({
        sucess: false, message: "a common password detected, please use another password"
      })
  } catch (error) {
    console.error(`Error reading file: ${error}`);
  }

  if (!Object.values(userTypesEnumeration()).includes(userType))
    return res.status(400).json({
      success: false,
      message:
        "invalid user type that is not these values: " + Object.values(userTypesEnumeration()),
    });
  if (!Object.values(staffTypesEnumeration()).includes(staffType))
    return res.status(400).json({
      success: false,
      message:
        "invalid staff type that is not these values: " + Object.values(staffTypesEnumeration()),
    });


  // does email exist:
  const checkEmailQuery = "SELECT Email FROM User WHERE Email = ? LIMIT 1";
  const isThereExistingEmail = (await db.query(checkEmailQuery, [email]))[0][0]
  if (isThereExistingEmail)
    return res.status(400).json({ message: "Email already exist" })

  const newPasswordSalt = crypto.randomBytes(16).toString("hex");
  const saltedPassword = crypto.pbkdf2Sync(
    password,
    newPasswordSalt,
    310000,
    32,
    "sha256")
  const insertUserQuery = `
            INSERT INTO User 
            (Email, SaltedPassword,PasswordSalt,  UserType, RegisteredDate,
              UpdatedDate,FullName,ContactNumber,StaffType,Comments)
            VALUES (?, ?,?,  ?, NOW(),NOW(),  ?, ?,?,?)`;
  const params = [
    email,
    saltedPassword,
    newPasswordSalt,
    userType,
    fullName,
    contactNumber,
    staffType,
    comments
  ];

  await db.query(insertUserQuery, params)

  return res.status(200).json({
    success: true,
    message: "User successfully registration",
    redirect: "/login",
  });

});

// Login User
router.post("/login", (req: Request, res: Response, next: NextFunction) => {
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
      if (info.message !== null)
        return res.status(400).json({ sucess: false, message: info.message })
      if (err)
        return next(err);
      if (!user) return res.status(401).send(info);

      req.login(user, async (err: any) => {
        // I am not suppose to use this as password authenticate already does it, 
        // but somehow this guy's code from stackoverflow works
        if (err) return res.status(500).json({ error: "Login failed." });
        const updateQuery =
          `UPDATE User 
          SET 
            LastLoginDate = NOW(),
            PasswordTries = 0,
            PasswordTimeoutTill = NULL 
          WHERE UserID = ? `;
        await db.query(updateQuery, [user.UserID])

        // these codes feels redundant now, may needed to be removed
        const x1: any[] = await db
          .query("SHOW COLUMNS FROM Media LIKE 'ImageEditingTool' ");
        req.session.imageEditingTools = x1[0][0]["Type"]
          .replace("enum(", "")
          .replace(")", "")
          .replaceAll("'", "")
          .split(",");

        const x2: any[] = await db
          .query("SHOW COLUMNS FROM Media LIKE 'ImagingPlatform' ");
        const ip = x2[0][0]["Type"]
        const ip2 = ip.substring(5, ip.length - 1)
          .replaceAll("'", "")
          .split(",");
        req.session.imagingPlatforms = ip2;
        const x3: any[] = await db
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
          if (err)
            return res.status(500).json({ error: "Session save error" });

          return res.json({
            success: true,
            redirect:
              user.UserType === userTypesEnumeration().admin
                ? "/admin/login-landing-page"
                : "/user/login-landing-page",
          });
        });
      });
    }
  )(req, res, next);
});

// Logout User
router.get("/logout", (req: Request, res: Response) => {
  try {
    if (!req.session.passport.user || !req.session.passport.user.UserID) {
      console.warn("⚠️ Logout Attempt Without user session");
      return res.redirect("/");
    }
    req.session.destroy((err: any) => {
      if (err) {
        console.error("❌ Logout Error:", err);
        return res.redirect("/");
      }
      return res.redirect("/");
    });
  } catch (error) {
    console.error("❌ Logout Try-Catch Error:", error);
    return res.redirect("/");
  }
});

router.get("/current-user", (req: Request, res: Response) => {
  if (req.session && req.session.passport.user)
    res.json({
      Email: req.session.passport.user.Email,
      FullName: req.session.passport.user.FullName,
      UserType: req.session.passport.user.UserType,
      UserID: req.session.passport.user.UserID,
    });
  else
    res.status(401).json({ error: "Not logged in" });

});

module.exports = router;
