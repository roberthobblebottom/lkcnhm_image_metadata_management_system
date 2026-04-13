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
import { RedisStore } from 'connect-redis'
import { createClient } from "redis"
import { isProjectOwner } from "./middleware/auth"
import { db } from "./routes/db"
const MemoryStore = require('memorystore')(session);
const fastcsv = require("fast-csv")
import AdmZip from "adm-zip"


const redisClient = createClient()
redisClient.connect().catch(console.error)
const app = express()
const PORT = process.env.PORT || 3001
app.disable('x-powered-by')

//  Middleware
app.use(express.static("public"))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))
app.set("view engine", "ejs") // Set view engine to HTML

// Session setup
app.set('trust proxy', 1) // trust first proxy
const cookiesSettings = {
  secure: process.env.NODE_ENV === 'production',
  httpOnly: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: "/",
  maxAge: 1000 * 60 * 60 * 6,// 6-hour expiry
}

if (process.env.NODE_ENV === "production")
  cookiesSettings['domain'] = "imaging.biodiversity.sg"
app.use(
  session({
    secret: process.env.SessionSecret,
    store: process.env.NODE_ENV == "production"
      ? new RedisStore({ client: redisClient, prefix: "image-metadata-management-system-session-storage:" })
      : new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
      }),
    name: 'sessionId',
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
// API Routes
app.use("/auth", authRoutes)
app.use("/admin", adminRoutes)
app.use("/media", mediaRoutes)
app.use("/project", projectRoutes)
app.use("/settings", settingsRoutes)
app.use("/admin/user-management", adminUserManagementRoutes)

app.get("/", (req: Request, res: Response) => {
  req.session.destroy(() => { })
  res.redirect("/login")
})

app.get("/login", (req: Request, res: Response) => {
  req.session.destroy(() => { })
  res.render("login", { title: "Login Page" })
})

app.get("/user/login-landing-page", isAuthenticated, (req: Request, res: Response) => {
  res.render("user/login-landing-page", {
    user: req.session.passport.user,
    title: "User login landing page",
    currentUser: req.session.passport.user,
  })
})



app.post("/download-all-projects-data",
   isAuthenticated,
    isProjectOwner,
     async (req: Request, res: Response) => {



  //PROJECT
  const temp3: any = await db.query(
    `SELECT Project.*,projectOwner.FullName FullName,
    GROUP_CONCAT(User.FullName SEPARATOR ",") ALIAS ProjectPhotographersNames,
    GROUP_CONCAT(User.Email SEPARATOR ",") ALIAS ProjectPhotogragraphersEmails ,
    GROUP_CONCAT(User.StaffType SEPARATOR ",") ALIAS ProjectPhotographersStaffTypes,
    GROUP_CONCAT(User.UserType SEPARATOR ",") ALIAS ProjectPhotographerUserTypes,  
    GROUP_BY(ipi.ImagingPlatform SEPARATOR ",") ALIAS ImagingPlatforms FROM Project 
    JOIN ProjectUserPhotographyLink pupl ON pupl.ProjectID = Project.ProjectID 
    JOIN User on User.UserID = pupl.photographerID
    JOIN ImagingPlatformInstance ipi on ipi.ProjectID = Project.ProjectID
    JOIN projectOwner on projectOwner.UserID = Project.ProjectOwnerID
    WHERE Project.ProjectOwnerID = ? 
    AND Project.IsDeleted = 0
    AND User.IsDeleted = 0
    GROUP BY Project.ProjectID 
    `,
    [req.session.passport.user.userID])
    .catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })
  const projectData = temp3[0]
  const projectData2: Array<Object> = Array.from(projectData)
  const jsonProjectData = JSON.parse(JSON.stringify(projectData2))
  const projectData3 = await fastcsv.writeToBuffer(jsonProjectData, {
    headers: true,
  })
  console.log('project data', projectData)

  // return res.json({message:'testing'})
  const projectID = null
  //MEDIA
  const temp5: any = await db.query(`SELECT Project.ProjectName,User.FullName, Media.* 
    FROM Media
    JOIN Project on Media.ProjectID = Project.ProjectID
    JOIN User on User.UserID = Project.PhotographerID
    WHERE Project.ProjectID = ?`
  [projectID])
    .catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })
  const mediaData = temp5[0]
  const mediaData2: Array<Object> = Array.from(mediaData)
  const jsonMediaData2 = JSON.parse(JSON.stringify(mediaData2))
  const mediaData3 = await fastcsv.writeToBuffer(jsonMediaData2, {
    headers: true,
  })




  const zip = new AdmZip()
  zip.addFile("media.csv", mediaData3)

  zip.addFile("project.csv", projectData3)


  res.json({
    success: true,
    message: "zipfile in blob",
    buffer: zip.toBuffer(),
  })



})

app.get("/download-instructions", isAuthenticated, async (req: any, res: Response) => {
  //helps to retrieve metadata template file for downloading.
  const filePath: string = "Instructions.pdf"
  res.download(filePath)
})

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
