require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const db = require("./routes/db");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin/admin");
const mediaRoutes = require("./routes/media");
const projectRoutes = require("./routes/project");
const settingsRoutes = require("./routes/settings");
const adminUserManagementRoutes = require("./routes/admin/user-management");
const { isAuthenticated, isAdmin } = require("./middleware/auth");
const passport = require("passport");
const app = express();
const PORT = process.env.PORT || 5000;
import { RowDataPacket } from "mysql2";
import { userTypesEnumeration } from "./middleware/utils";
import { Passport, Session, User } from "./@types/types";
// ✅ Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs"); // Set view engine to HTML
// app.use(cookieParser());

// 🔒 Session setup
app.use(
  session({
    secret: process.env.SessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true }, // 1-hour expiry
    //maxAge: 1000 * 60 * 60
  })
);
app.use(passport.session());

// ✅ API Routes
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/media", mediaRoutes);
app.use("/project", projectRoutes);
app.use("/settings", settingsRoutes);
app.use("/admin/user-management", adminUserManagementRoutes);

// ✅ Serve HTML pages
const serveHTML = (route: any, file: any) => {
  app.get(route, (req: any, res: { sendFile: (arg0: any) => void }) => {
    res.sendFile(path.resolve(__dirname, "views", file));
  });
};

app.get(
  "/",
  (
    req: any,
    res: { render: (arg0: string, arg1: { title: string }) => void }
  ) => {
    res.render("index", { title: "register" });
  }
);

app.get(
  "/register",
  async (
    req: any,
    res: {
      render: (
        arg0: string,
        arg1: { title: string; userTypes: string[] }
      ) => void;
    }
  ) => {
    res.render("register", {
      title: "register",
      userTypes: [
        userTypesEnumeration().photographerOnly,
        userTypesEnumeration().projectOwner,
      ],
    });
  }
);

app.get(
  "/login",
  (
    req: any,
    res: { render: (arg0: string, arg1: { title: string }) => void }
  ) => {
    res.render("login", { title: "Login Page" });
  }
);

// ✅ User Dashboard (Protected)
app.get(
  "/user/dashboard",
  isAuthenticated,
  (
    req: { session: { passport: { user: any } } },
    res: {
      render: (
        arg0: string,
        arg1: {
          layout: string; // Specify your layout file
          user: any;
          title: string;
        }
      ) => void;
    }
  ) => {
    res.render("user/dashboard", {
      layout: "layout", // Specify your layout file
      user: req.session.passport.user,
      title: "User Dashboard",
      // Add other data
    });
  }
);

app.get(
  "/api/current-user",
  (
    req: {
      session: {
        passport: Passport;
      };
    },
    res: {
      json: (arg0: User) => void;
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: { (arg0: { error: string }): void; new (): any };
      };
    }
  ) => {
    if (req.session && req.session.passport.user) {
      console.log(req.session.passport.user);
      res.json({
        Email: req.session.passport.user.Email,
        FullName: req.session.passport.user.FullName,
        UserType: req.session.passport.user.UserType,
        UserID: req.session.passport.user.UserID,
      });
    } else {
      res.status(401).json({ error: "Not logged in" });
    }
  }
);

// ✅ Debug Route to Check Session Persistence
app.get(
  "/session",
  (
    req: { session:Session},
    res: { json: (arg0: { sessionData: any }) => void }
  ) => {
    console.log("🟢 Session Check:", req.session.passport.user);
    res.json({ sessionData: req.session.passport.user || "No active session" });
  }
);

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

// app.get("/imagingUser", isAuthenticated, (req, res) => {
//     const userId = req.session.passport.user.UserID;

//     const query = `
//         SELECT u.*, ut.UserTypeName
//         FROM User u
//         LEFT JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
//         WHERE u.CreatedByID = ? AND u.IsDeleted = 0
//     `;

//     db.query(query, [userId], (err, results) => {
//         if (err) {
//             console.error("❌ Error fetching projects:", err);
//             return res.status(500).send("Server error");
//         }

//         const mainUserTypes = ['Internal User', 'External User'];

//         const userRequests = results.filter(r => mainUserTypes.includes(r.UserTypeName));
//         const otherRequests = results.filter(r => !mainUserTypes.includes(r.UserTypeName));

//         // ✅ Check if primary user request exists and is not approved
//         let showPendingAlert = false;

//         if (userRequests.length > 0 && userRequests[0].RequestStatusName !== "approved") {
//             showPendingAlert = true;
//         }

//         res.render("imagingUser", {
//             userRequests,
//             otherRequests,
//             showPendingAlert,
//             title: "Imaging User Request",
//         });
//     });
// });

app.get(
  "/form",
  isAuthenticated,
  (
    req: { session: { passport: { user: { UserID: any; UserType: any } } } },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        send: { (arg0: string): any; new (): any };
      };
      render: (
        arg0: string,
        arg1: {
          userTypesEnumeration?: any;
          isAdmin: boolean;
          isPrimaryUserRegistered: boolean;
          userTypes?: any;
          title?: string;
        }
      ) => any;
      redirect: (arg0: string) => any;
    }
  ) => {
    const loginUserId = req.session.passport.user.UserID;
    const isAdmin =
      req.session.passport.user.UserType === userTypesEnumeration().admin;

    // Get all user type data first
    const userTypeQuery = `SELECT * FROM UserType`;

    db.query(userTypeQuery, (err: any, userTypesEnum: any) => {
      if (err) {
        console.error("❌ Error fetching user types:", err);
        return res.status(500).send("Server error.");
      }

      // If admin, send all user types directly
      if (isAdmin) {
        return res.render("form", {
          userTypesEnumeration,
          isAdmin,
          isPrimaryUserRegistered: false, // Admin doesn't register themselves
        });
      }

      // Check if the user has registered already as Internal/External User
      const userCheckQuery = `
            SELECT u.*, u.RequestStatus, ut.UserType
            FROM User u
            WHERE u.CreatedByID = ? AND ut.UserTypeName IN ('Internal User', 'External User') AND u.IsDeleted = 0
            LIMIT 1
        `; // TODO Wrong Filter

      db.query(userCheckQuery, [loginUserId], (err: any, results: any[]) => {
        if (err) {
          console.error("❌ Error checking user registration:", err);
          return res.status(500).send("Server error.");
        }

        const user = results[0];

        if (!user) {
          // Not registered yet: send only Internal/External
          // const filtered = userTypes.filter((type: { UserTypeName: string; }) =>
          //     type.UserTypeName === "Internal User" || type.UserTypeName === "External User"
          // );

          return res.render("form", {
            // userTypes: filtered,
            isAdmin: false,
            isPrimaryUserRegistered: false,
          });
        }

        if (user.RequestStatusName !== "approved") {
          return res.redirect("/user/UserRequest?status=pending");
        }

        // Already registered & approved, so show only other user types
        // const filtered = userTypes.filter((type: { UserTypeName: string; }) =>
        //     type.UserTypeName !== "Internal User" && type.UserTypeName !== "External User"
        // );

        return res.render("form", {
          // userTypes: filtered,
          isAdmin: false,
          isPrimaryUserRegistered: true,
          title: "User Request Form", // Add title here
        });
      });
    });
  }
);

app.get(
  "/admin/UserRequest",
  isAuthenticated,
  isAdmin,
  (
    req: { session: { passport: { user: any } } },
    res: { render: (arg0: string, arg1: { user: any }) => void }
  ) => {
    res.render("admin", { user: req.session.passport.user });
  }
);

app.get(
  "/check-email",
  (
    req: { query: { email: any } },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: { (arg0: { error: string }): any; new (): any };
      };
      json: (arg0: { exists: boolean }) => void;
    }
  ) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const query = `SELECT id FROM User WHERE email = ? AND IsDeleted = 0`;
    db.query(query, [email], (err: any, results: string | any[]) => {
      if (err) {
        console.error("❌ DB Error while checking email:", err);
        return res.status(500).json({ error: "Server error" });
      }

      const exists = results.length > 0;
      res.json({ exists });
    });
  }
);

app.post(
  "/create",
  isAuthenticated,
  (
    req: {
      body: {
        email: any;
        ContactNumber: any;
        organisation: any;
        UserType: any;
        comments: any;
      };
      session: { passport: { user: { UserID: any } } };
    },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: { (arg0: { error: string }): any; new (): any };
      };
      json: (arg0: { message: string }) => void;
    }
  ) => {
    const { email, ContactNumber, organisation, UserType, comments } = req.body;
    const created_by = req.session.passport.user.UserID;
    const date_of_req = new Date().toISOString().slice(0, 19).replace("T", " ");
    const reason_for_req = null;
    const IsDeleted = 0;
    const RequestStatusID = 1; // 'New' status from RequestStatus table
    const CreatedDate = date_of_req; // Assuming CreatedDate is the same as date_of_req
    const checkQuery = `SELECT UserID FROM User WHERE Email = ? AND IsDeleted = 0`;

    db.query(checkQuery, [email], (err: any, results: string | any[]) => {
      if (err) {
        console.error("❌ Email Check Error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (results.length > 0) {
        return res.status(400).json({ error: "This email is already in use." });
      }

      const insertQuery = `
            INSERT INTO User 
            (Email, ContactNumber, Organisation, UserType, RequestStatus, Comments, date_of_req, ReasonForRequest IsDeleted, CreatedByID, CreatedDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

      const values = [
        email,
        ContactNumber,
        organisation,
        UserType,
        RequestStatusID,
        comments,
        date_of_req,
        reason_for_req,
        IsDeleted,
        created_by,
        CreatedDate,
      ];

      db.query(insertQuery, values, (err: any) => {
        if (err) {
          console.error("❌ Insert Failed:", err);
          return res.status(500).json({ error: "Database Insert Error" });
        }

        console.log("✅ Data Inserted Successfully with RequestStatusID = 1");
        res.json({ message: "User request submitted successfully!" });
      });
    });
  }
);

// Handle forgot password page
app.get(
  "/forgot-password",
  (
    req: any,
    res: {
      render: (
        arg0: string,
        arg1: {
          title: string;
          adminEmail: string;
          forgotPasswordPath: string; // POST endpoint
          redirectPath: string; // redirect after success
        }
      ) => void;
    }
  ) => {
    res.render("forgot-password", {
      title: "Forgot Password",
      adminEmail: "admin@gmail.com",
      forgotPasswordPath: "/forgot-password", // POST endpoint
      redirectPath: "/login", // redirect after success
    });
  }
);

// Handle forgot password
app.post(
  "/forgot-password",
  (
    req: { body: { userId: any; Password: any; newPassword: any } },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: { (arg0: { success: boolean; error: string }): any; new (): any };
      };
      json: (arg0: {
        success: boolean;
        error?: string;
        message?: string;
      }) => void;
    }
  ) => {
    const { userId, Password, newPassword } = req.body;

    console.log("🟢 Forgot Password Request:", req.body);

    // Step 1: Verify userId and Password
    const selectQuery =
      "SELECT * FROM User WHERE Email = ? AND TemporaryPassword = ?";
    db.query(
      selectQuery,
      [userId, Password],
      (err: any, results: string | any[]) => {
        if (err) {
          console.error("DB error:", err);
          return res
            .status(500)
            .json({ success: false, error: "Server error" });
        }

        if (results.length === 0) {
          return res.json({
            success: false,
            error: "Invalid user ID or temp password",
          });
        }

        // Step 2: Update the password
        const updateQuery =
          "UPDATE User SET Password = ?, TemporaryPassword = NULL WHERE Email = ?";
        db.query(
          updateQuery,
          [newPassword, userId],
          (err2: any, result: any) => {
            if (err2) {
              console.error("DB error:", err2);
              return res
                .status(500)
                .json({ success: false, error: "Update failed" });
            }

            res.json({
              success: true,
              message: "Password updated successfully",
            });
          }
        );
      }
    );
  }
);