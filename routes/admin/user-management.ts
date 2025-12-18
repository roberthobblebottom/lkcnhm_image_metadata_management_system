const express = require("express");
const router = express.Router();
import crypto from "crypto";
import { QueryResult, RowDataPacket } from "mysql2";
import { db } from "../db";
import {
  formatDisplayDate,
  requestStatusEnumeration,
  userTypesEnumeration,
} from "../../middleware/utils";
import { Request, Session, User } from "../../@types/types";
const { isAuthenticated, isAdmin } = require("../../middleware/auth"); // Middleware
router.get(
  "/create",
  isAuthenticated,
  isAdmin,
  async (
    req: Request,
    res: {
      render: (
        view: string,
        arg1: {
          userTypes: string[];
          requestStatuses: string[];
          currentUser: User;
        }
      ) => void;
    }
  ) => {
    res.render("admin/create", {
      userTypes: Object.values(userTypesEnumeration()),
      requestStatuses: Object.values(requestStatusEnumeration()),
      currentUser: req.session.passport.user,
    });
  }
);

router.post(
  "/create",
  isAuthenticated,
  isAdmin,
  async (
    req: {
      session: Session;
      body: {
        userID: number;
        email: string;
        password: string;
        confirmPassword: string;
        userType: string;
        fullName: string;
        contactNumber: string;
        organisation: string;
        comments: string;
        requestStatus: string;
        reasonForRequest: string;
      };
    },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: {
          (arg0: { success: boolean; message: string }): any;
          new (): any;
        };
      };
      json: (arg0: {
        success: boolean;
        message: string;
      }) => void | PromiseLike<void>;
    }
  ) => {
    const adminID = req.session.passport.user.UserID;
    const {
      userID,
      email,
      password,
      confirmPassword,
      userType,
      fullName,
      contactNumber,
      organisation,
      comments,
      requestStatus,
      reasonForRequest,
    } = req.body;
    console.log(req.body);
    //Validation
    const missingFields = [];
    if (!email) missingFields.push("email");
    if (!password) missingFields.push("password");
    if (!confirmPassword) missingFields.push("confirmPassword");
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
    if (password != confirmPassword && password.trim() != "") {
      return res.status(400).json({
        success: false,
        message: "the new passwords does not match",
      });
    }
    const result = (
      await db
        .promise()
        .query<RowDataPacket[]>("SELECT 1 FROM User WHERE Email = ? LIMIT 1", [
          email,
        ])
    )[0];
    if (result[0]) {
      return res.status(400).json({
        success: false,
        message: "Email already exist",
      });
    }
    const query = `
        INSERT INTO User
        (Email,
        SaltedPassword  ,
        PasswordSalt  ,
        UserType,
        FullName,
        ContactNumber,
        Organisation  ,
        Comments,
        RequestStatus,
        ReasonForRequest,
        UpdatedByID  ,
        CreatedByID  ,
        UpdatedDate 
        )
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NOW() )
    `;

    const newPasswordSalt = crypto.randomBytes(16).toString("hex");
    try {
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
            });
          const params = [
            email,
            hashedPassword,
            newPasswordSalt,
            userType,
            fullName,
            contactNumber,
            organisation,
            comments,
            requestStatus,
            reasonForRequest,
            adminID,
            adminID,
          ];
          await db.promise().query<RowDataPacket[]>(query, params);
          return res.json({
            success: true,
            message: "User created successfully!",
          });
        }
      );
    } catch (error) {
      console.error("password change error:", error);
      return res.json({
        success: false,
        message: `❌ Password change Failed: ${error} `,
      });
    }
  }
);
//✅ API to Fetch All Users
router.get(
  "/view-all",
  isAuthenticated,
  isAdmin,
  (
    req: any,
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: { (arg0: { error: string }): any; new (): any };
      };
      render: (
        arg0: string,
        arg1: { users: QueryResult; title: string }
      ) => void;
    }
  ) => {
    console.log("Route /admin-users hit"); // Debug log 1
    const query = `SELECT UserID, Email,UserType,FullName,Organisation,
    RegisteredDate, LastLoginDate, RequestStatus, IsDeleted  FROM User`;

    db.query(query, (err, result) => {
      console.log("Query executed", { err, result }); // Debug log 2
      if (err) {
        console.error("❌ Database Error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      console.log("Rendering template"); // Debug log 3
      res.render("admin/view-all", {
        users: result,
        title: "User Management",
      });
    });
  }
);

//refactored from server.js, not tested and may not be needed
router.get(
  "/view/:userID",
  isAuthenticated,
  isAdmin,
  (
    req: { params: { userID: number } },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        send: { (arg0: string): any; new (): any };
      };
      render: (
        arg0: string,
        arg1: { user: any; title: string; registeredDate: string|null }
      ) => void;
    }
  ) => {
    const userID = req.params.userID;

    const query = `
    SELECT UserID,Email,UserType,FullName,
    RegisteredDate,ContactNumber,
    Organisation,Comments,RequestStatus,
    IsDeleted,ReasonForRequest
    FROM User
    WHERE UserID = ?;
    `;

    db.query(query, [userID], (err, results: any) => {
      if (err) {
        console.error("❌ Error fetching user with joins:", err);
        return res.status(500).send("Error fetching user.");
      }

      if (results.length === 0) {
        return res.status(404).send("User not found or has been deleted.");
      }

      console.log("📄 User Data Fetched:", results[0]);
      res.render("admin/view", {
        user: results[0],
        title: "Imaging User Details",

        registeredDate: formatDisplayDate(results[0].RegisteredDate),
      });
    });
  }
);
//update user details
// Render edit user page (support both singular and plural URLs)
router.get(
  "/edit/:userID",
  isAuthenticated,
  isAdmin,
  async (
    req: {
      params: { userID: number };
      session: { message: { type: string; text: string } };
    },
    res: {
      render: (
        arg0: string,
        arg1: {
          title: string;
          message: any;
          user: RowDataPacket | null;
          userTypes?: string[];
          requestStatuses?: string[];
          registeredDate?: string|null;
        }
      ) => void;
    }
  ) => {
    const userId = req.params.userID;
    const query =
      "SELECT UserID,Email,UserType,FullName,RegisteredDate,ContactNumber,Organisation,Comments,RequestStatus,IsDeleted,ReasonForRequest FROM User WHERE UserID = ?";

    const result = (
      await db.promise().query<RowDataPacket[]>(query, [userId])
    )[0];
    if (result.length === 0) {
      return res.render("admin/edit", {
        title: "User Not Found",

        message: {
          type: "error",
          text: "User not found or has been deleted",
        },
        user: null,
      });
    }

    const message = req.session.message || { type: "", text: "" };

    res.render("admin/edit", {
      user: result[0],
      userTypes: Object.values(userTypesEnumeration()),
      requestStatuses: Object.values(requestStatusEnumeration()),
      registeredDate: formatDisplayDate(result[0].RegisteredDate),
      title: `Edit User - ${result[0].Email}`,
      message: message,
    });

  
  }
);

router.post(
  ["/edit/:userID"],
  isAuthenticated,
  isAdmin,
  async (
    req: {
      params: { userID: number };
      body: {
        userID: number;
        email: string;
        password: string;
        confirmPassword: string;
        userType: string;
        fullName: string;
        contactNumber: string;
        organisation: string;
        comments: string;
        requestStatus: string;
        reasonForRequest: string;
        originalEmail: string;
      };
    },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: {
          (arg0: { success: boolean; message: string }): any;
          new (): any;
        };
      };
      json: (arg0: {
        success: boolean;
        message: string;
      }) => void | PromiseLike<void>;
    }
  ) => {
    const adminID = req.params.userID;

    const {
      userID,
      email,
      password,
      confirmPassword,
      userType,
      fullName,
      contactNumber,
      organisation,
      comments,
      requestStatus,
      reasonForRequest,
      originalEmail,
    } = req.body;
    console.log(req.body);
    //Validation
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
    if (password != confirmPassword && password.trim() != "") {
      return res.status(400).json({
        success: false,
        message: "the new passwords does not match",
      });
    }
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
        UPDATE User 
    SET
        Email=?,
        UserType=?,
        FullName=?,
        ContactNumber=?,
        Organisation = ?,
        Comments=?,
        RequestStatus=?,
        ReasonForRequest=?,
        UpdatedDate = NOW(),
        UpdatedByID = ?
    `;

    const newPasswordSalt = crypto.randomBytes(16).toString("hex");
    try {
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
            });
          const q2 =
            password.trim() != ""
              ? query + ",SaltedPassword = ?, PasswordSalt = ? WHERE UserID = ?"
              : query + "WHERE UserID = ?";
          const params =
            password.trim() != ""
              ? [
                  email,
                  userType,
                  fullName,
                  contactNumber,
                  organisation,
                  comments,
                  requestStatus,
                  reasonForRequest,
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
                  organisation,
                  comments,
                  requestStatus,
                  reasonForRequest,
                  adminID,
                  userID,
                ];

          await db.promise().query<RowDataPacket[]>(q2, params);
          return res.json({
            success: true,
            message: "User updated successfully!",
          });
        }
      );
    } catch (error) {
      console.error("password change error:", error);
      return res.json({
        success: false,
        message: `❌ Password change Failed: ${error} `,
      });
    }
  }
);

// ✅ Delete User (Soft Delete - Update IsDeleted to 1)
router.post(
  "/delete/:userID",
  isAuthenticated,
  isAdmin,
  (
    req: { params: { userID: number} },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: { (arg0: { success: boolean; error: string }): any; new (): any };
      };
      redirect: (arg0: string) => void;
    }
  ) => {
    const userId = req.params.userID;
    const query = "UPDATE User SET IsDeleted = 1 WHERE UserID = ?";

    db.query(query, [userId], (err, result) => {
      if (err) {
        console.error("❌ Database Error:", err);
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }
      console.log(`🗑️ User ${userId} marked as deleted`);

      res.redirect("/admin/user-management/view-all");
    });
  }
);

router.post(
  "/restore/:userID",
  isAuthenticated,
  isAdmin,
  (
    req: { params: { userID: number } },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: { (arg0: { error: string }): any; new (): any };
      };
      redirect: (arg0: string) => void;
    }
  ) => {
    const userID = req.params.userID;
    db.query(
      "UPDATE User SET IsDeleted = 0 WHERE UserID = ?",
      [userID],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Error recovering user" });
        }
        console.log(`✅ User with ID ${userID} recovered`);
        res.redirect("/admin/user-management/view-all"); // Redirect to admin page after recovery
      }
    );
  }
);

module.exports = router;
