const { userTypesEnumeration } = require("./utils");
import { Request, Response, NextFunction } from "express";
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
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

const isAdmin = (req: Request, res: Response, next: NextFunction) => {
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
module.exports = { isAuthenticated, isAdmin, isAdminOrProjectOwner };
