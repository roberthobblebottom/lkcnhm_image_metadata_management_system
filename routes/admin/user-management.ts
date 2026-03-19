const express = require("express")
const router = express.Router()
import crypto from "crypto"
const db = require('../db')
import {
  emailRegex,
  formatDisplayDate,
  staffTypesEnumeration,
  userTypesEnumeration,
} from "../../middleware/utils"
import { Response, Request } from "express"
import { param, validationResult } from "express-validator"
import path from "path"
const fs = require("fs")
const {
  isAuthenticated,
  isAdmin,
  reconfirmPasswordFunctionForAdmin,
} = require("../../middleware/auth") // Middleware
router.get(
  "/create",
  isAuthenticated,
  isAdmin,
  async (req: Request, res: Response) => {
    res.render("admin/create", {
      userTypes: Object.values(userTypesEnumeration()),
      currentUser: req.session.passport.user,
      staffTypes: Object.values(staffTypesEnumeration()),
    })
  }
)

router.post(
  "/create",
  isAuthenticated,
  isAdmin,
  reconfirmPasswordFunctionForAdmin,
  async (req: Request, res: Response) => {
    const adminID = req.session.passport.user.UserID
    const {
      email,
      password,
      confirmPassword,
      userType,
      fullName,
      contactNumber,
      staffType,
      comments,
    } = req.body
    const insertUserQuery = `
        INSERT INTO User
        (Email,
        SaltedPassword  ,
        PasswordSalt  ,
        UserType,
        FullName,
        ContactNumber,
        StaffType  ,
        Comments,
        UpdatedByID  ,
        CreatedByID  ,
        UpdatedDate 
        )
        VALUES(?,?,?,?,?,?,?,?,?,?,NOW() )`
    const checkEmailValidityQuery = "SELECT 1 FROM User WHERE Email = ? LIMIT 1"

    //Validation
    const missingFields = []
    if (!email) missingFields.push("email")
    if (!password) missingFields.push("password")
    if (!confirmPassword) missingFields.push("confirmPassword")
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
    if (password != confirmPassword && password.trim() != "")
      return res.status(400).json({
        success: false,
        message: "the new passwords does not match",
      })

    try {
      const filePath = __dirname.replace("routes/admin", "") + 'public/common-passwords.txt'
      const commonPasswords = fs.readFileSync(path.resolve(filePath)).toString().split('\n')
      if (commonPasswords.includes(password))
        return res.status(400).json({
          success: false, message: "a common password detected, please use another password"
        })
    } catch (error) {
      console.error(`Error reading file: ${error}`)
    }
    if (!Object.values(userTypesEnumeration()).includes(userType))
      return res.status(400).json({
        success: false,
        message:
          "invalid user type that is not these values: " +
          Object.values(userTypesEnumeration()),
      })
    if (!Object.values(staffTypesEnumeration()).includes(staffType) && staffType != "")
      return res.status(400).json({
        success: false,
        message:
          "invalid staff type that is not these values: " +
          Object.values(staffTypesEnumeration()),
      })
    const result = await db.query(checkEmailValidityQuery, [email])
    if (result[0] != 0)
      return res.status(400).json({
        success: false,
        message: "Email already exist",
      })

    const newPasswordSalt = crypto.randomBytes(16).toString("hex")
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
          })
        const params = [
          email,
          hashedPassword,
          newPasswordSalt,
          userType,
          fullName,
          contactNumber,
          staffType == "" ? null : staffType,
          comments,
          adminID,
          adminID,
        ]
        const result = await db.query(insertUserQuery, params)
          .catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
        const o: any = result
        const insertID = Object.values(o[0])[2].toString()

        return res.json({
          success: true,
          message: "User created successfully!",
          redirectUrl: `/admin/user-management/view/${insertID}`,
        })
      }
    )

  }
)
//✅ API to Fetch All Users
router.get(
  "/view-all",
  isAuthenticated,
  isAdmin,
  async (req: Request, res: Response) => {
    const query = `SELECT UserID, Email,UserType,FullName,StaffType,
    RegisteredDate, LastLoginDate, IsDeleted  FROM User`
    const results = await db.query(query)
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    res.render("admin/view-all", {
      users: results[0],
      title: "User Management",
    })
  })

//refactored from server.js, not tested and may not be needed
router.get(
  "/view/:userID",
  param('userID').isInt({ min: 1 }).withMessage('unknown id'),
  isAuthenticated,
  isAdmin,
  async (req: Request, res: Response) => {
    const userID = req.params.userID
    const query = `
        SELECT UserID,Email,UserType,FullName,
        RegisteredDate,ContactNumber,
        StaffType,Comments,
        IsDeleted
        FROM User
        WHERE UserID = ? `

    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() })

    const temp = await db.query(query, [userID])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const results = temp[0]
    if (results.length === 0)
      return res.status(404).send("User not found or has been deleted.")

    res.render("admin/view", {
      user: results[0],
      title: "Imaging User Details",
      registeredDate: formatDisplayDate(results[0].RegisteredDate),
    })
  })
//update user details
// Render edit user page (support both singular and plural URLs)
router.get(
  "/edit/:userID",
  param('userID').isInt({ min: 1 }).withMessage('unknown id'),
  isAuthenticated,
  isAdmin,
  async (req: Request, res: Response) => {
    const userID = req.params.userID
    const query =
      `SELECT UserID,Email,UserType,FullName,RegisteredDate,
      ContactNumber,StaffType,Comments,IsDeleted 
      FROM User 
      WHERE UserID = ?`
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() })

    const temp = await db.query(query, [userID])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const result = temp[0]
    if (result.length === 0)
      return res.render("admin/edit", {
        title: "User Not Found",
        message: {
          type: "error",
          text: "User not found or has been deleted",
        },
        user: null,
      })
    const message = req.session.message || { type: "", text: "" }

    res.render("admin/edit", {
      user: result[0],
      userTypes: Object.values(userTypesEnumeration()),
      staffTypes: Object.values(staffTypesEnumeration()),
      registeredDate: formatDisplayDate(result[0].RegisteredDate),
      title: `Edit User - ${result[0].Email}`,
      message: message,
    })
  }
)

router.post(
  "/edit/:userID",
  isAuthenticated,
  isAdmin,
  reconfirmPasswordFunctionForAdmin,
  async (req: Request, res: Response) => {
    const adminID = req.params.userID
    const {
      userID,
      email,
      password,
      confirmPassword,
      userType,
      fullName,
      contactNumber,
      staffType,
      comments,
      originalEmail,
    } = req.body
    const updateUserQuery = `
        UPDATE User 
        SET
        Email=?,
        UserType=?,
        FullName=?,
        ContactNumber=?,
        StaffType = ?,
        Comments=?,
        UpdatedDate = NOW(),
        UpdatedByID = ?`
    const checkEmailValidity = "SELECT 1 FROM User WHERE Email = ? AND Email != ? LIMIT 1"

    //Validation
    const missingFields = []
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
    if (password.trim() != "") {
      if (password != confirmPassword)
        return res.status(400).json({
          success: false,
          message: "the new passwords does not match",
        })
      try {
        const filePath: string = __dirname.replace("routes/admin", "") + 'public/common-passwords.txt'
        const commonPasswords: string[] = fs.readFileSync(path.resolve(filePath)).toString().split('\n')
        if (commonPasswords.includes(password))
          return res.status(400).json({
            success: false, message: "a common password detected, please use another password"
          })
      } catch (error) {
        console.error(`Error reading file: ${error}`)
      }
    }
    try {
      const filePath = __dirname.replace("routes", "") + 'public/common-passwords.txt'
      const commonPasswords = fs.readFileSync(path.resolve(filePath)).toString().split('\n')

      if (commonPasswords.includes(password))
        return res.status(400).json({
          success: false, message: "a common password detected, please use another password"
        })
    } catch (error) {
      console.error(`Error reading file: ${error}`)
    }

    if (!Object.values(userTypesEnumeration()).includes(userType))
      return res.status(400).json({
        success: false,
        message:
          "invalid user type that is not these values: " +
          Object.values(userTypesEnumeration()),
      })
    if (!Object.values(staffTypesEnumeration()).includes(staffType) && staffType != "")
      return res.status(400).json({
        success: false,
        message:
          "invalid staff type that is not these values: " +
          Object.values(staffTypesEnumeration()),
      })

    if (email != originalEmail) {
      const result = await db
        .query(checkEmailValidity, [
          email,
          originalEmail,
        ])
        .catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
      if (result[0].length != 0)
        return res.status(400).json({
          success: false,
          message: "Email already exist",
        })
    }

    const newPasswordSalt = crypto.randomBytes(16).toString("hex")
    crypto.pbkdf2(
      password,
      newPasswordSalt,
      310000, 32, "sha256",
      async function (err, hashedPassword) {
        if (err)
          return res.json({
            success: false,
            message: `❌ Password change salting Failed: ${err} `,
          })
        const q2 =
          password.trim() != ""
            ? updateUserQuery + ",SaltedPassword = ?, PasswordSalt = ? WHERE UserID = ?"
            : updateUserQuery + "WHERE UserID = ?"
        const params =
          password.trim() != ""
            ? [
              email,
              userType,
              fullName,
              contactNumber,
              staffType == "" ? null : staffType,
              comments,
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
              staffType == "" ? null : staffType,
              comments,
              adminID,
              userID,
            ]

        await db.query(q2, params)
          .catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
        return res.json({
          success: true,
          message: "User updated successfully!",
        })
      }
    )

  }
)

// ✅ Delete User (Soft Delete - Update IsDeleted to 1)
router.post(
  "/delete/:userID",
  param('userID').isInt({ min: 1 }).withMessage('unknown id'),
  isAuthenticated,
  isAdmin,
  reconfirmPasswordFunctionForAdmin,
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    const userID = req.params.userID
    const query = "UPDATE User SET IsDeleted = 1 WHERE UserID = ?"
    await db.query(query, [userID])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    res.redirect("/admin/user-management/view-all")
  }
)

router.post(
  "/restore/:userID",
  param('userID').isInt({ min: 1 }).withMessage('unknown id'),
  isAuthenticated,
  isAdmin,
  reconfirmPasswordFunctionForAdmin,
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() })

    const userID = req.params.userID
    await db.query(
      "UPDATE User SET IsDeleted = 0 WHERE UserID = ?",
      [userID])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    res.redirect("/admin/user-management/view-all") // Redirect to admin page after recovery

  }
)

module.exports = router
