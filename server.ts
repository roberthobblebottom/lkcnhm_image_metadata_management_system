//TEST
// 
console.log("TEST")
require("dotenv").config()
const express = require("express")
import { Response, Request } from "express"
const session = require("express-session")
const authRoutes = require("./routes/auth")
const adminRoutes = require("./routes/admin/admin")
const mediaRoutes = require("./routes/media")
const projectRoutes = require("./routes/project")
const settingsRoutes = require("./routes/settings")
const adminUserManagementRoutes = require("./routes/admin/user-management")
const { isAuthenticated } = require("./middleware/auth")
const passport = require("passport")
const app = express()
const PORT = process.env.PORT || 3001
// ✅ Middleware
app.disable('x-powered-by')
app.use(express.static("public"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.set("view engine", "ejs") // Set view engine to HTML
// app.use(cookieParser())

// 🔒 Session setup
app.set('trust proxy', 1) // trust first proxy
const cookiesSettings = {
      secure: process.env.NODE_ENV === 'production', 
      httpOnly: process.env.NODE_ENV === 'production',
      sameSite:'strict',
      path:"/",
      maxAge: 1000 * 60 * 60 * 6,// 6-hour expiry
    }

if(process.env.NODE_ENV === "production")
  cookiesSettings['domain']="imaging.biodiversity.sg"
app.use(
  session({
    secret: process.env.SessionSecret,
    name:'sessionId',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: cookiesSettings,
    //
  })
)
app.use(passport.initialize())
app.use(passport.session())

// app.use(passport.authenticate('session'))
// ✅ API Routes
app.use("/auth", authRoutes)
app.use("/admin", adminRoutes)
app.use("/media", mediaRoutes)
app.use("/project", projectRoutes)
app.use("/settings", settingsRoutes)
app.use("/admin/user-management", adminUserManagementRoutes)

// ✅ Serve HTML pages

app.get("/", (req: Request, res: Response) => {
  req.session.destroy(() => { })
  // res.render("index", { title: "register" })
  res.redirect("/user/login-landing-page")
})

app.get("/login", (req: Request, res: Response) => {
  req.session.destroy(() => { })
  res.render("login", { title: "Login Page" })
})

// ✅ User Dashboard (Protected)
app.get("/user/login-landing-page", isAuthenticated, (req: Request, res: Response) => {

  res.render("user/login-landing-page", {
    user: req.session.passport.user,
    title: "User login landing page",
    currentUser: req.session.passport.user,
  })
})
app.get("/download-instructions", isAuthenticated, async (req: any, res: Response) => {
  //helps to retrieve metadata template file for downloading.
  const filePath: string = "Instructions.pdf"
  res.download(filePath)
})


// ✅ Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://localhost:${PORT}`)
})




// Handle forgot password page
// app.get("/forgot-password", (req: Request, res: Response) => {
//   res.render("forgot-password", {
//     title: "Forgot Password",
//     adminEmail: "admin@gmail.com",
//     forgotPasswordPath: "/forgot-password", // POST endpoint
//     redirectPath: "/login", // redirect after success
//   })
// })

// Handle forgot password
// app.post("/forgot-password", (req: Request, res: Response) => {
//   const { userID, Password, newPassword } = req.body

//   console.log("🟢 Forgot Password Request:", req.body)

//   // Step 1: Verify userID and Password
//   const selectQuery =
//     "SELECT * FROM User WHERE Email = ? AND TemporaryPassword = ?"
//   db.query(
//     selectQuery,
//     [userID, Password],
//     (err: any, results: string | any[]) => {
//       if (err) {
//         console.error("DB error:", err)
//         return res.status(500).json({ success: false, error: "Server error" })
//       }

//       if (results.length === 0) {
//         return res.json({
//           success: false,
//           error: "Invalid user ID or temp password",
//         })
//       }

//       // Step 2: Update the password
//       const updateQuery =
//         "UPDATE User SET Password = ?, TemporaryPassword = NULL WHERE Email = ?"
//       db.query(updateQuery, [newPassword, userID], (err2: any, result: any) => {
//         if (err2) {
//           console.error("DB error:", err2)
//           return res
//             .status(500)
//             .json({ success: false, error: "Update failed" })
//         }

//         res.json({
//           success: true,
//           message: "Password updated successfully",
//         })
//       })
//     }
//   )
// })
