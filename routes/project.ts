const express = require("express")
const router = express.Router()
const db = require('./db')
import { Response, Request } from "express"
import { checkIfParamIsPositiveInteger, emailRegex, userTypesEnumeration } from "../middleware/utils"

import crypto from "crypto"
const {
  isAuthenticated,
  isAdminOrProjectOwner,
} = require("../middleware/auth")
const {
  formatDisplayDate,
  projectStatusEnumeration,
} = require("../middleware/utils")

router.get(
  "/create",
  isAuthenticated,
  isAdminOrProjectOwner,
  async (req: Request, res: Response) => {
    const getProjectOwners = `
    SELECT u.UserID,u.FullName, u.Email, u.UserType 
    FROM User u
    WHERE u.UserType = 'projectOwner'
    AND u.IsDeleted = 0`
    const getPhotographers = `
    SELECT u.UserID,u.FullName, u.Email 
    FROM User u
    WHERE u.UserType != 'admin' 
    AND u.IsDeleted = 0`
    const isUserRegistrationEnabledQuery = 'SELECT IsEnabled FROM IsUserRegistrationEnabled'
    const [projectOwners, photographers, isUserRegistrationEnabledResults] = await Promise.all([
      db.query(getProjectOwners),
      db.query(getPhotographers),
      db.query(isUserRegistrationEnabledQuery)
    ]).then((results) => { return results })
      .catch((e) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
        return null
      })
    const isUserRegistrationEnabled = (isUserRegistrationEnabledResults)[0][0].IsEnabled

    res.render("project/create", {
      currentUser: req.session.passport.user,
      projectOwners: projectOwners[0],
      photographers: photographers[0],
      projectTypes: req.session.projectTypes,
      imagingPlatforms: req.session.imagingPlatforms,
      title: "Project Form",
      isUserRegistrationEnabled,
      emailRegex
    })
  }
)

//  for creation of new project
router.post(
  "/create",
  isAuthenticated,
  isAdminOrProjectOwner,
  async (req: Request, res: Response) => {

    const isUserRegistrationEnabledQuery =
      'SELECT IsEnabled FROM IsUserRegistrationEnabled'
    const temp1 = await db.query(isUserRegistrationEnabledQuery)
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const isUserRegistrationEnabled = temp1[0][0].IsEnabled

    const userID = req.session.passport.user.UserID
    const startDate = new Date(req.body.startDate)
    const endDate = new Date(req.body.endDate)
    const requiredFields = [
      "projectOwner",
      "projectName",
      "startDate",
      "endDate",
      "summary",
      "specimenDetails",
    ]

    //VALIDATIONS
    const missingFields = requiredFields.filter((field) => !req.body[field])
    if (missingFields.length > 0)
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      })
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
      return res.status(400).json({
        success: false,
        message: "Invalid date format provided",
      })
    if (endDate < startDate)
      return res.status(400).json({
        success: false,
        message: "End date cannot be before start date",
      })
    if (!userID)
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Please login first.",
      })
    if (req.body.selectedImagingPlatforms.length == 0)
      return res.status(400).json({
        success: false,
        message: "there are no selected Imaging Platforms",
      })
    if (req.body.selectedPhotographers.length == 0)
      return res.status(400).json({
        success: false,
        message: "there are no selected selected photographers",
      })
    for (const x of req.body.toBeCreatedPhotographers) {
      if (!emailRegex.test(x[1]))
        return res.status(400).json({
          success: false,
          message:
            "there is at least a photographer with email of the wrong format",
        })

      //validating to be created photographer full name
      if (x[0] == "" || !x[0])
        return res.status(400).json({
          success: false,
          message: "there is at least a photographer with missing full name ",
        })
    }

    const selectedPhotographers = req.body.selectedPhotographers

    //creation of new photographers
    if (isUserRegistrationEnabled) {
      const newlyCreatedPhotographers
        : { email: string; password: string }[] =
        []
      for (const x of req.body.toBeCreatedPhotographers) {
        const fullName = x[0]
        const email = x[1]
        const newPasswordSalt = crypto.randomBytes(16).toString()
        const newPassword = Buffer.from(crypto.randomBytes(4)).toString('hex') // TODO: switch to this in production
        // const newPassword = "1" // For testing only
        const saltedPassword = crypto.pbkdf2Sync(
          newPassword, newPasswordSalt, 310000, 32, "sha256"
        )
        var insertedId = ""
        const insertUserQuery = `
            INSERT INTO User 
            (Email, SaltedPassword,PasswordSalt,  UserType, RegisteredDate,
              UpdatedDate,FullName,ContactNumber,Comments)
            VALUES (?, ?,?,  ?, NOW(),NOW(),  ?, ?,?)`
        const params = [
          email,
          saltedPassword,
          newPasswordSalt,
          userTypesEnumeration().photographerOnly,
          fullName,
          "",
          "Created during the creation of a project this user is in by project owner of user id." +
          userID,
        ]
        const temp1 = await db.query(insertUserQuery, params)
          .catch((err: any) => {
            console.error(err)
            const condition = err.toString().toLowerCase().includes("duplicate") &&
              err.toString().toLowerCase().includes("email")
            if (condition) {
              const msg = "email already existed in the database."
              res.status(400).json({ success: false, message: msg })
            } else
              res.status(500).json({ success: false, error: err })
          })
        const result = temp1[0]
        const o: any = result
        insertedId = Object.values(o)[2].toString() //the weird way of getting insertedId
        newlyCreatedPhotographers.push({ email: email, password: newPassword, })
        for (let x = 0; x < selectedPhotographers.length; x++)
          if (emailRegex.test(selectedPhotographers[x])) {
            selectedPhotographers[x] = insertedId
            break
          }

      }
      req.session["newlyCreatedPhotographers"] = newlyCreatedPhotographers
      req.session.save()
    }

    //main creation queries
    const insertQuery = `
        INSERT INTO Project (
            ProjectName,
            ProjectType,
            ProjectOwnerID,
            ImagingStartDate,
            ImagingEndDate,
            SummaryofProject,
            DetailsOfSpecimens,
            Comments,
            CreatedDate,
            CreatedByID,
            UpdatedDate,
            UpdatedByID,
            IsDeleted,
            ProjectStatus
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), ?, 0, ?)`
    const insertPhotographersLinksQuery = `
        INSERT INTO ProjectUserPhotographyLink (PhotographerID,ProjectID)
        VALUES ?`
    const insertImagingPlatformsQuery = `
        INSERT INTO ImagingPlatformInstance
        (ImagingPlatform,ProjectID)
        VALUES ?`

    const result = await db
      .query(insertQuery, [
        req.body.projectName,
        req.body.projectType == "" ? null : req.body.projectType,
        req.body.projectOwner,
        req.body.startDate,
        req.body.endDate,
        req.body.summary,
        req.body.specimenDetails,
        req.body.comments || null,
        userID,
        userID,
        projectStatusEnumeration().in_progress,
      ]).catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const insertedProjectID = Object.values(result[0])[2].toString()

    const photographersLinksTuple: string[][] = []
    for (var x of selectedPhotographers)
      photographersLinksTuple.push([x, insertedProjectID])
    await db
      .query(insertPhotographersLinksQuery, [photographersLinksTuple])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })

    // insert into ImagingPlatformInstance Table
    const imagingPlatformsTuple: string[][] = []
    for (x of req.body.selectedImagingPlatforms)
      imagingPlatformsTuple.push([x, insertedProjectID])
    await db
      .query(insertImagingPlatformsQuery, [imagingPlatformsTuple])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })


    res.json({
      success: true,
      message: "project submitted successfully",
      redirectUrl: `/project/view/${insertedProjectID}`
    })

  }
)

// Route to view projects
router.get(
  "/view-all",
  isAuthenticated,
  async (req: Request, res: Response) => {
    const queryForAdmin = `
        SELECT 
            p.*,
            projectOwner.FullName AS projectOwnerName,
            projectOwner.Email,
            cb.FullName AS CreatedByName,
            ub.FullName AS UpdatedByName
        FROM Project p
        LEFT JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
        LEFT JOIN User cb ON p.CreatedByID = cb.UserID
        LEFT JOIN User ub ON p.UpdatedByID = ub.UserID
        ORDER BY p.CreatedDate DESC `
    const queryForProjectOwner = ` 
    SELECT 
            p.*,
            projectOwner.FullName AS projectOwnerName,
            projectOwner.Email,
            cb.FullName AS CreatedByName,
            ub.FullName AS UpdatedByName
        FROM Project p
        LEFT JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
        LEFT JOIN User cb ON p.CreatedByID = cb.UserID
        LEFT JOIN User ub ON p.UpdatedByID = ub.UserID
        WHERE p.IsDeleted = 0
        AND p.ProjectOwnerID = ?
        ORDER BY p.CreatedDate DESC  
        `
    const queryForPhotographerViewing = 
    `
    SELECT 
            p.*,
            projectOwner.FullName AS projectOwnerName,
            projectOwner.Email,
            cb.FullName AS CreatedByName,
            ub.FullName AS UpdatedByName
        FROM Project p
        LEFT JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
        LEFT JOIN User cb ON p.CreatedByID = cb.UserID
        LEFT JOIN User ub ON p.UpdatedByID = ub.UserID
        JOIN  ProjectUserPhotographyLink pupl ON p.ProjectID = pupl.ProjectID
        WHERE p.IsDeleted = 0
        AND pupl.PhotographerID = ?
        ORDER BY p.CreatedDate DESC  
    `
    const queryForPhotographersInTheRespectiveProjects = `
    SELECT
        pupl.ProjectID,
        GROUP_CONCAT(DISTINCT user.FullName SEPARATOR ', ') as photographersNames
    FROM ProjectUserPhotographyLink pupl JOIN User user ON user.UserID = pupl.PhotographerID
    GROUP BY pupl.ProjectID 
    ORDER BY pupl.ProjectID    `

    const user = req.session.passport.user
    const query = user.UserType == userTypesEnumeration().admin 
    ? queryForAdmin 
    : (user.UserType == userTypesEnumeration().projectOwner 
      ? queryForProjectOwner 
      : queryForPhotographerViewing)
    const userID = user.UserType != "admin" ? [user.UserID] : []

    const photographersTemp1: any = (
      await db.query(queryForPhotographersInTheRespectiveProjects, [user.UserID])
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
    )
    const photographersTemp2 = photographersTemp1[0]
    const photographers: any = {}
    for (var x of photographersTemp2)
      photographers[x.ProjectID] = x.photographersNames

    const temp = await db.query(query, [userID])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const result = temp[0]
    if (result.length === 0)
      return res.render("project/view-all", {
        projects: [],
        message: "No projects found",
        currentUser: user,
      })

    res.render("project/view-all", {
      projects: result,
      currentUser: user,
      photographers: photographers,
      title: "Projects Dashboard", // Add title here
    })

  }
)

router.get(
  "/view/:projectID",
  checkIfParamIsPositiveInteger,
  isAuthenticated,
  async (req: Request, res: Response) => {
    const projectID = req.params.projectID
    const query = `
    SELECT
        p.*,
        projectOwner.FullName AS projectOwnerName,
        p.ProjectStatus AS statusName,
        creator.Email AS CreatorEmail,
        creator.FullName AS CreatorName,
        updater.Email AS UpdaterEmail,
        updater.FullName AS UpdaterName
    FROM Project p
    LEFT JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
    LEFT JOIN User creator ON p.CreatedByID = creator.UserID
    LEFT JOIN User updater ON p.UpdatedByID = updater.UserID
    WHERE p.ProjectID = ?    `
    const photographersQuery = `SELECT user.FullName, user.UserID FROM ProjectUserPhotographyLink pupl 
        JOIN User user ON user.UserID = pupl.PhotographerID
        WHERE pupl.ProjectID = ? 
        AND user.IsDeleted = 0`
    const imagingPlatformsQuery = `
    SELECT ImagingPlatform FROM ImagingPlatformInstance WHERE ProjectID = ? `
    const newlyCreatedPhotographers = req.session.newlyCreatedPhotographers
    req.session.newlyCreatedPhotographers = []
    req.session.save()


    const photographersTemp1: any = (
      await db.query(photographersQuery, [projectID])
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
    )
    const photographersTemp2 = photographersTemp1[0]
    const photographers: any[] = []
    for (var x of photographersTemp2)
      photographers.push(x.FullName + " (ID: " + x.UserID.toString() + ")")

    const imagingPlatformsTemp1: any = (
      await db.query(imagingPlatformsQuery, [projectID])
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
    )
    const imagingPlatformsTemp2 = imagingPlatformsTemp1[0]
    const imagingPlatforms: any[] = []
    for (const x of imagingPlatformsTemp2)
      imagingPlatforms.push(x.ImagingPlatform)

    const results = await db.query(query, [projectID])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })

    // Format dates for display
    const project = {
      ...results[0][0],
      CreatedDate: formatDisplayDate(results[0][0].CreatedDate),
      ImagingStartDate: formatDisplayDate(results[0][0].ImagingStartDate),
      ImagingEndDate: formatDisplayDate(results[0][0].ImagingEndDate),
      UpdatedDate: results[0][0].UpdatedDate
        ? formatDisplayDate(results[0][0].UpdatedDate)
        : null,
      photographers:
        photographers.length != 0
          ? photographers.toString().replace(",", ", ")
          : "Not Specified",
      imagingPlatforms:
        imagingPlatforms.length != 0
          ? imagingPlatforms.toString().replace(",", ", ")
          : "Not Specified",
    }
    console.log('results', results)
    res.render("project/view", {
      project: project,
      currentUser: req.session.passport.user,
      newlyCreatedPhotographers: newlyCreatedPhotographers
        ? newlyCreatedPhotographers
        : [],
      title: "View Project", // Add title here
    })
  }
)

router.get(
  "/edit/:projectID",
  checkIfParamIsPositiveInteger,
  isAuthenticated,
  isAdminOrProjectOwner,
  async (req: Request, res: Response) => {
    const projectID = req.params.projectID
    const projectAndOwnerQuery = `
            SELECT p.*, projectOwner.FullName, projectOwner.Email            
            FROM Project p        
            LEFT JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID  
            WHERE p.ProjectID = ? 
            AND (projectOwner.IsDeleted = 0 OR  projectOwner.UserID IS NULL)
            AND p.IsDeleted = 0 `
    const getProjectOwners = `
            SELECT u.UserID,u.FullName, u.Email, u.UserType 
            FROM User u
            WHERE u.UserType ='projectOwner' AND (u.IsDeleted = 0 OR u.UserID = NULL)`
    const getImagingPlatformsQuery = `SELECT ImagingPlatform FROM ImagingPlatformInstance 
                                        WHERE ProjectID = ? ORDER BY ImagingPlatform`
    const getSelectedPhotographersQuery = `SELECT user.UserID  FROM ProjectUserPhotographyLink p 
                                              LEFT JOIN User user on user.UserID = p.PhotographerID 
                                              WHERE p.ProjectID = ? AND user.IsDeleted = 0`
    const isUserRegistrationEnabledQuery = 'SELECT IsEnabled FROM IsUserRegistrationEnabled'
    const allPhotographersQuery = `SELECT UserID,FullName FROM User 
                                    WHERE UserType!= 'admin' AND IsDeleted = 0`
    const currentlySelectedPhotographers: string[] = []
    const imagingPlatforms: any[] = []

    // Get all needed data in parallel for better performance

    const [
      projectAndOwnerResults,
      imagingPlatformTemp,
      selectedPhotographersTemp,
      allPhotographers,
      projectOwners,
      isUserRegistrationEnabledResults
    ]: [any, any, any, any, any, any] = await Promise.all([
      db.query(projectAndOwnerQuery, [projectID]),
      db.query(getImagingPlatformsQuery, [projectID]),
      db.query(getSelectedPhotographersQuery, [projectID]),
      db.query(allPhotographersQuery),
      db.query(getProjectOwners),
      db.query(isUserRegistrationEnabledQuery)
    ])
      .then((results) => { return results })
      .catch((e) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
        return null
      })
    const isUserRegistrationEnabled = (isUserRegistrationEnabledResults)[0][0].IsEnabled
    if (projectAndOwnerResults[0].length == 0)
      return res
        .status(400)
        .json({ message: "no projects and their owners not found" })
    for (var i of selectedPhotographersTemp[0])
      currentlySelectedPhotographers.push(i.UserID)
    for (const i of imagingPlatformTemp[0])
      imagingPlatforms.push(Object.values(i)[0])

    // Format dates for display
    const project = {
      ...projectAndOwnerResults[0][0],
      CreatedDate: formatDisplayDate(projectAndOwnerResults[0][0].CreatedDate),
      ImagingStartDate: formatDisplayDate(
        projectAndOwnerResults[0][0].ImagingStartDate
      ),
      ImagingEndDate: formatDisplayDate(projectAndOwnerResults[0][0].ImagingEndDate),
    }
    res.render(`project/edit`, {
      project: project,
      allPhotographers: allPhotographers[0],
      selectedPhotographers: currentlySelectedPhotographers,
      statuses: Object.values(projectStatusEnumeration()),
      projectTypes: req.session.projectTypes,
      imagingPlatforms: req.session.imagingPlatforms,
      selectedImagingPlatforms: imagingPlatforms,
      currentUser: req.session.passport.user,
      title: "Edit Project", // Add title here
      newlyCreatedPhotographers: [],
      projectOwners: projectOwners[0],
      isUserRegistrationEnabled
    })

  }
)

router.post(
  "/edit/:projectID",
  isAuthenticated,
  isAdminOrProjectOwner,
  async (req: Request, res: Response) => {
    const projectID: string = req.params.projectID
    const isUserRegistrationEnabledQuery = 'SELECT IsEnabled FROM IsUserRegistrationEnabled'
    const temp1 = await db
      .query(isUserRegistrationEnabledQuery)
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const isUserRegistrationEnabled = temp1[0][0].IsEnabled

    const userID = req.session.passport.user.UserID
    if (!req.session.passport.user || !userID)
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      })

    const {
      projectName,
      projectType,
      imagingStartDate,
      imagingEndDate,
      summaryOfProject,
      detailsOfSpecimens,
      projectStatus,
      projectOwnerID,
      selectedImagingPlatforms: newlySelectedImagingPlatforms,
      selectedPhotographers: newlySelectedPhotographers,
      toBeCreatedPhotographers,
    } = req.body
    // === 1. VALIDATION ===
    if (!imagingStartDate || !imagingEndDate || !projectStatus)
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" })

    if (
      newlySelectedImagingPlatforms.length == 0 ||
      (newlySelectedImagingPlatforms.length == 1 &&
        newlySelectedImagingPlatforms[0] == "")
    )
      return res
        .status(400)
        .json({ success: false, message: "No Selected Imaging Platforms" })
    if (newlySelectedPhotographers.length == 0)
      return res
        .status(400)
        .json({ success: false, message: "no Selected Photographers" })
    if (!newlySelectedPhotographers.includes(projectOwnerID.toString()))
      return res.status(400).json({
        success: false,
        message: "Photographers must include him or herself.",
      })
    // Date validation
    const startDate = new Date(imagingStartDate)
    const endDate = new Date(imagingEndDate)
    if (isNaN(startDate.getTime()))
      return res
        .status(400)
        .json({ success: false, message: "Invalid start date format" })
    if (isNaN(endDate.getTime()))
      return res
        .status(400)
        .json({ success: false, message: "Invalid end date format" })
    if (startDate >= endDate)
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      })
    for (const x of toBeCreatedPhotographers) {
      if (!emailRegex.test(x[1]))
        return res.status(400).json({
          success: false,
          message:
            "there is at least a photographer with email of the wrong format",
        })
      if (x[0] == "" || !x[0])
        return res.status(400).json({
          success: false,
          message: "there is at least a photographer with missing full name ",
        })
    }

    //creation of new photographers
    if (isUserRegistrationEnabled) {
      const newlyCreatedPhotographers: { email: string; password: string }[] =
        []
      for (const x of toBeCreatedPhotographers) {
        const fullName = x[0]
        const email = x[1]
        const newPasswordSalt = crypto.randomBytes(16).toString()
        const newPassword = Buffer.from(crypto.randomBytes(4)).toString('hex') // TODO: switch to this in production
        // const newPassword = "1" // For testing only
        const saltedPassword = crypto.pbkdf2Sync(
          newPassword,
          newPasswordSalt,
          310000,
          32,
          "sha256"
        )
        const insertUserQuery = `
            INSERT INTO User temp
            (Email, SaltedPassword,PasswordSalt,  UserType, RegisteredDate,
              UpdatedDate,FullName,ContactNumber,Comments)
            VALUES (?, ?,?,  ?, NOW(),NOW(),  ?,?,?)`
        const params = [
          email,
          saltedPassword,
          newPasswordSalt,
          userTypesEnumeration().photographerOnly,
          fullName,
          "",
          "",
        ]

        const temp = await db.query(insertUserQuery, params)
          .catch((err: any) => {
            console.error(err)
            const condition = err.toString().toLowerCase().includes("duplicate") &&
              err.toString().toLowerCase().includes("email")
            if (condition) {
              const msg = "email already existed in the database."
              res.status(400).json({ success: false, message: msg })
            } else
              res.status(500).json({ success: false, error: err })
          })
        const result = temp[0]
        const o: any = result
        const insertedID = Object.values(o)[2].toString() //the weird way of getting insertedId
        newlyCreatedPhotographers.push({
          email: email,
          password: newPassword,
        })
        for (let x = 0; x < newlySelectedPhotographers.length; x++)
          if (emailRegex.test(newlySelectedPhotographers[x])) {
            newlySelectedPhotographers[x] = insertedID
            break
          }

      }
      req.session["newlyCreatedPhotographers"] = newlyCreatedPhotographers
      req.session.save()
    }
    // imaging Platforms operations for updating enum if any
    // var hasNewImagingPlatform = false
    // for (const i of selectedImagingPlatforms) {
    //   if (
    //     i != null &&
    //     i != "" &&
    //     !req.session["imagingPlatforms"].includes(i)
    //   ) {
    //     console.log("adding ", i)
    //     req.session["imagingPlatforms"].push(i)
    //     hasNewImagingPlatform = true
    //   }
    // }
    // if (hasNewImagingPlatform) {
    //   const i2: string[] = req.session.imagingPlatforms
    //   console.log(i2)
    //   await db
    //     
    //     .query("ALTER TABLE Media MODIFY COLUMN `ImagingPlatform` enum(?)", [
    //       i2,
    //     ])
    //   await db
    //     
    //     .query<RowDataPacket[]>(
    //       "ALTER TABLE ImagingPlatformInstance MODIFY COLUMN `ImagingPlatform` enum(?)",
    //       [i2]
    //     )
    // }

    // project Type operations for updating enum if any
    // const projectType = req.body.projectType
    // if (
    //   projectType != null &&
    //   projectType != "" &&
    //   !req.session["projectTypes"].includes(projectType)
    // )
    //   req.session["projectTypes"].push(projectType)

    // const i3: string[] = req.session.projectTypes
    // console.log(i3)
    // await db
    //   
    //   .query("ALTER TABLE Project MODIFY COLUMN `ProjectType` enum(?)", [i3])

    /// IMAGING PLATFORMS OPERATIONS START
    const selectImagingQuery = `
        SELECT ImagingPlatform FROM ImagingPlatformInstance WHERE ProjectID = ?`
    const temp6: any = (
      await db.query(selectImagingQuery, [projectID])
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
    )
    const temp = temp6[0]
    const currentSelectedImagingPlatforms: string[] = []
    for (var x of temp)
      currentSelectedImagingPlatforms.push(x.ImagingPlatform)


    //Getting differences
    const temp2 = newlySelectedImagingPlatforms.filter(
      (e: any) => !currentSelectedImagingPlatforms.includes(e)
    )
    const imagingPlatformsToBeAdded: string[][] = []
    for (x of temp2)
      imagingPlatformsToBeAdded.push([x, projectID])

    const imagingPlatformsToBeRemoved: any =
      currentSelectedImagingPlatforms.filter(
        (e: any) => !newlySelectedImagingPlatforms.includes(e)
      )

    //the update
    if (imagingPlatformsToBeRemoved.length != 0)
      await db
        .query(
          "DELETE FROM ImagingPlatformInstance WHERE ImagingPlatform in (?) AND ProjectID =?",
          [imagingPlatformsToBeRemoved, projectID]
        )
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })

    if (imagingPlatformsToBeAdded.length != 0)
      await db
        .query(
          "INSERT INTO ImagingPlatformInstance(ImagingPlatform,ProjectID) VALUES ? ",
          [imagingPlatformsToBeAdded]
        )
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })

    /// IMAGING PLATFORMS OPERATIONS END

    /// Photographers OPERATIONS START
    const selectPhotographerQuery = `
        SELECT PhotographerID FROM ProjectUserPhotographyLink WHERE ProjectID = ?`

    const temp3: any = (
      await db
        .query(selectPhotographerQuery, [projectID])
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
    )
    const temp5: any = temp3[0]
    var currentSelectedPhotographers: string[] = []
    for (const x of temp5)
      currentSelectedPhotographers.push(x.PhotographerID.toString())

    //Getting differences
    const temp4 = newlySelectedPhotographers.filter(
      (e: any) => !currentSelectedPhotographers.includes(e)
    )
    const photographersToBeAdded: string[][] = []
    for (const x of temp4)
      photographersToBeAdded.push([x, projectID.toString()])
    const photographersToBeRemoved: string[] =
      currentSelectedPhotographers.filter(
        (e: any) => !newlySelectedPhotographers.includes(e)
      )

    //the update
    if (photographersToBeRemoved.length != 0)
      await db
        .query(
          "DELETE FROM ProjectUserPhotographyLink WHERE PhotographerID in (?) AND ProjectID =?",
          [photographersToBeRemoved, projectID]
        ).catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
    if (photographersToBeAdded.length != 0)
      await db
        .query(
          "INSERT INTO ProjectUserPhotographyLink(PhotographerID,ProjectID) VALUES ? ",
          [photographersToBeAdded]
        ).catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
    /// Photographers OPERATIONS ENDquery

    // === 2. DATABASE UPDATE ===
    const updateQuery = `
        UPDATE Project
        SET
        projectName =?,
        ImagingStartDate = ?,
        ImagingEndDate = ?,
        SummaryofProject = ?,
        DetailsOfSpecimens = ?,
        ProjectStatus = ?,
        UpdatedByID = ?,
        UpdatedDate = NOW(),
        ProjectType = ?,
        ProjectOwnerID = ?
        WHERE ProjectID = ?`
    await db
      .query(updateQuery, [
        projectName,
        startDate,
        endDate,
        summaryOfProject || null,
        detailsOfSpecimens || null,
        projectStatus,
        req.session.passport.user.UserID,
        projectType == "" ? null : projectType,
        projectOwnerID,
        projectID,
      ]).catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })

    res.json({
      success: true,
      message: "project updated successfully",
      redirectUrl: `/project/view/${projectID}`,
    })

  }
)

// Soft Delete Request (POST)
router.post(
  "/delete/:projectID",
  isAuthenticated,
  isAdminOrProjectOwner,
  checkIfParamIsPositiveInteger,
  async (req: Request, res: Response) => {

    const projectID = req.params.projectID
    const query = `
        UPDATE Project
        SET
            IsDeleted = 1,
            UpdatedByID = ?,
            UpdatedDate = NOW()
        WHERE ProjectID = ?`
    await db.query(
      query,
      [req.session.passport.user.UserID, projectID],
    ).catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })
    res.redirect("/project/view-all")
  }
)

//undo soft delete
router.post(
  "/restore/:projectID",
  isAuthenticated,
  isAdminOrProjectOwner,
  checkIfParamIsPositiveInteger,
  async (req: Request, res: Response) => {
    const projectID = req.params.projectID
    const query = `
        UPDATE Project
        SET
            IsDeleted = 0,
            UpdatedByID = ?,
            UpdatedDate = NOW()
        WHERE ProjectID = ?    `
    await db.query(
      query,
      [req.session.passport.user.UserID, projectID],
    ).catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })

    res.redirect("/project/view-all")
  }
)

module.exports = router
