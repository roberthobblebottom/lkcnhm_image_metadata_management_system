const express = require("express")
const router = express.Router()
const db = require('./db')
import { Request, Response } from "express"
import crypto from "crypto"
import {
  emailRegex,
  formatDisplayDate,
  staffTypesEnumeration,
} from "../middleware/utils"
const { isAuthenticated } = require("../middleware/auth")
import path from "path"
const fs = require("fs")
router.get(
  "/change-password",
  isAuthenticated,
  (req: Request, res: Response) => {
    res.render("settings/change-password", {
      currentUser: req.session.passport.user,
      title: "Change Password",
    })
  }
)

router.post(
  "/change-password",
  isAuthenticated,
  async (req: Request, res: Response) => {
    // This may not be the best way to change passwords.
    const username = req.body.email
    const oldPassword = req.body.oldPassword
    const newPassword = req.body.newPassword
    const confirmNewPassword = req.body.confirmNewPassword

    const getCurrentPasswordStuffQuery =
      "SELECT SaltedPassword,PasswordSalt FROM User WHERE Email = ?"
    const updatePasswordQuery =
      "UPDATE User SET SaltedPassword = ?, PasswordSalt = ? WHERE Email = ?"
    if (newPassword != confirmNewPassword)
      return res.status(400).json({
        success: false,
        message: "the new passwords does not match",
      })
    try {
      const filePath = __dirname.replace("routes", "") + 'public/common-passwords.txt'
      const commonPasswords = fs.readFileSync(path.resolve(filePath)).toString().split('\n')
      if (commonPasswords.includes(newPassword))
        return res.status(400).json({
          success: false, message: "a common password detected, please use another password"
        })
    } catch (error) {
      console.error(`Error reading file: ${error}`)
      return res.status(500).json({
        success: false,
        error: error,
      })
    }

    const temp1 = (
      await db.query(getCurrentPasswordStuffQuery, [username])
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
    )
    const results = temp1[0][0]
    const currentSaltedPassword = results.SaltedPassword
    const currentPasswordSalt = results.PasswordSalt
    const newPasswordSalt = crypto.randomBytes(16).toString("hex")
    // first hash to see if old password matches and
    // then second hash is used for updating the db with the new salted password.
    const saltedOldPassword = crypto.pbkdf2Sync(
      oldPassword,
      currentPasswordSalt,
      310000,
      32,
      "sha256")
    if (!crypto.timingSafeEqual(saltedOldPassword, currentSaltedPassword))
      return res.json({
        success: false,
        message: "old password is incorrect",
      })

    const saltedPassword = crypto.pbkdf2Sync(
      newPassword,
      newPasswordSalt,
      310000,
      32,
      "sha256")

    await db.query(updatePasswordQuery, [
      saltedPassword,
      newPasswordSalt,
      username,
    ]).catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })

    return res.json({
      success: true,
      message: "successfully changed password",
    })
  }
)

router.get("/profile", isAuthenticated, async (req: Request, res: Response) => {
  const query = "SELECT * FROM User WHERE User.UserID = ?"
  const temp1 = await db
    .query(query, [req.session.passport.user.UserID])
    .catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })

  const result = temp1[0][0]
  res.render("settings/profile", {
    currentUser: result,
    registeredDate: formatDisplayDate(result.RegisteredDate),
    staffTypes: Object.values(staffTypesEnumeration()),
  })
})

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
    } = req.body
    const missingFields = []
    const updateProfileQuery = `
      UPDATE User SET
          Email =?,
          FullName = ?,
          ContactNumber = ?,
          StaffType =?,
          Comments = ?
      WHERE UserID = ?`
    const checkEmailValidityQuery =
      `SELECT 1 
      FROM User 
      WHERE Email = ? AND Email != ? LIMIT 1`

    //validation
    if (!userID) missingFields.push("userID")
    if (!email) missingFields.push("email")
    if (!fullName) missingFields.push("fullName")
    if (missingFields.length > 0)
      return res.status(400).json({
        success: false,
        message: "Missing required fields: " + missingFields.join(", "),
      })

    if (!emailRegex.test(email))
      return res.status(400).json({
        success: false,
        message:
          "invalid email, email value does not have '@' or '.' character(s).",
      })

    if (email != originalEmail) {
      const result = await db
        .query(checkEmailValidityQuery, [email, originalEmail])
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })

      if (result[0] != 0)
        return res.status(400).json({
          success: false,
          message: "Email already exist",
        })
    }
    if (!Object.values(staffTypesEnumeration()).includes(staffType))
      return res.status(400).json({
        success: false,
        message:
          "invalid staff type that is not these values: " +
          Object.values(staffTypesEnumeration()),
      })

    const params = [
      email,
      fullName,
      contactNumber,
      staffType,
      comments,
      userID,
    ]
    await db.query(updateProfileQuery, params)
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    req.session.passport.user.Email = email
    req.session.passport.user.FullName = fullName
    req.session.save()
    res.json({
      success: true,
      message: "successfully edited user profile",
      redirectUrl: "/settings/profile",
    })
  }
)

module.exports = router
