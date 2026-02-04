const express = require("express");
const router = express.Router();
// import { db } from "./db";
const db = require('./db')
const { isAuthenticated } = require("../middleware/auth");
import { param, query, validationResult } from "express-validator";
const {
  formatDisplayDate,
  userTypesEnumeration,
  mediaFileFormatEnumeration,
} = require("../middleware/utils");
const multer = require("multer");
import fs from "fs";
import { Response, Request } from "express";
const path = require("path");
const upload = multer({ dest: "upload-bulk-metadata/" });

import pl from "nodejs-polars";
//OLD
// router.get('/select-user-for/:mediaID/:projectID', isAuthenticated, async (req, res) => {
//     const mediaID = req.params.mediaID;
//     const projectID = req.params.projectID;
//     const isEdit = mediaID != 'create-mode';
//     const baseQuery = `
//             SELECT
//                 p.ProjectID,
//                 p.ProjectName,
//                 u.UserID AS user_id,
//                 u.FullName AS projectOwnerName,
//                 u.Email AS projectOwnerEmail,
//                 u.ContactNumber,
//                 u.StaffType,
//                 p.ImagingStartDate,
//                 p.ImagingEndDate
//             FROM Project p
//             JOIN User u ON p.ProjectOwnerID = u.UserID
//             WHERE
//                 u.IsDeleted = 0 AND
//                 p.IsDeleted = 0 AND
//       `;

//     const currentProjectQuery = `SELECT p.ProjectID,
//                         p.ProjectName,
//                         p.ProjectID
//                         FROM Project p
//                         WHERE p.ProjectID = ?  `;
//     const currentProject = isEdit
//         ? await db.query(currentProjectQuery, [projectID])
//         : null;
//     const query = req.session.passport.user.UserType != userTypesEnumeration().admin
//         ? baseQuery + " AND photographer.UserID = " + req.session.passport.user.UserID
//         : baseQuery
//     const query2 = isEdit
//         ? query + " AND photographer.UserID !=" + currentProject[0][0].photographerID
//         : query
//     const users = (await db.query(query2))[0];
//     console.log('isEdit', isEdit)
//     res.render('media/user-list', {
//         users: users,
//         currentUser: req.session.passport.user,
//         title: 'Media Image List',
//         isEdit: isEdit,
//         mediaID: mediaID,
//         currentProject: mediaID != 'create-mode' ? currentProject[0][0] : ""
//     });

// });

router.get("/create", isAuthenticated, async (req: Request, res: Response) => {
  /***
   * Select Only relevant project andd photographer pairs based on user typer
   */
  const allProjectAndPhotographerPairsQuery = `    Select pupl.ProjectID, photographer.UserID, 
          p.ProjectName as projectName, photographer.FullName as photographerName 
        FROM ProjectUserPhotographyLink pupl 
        JOIN Project p ON p.ProjectID = pupl.ProjectID 
        JOIN User photographer ON photographer.UserID = pupl.PhotographerID
        WHERE photographer.UserType != 'admin'
        `;
  const user = req.session.passport.user;
  var q2: string;

  if (user.UserType == userTypesEnumeration().projectOwner) {
    q2 = allProjectAndPhotographerPairsQuery + "AND p.ProjectOwnerID = ?";
  } else if (user.UserType == userTypesEnumeration().photographerOnly) {
    q2 = allProjectAndPhotographerPairsQuery + "AND photographer.UserID = ?";
  } else {
    q2 = allProjectAndPhotographerPairsQuery;
  }
  const allProjectAndPhotographerPairs = (
    await db.query(q2, [user.UserID])
  )[0];
  console.log(allProjectAndPhotographerPairs)
  res.render("media/create", {
    currentUser: req.session.passport.user,
    imageEditingTools: req.session["imageEditingTools"],
    imagingPlatforms: req.session["imagingPlatforms"],
    allProjectAndPhotographerPairs: allProjectAndPhotographerPairs,
    fileFormats: Object.values(mediaFileFormatEnumeration()),

    title: "Media Form",
  });
});
router.post("/create", isAuthenticated, async (req: Request, res: Response) => {
  try {
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
      projectAndPhotographerPair,
    } = req.body;

    console.log("📤 Media submission data:", req.body);
    const createdBy = req.session.passport.user.UserID;
    const updatedBy = createdBy;
    // Validation: required fields
    const missingFields = [];
    if (!projectAndPhotographerPair)
      missingFields.push("projectAndPhotographerPair");
    if (!fileName) missingFields.push("fileName");
    if (!filePath) missingFields.push("filePath");
    if (!catalogID) missingFields.push("catalogID");
    if (!morphoID) missingFields.push("morphoID");
    // if (!clusterID) missingFields.push("clusterID");
    // if (!imagingDate) missingFields.push("imagingDate");
    if (!description) missingFields.push("description");
    // if (!imagingPlatform) missingFields.push("imagingPlatform");

    const splitX = projectAndPhotographerPair.split(",");
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: " + missingFields.join(", "),
      });
    }

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
        ) VALUES(?,  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(),?)
        `;
    const projectID = splitX[0];
    const values = [
      projectID,
      splitX[1],
      fileName,
      filePath,
      catalogID || null,
      morphoID || null,
      clusterID || null,
      imagingDate || null,
      resolution || null,
      fileSizeBytes || null,
      fileFormat || null,
      description || null,
      imagingPlatform,
      imageEditingTool || null,
      comments || null,
      createdBy,
      updatedBy,
    ];

    const result: any = (
      await db.query(insertQuery, values)
    )[0];
    console.log("✅ Media submitted successfully, ID:", result.insertId);
    req.session.save();
    res.json({
      success: true,
      message: "Media metadata sucessfully created",
      redirectUrl: `/media/view/${result.insertId} `,
    });
  } catch (error: any) {
    console.error("❌ Media submission failed:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during media submission.",
      error: error.message,
    });
  }
});

router.get(
  "/view-all",
  isAuthenticated,
  async (req: Request, res: Response) => {
    const baseQuery = `
      SELECT 
        m.MediaID,
        m.MorphoID,
        m.FilePath,
        m.CatalogID,
        m.ImagingDate,
        m.Description,
        m.FileFormat,
        m.CreatedDate,
        m.IsDeleted,
        m.Resolution,
        p.ProjectID,
        p.ProjectName,
        photographer.FullName As photographerName
      FROM Media m
      LEFT JOIN Project p ON m.ProjectID = p.ProjectID
      LEFT JOIN User photographer ON m.PhotographerID = photographer.UserID  
    `;
    const user = req.session.passport.user;
    var query: string = "";
    /**
     * retrieve table data based on what user type
     * to show only relevant data and enforce authentication
     */
    switch (user.UserType) {
      case userTypesEnumeration().admin:
        query = baseQuery + "\nORDER BY m.CreatedDate DESC";
        break;
      case userTypesEnumeration().projectOwner:
        query =
          baseQuery +
          "\nWHERE (p.ProjectOwnerID =? )  ORDER BY m.CreatedDate DESC";
        // m.IsDeleted = 0 AND 
        break;
      case userTypesEnumeration().photographerOnly:
        query =
          baseQuery +
          "\nWHERE m.IsDeleted = 0 AND (m.PhotographerID =? )  ORDER BY m.CreatedDate DESC";
        break;
    }
    const anyLinks = (
      await db.query(
        `
        SELECT * 
        FROM ProjectUserPhotographyLink pupl 
        RIGHT JOIN Project p ON p.ProjectID = pupl.ProjectID
        WHERE pupl.PhotographerID = ? OR p.ProjectOwnerID = ? LIMIT 1`,
        [user.UserID, user.UserID]
      )
    )[0];

    const results = await db.query(query, [user.UserID]);
    res.render("media/view-all", {
      title: "Media Management",
      medias: results[0],
      currentUser: user,
      disableCreateMedia:
        anyLinks.length == 0 && user.UserType != userTypesEnumeration().admin,
    });
  }
);

router.get("/view/:mediaID", param('mediaID').isInt({ min: 1 }).withMessage("unknown ID"), isAuthenticated, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  const mediaID = req.params.mediaID;

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
    ORDER BY m.CreatedDate DESC
        `;

  const results = await db.query(
    query,
    [mediaID],
    // (err: any, results: string | any[]) => {
    //   if (err) {
    //     console.error("❌ Error fetching media record:", err);
    //     return res.status(500).render("error", {
    //       message: "Error loading media entry",
    //       error: process.env.NODE_ENV === "development" ? err : null,
    //     });
    //   }

    //   if (results.length === 0) {
    //     return res.status(404).render("error", {
    //       message: "Media record not found",
    //     });
    //   }



  );
  res.render("media/view", {
    currentUser: req.session.passport.user,
    media: results[0][0], // Since we're querying by ID, we'll only get one record
    mediaID,
    title: "View Media",
  });
});
router.get(
  "/edit/:mediaID",
  param('mediaID').isInt({ min: 1 }).withMessage('unknown ID'),
  isAuthenticated,
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    const mediaID = req.params.mediaID;
    const allProjectAndPhotographerPairsQuery = `    Select pupl.ProjectID, photographer.UserID, 
          p.ProjectName as projectName, photographer.FullName as photographerName 
        FROM ProjectUserPhotographyLink pupl 
        JOIN Project p ON p.ProjectID = pupl.ProjectID 
        JOIN User photographer ON photographer.UserID = pupl.PhotographerID
        WHERE photographer.UserType != 'admin'
        `;
    const user = req.session.passport.user;
    var q2: string;
    /**
     * retrieve project photographer pair based on user privilleges
     */
    if (user.UserType == userTypesEnumeration().projectOwner) {
      q2 = allProjectAndPhotographerPairsQuery + "AND p.ProjectOwnerID = ?";
    } else if (user.UserType == userTypesEnumeration().photographerOnly) {
      q2 =
        allProjectAndPhotographerPairsQuery + "AND photographer.UserID = ?";
    } else {
      q2 = allProjectAndPhotographerPairsQuery;
    }
    const allProjectAndPhotographerPairs = (
      await db.query(q2, [user.UserID])
    )[0];
    console.log(
      "allProjectAndPhotographerPairs",
      allProjectAndPhotographerPairs
    );

    const currentMediaQuery =
      `SELECT Media.*,
        projectOwner.FullName projectOwnerName,
        Project.ProjectName ,
        photographer.FullName as photographerName 
        FROM Media
        JOIN Project ON Media.ProjectID = Project.ProjectID
        JOIN User projectOwner ON Project.ProjectOwnerID = projectOwner.UserID
        JOIN User photographer ON photographer.UserID = Media.PhotographerID
        WHERE Media.MediaID = ` + mediaID;
    const x: any[] = await db.query(currentMediaQuery);
    const toBeEditedMedia = x[0][0];
    console.log("-------");
    console.log("toBeEditedMedia", toBeEditedMedia);
    res.render("media/edit", {
      currentUser: req.session.passport.user,
      imageEditingTools: req.session["imageEditingTools"],
      imagingPlatforms: req.session["imagingPlatforms"],
      allProjectAndPhotographerPairs,
      fileFormats: Object.values(mediaFileFormatEnumeration()),
      toBeEditedMedia,
      toBeEditedImagingDate: formatDisplayDate(toBeEditedMedia.ImagingDate),
      title: "Media Form",
    });
  }
);

// Controller for handling form submission
router.post("/edit", isAuthenticated, async (req: Request, res: Response) => {
  const mediaData = req.body;
  // Update existing media
  const query = `
        UPDATE Media SET
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
        WHERE MediaID = ?
                `;
  const updatedBy = req.session.passport.user.UserID;
  console.log("mediaData.imageEditingTool", mediaData.imageEditingTool);
  const splitX = mediaData.projectAndPhotographerPair.split(",");
  const projectID = splitX[0];
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
    projectID,
    splitX[1],
    mediaData.MediaID,
  ];
  // const newImageEditingTool = mediaData.newImageEditingTool;
  // const newImagingPlatform = mediaData.newImagingPlatform;

  // console.log("newImageEditingTool", newImageEditingTool);
  // console.log("newImagingPlatform", newImagingPlatform);
  // if (
  //   newImageEditingTool != null &&
  //   newImageEditingTool != "" &&
  //   !req.session.imageEditingTools.includes(newImageEditingTool)
  // ) {
  //   req.session.imageEditingTools.push(newImageEditingTool);
  //   const i = req.session.imageEditingTools;
  //   console.log("i", i);
  //   await db
  //     
  //     .query<RowDataPacket[]>(
  //       "ALTER TABLE Media MODIFY COLUMN `ImageEditingTool` ENUM(?)",
  //       [i]
  //     );
  // }

  //   if (
  //     newImagingPlatform != null &&
  //     newImagingPlatform != "" &&
  //     !req.session.imagingPlatforms.includes(newImagingPlatform)
  //   ) {
  //     req.session.imagingPlatforms.push(newImagingPlatform);
  //     const i = req.session.imagingPlatforms;
  //     await db
  //       
  //       .query<RowDataPacket[]>(
  //         "ALTER TABLE Media MODIFY COLUMN `ImagingPlatform` enum(?)",
  //         [i]
  //       );
  //     await db
  //       
  //       .query<RowDataPacket[]>(
  //         "ALTER TABLE ImagingPlatformInstance MODIFY COLUMN `ImagingPlatform` enum(?)",
  //         [i]
  //       );
  //     // for new enums, the list of imaging platforms that the entity project has
  //     // needs to be updated:
  //     await db
  //       
  //       .query<RowDataPacket[]>(
  //         "INSERT IGNORE INTO ImagingPlatformInstance (ProjectID, ImagingPlatform) VALUES (?,?) ",
  //         [projectID, newImagingPlatform]
  //       ); // I can't remember why I ignore errors here, sorry.
  //   }
  //   req.session.save();

  await db.query(query, params)

  res.json({
    success: true,
    message: "sucessfully edited media",
    redirectUrl: "/media/view/" + mediaData.MediaID,
  });
});

// Soft delete media by setting IsDelete = 1 and redirect
router.post(
  "/delete/:mediaID",
  param('mediaID').isInt({ min: 1 }).withMessage('unknown id'),
  isAuthenticated,
  (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    const mediaID = req.params.mediaID;
    const userID = req.session.passport.user.UserID;

    // First verify the media exists and isn't already deleted
    // this could be replace with catching the error but just using what works from the previous developers
    const checkQuery =
      "SELECT * FROM Media WHERE MediaID = ? AND IsDeleted = 0";

    db
      .query(checkQuery, [mediaID])
      .then((results) => {
        if (results[0].length === 0) {
          req.flash("error", "Media not found or already deleted");
          res.redirect("/media/view-all");
          return Promise.resolve(results);
        }

        const updateQuery = `
                UPDATE Media 
                SET IsDeleted = 1,
                    UpdatedByID = ?,
                    UpdatedDate = NOW() 
                WHERE MediaID = ?
        `;

        return db.query(updateQuery, [userID, mediaID]);
      })
      .then(() => res.redirect("/media/view-all"))
      .catch((error: any) => {
        console.error("❌ Error soft deleting media:", error);
        req.flash("error", "Error archiving media");
        res.redirect("/media/view-all");
        return Promise.resolve();
      });
  }
);

router.post(
  "/restore/:mediaID",
  param('mediaID').isInt({ min: 1 }).withMessage('unknown id'),
  isAuthenticated,
  (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    const mediaID = req.params.mediaID;
    const userID = req.session.passport.user.UserID;

    // First verify the media exists and isn't already restored
    // this could be replace with catching the error but just using what works from the previous developers
    const checkQuery =
      "SELECT * FROM Media WHERE MediaID = ? AND IsDeleted = 1";

    db
      .query(checkQuery, [mediaID])
      .then((results) => {
        if (results[0].length == 0) {
          req.flash("error", "Media not found or already restored");
          res.redirect("/media/view-all");
          return Promise.resolve(results);
        }

        const updateQuery = `
                UPDATE Media 
                SET IsDeleted = 0,
                    UpdatedByID = ?,
                    UpdatedDate = NOW() 
                WHERE MediaID = ?
            `;

        return db.query(updateQuery, [userID, mediaID]);
      })
      .then(() => {
        res.redirect("/media/view-all");
        return Promise.resolve();
      })
      .catch((error: any) => {
        console.error("❌ Error soft deleting media:", error);
        req.flash("error", "Error archiving media");
        res.redirect("/media/view-all");
        return Promise.resolve();
      });
  }
);

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

  const userID = req.session.passport.user.UserID;
  const updateQuery = `
                UPDATE Media 
                SET IsDeleted = 1,
                    UpdatedByID = ?,
                    UpdatedDate = NOW() 
                WHERE MediaID in (?)
        `;

  await db.query(updateQuery, [userID, req.body]);
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

  const userID = req.session.passport.user.UserID;
  const updateQuery = `
                UPDATE Media 
                SET IsDeleted = 0,
                    UpdatedByID = ?,
                    UpdatedDate = NOW() 
                WHERE MediaID in (?)
        `;

  await db.query(updateQuery, [userID, req.body]);
  return res.status(200).json({ success: true, message: "successfully restored selected metadata" })
})
router.get(
  "/upload-bulk-metadata",
  isAuthenticated,
  async (req: Request, res: Response) => {
    console.log("upload bulk metadata GET");
    const user = req.session.passport.user;
    const query = `
    SELECT  p.ProjectID, p.ProjectName
    FROM Project p
`;
    // list projects based on user type,
    // where non admins will only get projects that they photographs or owns.
    const q2 =
      user.UserType != userTypesEnumeration().admin
        ? query +
        `
        JOIN ProjectUserPhotographyLink pupl ON pupl.ProjectID = p.ProjectID
        WHERE pupl.PhotographerID = ` +
        user.UserID
        : query;
    const allProjects = (await db.query(q2))[0];
    console.log(allProjects);
    res.render("media/upload-bulk-metadata", {
      currentUser: user,
      allProjects,
      title: "Media Form",
    });
  }
);

router.post(
  "/upload-bulk-metadata/:projectID",
  upload.single("bulk-metadata"),
  isAuthenticated,
  async (req: Request, res: Response) => {
    const projectID = req.params.projectID;

    const absolutePath = path
      .join(__dirname, req.file.path)
      .replace("/routes", "");
    console.log("absolutePath", absolutePath);
    const jsonString = fs.readFileSync(absolutePath, "utf-8");
    const newRowsTemp = jsonString.split("\n").slice(1);
    fs.rm(absolutePath, (err: any) => {
      if (err) {
        // File deletion failed
        console.error(err.message);
        return;
      }
    });

    //Conducts some validation for each row of the data.
    interface newRowColumnInterface {
      MorphoID: number;
      CatalogID: number;
      FileName: number;
      FilePath: number;
      FileSizeBytes: number;
      FileFormat: number;
      PhotographerID: number;
      ImagingDate: number;
      ImageEditingTool: number;
      Description: number;
      Resolution: number;
      // ImagingPlatform: number;
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
    };
    const user = req.session.passport.user;
    function isValidFileName(filename: string, fileFormat: any) {
      if (!filename) return false;
      const lower: string = filename.toLowerCase();
      if (!lower.endsWith(fileFormat)) return false;
      if (lower.replace(fileFormat, "") == "") return false;
      const x: string[] = Object.values(mediaFileFormatEnumeration());
      return x.some((value: string, index: number, array: string[]) =>
        lower.endsWith(value.toString())
      );
    }
    const newTable: string[][] = [];
    var newTableDF: pl.DataFrame = pl.DataFrame();
    var hasErrors = false;
    // const newImagingPlatforms: string[] = [];
    const newImageEditingTools = [];
    const uniqueFileNames = [];

    const tempListOfObjects1 = (
      await db.query("SELECT DISTINCT FileName FROM Media")
    )[0];
    const tempListOfObjects2: any = tempListOfObjects1;
    const listOfFileNamesFromDB = [];
    for (const x of tempListOfObjects2) {
      listOfFileNamesFromDB.push(x.FileName);
    }

    const tempListOfLinks1 = (
      await db

        .query("SELECT DISTINCT * FROM ProjectUserPhotographyLink")
    )[0];
    const tempListOfLinks2: any = tempListOfLinks1;
    const listOfPhotographerProjectLinks = [];
    for (const x of tempListOfLinks2) {
      listOfPhotographerProjectLinks.push([x.PhotographerID, x.ProjectID]);
    }
    console.log(
      "listOfPhotographerProjectLinks",
      listOfPhotographerProjectLinks
    );

    //getting each row
    for (var i: number = 0; i < newRowsTemp.length; i++) {
      var newRowTempSplited = newRowsTemp[i].split(",");
      if (newRowTempSplited.length == 1 && newRowTempSplited[0] == "") {
        continue;
      }
      const newRow: string[] = [projectID.toString()];
      const fileName = newRowTempSplited[newRowColumns.FileName];
      var errorMessage = "";
      // getting individual cells of the row.
      for (var j: number = 0; j < newRowTempSplited.length; j++) {
        const elementTemp = newRowTempSplited[j]
          .replaceAll('"', "")
          .replaceAll("'", "")
          .replaceAll(".", ".")
          .replaceAll(",", ",")
          .replaceAll("(", "(")
          .replaceAll(")", ")")
          .trim();
        // const forNullHandling = [
        // newRowColumns.ImagingPlatform,
        // newRowColumns.ImageEditingTool,
        // newRowColumns.ImagingDate,
        // newRowColumns.Resolution,
        // ];
        const element =
          // elementTemp == "" && forNullHandling.includes(j) ? null : elementTemp;
          elementTemp == "" ? null : elementTemp;
        // if (element == null && !forNullHandling.includes(j))
        // (errorMessage = errorMessage + "This feature"),
        //   Object.keys(newRowColumns)[j],
        //   "is a null value. \n";

        //VALIDATION SWITCH CASES with check for new image editing tools
        switch (j) {
          case newRowColumns.FileName:
            const fileNameToCheck = newRowTempSplited[newRowColumns.FileFormat];
            if (!isValidFileName(element!, fileNameToCheck)) {
              errorMessage =
                errorMessage +
                `The media file name '${fileNameToCheck}' must include a valid extension like ` +
                Object.values(mediaFileFormatEnumeration()) +
                `or it needs to match FileFormat value in the same row
                or your FileFormat value is wrong
                or there needs to be a file name before the file format\n`;
              break;
            }
            if (listOfFileNamesFromDB.includes(element)) {
              errorMessage =
                errorMessage +
                `There is already an existing entry in the database for the  FileName: '${element}' \n`;
              break;
            }
            if (!uniqueFileNames.includes(element))
              uniqueFileNames.push(element);
            else {
              errorMessage =
                errorMessage +
                `There are duplicate FileName for '${element}' within this csv file.\n`;
            }
            break;
          case newRowColumns.CatalogID:
            if (!/^[A-Z]{6}\d{7,8}$/.test(element!)) {
              errorMessage =
                errorMessage +
                `CatalogID '${element!}' is not in the correct format. Example of a correct format: ZRCBDP0012345. 6 capital letters and then 7 numbers. \n`;
            }
            break;
          //   case newRowColumns.ClusterID:
          //     if (!/^[\d][A-Z]{7}\d{7}$/.test(element))
          //       errorMessage =
          //         errorMessage +
          //         errorMessageBuilder(
          //           "clusterID is not in the correct format. Example of a correct format: 3PZRCBDP1234567.1 number, 7 capital letters and then 7 numbers."
          //         );
          //     break;
          case newRowColumns.ImagingDate:
            // console.log(i,element)
            if (isNaN(new Date(element!).getTime()!) && element != null)
              errorMessage =
                errorMessage +
                `Invalid Imaging Date format. current value: ${element} \n`;
            break;
          case newRowColumns.Resolution:
            if (!/^\d{1,5}x\d{1,5}$/.test(element!) && element != null)
              errorMessage =
                errorMessage +
                `Resolution value: '${element}' is not in the correct format. example format: 1440x720, the length and width should not be more than 5 digits. \n`;
            break;
          case newRowColumns.FileSizeBytes:
            if (isNaN(parseInt(element!))) {
              errorMessage =
                errorMessage +
                `File size must be in integer, not float or decimal or any other characters. Current Value: '${element}'\n`;
            }

            if (parseInt(element) <= 0)
              errorMessage =
                errorMessage +
                `File size must be a positive integer. Current Value: ${element}\n`;
            break;
          case newRowColumns.FileFormat:
            if (!Object.values(mediaFileFormatEnumeration()).includes(element))
              errorMessage =
                errorMessage +
                `Invalid file format: ${element}. The format should be any one of these: ` +
                Object.values(mediaFileFormatEnumeration()).toString() +
                "\n";
            break;
          case newRowColumns.PhotographerID:
            console.log("in case photographer ID");
            const photographerID = element;
            if (isNaN(parseInt(photographerID!))) {
              errorMessage =
                errorMessage +
                `Photographer ID must be in integer, not decimal or any other characters. Current Value: '${photographerID}'\n`;
              break;
            }
            var matched = false;
            for (const x of listOfPhotographerProjectLinks) {
              if (
                x[0].toString() == photographerID &&
                x[1].toString() == projectID
              ) {
                matched = true;
                break;
              }
            }
            if (!matched)
              errorMessage =
                errorMessage +
                `The photographer (ID: ${photographerID}) is not the selected project (ID: ${projectID}). 
                You may have selected the wrong project from the dropdown box or the wrong photographer ID in the config.ini \n`;
            break;

          // case newRowColumns.ImagingPlatform:
          // checks for new Imaging platform to take note
          // if (
          //   !req.session.imagingPlatforms.includes(element!) &&
          //   !newImagingPlatforms.includes(element!) &&
          //   element != null &&
          //   element != ""
          // ) {
          //   newImagingPlatforms.push(element);
          // }
          // break;
          case newRowColumns.ImageEditingTool:
            // checks for new image editing tools to take note
            if (
              !req.session.imageEditingTools.includes(element!) &&
              !newImageEditingTools.includes(element!) &&
              element != null &&
              element != ""
            ) {
              newImageEditingTools.push(element);
            }
            break;

          case newRowColumns.PhotographerID:
            if (isNaN(parseInt(element!))) {
              errorMessage =
                errorMessage +
                `PhotographerID must be an integer, not decimal or any other characters. Current Value: '${element}' \n`;
              break;
            }
            if (parseInt(element) <= 0)
              errorMessage =
                errorMessage +
                `PhotographerID must be a positive integer. Current Value: ${element} \n`;
            break;
        }
        if (element == null) newRow.push(element!);
        else newRow.push(element.toString());
        if (errorMessage.trim() != "" && !hasErrors) hasErrors = true;
      }
      newRow.push(new Date().toISOString().split("T")[0]); //created date
      newRow.push(user.UserID); // created by
      newRow.push(new Date().toISOString().split("T")[0]); //updated date
      newRow.push(user.UserID); //updated by
      const rowPl = pl.DataFrame({
        fileName: [errorMessage.trim() != "" ? fileName : ""],
        errorLog: [errorMessage],
      });
      newTable.push(newRow);
      newTableDF = pl.concat([newTableDF, rowPl]);
    }
    if (hasErrors) {
      res.json({
        success: false,
        message:
          "Media metadata has contraints violations. press okay to csv error log file with the error logs",
        buffer: newTableDF.writeCSV(),
      });
      return;
    }

    // START OF SECTION For adding new Image Editing Tools
    const allImageEditingTools =
      req.session["imageEditingTools"].concat(newImageEditingTools);

    //insert any new image editing tools or Image Platforms
    if (newImageEditingTools != null && newImageEditingTools.length != 0)
      await db

        .query("ALTER TABLE Media MODIFY COLUMN `ImageEditingTool` enum(?)", [
          allImageEditingTools,
        ]);
    req.session["imageEditingTools"] = allImageEditingTools;
    // const allImagingPlatforms =
    //   req.session["imagingPlatforms"].concat(newImagingPlatforms);
    // if (newImagingPlatforms != null && newImagingPlatforms.length != 0)
    //   await db
    //     
    //     .query("ALTER TABLE Media MODIFY COLUMN `ImagingPlatform` enum(?)", [
    //       allImagingPlatforms,
    //     ]);
    // req.session["imagingPlatforms"] = allImagingPlatforms;
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
        ) VALUES ?`;
    await db.query(insertQuery, [newTable]);
    console.log("✅ bulk metadata submitted successfully");
    res.json({
      success: true,
      message: "Media metadata bulk upload sucessful",
      redirectUrl: "/media/view-all",
    });
  }
);

router.get("/download-template", isAuthenticated, async (req: any, res: Response) => {
  //helps to retrieve metadata template file for downloading.
  const filePath: string = "image metadata template for only one project.xlsx";
  res.download(filePath);
});

router.get("/download-pipeline-script", isAuthenticated, (req: Request, res: Response) => {
  res.download("pipeline.zip")
})

module.exports = router;
function params(arg0: string) {
  throw new Error("Function not implemented.");
}

