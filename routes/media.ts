const express = require("express")
const router = express.Router()
const db = require('./db')
const { isAuthenticated } = require("../middleware/auth")
import { param, validationResult } from "express-validator"
const {
  formatDisplayDate,
  userTypesEnumeration,
  mediaFileFormatEnumeration,
} = require("../middleware/utils")
const multer = require("multer")
import fs from "fs"
import { Response, Request } from "express"
const path = require("path")
const upload = multer({ dest: "upload-bulk-metadata/" })

import pl, { Null } from "nodejs-polars"

router.get("/create", isAuthenticated, async (req: Request, res: Response) => {
  const user = req.session.passport.user

  //--------------------------------------------------------------------------------
  const allProjectsQueryBase = ` SELECT  p.ProjectID, p.ProjectName
                    FROM Project p\n`
  // list projects based on user type,
  // where non admins will only get projects that they photographs or owns.
  const allProjectsQuery =
    user.UserType != userTypesEnumeration().admin
      ? allProjectsQueryBase +
      `JOIN ProjectUserPhotographyLink pupl ON pupl.ProjectID = p.ProjectID
        WHERE pupl.PhotographerID = ` + user.UserID
      : allProjectsQueryBase
  const temp1 = await db.query(allProjectsQuery)
    .catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })
  const allProjects = temp1[0]

  //--------------------------------------------------------------------------------
  const projectPhotographersQuery = `
    SELECT pupl.PhotographerID, u.FullName, p.ProjectID, p.ProjectName, p.ProjectOwnerID 
    FROM ProjectUserPhotographyLink pupl 
    JOIN User u ON u.UserID = pupl.PhotographerID
    JOIN Project p on p.ProjectID = pupl.ProjectID
    WHERE u.IsDeleted = 0 
    AND p.IsDeleted = 0`
  const projectPhotographersQuery2 =
    user.UserType == userTypesEnumeration().photographerOnly
      ? projectPhotographersQuery +
      `\n AND pupl.PhotographerID = ` + user.UserID + `
         \n ORDER BY p.ProjectID `
      : user.UserType == userTypesEnumeration().projectOwner
        ? projectPhotographersQuery + `\n AND p.ProjectOwnerID= ` + user.UserID
        + `\n ORDER BY p.ProjectID `
        : projectPhotographersQuery + `\nORDER BY p.ProjectID `

  const temp2 = await db.query(projectPhotographersQuery2,).catch((e: any) => {
    console.error(e)
    res.status(500).json({ error: e, success: false })
  })
  const projectPhotographers = temp2[0]

  res.render("media/create", {
    currentUser: req.session.passport.user,
    imageEditingTools: req.session["imageEditingTools"],
    imagingPlatforms: req.session["imagingPlatforms"],
    fileFormats: Object.values(mediaFileFormatEnumeration()),
    title: "Media Form",
    allProjects,
    projectPhotographers
  })
})

router.post("/create", isAuthenticated, async (req: Request, res: Response) => {

  const {
    fileName,
    filePath,
    catalogID,
    morphoID,
    clusterID,
    imagingDate,
    resolution,
    fileSizeBytes,
    fileFormat,
    description,
    imagingPlatform,
    imageEditingTool,
    comments,
    projectID,
    photographerID,
  } = req.body

  const createdBy = req.session.passport.user.UserID
  const updatedBy = createdBy

  // Validation: required fields
  const missingFields = []
  if (!photographerID)
    missingFields.push("projectAndPhotographerPair")
  if (!projectID) missingFields.push("fileName")
  if (!fileName) missingFields.push("fileName")
  if (!filePath) missingFields.push("filePath")
  if (!catalogID) missingFields.push("catalogID")
  if (!morphoID) missingFields.push("morphoID")
  if (!description) missingFields.push("description")

  if (missingFields.length > 0)
    return res.status(400).json({
      success: false,
      message: "Missing required fields: " + missingFields.join(", "),
    })

  const insertQuery = `
      INSERT INTO Media(
            ProjectID,
            PhotographerID,
            FileName,
            FilePath,
            CatalogID,
            MorphoID,
            ClusterID,
            ImagingDate,
            Resolution,
            FileSizeBytes,
            FileFormat,
            Description,
            imagingPlatform,
            ImageEditingTool,
            Comments,
            CreatedDate,
            CreatedByID,
            UpdatedDate,
            UpdatedByID
        ) VALUES(?,  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(),?)`
  const values = [
    projectID,
    photographerID,
    fileName,
    filePath,
    catalogID,
    morphoID,
    clusterID || null,
    imagingDate,
    resolution || null,
    fileSizeBytes,
    fileFormat,
    description || null,
    imagingPlatform,
    imageEditingTool,
    comments || null,
    createdBy,
    updatedBy,
  ]

  const temp1: any = await db.query(insertQuery, values)
    .catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })
  const result = temp1[0]
  res.json({
    success: true,
    message: "Media metadata successfully created",
    redirectUrl: `/media/view/${result.insertId} `,
  })

})

router.get(
  "/view-all",
  isAuthenticated,
  async (req: Request, res: Response) => {
    const user = req.session.passport.user

    const temp =
      await db.query(
        `SELECT * 
        FROM ProjectUserPhotographyLink pupl 
        RIGHT JOIN Project p ON p.ProjectID = pupl.ProjectID
        WHERE pupl.PhotographerID = ? OR p.ProjectOwnerID = ?
        AND p.IsDeleted = 0 LIMIT 1`,
        [user.UserID, user.UserID]
      ).catch((error: { message: any }) => {
        console.error("db query errror:", error)
        return res.status(500).json({
          success: false,
          message: "Server error during media submission.",
          error: error.message,
        })
      })
    const anyLinks = temp[0]

    res.render("media/view-all", {
      title: "Media Management",
      currentUser: user,
      disableCreateMedia:
        anyLinks.length == 0
        && user.UserType != userTypesEnumeration().admin,
    })
  }
)

// Datatables server side processing
router.post("/view-all-processing", isAuthenticated, async (req: Request, res: Response) => {
  const baseQuery = `
      SELECT 
        m.MediaID,
        m.MorphoID,
        m.CatalogID,
        m.ImagingDate,
        m.IsDeleted,
        m.Resolution,
        p.ProjectName,
        photographer.FullName As photographerName
      FROM Media m
      LEFT JOIN Project p ON m.ProjectID = p.ProjectID
      LEFT JOIN User photographer ON m.PhotographerID = photographer.UserID  `
  var totalCountQuery = `
      SELECT 
      COUNT(*)
      FROM Media m
      LEFT JOIN Project p ON m.ProjectID = p.ProjectID
      LEFT JOIN User photographer ON m.PhotographerID = photographer.UserID  `
  var filteredCountQuery = totalCountQuery
  const user = req.session.passport.user
  var query: string = ""
  var filteredQuery = ""
  var results = Null
  var filteredResults = Null
  var filteredCount = -1
  var params = user.UserType == userTypesEnumeration().admin ? [] : [user.UserID]
  const isSearchTermEmpty = req.body.search.value == ''
  var searchTerm = req.body.search.value.toLowerCase().trim()
  // for filtering boolean keywords
  searchTerm = ['yes', 'ye', 'y', '1', 'true', 'tru', 'tr', 't'].includes(searchTerm)
    ? true : ['no', 'n', '0', 'false', 'fals', 'fal', 'fa', 'f'].includes(searchTerm) ? false : searchTerm

  //--------------------------BUILDING QUERY------------------------------------

  switch (user.UserType) {
    case userTypesEnumeration().admin:
      query = baseQuery
      break
    case userTypesEnumeration().projectOwner:
      const constraint1 = "\nWHERE   (p.ProjectOwnerID =? )  "
      query = baseQuery + constraint1
      totalCountQuery = totalCountQuery + constraint1
      filteredCountQuery = filteredCountQuery + constraint1
      break
    case userTypesEnumeration().photographerOnly:
      const constraint2 = "\nWHERE m.IsDeleted = 0 AND (m.PhotographerID =? )  "
      query = baseQuery + constraint2
      totalCountQuery = totalCountQuery + constraint2
      filteredCountQuery = filteredCountQuery + constraint2
      break
  }

  // SEARCH TERM PROCESSING
  if (!isSearchTermEmpty) {
    filteredQuery = user.UserType == userTypesEnumeration().admin ? query + ' \nWHERE' : query + "\n AND "
    filteredCountQuery = user.UserType == userTypesEnumeration().admin ? filteredCountQuery + ' \nWHERE' : filteredCountQuery + "\n AND "
    if ("not specified".includes(searchTerm.toString())) {
      var constraint1 = `
        m.MediaID  IS NULL OR
        m.MorphoID  IS NULL OR
        m.CatalogID  IS NULL OR
        m.ImagingDate  IS NULL OR
        m.IsDeleted  IS NULL OR
        m.Resolution  IS NULL OR
        p.ProjectName  IS NULL OR
        photographer.FullName  IS NULL `
      filteredQuery = filteredQuery + constraint1
      filteredCountQuery = filteredCountQuery + constraint1
    }
    else if (typeof searchTerm == 'boolean') {// if it is boolean
      filteredQuery = filteredQuery + ` m.IsDeleted = ? `
      filteredCountQuery = filteredCountQuery + ` m.IsDeleted = ?`
    }
    else {
      var constraint2 = `
        m.MediaID LIKE ? OR
        m.MorphoID LIKE ? OR
        m.CatalogID LIKE ? OR
        m.ImagingDate LIKE ? OR
        m.IsDeleted LIKE ? OR
        m.Resolution LIKE ? OR
        p.ProjectName LIKE ? OR
        photographer.FullName LIKE ? `
      filteredQuery = filteredQuery + constraint2
      filteredCountQuery = filteredCountQuery + constraint2
    }

    //searching thorugh 
    for (let i = 0; i < 8; i++)
      if (searchTerm == false || searchTerm == true)
        params.push(searchTerm)
      else
        params.push("%" + searchTerm + "%")

    if (req.body.order && req.body.order[0].name != 's')
      filteredQuery = filteredQuery + "\nORDER BY " + req.body.order[0].name + " " + req.body.order[0].dir
    filteredQuery = req.body.length
      ? filteredQuery + "\nLIMIT " + req.body.length + " OFFSET " + req.body.start
      : filteredQuery + "\nLIMIT 10"
    filteredResults = await db.query(filteredQuery, params).catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })
    const temp1 = await db.query(filteredCountQuery, params).catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })
    filteredCount = temp1[0][0]['COUNT(*)']

    // PROCESSING WITHOUT SEARCH TERM
  } else {
    if (req.body.order && req.body.order[0].name != 's')
      query = query + "\nORDER BY " + req.body.order[0].name + " " + req.body.order[0].dir
    query = req.body.length
      ? query + "\nLIMIT " + req.body.length + " OFFSET " + req.body.start
      : query + "\nLIMIT 10"
    results = await db.query(query, params).catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })
    for (const x of results[0])
      x['s'] = ""
  }

  const temp2 = await db.query(totalCountQuery, [user.UserID]).catch((e: any) => {
    console.error(e)
    res.status(500).json({ error: e, success: false })
  })
  const totalCount = temp2[0][0]["COUNT(*)"]

  res.json({
    draw: req.body.draw,
    recordsTotal: totalCount,
    recordsFiltered: isSearchTermEmpty ? totalCount : filteredCount,
    data: isSearchTermEmpty ? results[0] : filteredResults[0],
    error: ""
  })

})

router.get("/view/:mediaID", param('mediaID').isInt({ min: 1 }).withMessage("unknown ID"), isAuthenticated, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() })
  const mediaID = req.params.mediaID
  const query = `
    SELECT
        m.*,
        u1.Email AS CreatedByName,
        u2.Email AS UpdatedByName,
        photographer.FullName As photographerName,
        project.ProjectName as projectName
    FROM Media m
    LEFT JOIN User u1 ON m.CreatedByID = u1.UserID
    LEFT JOIN User u2 ON m.UpdatedByID = u2.UserID
    LEFT JOIN User photographer ON m.PhotographerID = photographer.UserID  
    LEFT JOIN Project project ON m.ProjectID = project.ProjectID
    WHERE m.MediaID = ? 
    ORDER BY m.CreatedDate DESC`

  const results = await db.query(query, [mediaID]).catch((e: any) => {
    console.error(e)
    res.status(500).json({ error: e, success: false })
  })
  console.log('imageing date', results[0][0].ImagingDate)
  res.render("media/view", {
    currentUser: req.session.passport.user,
    media: results[0][0], // Since we're querying by ID, we'll only get one record
    mediaID,
    title: "View Media",
  })
})

router.get(
  "/edit/:mediaID",
  param('mediaID').isInt({ min: 1 }).withMessage('unknown ID'),
  isAuthenticated,
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() })

    const mediaID = req.params.mediaID
    const user = req.session.passport.user
    // const allProjectAndPhotographerPairsQuery = `    Select pupl.ProjectID, photographer.UserID, 
    //       p.ProjectName as projectName, photographer.FullName as photographerName 
    //     FROM ProjectUserPhotographyLink pupl 
    //     JOIN Project p ON p.ProjectID = pupl.ProjectID 
    //     JOIN User photographer ON photographer.UserID = pupl.PhotographerID
    //     WHERE photographer.UserType != 'admin' 
    //     AND photographer.IsDeleted = 0
    //     AND p.IsDeleted = 0`

    // var q2: string
    // /**
    //  * retrieve project photographer pair based on user privilleges
    //  */
    // if (user.UserType == userTypesEnumeration().projectOwner)
    //   q2 = allProjectAndPhotographerPairsQuery + "\nAND p.ProjectOwnerID = ?"
    // else if (user.UserType == userTypesEnumeration().photographerOnly)
    //   q2 = allProjectAndPhotographerPairsQuery + "\nAND photographer.UserID = ?"
    // else q2 = allProjectAndPhotographerPairsQuery

    // const allProjectAndPhotographerPairs = (
    //   await db.query(q2, [user.UserID])
    // )[0]

    const allProjectsQueryBase = ` SELECT  p.ProjectID, p.ProjectName
                    FROM Project p\n`
    // list projects based on user type,
    // where non admins will only get projects that they photographs or owns.
    const allProjectsQuery =
      user.UserType != userTypesEnumeration().admin
        ? allProjectsQueryBase +
        `JOIN ProjectUserPhotographyLink pupl ON pupl.ProjectID = p.ProjectID
        WHERE pupl.PhotographerID = ` + user.UserID
        : allProjectsQueryBase
    const t = await db.query(allProjectsQuery)
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const allProjects = t[0]
    //--------------------------------------------------------------------------------
    const currentMediaQuery =
      `SELECT Media.*,
        projectOwner.FullName projectOwnerName,
        Project.ProjectName ,
        photographer.FullName as photographerName 
        FROM Media
        JOIN Project ON Media.ProjectID = Project.ProjectID
        JOIN User projectOwner ON Project.ProjectOwnerID = projectOwner.UserID
        JOIN User photographer ON photographer.UserID = Media.PhotographerID
        WHERE Media.MediaID = ` + mediaID
    const temp1: any[] = await db.query(currentMediaQuery).catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })
    const toBeEditedMedia = temp1[0][0]
    console.log(toBeEditedMedia)
    //--------------------------------------------------------------------------------
    const projectPhotographersQuery = `
    SELECT pupl.PhotographerID, u.FullName, p.ProjectID, p.ProjectName, p.ProjectOwnerID 
    FROM ProjectUserPhotographyLink pupl 
    JOIN User u ON u.UserID = pupl.PhotographerID
    JOIN Project p on p.ProjectID = pupl.ProjectID
    WHERE u.IsDeleted = 0 
    AND p.IsDeleted = 0
    `
    const projectPhotographersQuery2 =
      user.UserType == userTypesEnumeration().photographerOnly
        ? projectPhotographersQuery +
        `\n AND pupl.PhotographerID = ` + user.UserID + `
         \n ORDER BY p.ProjectID `
        : user.UserType == userTypesEnumeration().projectOwner
          ? projectPhotographersQuery + `\n AND p.ProjectOwnerID= ` + user.UserID
          + `\n ORDER BY p.ProjectID `
          : projectPhotographersQuery + `\nORDER BY p.ProjectID `
    const temp2 = await db.query(projectPhotographersQuery2,).catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })
    const projectPhotographers = temp2[0]
    res.render("media/edit", {
      currentUser: req.session.passport.user,
      imageEditingTools: req.session["imageEditingTools"],
      imagingPlatforms: req.session["imagingPlatforms"],
      allProjects,
      fileFormats: Object.values(mediaFileFormatEnumeration()),
      toBeEditedMedia,
      toBeEditedImagingDate: toBeEditedMedia.ImagingDate === null ? null : formatDisplayDate(toBeEditedMedia.ImagingDate),
      title: "Media Form",
      projectPhotographers,
    })
  }
)

// Controller for handling form submission
router.post("/edit", isAuthenticated, async (req: Request, res: Response) => {
  const mediaData = req.body
  // Update existing media
  const query = `UPDATE Media SET
                  FileName = ?,
                  FilePath = ?,
                  CatalogID = ?,
                  MorphoID = ?,
                  ClusterID = ?,
                  ImagingDate = ?,
                  Resolution = ?,
                  FileSizeBytes = ?,
                  FileFormat = ?,
                  Description = ?,
                  ImagingPlatform = ?,
                  ImageEditingTool = ?,
                  Comments = ?,
                  UpdatedDate = NOW(),
                  UpdatedByID = ?,
                  ProjectID =?,
                  PhotographerID = ?
                  WHERE MediaID = ?`
  const updatedBy = req.session.passport.user.UserID
  const params = [
    mediaData.fileName,
    mediaData.filePath,
    mediaData.catalogID,
    mediaData.morphoID,
    mediaData.clusterID,
    mediaData.imagingDate,
    mediaData.resolution,
    mediaData.fileSizeBytes,
    mediaData.fileFormat,
    mediaData.description,
    mediaData.imagingPlatform,
    mediaData.imageEditingTool,
    mediaData.comments,
    updatedBy, // current user making the update
    mediaData.projectID,
    mediaData.photographerID,
    mediaData.MediaID,
  ]

  await db.query(query, params).catch((e: any) => {
    console.error(e)
    res.status(500).json({ error: e, success: false })
  })

  res.json({
    success: true,
    message: "successfully edited media",
    redirectUrl: "/media/view/" + mediaData.MediaID,
  })
})

// Soft delete media by setting IsDelete = 1 and redirect
router.post(
  "/delete/:mediaID",
  param('mediaID').isInt({ min: 1 }).withMessage('unknown id'),
  isAuthenticated,
  (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() })

    const mediaID = req.params.mediaID
    const userID = req.session.passport.user.UserID

    // First verify the media exists and isn't already deleted
    // this could be replace with catching the error but just using what works from the previous developers
    const checkQuery =
      "SELECT * FROM Media WHERE MediaID = ? AND IsDeleted = 0"

    db.query(checkQuery, [mediaID])
      .then((results: (string | any[])[]) => {
        if (results[0].length === 0) {
          req.flash("error", "Media not found or already deleted")
          res.redirect("/media/view-all")
          return Promise.resolve(results)
        }

        const updateQuery = `
                UPDATE Media 
                SET IsDeleted = 1,
                    UpdatedByID = ?,
                    UpdatedDate = NOW() 
                WHERE MediaID = ?`

        return db.query(updateQuery, [userID, mediaID])
      })
      .then(() => res.redirect("/media/view-all"))
      .catch((error: any) => {
        console.error("❌ Error soft deleting media:", error)
        req.flash("error", "Error archiving media")
        res.redirect("/media/view-all")
        return Promise.resolve()
      })
  }
)

router.post(
  "/restore/:mediaID",
  param('mediaID').isInt({ min: 1 }).withMessage('unknown id'),
  isAuthenticated,
  (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() })

    const mediaID = req.params.mediaID
    const userID = req.session.passport.user.UserID

    // First verify the media exists and isn't already restored
    // this could be replace with catching the error but just using what works from the previous developers
    const checkQuery =
      "SELECT * FROM Media WHERE MediaID = ? AND IsDeleted = 1"

    db.query(checkQuery, [mediaID])
      .then((results: (string | any[])[]) => {
        if (results[0].length == 0) {
          req.flash("error", "Media not found or already restored")
          res.redirect("/media/view-all")
          return Promise.resolve(results)
        }

        const updateQuery = `
                UPDATE Media 
                SET IsDeleted = 0,
                    UpdatedByID = ?,
                    UpdatedDate = NOW() 
                WHERE MediaID = ?`

        return db.query(updateQuery, [userID, mediaID])
      })
      .then(() => {
        res.redirect("/media/view-all")
        return Promise.resolve()
      })
      .catch((error: any) => {
        console.error("❌ Error soft deleting media:", error)
        req.flash("error", "Error archiving media")
        res.redirect("/media/view-all")
        return Promise.resolve()
      })
  }
)

router.post("/bulk-delete", isAuthenticated, async (req: Request, res: Response) => {
  if (!Array.isArray(req.body))
    return res.status(400).json({ success: false, message: "request body is not an array" })
  if (req.body.length == 0)
    return res.status(400).json({ success: false, message: "request body array is empty" })
  for (const x of req.body) {
    if (isNaN(parseInt(x)))
      return res.status(400).json({ success: false, message: "request body contains non integers" })
    if (x <= 0)
      return res.status(400).json({ success: false, message: "request body contains  non positive integers" })
  }

  const userID = req.session.passport.user.UserID
  const updateQuery = `
                UPDATE Media 
                SET IsDeleted = 1,
                    UpdatedByID = ?,
                    UpdatedDate = NOW() 
                WHERE MediaID in (?)`

  await db.query(updateQuery, [userID, req.body]).catch((e: any) => {
    console.error(e)
    res.status(500).json({ error: e, success: false })
  })
  return res.status(200).json({ success: true, message: "successfully soft deleted selected metadata" })
})

router.post("/bulk-restore", isAuthenticated, async (req: Request, res: Response) => {
  if (!Array.isArray(req.body))
    return res.status(400).json({ success: false, message: "request body is not an array" })
  if (req.body.length == 0)
    return res.status(400).json({ success: false, message: "request body array is empty" })
  for (const x of req.body) {
    if (isNaN(parseInt(x)))
      return res.status(400).json({ success: false, message: "request body contains non integers" })
    if (x <= 0)
      return res.status(400).json({ success: false, message: "request body contains  non positive integers" })
  }

  const userID = req.session.passport.user.UserID
  const updateQuery = `
                UPDATE Media 
                SET IsDeleted = 0,
                    UpdatedByID = ?,
                    UpdatedDate = NOW() 
                WHERE MediaID in (?)`
  await db.query(updateQuery, [userID, req.body]).catch((e: any) => {
    console.error(e)
    res.status(500).json({ error: e, success: false })
  })
  return res.status(200).json({ success: true, message: "successfully restored selected metadata" })
})



router.get("/bulk-edit", isAuthenticated, async (req: Request, res: Response) => {
  const mediaIDs = req.query.array.toString().replace("[", "").replace("]", "").split(",")
  if (!Array.isArray(mediaIDs))
    return res.status(400).json({ success: false, message: "request query is not an array" })
  if (mediaIDs.length == 0)
    return res.status(400).json({ success: false, message: "request query array is empty" })
  for (const x1 of mediaIDs) {
    const x2 = parseInt(x1.toString())
    if (isNaN(x2))
      return res.status(400).json({ success: false, message: "request query contains non integers" })
    if (x2 <= 0)
      return res.status(400).json({ success: false, message: "request query contains  non positive integers" })
  }
  const user = req.session.passport.user
  const allProjectsQueryBase = ` SELECT  p.ProjectID, p.ProjectName
                                FROM Project p\n`
  // list projects based on user type,
  // where non admins will only get projects that they photographs or owns.
  const allProjectsQuery =
    user.UserType != userTypesEnumeration().admin
      ? allProjectsQueryBase +
      `JOIN ProjectUserPhotographyLink pupl ON pupl.ProjectID = p.ProjectID
        WHERE pupl.PhotographerID = ` + user.UserID
      : allProjectsQueryBase
  const temp1 = await db.query(allProjectsQuery).catch((e: any) => {
    console.error(e)
    res.status(500).json({ error: e, success: false })
  })
  const allProjects = temp1[0]

  const projectPhotographersQuery = `
    SELECT pupl.PhotographerID, u.FullName, p.ProjectID, p.ProjectName, p.ProjectOwnerID 
    FROM ProjectUserPhotographyLink pupl 
    JOIN User u ON u.UserID = pupl.PhotographerID
    JOIN Project p on p.ProjectID = pupl.ProjectID
    WHERE u.IsDeleted = 0 
    AND p.IsDeleted = 0`
  const projectPhotographersQuery2 =
    user.UserType == userTypesEnumeration().photographerOnly
      ? projectPhotographersQuery +
      `\n AND pupl.PhotographerID = ` + user.UserID + `
         \n ORDER BY p.ProjectID `
      : user.UserType == userTypesEnumeration().projectOwner
        ? projectPhotographersQuery + `\n AND p.ProjectOwnerID= ` + user.UserID
        + `\n ORDER BY p.ProjectID `
        : projectPhotographersQuery + `\nORDER BY p.ProjectID `
  const temp2 = await db.query(projectPhotographersQuery2).catch((e: any) => {
    console.error(e)
    res.status(500).json({ error: e, success: false })
  })
  const projectPhotographers = temp2[0]

  // const selectedMetadataQuery = "SELECT * FROM Media WHERE MediaID in (?)"
  // const selectedMetadata = (await db.query(selectedMetadataQuery,mediaIDs))[0]
  res.render("media/bulk-edit", {
    mediaIDs,
    currentUser: user,
    imageEditingTools: req.session["imageEditingTools"],
    imagingPlatforms: req.session["imagingPlatforms"],
    fileFormats: Object.values(mediaFileFormatEnumeration()),
    allProjects,
    projectPhotographers,
    // selectedMetadata
  })
})



router.post("/bulk-edit", isAuthenticated, async (req: Request, res: Response) => {
  const mediaIDs = req.body.mediaIDs
  const columns = ['catalogID',
    'morphoID',
    'clusterID',
    'imagingDate',
    'resolution',
    'fileSizeBytes',
    'fileFormat',
    'description',
    'imagingPlatform',
    'imageEditingTool',
    'comments',
    'projectID',
    'photographerID']
  const updatedBy = req.session.passport.user.UserID

  //building query and params
  var insertQuery = `Update Media SET `
  var params = []
  const reqBodyEntries = Object.entries(req.body)
  for (var i = 0; i < reqBodyEntries.length; i++) {
    const x = reqBodyEntries[i]
    if (x[1].toString().trim() == "" || !columns.includes(x[0])) continue
    insertQuery += " " + x[0] + " = ?,"
    params.push(x[1])
  }
  insertQuery += `
    UpdatedByID = ?,
    UpdatedDate = NOW()
    WHERE MediaID IN (?) AND IsDeleted = 0`
  params.push(updatedBy)
  params.push(mediaIDs.indexOf(',') > -1 ? mediaIDs.split(",") : mediaIDs)

  await db.query(insertQuery, params).catch((e: any) => {
    console.error(e)
    res.status(500).json({ error: e, success: false })
  })

  res.json({
    success: true,
    message: "Media metadatas successfully created",
    redirectUrl: `/media/view-all `,
  })

})



router.get(
  "/upload-bulk-metadata",
  isAuthenticated,
  async (req: Request, res: Response) => {
    const user = req.session.passport.user

    const allProjectsQueryBase = ` SELECT  p.ProjectID, p.ProjectName
                    FROM Project p\n`
    // list projects based on user type,
    // where non admins will only get projects that they photographs or owns.
    const allProjectsQuery =
      user.UserType != userTypesEnumeration().admin
        ? allProjectsQueryBase +
        `JOIN ProjectUserPhotographyLink pupl ON pupl.ProjectID = p.ProjectID
        WHERE pupl.PhotographerID = ` + user.UserID
        : allProjectsQueryBase
    const temp1 = await db.query(allProjectsQuery).catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })
    const allProjects = temp1[0]

    const projectPhotographersQuery = `
    SELECT pupl.PhotographerID, u.FullName, p.ProjectID, p.ProjectName, p.ProjectOwnerID 
    FROM ProjectUserPhotographyLink pupl 
    JOIN User u ON u.UserID = pupl.PhotographerID
    JOIN Project p on p.ProjectID = pupl.ProjectID
    WHERE u.IsDeleted = 0 
    AND p.IsDeleted = 0`
    const projectPhotographersQuery2 =
      user.UserType == userTypesEnumeration().photographerOnly
        ? projectPhotographersQuery +
        `\n AND pupl.PhotographerID = ` + user.UserID + `
         \n ORDER BY p.ProjectID `
        : user.UserType == userTypesEnumeration().projectOwner
          ? projectPhotographersQuery + `\n AND p.ProjectOwnerID= ` + user.UserID
          + `\n ORDER BY p.ProjectID `
          : projectPhotographersQuery + `\nORDER BY p.ProjectID `
    const temp2 = await db.query(projectPhotographersQuery2,).catch((e: any) => {
      console.error(e)
      res.status(500).json({ error: e, success: false })
    })
    const projectPhotographers = temp2[0]

    res.render("media/upload-bulk-metadata", {
      currentUser: user,
      allProjects,
      title: "Media Form",
      projectPhotographers,
    })
  }
)

router.post(
  "/upload-bulk-metadata/",
  upload.single("bulk-metadata"),
  isAuthenticated,
  async (req: Request, res: Response) => {
    const user = req.session.passport.user
    const overridingPhotographerID = req.body.photographerID
    const overridingProjectID = req.body.projectID
    const newTable: string[][] = []
    var newTableDF: pl.DataFrame = pl.DataFrame()
    var hasErrors = false
    const newImageEditingTools = []
    const uniqueFileNames = []

    //Conducts some validation for each row of the data.
    interface newRowColumnInterface {
      MorphoID: number
      CatalogID: number
      FileName: number
      FilePath: number
      FileSizeBytes: number
      FileFormat: number
      PhotographerID: number
      ImagingDate: number
      ImageEditingTool: number
      Description: number
      Resolution: number
      // ImagingPlatform: number
    }
    const newRowColumns: newRowColumnInterface = {
      MorphoID: 0,
      CatalogID: 1,
      FileName: 2,
      FilePath: 3,
      FileSizeBytes: 4,
      FileFormat: 5,
      PhotographerID: 6,
      ImagingDate: 7,
      ImageEditingTool: 8,
      Description: 9,
      Resolution: 10,
      // ImagingPlatform: 11,
    }
    const absolutePath = path
      .join(__dirname, req.file.path)
      .replace("/routes", "")
    const jsonString = fs.readFileSync(absolutePath, "utf-8")
    const newRowsTemp = jsonString.split("\n").slice(1)
    fs.rm(absolutePath, (err: any) => {
      if (err) {
        console.error(err.message)
        return
      }
    })

    const tempListOfFileNames1 =
      await db.query("SELECT DISTINCT FileName FROM Media WHERE IsDeleted = 0")
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
    const tempListOfFileNames2: any = tempListOfFileNames1[0]
    const listOfFileNamesFromDB: any[] = []
    for (const x of tempListOfFileNames2)
      listOfFileNamesFromDB.push(x.FileName)

    const tempListOfLinks1 =
      await db.query(`SELECT DISTINCT * FROM ProjectUserPhotographyLink pupl
              JOIN User u ON u.UserID = pupl.PhotographerID
              JOIN Project p ON p.ProjectID = pupl.ProjectID
              WHERE u.IsDeleted = 0 AND p.IsDeleted = 0`)
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
    const tempListOfLinks2: any = tempListOfLinks1[0]
    const listOfPhotographerProjectLinks: any[][] = []
    for (const x of tempListOfLinks2)
      listOfPhotographerProjectLinks.push([x.PhotographerID, x.ProjectID])

    function checkProjectPhotographerLink(listOfPhotographerProjectLinks: any[][],
      photographerID: number, projectID: number, errorMessage: string = "") {
      var matched = false
      for (const x of listOfPhotographerProjectLinks)
        if (x[0] == photographerID && x[1] == projectID)
          return ""

      if (!matched)
        errorMessage = errorMessage +
          `The photographer (ID: ${photographerID}) is not in the selected project (ID: ${projectID}). 
                You may have selected the wrong project from the dropdown box 
                or the wrong photographer ID in the config.ini \n`
    }

    if (overridingPhotographerID != -1) {
      const msg = checkProjectPhotographerLink(listOfPhotographerProjectLinks,
        overridingPhotographerID,
        overridingProjectID)
      if (msg != "")
        return res.status(400).json({ success: false, message: msg })
    }


    //getting each row
    for (var i: number = 0; i < newRowsTemp.length; i++) {
      var newRowTempSplited = newRowsTemp[i].split(",")
      if (newRowTempSplited.length == 1 && newRowTempSplited[0] == "")
        continue

      const newRow: string[] = [overridingProjectID.toString()]
      const fileName = newRowTempSplited[newRowColumns.FileName]
      var errorMessage = ""
      // getting individual cells of the row.
      for (var j: number = 0; j < newRowTempSplited.length; j++) {
        const elementTemp = newRowTempSplited[j]
          .replaceAll('"', "")
          .replaceAll("'", "")
          .replaceAll(".", ".")
          .replaceAll(",", ",")
          .replaceAll("(", "(")
          .replaceAll(")", ")")
          .trim()
        var element = elementTemp == "" ? null : elementTemp

        //VALIDATION SWITCH CASES with check for new image editing tools
        switch (j) {
          case newRowColumns.FileName:
            const fileNameToCheck = newRowTempSplited[newRowColumns.FileFormat]

            function isValidFileName(filename: string, fileFormat: any) {
              if (!filename) return false
              const lower: string = filename.toLowerCase()
              if (!lower.endsWith(fileFormat)) return false
              if (lower.replace(fileFormat, "") == "") return false
              const x: string[] = Object.values(mediaFileFormatEnumeration())
              return x.some((value: string, index: number, array: string[]) =>
                lower.endsWith(value.toString())
              )
            }

            if (!isValidFileName(element!, fileNameToCheck)) {
              errorMessage = errorMessage +
                `The media file name '${fileNameToCheck}' must include a valid extension like ` +
                Object.values(mediaFileFormatEnumeration()) +
                `or it needs to match FileFormat value in the same row
                or your FileFormat value is wrong
                or there needs to be a file name before the file format\n`
              break
            }
            if (listOfFileNamesFromDB.includes(element)) {
              errorMessage = errorMessage +
                `There is already an existing entry in the database for the  FileName: '${element}' \n`
              break
            }
            if (!uniqueFileNames.includes(element))
              uniqueFileNames.push(element)
            else
              errorMessage = errorMessage +
                `There are duplicate FileName for '${element}' within this csv file.\n`
            break
          case newRowColumns.CatalogID:
            if (!/^[A-Z]{6}\d{7,8}$/.test(element!))
              errorMessage = errorMessage +
                `CatalogID '${element!}' is not in the correct format.\
                 Example of a correct format: ZRCBDP0012345. 
                 6 capital letters and then 7 numbers. \n`
            break
          case newRowColumns.ImagingDate:
            if (isNaN(new Date(element!).getTime()!) && element != null)
              errorMessage = errorMessage +
                `Invalid Imaging Date format. current value: ${element} \n`
            break
          case newRowColumns.Resolution:
            if (!/^\d{1,5}x\d{1,5}$/.test(element!) && element != null)
              errorMessage =
                errorMessage +
                `Resolution value: '${element}' is not in the correct format. 
                example format: 1440x720, the length and width should not be more than 5 digits. \n`
            break
          case newRowColumns.FileSizeBytes:
            if (isNaN(parseInt(element!)))
              errorMessage = errorMessage +
                `File size must be in integer, not float or decimal or any other characters. 
                Current Value: '${element}'\n`

            if (parseInt(element) <= 0)
              errorMessage = errorMessage +
                `File size must be a positive integer. Current Value: ${element} \n`
            break
          case newRowColumns.FileFormat:
            if (!Object.values(mediaFileFormatEnumeration()).includes(element))
              errorMessage = errorMessage +
                `Invalid file format: ${element}. The format should be any one of these: ` +
                Object.values(mediaFileFormatEnumeration()).toString() + "\n"
            break
          case newRowColumns.PhotographerID:
            element = overridingPhotographerID != -1 ? overridingPhotographerID : element
            if (isNaN(parseInt(element!))) {
              errorMessage = errorMessage +
                `Photographer ID must be in integer, not decimal or any other characters. 
                Current Value: '${element}'\n`
              break
            }
            if (parseInt(element) <= 0) {
              errorMessage = errorMessage +
                `PhotographerID must be a positive integer. Current Value: ${element} \n`
              break
            }
            checkProjectPhotographerLink(listOfPhotographerProjectLinks,
              parseInt(element),
              parseInt(overridingProjectID), errorMessage)
            break

          // case newRowColumns.ImagingPlatform:
          // checks for new Imaging platform to take note
          // if (
          //   !req.session.imagingPlatforms.includes(element!) &&
          //   !newImagingPlatforms.includes(element!) &&
          //   element != null &&
          //   element != ""
          // ) {
          //   newImagingPlatforms.push(element)
          // }
          // break
          case newRowColumns.ImageEditingTool:
            // checks for new image editing tools to take note
            if (
              !req.session.imageEditingTools.includes(element!) &&
              !newImageEditingTools.includes(element!) &&
              element != null &&
              element != ""
            ) newImageEditingTools.push(element)
            break
        }
        if (element == null) newRow.push(element!)
        else newRow.push(element.toString())
        if (errorMessage.trim() != "" && !hasErrors) hasErrors = true
      }
      newRow.push(new Date().toISOString().split("T")[0]) //created date
      newRow.push(user.UserID) // created by
      newRow.push(new Date().toISOString().split("T")[0]) //updated date
      newRow.push(user.UserID) //updated by
      const rowPl = pl.DataFrame({
        fileName: [errorMessage.trim() != "" ? fileName : ""],
        errorLog: [errorMessage],
      })
      newTable.push(newRow)
      newTableDF = pl.concat([newTableDF, rowPl])
    }
    if (hasErrors) {
      res.json({
        success: false,
        message:
          `Media metadata has contraints violations. 
          press okay to csv error log file with the error logs`,
        buffer: newTableDF.writeCSV(),
      })
      return
    }

    // START OF SECTION For adding new Image Editing Tools
    const allImageEditingTools =
      req.session["imageEditingTools"].concat(newImageEditingTools)

    //insert any new image editing tools or Image Platforms
    if (newImageEditingTools != null && newImageEditingTools.length != 0)
      await db
        .query("ALTER TABLE Media MODIFY COLUMN `ImageEditingTool` enum(?)",
          [allImageEditingTools])
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
    req.session["imageEditingTools"] = allImageEditingTools
    // const allImagingPlatforms =
    //   req.session["imagingPlatforms"].concat(newImagingPlatforms)
    // if (newImagingPlatforms != null && newImagingPlatforms.length != 0)
    //   await db
    //     
    //     .query("ALTER TABLE Media MODIFY COLUMN `ImagingPlatform` enum(?)", [
    //       allImagingPlatforms,
    //     ]) .catch((e: any) => {
    //   console.error(e)
    //   res.status(500).json({ error: e, success: false })
    // })
    // req.session["imagingPlatforms"] = allImagingPlatforms
    // END OF SECTION

    const insertQuery = `
      INSERT INTO Media(
            ProjectID,
            MorphoID, CatalogID,FileName, FilePath ,
            FileSizeBytes , FileFormat, PhotographerID ,
            ImagingDate , ImageEditingTool , Description, Resolution ,
            imagingPlatform,
            CreatedDate ,
            CreatedByID ,
            UpdatedDate ,
            UpdatedByID 
        ) VALUES ?`
    await db.query(insertQuery, [newTable])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })

    res.json({
      success: true,
      message: "Media metadata bulk upload successful",
      redirectUrl: "/media/view-all",
    })
  }
)

router.get("/download-template", isAuthenticated, async (req: any, res: Response) => {
  //helps to retrieve metadata template file for downloading.
  const filePath: string = "image metadata template for only one project.xlsx"
  res.download(filePath)
})

router.get("/download-pipeline-script", isAuthenticated, (req: Request, res: Response) => {
  res.download("pipeline.zip")
})

module.exports = router


