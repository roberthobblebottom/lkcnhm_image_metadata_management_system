const { userTypesEnumeration } = require("./utils");
import { Request, Response, NextFunction } from "express";

import { db } from "../routes/db";
import crypto from "crypto";
export const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.session.passport == null) {
    console.log("passport is null, redirecting to home page");
    return res.redirect("/login"); // 🔁 Redirect to login
  }
  const user = req.session.passport.user;

  console.log("Checking Auth:", user.Email);
  if (user) {
    console.log("✅ User is authenticated.");
    return next(); // ✅ User is logged in
  } else {
    return res.redirect("/login"); // 🔁 Redirect to login
  }
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.passport == null) {
    console.log("passport is null, redirecting to home page");
    return res.redirect("/login"); // 🔁 Redirect to login
  }
  const user = req.session.passport.user;
  if (!user || user.UserType !== userTypesEnumeration().admin) {
    console.log("🚫 Forbidden: User is not an admin");
    return res.redirect("/login"); // 🔁 Send to login page if not admin
  }
  next();
};

const isAdminOrProjectOwner = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.session.passport == null) {
    console.log("passport is null, redirecting to home page");
    return res.redirect("/login"); // 🔁 Redirect to login
  }
  const user = req.session.passport.user;
  if (!user || user.UserType === userTypesEnumeration().photographerOnly) {
    console.log("🚫 Forbidden: User is not an admin or project owner");
    return res.redirect("/login"); // 🔁 Send to login page if not admin
  }
  next();
};

const reconfirmPasswordFunction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const reconfirmPassword: string = req.body.reconfirmPassword;
  const username: string = req.session.passport.user.Email;
  if (!reconfirmPassword) {
    return res
      .status(400)
      .json({ success: false, message: "Password to reconfirm is empty" });
  }
  console.log("reconfirm password function")
  console.log('email', username)
  const query =
    "SELECT PasswordSalt, SaltedPassword FROM User WHERE Email = ? AND IsDeleted = 0 AND UserType = 'admin'";
  const [result]: any = await db
    .promise()
    .query(query, [username])
    .catch((error: any) => {
      console.error("❌ Database Error:", error);
      return res
        .status(400)
        .json({ success: false, message: "Database error " + error });
    });

  console.log('result', result)
  if (result.length === 0) {
    console.log("🚫 User Not Found");
    return res
      .status(400)
      .json({
        success: false,
        message: "Invalid User, potentially missing user.",
      });
  }

  const user = result[0];
  const saltedPasswordFromDB = crypto.pbkdf2Sync(
    reconfirmPassword,
    user.PasswordSalt,
    310000,
    32,
    "sha256"
    
  );
  if (!crypto.timingSafeEqual(user.SaltedPassword, saltedPasswordFromDB)) {
    console.log("❌ Invalid Password");

    return res
      .status(400)
      .json({ success: false, message: "Invalid password" });
  } else {
    console.log('Sucessful reconfirmation of password.')
  }
  next();
};
module.exports = { isAuthenticated, isAdmin, isAdminOrProjectOwner,reconfirmPasswordFunction };
