import { Interface } from "readline";

const express = require("express");
const router = express.Router();
const db = require("./db");
const { isAuthenticated } = require("../middleware/auth");
const {
  formatDisplayDate,
  userTypesEnumeration,
  mediaFileFormatEnumeration,
} = require("../middleware/utils");
const multer = require("multer");
import fs from "fs";
const path = require("path");
const upload = multer({ dest: "upload-bulk-metadata/" });

router.get(
  "/view-all",
  isAuthenticated,
  async (
    req: { session: { passport: { user: any }; message: any } },
    res: {
      render: (
        arg0: string,
        arg1: {
          title: string;
          mediaRecords: any;
          errorMessage?: string;
          message?: any;
          currentUser?: any;
          disableCreateMedia?: boolean;
        }
      ) => void;
    }
  ) => {
    const baseQuery = `
      SELECT 
        m.MediaID,
        m.FileName,
        m.FilePath,
        m.CatalogID,
        m.ImagingDate,
        m.Description,
        m.FileFormat,
        m.CreatedDate,
        m.IsDeleted,
        p.ProjectID,
        p.ProjectName,
        photographer.FullName As photographerName
      FROM Media m
      JOIN Project p ON m.ProjectID = p.ProjectID
      JOIN ProjectUserPhotographyLink pupl ON pupl.ProjectID = p.ProjectID
      JOIN User photographer ON pupl.PhotographerID = photographer.UserID  
    `;
    const user = req.session.passport.user;
    const query =
      user.UserType == userTypesEnumeration().admin
        ? baseQuery + "\nORDER BY m.CreatedDate DESC"
        : baseQuery +
          "\nWHERE m.IsDeleted = 0 AND photographer.UserID =" +
          user.UserID +
          " ORDER BY m.CreatedDate DESC";

    const anyLinks = (
      await db.promise().query(
        `
        SELECT * 
        FROM ProjectUserPhotographyLink pupl 
        RIGHT JOIN Project p ON p.ProjectID = pupl.ProjectID
        WHERE pupl.PhotographerID = ? OR p.ProjectOwnerID = ? LIMIT 1`,
        [user.UserID, user.UserID]
      )
    )[0];
    db.query(query, (err: any, results: any) => {
      if (err) {
        console.error("Database error:", err);
        // Render the media page with empty results and error message
        return res.render("media-managment-index", {
          title: "Media Management - Error",
          mediaRecords: [],
          errorMessage: "Failed to load media data. Please try again later.",
        });
      }

      // Successful query
      res.render("media/view-all", {
        title: "Media Management",
        mediaRecords: results,
        message: req.session.message || null,
        currentUser: user,
        disableCreateMedia:
          anyLinks.length == 0 && user.UserType != userTypesEnumeration().admin,
      });

      // Clear session message if it exists
      if (req.session.message) {
        delete req.session.message;
      }
    });
  }
);
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
//                 u.Organisation,
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
//         ? await db.promise().query(currentProjectQuery, [projectID])
//         : null;
//     const query = req.session.passport.user.UserType != userTypesEnumeration().admin
//         ? baseQuery + " AND photographer.UserID = " + req.session.passport.user.UserID
//         : baseQuery
//     const query2 = isEdit
//         ? query + " AND photographer.UserID !=" + currentProject[0][0].photographerID
//         : query
//     const users = (await db.promise().query(query2))[0];
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

router.get(
  "/create-or-edit-for-project/:mediaID",
  isAuthenticated,
  async (
    req: {
      params: { mediaID: any };
      session: { [x: string]: any; passport: { user: any } };
    },
    res: {
      render: (
        arg0: string,
        arg1: {
          currentUser: any;
          imageEditingTools: any;
          imagingPlatforms: any;
          allPhotographers: any;
          allProjects: any;
          fileFormats: unknown[];
          toBeEditedMedia: any;
          toBeEditedPhotographer: any;
          toBeEditedImagingDate: any;
          title: string;
        }
      ) => void;
    }
  ) => {
    const mediaID = req.params.mediaID;
    const allPhotographersQuery = `SELECT FullName, UserID, UserType FROM User WHERE IsDeleted = 0;`;
    const allPhotographers = (
      await db.promise().query(allPhotographersQuery)
    )[0];
    const allProjects = (
      await db.promise().query("SELECT * FROM Project WHERE IsDeleted = 0")
    )[0];

    //For EDIT only
    const currentMediaQuery =
      `SELECT Media.*,
        projectOwner.FullName projectOwnerName,Project.ProjectName , projectOwner.UserID
        FROM Media
        JOIN Project ON Media.ProjectID = Project.ProjectID
        JOIN User projectOwner ON Project.ProjectOwnerID = projectOwner.UserID
        WHERE Media.MediaID = ` + mediaID;
    const toBeEditedMedia =
      mediaID != "create-mode"
        ? (await db.promise().query(currentMediaQuery))[0][0]
        : "create-mode";

    const toBeEditedPhotographerQuery =
      `
                SELECT User.FullName, User.UserID
                FROM User
                WHERE User.IsDeleted = 0
                AND User.UserID = 
                ` + toBeEditedMedia.PhotographerID;
    const toBeEditedPhotographer =
      mediaID != "create-mode"
        ? (await db.promise().query(toBeEditedPhotographerQuery))[0][0]
        : "create-mode";
    // End of EDIT section

    console.log("currentMedia", toBeEditedMedia);
    console.log("toBeEditedMedia", toBeEditedMedia);
    console.log("toBeEditedPhotographer", toBeEditedPhotographer);
    res.render("media/create-or-edit", {
      currentUser: req.session.passport.user,
      imageEditingTools: req.session["imageEditingTools"],
      imagingPlatforms: req.session["imagingPlatforms"],
      allPhotographers,
      allProjects,
      fileFormats: Object.values(mediaFileFormatEnumeration()),
      toBeEditedMedia,
      toBeEditedPhotographer,
      toBeEditedImagingDate:
        toBeEditedMedia != "create-mode"
          ? formatDisplayDate(toBeEditedMedia.ImagingDate)
          : new Date(),
      title: "Media Form",
    });
  }
);

router.get(
  "/upload-bulk-metadata",
  isAuthenticated,
  async (
    req: { session: { passport: { user: any } } },
    res: {
      render: (
        arg0: string,
        arg1: { currentUser: any; allProjects: any; title: string }
      ) => void;
    }
  ) => {
    console.log("upload bulk metadata GET");
    const user = req.session.passport.user;
    const query =
      `
    SELECT p.ProjectID, p.ProjectName
    FROM ProjectUserPhotographyLink pupl
    JOIN Project p ON pupl.ProjectID = p.ProjectID
    WHERE pupl.PhotographerID = ` + user.UserID;
    const allProjects = (await db.promise().query(query))[0];
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
  async (
    req: {
      params: { projectID: any };
      file: { path: any };
      session: {
        [x: string]: any;
        passport: { user: any };
        imagingPlatforms: any[];
        imageEditingTools: any[];
      };
    },
    res: {
      json: (arg0: {
        sucess?: boolean;
        message: string;
        success?: boolean;
        redirectUrl?: string;
      }) => void;
    }
  ) => {
    const projectID = req.params.projectID;
    if (isNaN(parseInt(projectID))) {
      res.json({ sucess: false, message: "projectID is not an integer" });
      return;
    }
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
      console.log("File deleted successfully");
    });
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
      ImagingPlatform: number;
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
      ImagingPlatform: 11,
    };
    const user = req.session.passport.user;
    function isValidFileName(filename: string , fileFormat: any) {
      if (!filename) return false;
      const lower: string = filename.toLowerCase();
      if (!lower.endsWith(fileFormat)) return false;
      if (lower.replace(fileFormat, "") == "") return false;
      const x:string[] = Object.values(mediaFileFormatEnumeration())
      return x.some((value: string, index: number, array: string[]) =>
        lower.endsWith(value.toString())
      );
    }
    const newTable: string[][] = [];
    const newImagingPlatforms: string[] = [];
    const newImageEditingTools: string[] = [];
    var errorMessage = "";
    for (var i: number = 0; i < newRowsTemp.length; i++) {
      var newRowTempSplited = newRowsTemp[i].split(",");
      if (newRowTempSplited.length == 1 && newRowTempSplited[0] == "") {
        continue;
      }
      // console.log(newRowTempSplited)
      const newRow: string[] = [projectID];
      for (var j: number = 0; j < newRowTempSplited.length; j++) {
        const elementTemp = newRowTempSplited[j]
          .replaceAll('"', "")
          .replaceAll("'", "")
          .replaceAll(".", ".")
          .replaceAll(",", ",")
          .replaceAll("(", "(")
          .replaceAll(")", ")")
          .trim();
        const forNullHandling = [
          newRowColumns.ImagingPlatform,
          newRowColumns.ImageEditingTool,
          newRowColumns.ImagingDate,
          newRowColumns.Resolution,
        ];
        const element =
          elementTemp == "" && forNullHandling.includes(j) ? null : elementTemp;
        if (element == null && !forNullHandling.includes(j))
          (errorMessage = errorMessage + "This feature"),
            Object.keys(newRowColumns)[j],
            "is a null value. \n";
        function errorMessageBuilder(msg: string) {
          return "row " + (i + 1).toString() + " " + msg + "\n" + element;
        }
        switch (j) {
          case newRowColumns.FileName:
            if (
              !isValidFileName(
                element!,
                newRowTempSplited[newRowColumns.FileFormat]
              )
            )
              errorMessage =
                errorMessage +
                errorMessageBuilder(
                  `The media file name must include a valid extension like ` +
                    Object.values(mediaFileFormatEnumeration())
                );
            break;
          case newRowColumns.CatalogID:
            if (!/^[A-Z]{6}\d{7,8}$/.test(element!))
              errorMessage =
                errorMessage +
                errorMessageBuilder(
                  "catalogID is not in the correct format. Example of a correct format: ZRCBDP0012345. 6 capital letters and then 7 numbers."
                );
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
                if (isNaN(new Date(element!).getTime()!)&& element != null)
              errorMessage =
                errorMessage +
                errorMessageBuilder("Invalid Imaging Date format.");
            break;
          case newRowColumns.Resolution:
            // console.log(element)
            if (!/^\d{1,5}x\d{1,5}$/.test(element!) && element != null)
              errorMessage =
                errorMessage +
                errorMessageBuilder(
                  "resolution is not in the correct format. example format: 1440x720, the length and width should not be more than 5 digits."
                );
            break;
          case newRowColumns.FileSizeBytes:
            if (isNaN(parseInt(element!)))
              errorMessage =
                errorMessage +
                errorMessageBuilder("file size must be in integer.");
            break;
          case newRowColumns.FileFormat:
            if (!Object.values(mediaFileFormatEnumeration()).includes(element))
              errorMessage =
                errorMessage +
                errorMessageBuilder(
                  "Invalid file format. The format should be any one of these: " +
                    Object.values(mediaFileFormatEnumeration()).toString()
                );
            break;
          case newRowColumns.ImagingPlatform:
            // if (!Object.values(imagingPlatformEnumeration()).includes(element)) {
            //     errorMessage = errorMessage + errorMessageBuilder(
            //         " Invalid image platform. The platform should be any one of these: "
            //         + Object.values(imagingPlatformEnumeration()).toString())

            // } else
            if (
              !req.session.imagingPlatforms.includes(element) &&
              !newImagingPlatforms.includes(element!) &&
              element != null &&
              element != ""
            ) {
              newImagingPlatforms.push(element);
            }
            break;
          case newRowColumns.ImageEditingTool:
            // if (!Object.values(imageEditingToolEnumeration()).includes(element)) {
            //     errorMessage = errorMessage + errorMessageBuilder(
            //         " Invalid image editing tool. The tool should be any one of these: "
            //         + Object.values(imageEditingToolEnumeration()).toString())
            // } else
            if (
              !req.session.imageEditingTools.includes(element) &&
              !newImageEditingTools.includes(element!) &&
              element != null &&
              element != ""
            ) {
              newImageEditingTools.push(element);
            }
            break;

          case newRowColumns.PhotographerID:
            if (isNaN(parseInt(element!)))
              errorMessage =
                errorMessage +
                errorMessageBuilder(" PhotographerID must be an integer ");
        }
        if (element == null) newRow.push(element!);
        else newRow.push(element.toString());
      }
      newRow.push(new Date().toISOString().split("T")[0]);
      newRow.push(user.UserID);
      newRow.push(new Date().toISOString().split("T")[0]);
      newRow.push(user.UserID);
      newTable.push(newRow);
    }
    if (errorMessage.length > 0) {
      console.log("there is error Message\n", errorMessage);
      res.json({
        success: false,
        message:
          "Media metadata has contraints violations. \n These are the violations:\n" +
          errorMessage,
      });
      return;
    }
    // console.log(req.session["imageEditingTools"])
    // console.log(req.session['imagingPlatforms'])
    // console.log('newImageEditingTools', newImageEditingTools)
    // console.log('newImagingPlatforms', newImagingPlatforms)
    // console.log('newTable', newTable)
    const allImageEditingTools =
      req.session["imageEditingTools"].concat(newImageEditingTools);
    if (
      newImageEditingTools != null &&
      newImageEditingTools.length != 0 &&
      !req.session["imageEditingTools"].includes(newImageEditingTools)
    )
      await db
        .promise()
        .query("ALTER TABLE Media MODIFY COLUMN `ImageEditingTool` enum(?)", [
          allImageEditingTools,
        ]);
    req.session["imageEditingTools"] = allImageEditingTools;
    const allImagingPlatforms =
      req.session["imagingPlatforms"].concat(newImagingPlatforms);
    if (
      newImagingPlatforms != null &&
      newImagingPlatforms.length != 0 &&
      !req.session["imagingPlatforms"].includes(newImagingPlatforms)
    )
      await db
        .promise()
        .query("ALTER TABLE Media MODIFY COLUMN `ImagingPlatform` enum(?)", [
          allImagingPlatforms,
        ]);
    req.session["imagingPlatforms"] = allImagingPlatforms;

    // console.log('newTable',newTable)
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
    await db.promise().query(insertQuery, [newTable]);

    console.log("✅ bulk metadata submitted successfully");

    res.json({
      success: true,
      message: "Media metadata bulk upload sucessful",
      redirectUrl: "/media/view-all",
    });
  }
);
router.post(
  "/create",
  isAuthenticated,
  async (
    req: {
      body: {
        fileName: any;
        filePath: any;
        catalogID: any;
        morphoID: any;
        clusterID: any;
        imagingDate: any;
        resolution: any;
        fileSizeBytes: any;
        fileFormat: any;
        description: any;
        imagingPlatform: any;
        imageEditingTool: any;
        newImagingPlatform: any;
        newImageEditingTool: any;
        comments: any;
        projectID: any;
        photographerID: any;
      };
      session: any;
    },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: {
          (arg0: { success: boolean; message: string; error?: any }): any;
          new (): any;
        };
      };
      json: (arg0: {
        success: boolean;
        message: string;
        redirectUrl: string;
      }) => void;
    }
  ) => {
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
        newImagingPlatform,
        newImageEditingTool,
        comments,
        projectID,
        photographerID,
      } = req.body;

      console.log("📤 Media submission data:", req.body);
      const createdBy = req.session.passport.user.UserID;
      const updatedBy = createdBy;
      // Validation: required fields
      const missingFields = [];
      if (!projectID) missingFields.push("ProjectID");
      if (!photographerID) missingFields.push("PhotographerID");
      if (!fileName) missingFields.push("fileName");
      if (!filePath) missingFields.push("filePath");
      if (!catalogID) missingFields.push("catalogID");
      if (!morphoID) missingFields.push("morphoID");
      // if (!clusterID) missingFields.push("clusterID");
      // if (!imagingDate) missingFields.push("imagingDate");
      if (!description) missingFields.push("description");
      // if (!imagingPlatform) missingFields.push("imagingPlatform");
      console.log("imagingPlatform", imagingPlatform);
      console.log("createdBy", createdBy);
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

      const values = [
        projectID,
        photographerID,
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

      if (
        newImageEditingTool != null &&
        newImageEditingTool != "" &&
        !req.session["imageEditingTools"].includes(newImageEditingTool)
      )
        await db
          .promise()
          .query(
            "ALTER TABLE Media MODIFY COLUMN `ImageEditingTool` enum(?)",
            req.session["imageEditingTools"].concat(newImageEditingTool)
          );
      req.session["imageEditingTools"].push(newImageEditingTool);

      if (
        newImagingPlatform != null &&
        newImagingPlatform != "" &&
        !req.session["imagingPlatforms"].includes(newImagingPlatform)
      )
        await db
          .promise()
          .query(
            "ALTER TABLE Media MODIFY COLUMN `ImagingPlatform` enum(?)",
            req.session["imagingPlatforms"].concat(newImagingPlatform)
          );
      req.session["imagingPlatforms"].push(newImagingPlatform);

      const [result] = await db.promise().query(insertQuery, values);
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
  }
);

// Controller for handling form submission
router.post(
  "/edit",
  isAuthenticated,
  async (
    req: {
      body: any;
      session: any;
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
        redirectUrl: string;
      }) => void;
    }
  ) => {
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
    ];
    const newImageEditingTool = mediaData.newImageEditingTool;
    const newImagingPlatform = mediaData.newImagingPlatform;
    console.log("mediaData", mediaData);
    console.log("params", params);

    console.log("newImageEditingTool", newImageEditingTool);
    console.log("newImagingPlatform", newImagingPlatform);
    if (
      newImageEditingTool != null &&
      newImageEditingTool != "" &&
      !req.session["imageEditingTools"].includes(newImageEditingTool)
    ) {
      await db
        .promise()
        .query(
          "ALTER TABLE Media MODIFY COLUMN `ImageEditingTool` enum(?)",
          req.session.imageEditingTools.concat(newImageEditingTool)
        );
      req.session["imageEditingTools"].push(newImageEditingTool);
    }
    if (
      newImagingPlatform != null &&
      newImagingPlatform != "" &&
      !req.session["imagingPlatforms"].includes(newImagingPlatform)
    ) {
      await db
        .promise()
        .query(
          "ALTER TABLE Media MODIFY COLUMN `ImagingPlatform` enum(?)",
          req.session.imagingPlatforms.concat(newImagingPlatform)
        );
      req.session["imagingPlatforms"].push(newImagingPlatform);
    }
    req.session.save();

    db.query(query, params, (err: any) => {
      if (err) {
        console.error("❌ Error updating media:", err);
        return res
          .status(500)
          .json({ success: false, message: "Error updating media" });
      }
      res.json({
        success: true,
        message: "sucessfully edited media",
        redirectUrl: "/media/view/" + mediaData.MediaID,
      });
    });
  }
);

router.get(
  "/view/:mediaID",
  isAuthenticated,
  (
    req: { params: { mediaID: any }; session: { passport: { user: any } } },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        render: {
          (arg0: string, arg1: { message: string; error?: any }): any;
          new (): any;
        };
      };
      render: (
        arg0: string,
        arg1: {
          currentUser: any;
          media: any; // Since we're querying by ID, we'll only get one record
          mediaID: any;
          title: string;
        }
      ) => void;
    }
  ) => {
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
    JOIN User photographer ON m.PhotographerID = photographer.UserID  
    JOIN Project project ON m.ProjectID = project.ProjectID
    WHERE m.MediaID = ? AND m.IsDeleted = 0
    ORDER BY m.CreatedDate DESC
        `;

    db.query(query, [mediaID], (err: any, results: string | any[]) => {
      if (err) {
        console.error("❌ Error fetching media record:", err);
        return res.status(500).render("error", {
          message: "Error loading media entry",
          error: process.env.NODE_ENV === "development" ? err : null,
        });
      }

      if (results.length === 0) {
        return res.status(404).render("error", {
          message: "Media record not found",
        });
      }

      res.render("media/view", {
        currentUser: req.session.passport.user,
        media: results[0], // Since we're querying by ID, we'll only get one record
        mediaID,
        title: "View Media",
      });
    });
  }
);

// Soft delete media by setting IsDelete = 1 and redirect
router.post(
  "/delete/:mediaID",
  isAuthenticated,
  (
    req: {
      params: { mediaID: any };
      session: { passport: { user: { UserID: any } } };
      flash: (arg0: string, arg1: string) => void;
    },
    res: { redirect: (arg0: string) => void }
  ) => {
    const mediaID = req.params.mediaID;
    const userId = req.session.passport.user.UserID;

    // First verify the media exists and isn't already deleted
    const checkQuery =
      "SELECT * FROM Media WHERE MediaID = ? AND IsDeleted = 0";

    db.promise()
      .query(checkQuery, [mediaID])
      .then(([results]: [any]) => {
        if (results.length === 0) {
          req.flash("error", "Media not found or already deleted");
          return res.redirect("/media/view-all");
        }

        const updateQuery = `
                UPDATE Media 
                SET IsDeleted = 1,
                    UpdatedByID = ?,
                    UpdatedDate = NOW() 
                WHERE MediaID = ?
        `;

        return db.promise().query(updateQuery, [userId, mediaID]);
      })
      .then(() => res.redirect("/media/view-all"))
      .catch((error: any) => {
        console.error("❌ Error soft deleting media:", error);
        req.flash("error", "Error archiving media");
        res.redirect("/media/view-all");
      });
  }
);

router.post(
  "/restore/:mediaID",
  isAuthenticated,
  (
    req: {
      params: { mediaID: any };
      session: { passport: { user: { UserID: any } } };
      flash: (arg0: string, arg1: string) => void;
    },
    res: { redirect: (arg0: string) => void }
  ) => {
    const mediaID = req.params.mediaID;
    const userId = req.session.passport.user.UserID;

    // First verify the media exists and isn't already restored
    const checkQuery =
      "SELECT * FROM Media WHERE MediaID = ? AND IsDeleted = 1";

    db.promise()
      .query(checkQuery, [mediaID])
      .then(([results]: [any]) => {
        if (results.length === 0) {
          req.flash("error", "Media not found or already restored");
          return res.redirect("/media/view-all");
        }

        const updateQuery = `
                UPDATE Media 
                SET IsDeleted = 0,
                    UpdatedByID = ?,
                    UpdatedDate = NOW() 
                WHERE MediaID = ?
            `;

        return db.promise().query(updateQuery, [userId, mediaID]);
      })
      .then(() => res.redirect("/media/view-all"))
      .catch((error: any) => {
        console.error("❌ Error soft deleting media:", error);
        req.flash("error", "Error archiving media");
        res.redirect("/media/view-all");
      });
  }
);

module.exports = router;
