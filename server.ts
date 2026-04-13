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
const  db =require( "./routes/db")
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



app.get("/download-all-projects-data",
  isAuthenticated,
  isProjectOwner,
  async (req: Request, res: Response) => {
    //PROJECT
    const temp3: any = await db.query(
         `
         SELECT projectOwner.FullName FullName, p.*
    FROM Project p
    JOIN User projectOwner on projectOwner.UserID = p.ProjectOwnerID
    WHERE p.ProjectOwnerID = ? 
    AND p.IsDeleted = 0
    GROUP BY p.ProjectID;
    `,
      [req.session.passport.user.UserID])
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
    const projectIDs =  []


    // photographers
    for (const x of projectData2){
      const x1: any = x
      projectIDs.push(x1.ProjectID)
    }
    console.log("Project: ",projectData2)
    console.log(projectIDs)
    const temp4: any = await db.query(
         `
       SELECT p.ProjectName,p.ProjectID,u.FullName,u.UserID, u.UserType, u.StaffType 
       FROM ProjectUserPhotographyLink pupl
       JOIN User u ON pupl.PhotographerID = u.UserID
       JOIN Project p on pupl.ProjectID = p.ProjectID
       WHERE p.ProjectID IN (?)
       AND p.IsDeleted = 0
       AND u.IsDeleted = 0
    `,
      [projectIDs])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const photographersData = temp4[0]
    const photographersData2: Array<Object> = Array.from(photographersData)
    const jsonPhotographersData = JSON.parse(JSON.stringify(photographersData2))
    const photographersData3 = await fastcsv.writeToBuffer(jsonPhotographersData, {
      headers: true,
    })
    console.log("photographers",photographersData2)
    
    // ImagingPlatformsInstances
    const temp5: any = await db.query(
         `
       SELECT p.ProjectName,p.ProjectID,i.ImagingPlatform 
       FROM ImagingPlatformInstance i
       JOIN Project p on i.ProjectID = p.ProjectID
       AND p.IsDeleted = 0
       AND p.ProjectID in (?)
    `,
      [projectIDs])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const imagingPlatformsData = temp5[0]
    const imagingPlatformsData2: Array<Object> = Array.from(imagingPlatformsData)
    const jsonimagingPlatformsData = JSON.parse(JSON.stringify(imagingPlatformsData2))
    const imagingPlatformsData3 = await fastcsv.writeToBuffer(jsonimagingPlatformsData, {
      headers: true,
    })
    console.log("Imaging Platforms",imagingPlatformsData2)

    //MEDIA
    const temp6: any = await db.query(`SELECT p.ProjectName,User.FullName, m.* 
    FROM Media m 
    JOIN Project p on m.ProjectID = p.ProjectID
    JOIN User on User.UserID = m.PhotographerID
    WHERE p.ProjectID IN (?)`,
    [projectIDs])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const mediaData = temp6[0]
    const mediaData2: Array<Object> = Array.from(mediaData)
    const jsonMediaData2 = JSON.parse(JSON.stringify(mediaData2))
    const mediaData3 = await fastcsv.writeToBuffer(jsonMediaData2, {
      headers: true,
    })

    const zip = new AdmZip()
    // zip.addFile("media.csv", mediaData3)
    zip.addFile("project.csv", projectData3)
    zip.addFile("photographers.csv", photographersData3 )
    zip.addFile("imagingPlatforms.csv", imagingPlatformsData3 )
    zip.addFile("media.csv",mediaData3)

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
