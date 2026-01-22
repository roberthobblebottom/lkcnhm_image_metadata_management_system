require("dotenv").config();
const express = require("express");
import { Response, Request } from "express";
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
const PORT = process.env.PORT || 3001;
// ✅ Middleware
app.use(express.static("public"));
// app.use(express.static(path.join(__dirname,"/public/")));
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
rolling: true, 
    cookie: { 
      // secure: true, 
      httpOnly: true,
       maxAge: 1000 * 60 * 60 * 6,// 6-hour expiry
      }, 
    //
  })
);
app.use(passport.initialize());
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

app.get("/", (req: Request, res: Response) => {
  res.render("index", { title: "register" });
});

// app.get("/register", async (req: Request, res: Response) => {
//   res.render("register", {
//     title: "register",
//     userTypes: [
//       userTypesEnumeration().photographerOnly,
//       userTypesEnumeration().projectOwner,
//     ],
//   });
// });

app.get("/login", (req: Request, res: Response) => {
  res.render("login", { title: "Login Page" });
});

// ✅ User Dashboard (Protected)
app.get("/user/login-landing-page", isAuthenticated, (req: Request, res: Response) => {

  res.render("user/login-landing-page", {
    user: req.session.passport.user,
    title: "User login landing page",
    currentUser: req.session.passport.user,
  });
});

app.get("/current-user2", (req: Request, res: Response) => {
  console.log('/current user')
  console.log('current user', req.session.passport.user)
  if (req.session && req.session.passport.user) {
    res.json({
      Email: req.session.passport.user.Email,
      FullName: req.session.passport.user.FullName,
      UserType: req.session.passport.user.UserType,
      UserID: req.session.passport.user.UserID,
    });
  } else {
    res.status(401).json({ error: "Not logged in" });
  }
});


// ✅ Start Server
app.listen(PORT,'0.0.0.0', () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});




// Handle forgot password page
// app.get("/forgot-password", (req: Request, res: Response) => {
//   res.render("forgot-password", {
//     title: "Forgot Password",
//     adminEmail: "admin@gmail.com",
//     forgotPasswordPath: "/forgot-password", // POST endpoint
//     redirectPath: "/login", // redirect after success
//   });
// });

// Handle forgot password
// app.post("/forgot-password", (req: Request, res: Response) => {
//   const { userId, Password, newPassword } = req.body;

//   console.log("🟢 Forgot Password Request:", req.body);

//   // Step 1: Verify userId and Password
//   const selectQuery =
//     "SELECT * FROM User WHERE Email = ? AND TemporaryPassword = ?";
//   db.query(
//     selectQuery,
//     [userId, Password],
//     (err: any, results: string | any[]) => {
//       if (err) {
//         console.error("DB error:", err);
//         return res.status(500).json({ success: false, error: "Server error" });
//       }

//       if (results.length === 0) {
//         return res.json({
//           success: false,
//           error: "Invalid user ID or temp password",
//         });
//       }

//       // Step 2: Update the password
//       const updateQuery =
//         "UPDATE User SET Password = ?, TemporaryPassword = NULL WHERE Email = ?";
//       db.query(updateQuery, [newPassword, userId], (err2: any, result: any) => {
//         if (err2) {
//           console.error("DB error:", err2);
//           return res
//             .status(500)
//             .json({ success: false, error: "Update failed" });
//         }

//         res.json({
//           success: true,
//           message: "Password updated successfully",
//         });
//       });
//     }
//   );
// });
