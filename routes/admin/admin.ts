const express = require("express")
import { Response, Request } from "express"
const router = express.Router()
import { QueryResult } from "mysql2"
const db = require("../db")
const { isAuthenticated, isAdmin, reconfirmPasswordFunctionForAdmin } = require("../../middleware/auth") // Middleware
const fastcsv = require("fast-csv")
import AdmZip from "adm-zip"

const multer = require("multer")
const path = require("path")

var storage = multer.diskStorage(
    {
        destination: './extraction-tool',
        filename: function (req, file, cb) {

      cb(null, "extraction-tool.zip" );

  }
        
    }
);
const upload = multer({ storage:storage })


router.get(
  "/login-landing-page",
  isAuthenticated,
  isAdmin,
  (req: Request, res: Response) => {
    res.render("admin/login-landing-page", {
      user: req.session.passport.user,
      title: "Admin Login Landing Page",
    })
  }
)

router.get(
  "/other-admin-settings",
  isAuthenticated,
  isAdmin,
  async (req: Request, res: Response) => {
    const temp = (
      await db.query('SELECT IsEnabled FROM IsUserRegistrationEnabled LIMIT 1')
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        }))
    const IsUserRegistrationEnabled = temp[0][0].IsEnabled
    res.render("admin/other-admin-settings", {
      projectTypes: req.session.projectTypes,
      imagingPlatforms: req.session.imagingPlatforms,
      imageEditingTools: req.session.imageEditingTools,
      IsUserRegistrationEnabled
    })
  }
)

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Enumerations Operations
router.post(
  "/add-enumeration-value",
  isAuthenticated,
  isAdmin,
  async (req: Request, res: Response) => {
    const feature = req.body.feature
    const value = req.body.value
    switch (feature) {
      case "projectType":
        req.session.projectTypes.push(value)
        await db
          .query("ALTER TABLE Project MODIFY COLUMN `ProjectType` enum(?)", [
            req.session.projectTypes,
          ]).catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
        break

      case "imagingPlatform":
        req.session.imagingPlatforms.push(value)

        await db
          .query(
            "ALTER TABLE ImagingPlatformInstance MODIFY COLUMN `ImagingPlatform` enum(?)",
            [req.session.imagingPlatforms]).catch((e: any) => {
              console.error(e)
              res.status(500).json({ error: e, success: false })
            })
        await db
          .query("ALTER TABLE Media MODIFY COLUMN `ImagingPlatform` enum(?)",
            [req.session.imagingPlatforms,]).catch((e: any) => {
              console.error(e)
              res.status(500).json({ error: e, success: false })
            })
        break

      case "imageEditingTool":
        req.session.imageEditingTools.push(value)
        await db
          .query("ALTER TABLE Media MODIFY COLUMN `ImageEditingTool` enum(?)", [
            req.session.imageEditingTools,
          ]).catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
        break
    }
    return res.json({
      success: true,
      message: "altered table enums for project table project type.",
      redirectUrl: "/admin/other-admin-settings",
    })
  }
)
router.post(
  "/edit-enumeration-value",
  isAuthenticated,
  isAdmin,
  reconfirmPasswordFunctionForAdmin,
  async (req: Request, res: Response) => {
    const feature = req.body.feature
    const oldValue = req.body.oldValue
    const newValue = req.body.newValue
    switch (feature) {
      case "projectType":
        const projectTypes = req.session.projectTypes
        projectTypes.includes(oldValue) &&
          projectTypes.splice(projectTypes.indexOf(oldValue), 1)
        projectTypes.push(newValue)
        req.session.save()
        await db.query("UPDATE Project SET ProjectType =NULL WHERE ProjectType = ?",
          [oldValue,])
          .catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
        await db.query("ALTER TABLE Project CHANGE ProjectType ProjectType ENUM(?)",
          [projectTypes,])
          .catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
        await db.query(
          "UPDATE Project SET ProjectType = ? WHERE ProjectType IS NULL",
          [newValue])
          .catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
        break

      case "imagingPlatform":
        const imagingPlatforms = req.session.imagingPlatforms
        imagingPlatforms.includes(oldValue) &&
          imagingPlatforms.splice(imagingPlatforms.indexOf(oldValue), 1)
        imagingPlatforms.push(newValue)
        req.session.save()
        //QUERY IDs
        const temp1: QueryResult =
          await db.query(
            "SELECT ImagingPlatformInstanceID FROM ImagingPlatformInstance WHERE ImagingPlatform = ?",
            [oldValue]
          )
            .catch((e: any) => {
              console.error(e)
              res.status(500).json({ error: e, success: false })
            })
        const temp2 = temp1[0]
        const imagingPlatformIDsResults: any = temp2
        //SET  ImagingPlatform of certain types to null so that data truncated error won't appear
        if (imagingPlatformIDsResults.length != 0)
          await db.query(
            "UPDATE ImagingPlatformInstance SET ImagingPlatform =NULL WHERE ImagingPlatform = ?",
            [oldValue]
          ).catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
        // update enum
        await db.query(
          "ALTER TABLE ImagingPlatformInstance CHANGE ImagingPlatform ImagingPlatform ENUM(?)",
          [imagingPlatforms]
        ).catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
        if (imagingPlatformIDsResults.length != 0) {
          const imagingPlatformInstanceIDs: string[] = []
          for (const r of imagingPlatformIDsResults)
            imagingPlatformInstanceIDs.push(
              r.ImagingPlatformInstanceID.toString()
            )
          await db.query(
            "UPDATE ImagingPlatformInstance SET ImagingPlatform = ? WHERE ImagingPlatformInstanceID in (?)",
            [newValue, imagingPlatformInstanceIDs]
          ).catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
        }
        //QUERY IDs
        const temp3 = (
          await db.query("SELECT MediaID FROM Media WHERE ImagingPlatform = ?", [
            oldValue,
          ]).catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
        )
        const temp4 = temp3[0]
        const mediaIDsResults: any = temp4
        //SET  ImagingPlatform of certain types to null so that data truncated error won't appear
        if (mediaIDsResults.length != 0)
          await db.query(
            "UPDATE Media SET ImagingPlatform =NULL WHERE ImagingPlatform = ?",
            [oldValue]
          ).catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
        //update enums
        await db.query(
          "ALTER TABLE Media CHANGE ImagingPlatform ImagingPlatform ENUM(?)",
          [imagingPlatforms]
        ).catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
        //update media with said enum
        if (mediaIDsResults.length != 0) {
          const mediaIDs: string[] = []
          for (const r of mediaIDsResults)
            mediaIDs.push(r.MediaID.toString())
          await db.query(
            "UPDATE Media SET ImagingPlatform = ? WHERE MediaID in (?)",
            [newValue, mediaIDs]
          ).catch((e: any) => {
            console.error(e)
            res.status(500).json({ error: e, success: false })
          })
        }
        break

      case "imageEditingTool":
        const imageEditingTools = req.session.imageEditingTools
        imageEditingTools.includes(oldValue) &&
          imageEditingTools.splice(imageEditingTools.indexOf(oldValue), 1)
        imageEditingTools.push(newValue)
        req.session.save()
        await db.query(
          "UPDATE Media SET ImageEditingTool =NULL WHERE ImageEditingTool = ?",
          [oldValue]
        ).catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
        await db.query(
          "ALTER TABLE Media CHANGE ImageEditingTool ImageEditingTool ENUM(?)",
          [imageEditingTools]
        ).catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
        await db.query(
          "UPDATE Media SET ImageEditingTool  = ? WHERE ImageEditingTool IS NULL",
          [newValue]
        ).catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
        break
    }
    return res.json({
      success: true,
      message: "edited table enum value for " + feature,
      redirectUrl: "/admin/other-admin-settings",
    })
  }
)

router.post(
  "/delete-enumeration-value",
  isAuthenticated,
  isAdmin,
  reconfirmPasswordFunctionForAdmin,
  async (req: Request, res: Response) => {
    const feature = req.body.feature
    const value = req.body.value
    switch (feature) {
      case "projectType":
        const projectTypes = req.session.projectTypes
        projectTypes.includes(value) &&
          projectTypes.splice(projectTypes.indexOf(value), 1)
        await db
          .query("UPDATE Project SET ProjectType =NULL WHERE ProjectType = ?",
            [value])
        await db
          .query("ALTER TABLE Project CHANGE ProjectType ProjectType ENUM(?)", [
            req.session.projectTypes,
          ])
        break

      case "imagingPlatform":
        const imagingPlatforms = req.session.imagingPlatforms
        imagingPlatforms.includes(value) &&
          imagingPlatforms.splice(imagingPlatforms.indexOf(value), 1)
        await db.query(
          "DELETE FROM ImagingPlatformInstance  WHERE ImagingPlatform = ?",
          [value]
        )
        await db.query(
          "ALTER TABLE ImagingPlatformInstance CHANGE ImagingPlatform ImagingPlatform enum(?)",
          [req.session.imagingPlatforms]
        )
        await db.query(
          "UPDATE Media SET ImagingPlatform= NULL WHERE ImagingPlatform = ?",
          [value]
        )
        await db.query(
          "ALTER TABLE Media CHANGE  ImagingPlatform ImagingPlatform enum(?)",
          [req.session.imagingPlatforms]
        )
        break

      case "imageEditingTool":
        const imageEditingTools = req.session.imageEditingTools
        imageEditingTools.includes(value) &&
          imageEditingTools.splice(imageEditingTools.indexOf(value), 1)
        await db.query(
          "UPDATE Media SET ImageEditingTool=NULL WHERE ImageEditingTool = ?",
          [value]
        ).catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
        await db.query(
          "ALTER TABLE Media CHANGE COLUMN ImageEditingTool ImageEditingTool enum(?)",
          [req.session.imageEditingTools]
        ).catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })

        break
    }
    return res.json({
      success: true,
      message: "deleted table enum value for " + feature,
      redirectUrl: "/admin/other-admin-settings",
    })
  }
)

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Purge soft deleted data
router.post(
  "/purge-soft-deleted-medias",
  isAuthenticated,
  isAdmin,
  reconfirmPasswordFunctionForAdmin,
  async (req: Request, res: Response) => {
    const result: any = await db
      .query(`SELECT * FROM Media WHERE IsDeleted = 1`)
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const mediaData: Array<Object> = Array.from(result[0])
    if (mediaData.length == 0)
      return res.status(400).json({
        success: false,
        message:
          "There is no media data that is soft deleted or another words, marked for deletion",
      })

    const jsonMediaData = JSON.parse(JSON.stringify(mediaData))
    const bufferMediaData = await fastcsv.writeToBuffer(jsonMediaData,
      { headers: true })
    const zip = new AdmZip()
    zip.addFile(
      "purged media data " + new Date().toISOString() + ".csv",
      bufferMediaData
    )
    await db.query(`DELETE FROM Media WHERE IsDeleted = 1`)
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    return res.status(200).json({
      success: true,
      message:
        "Deleted any media data that is soft deleted (or another words, marked for deletion).",
      buffer: zip.toBuffer(),
    })
  }
)

router.post(
  "/purge-soft-deleted-projects",
  isAuthenticated,
  isAdmin,
  reconfirmPasswordFunctionForAdmin,
  async (req: Request, res: Response) => {
    const ids = []
    var imagingPlatformInstances = []
    var projectUserPhotographyLinks = []
    var medias = []

    const result: any = await db
      .query(`SELECT * FROM Project WHERE IsDeleted = 1`)
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const projectData: Array<Object> = Array.from(result[0])
    if (projectData.length == 0)
      return res.status(400).json({
        success: false,
        message:
          "There is no project data that is soft deleted or another words, marked for deletion",
      })

    for (const x of projectData) {
      const temp: any = x
      ids.push(temp.ProjectID)

      // query Data
      const imagingPlatformInstanceResults = await db.query(
        `SELECT * FROM ImagingPlatformInstance WHERE ProjectID = ?`,
        [temp.ProjectID]
      ).catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
      imagingPlatformInstances = imagingPlatformInstances.concat(
        imagingPlatformInstanceResults[0]
      )
      const projectUserPhotographyLinkResults = await db.query(
        `SELECT * FROM ProjectUserPhotographyLink WHERE ProjectID = ?`
        , [temp.ProjectID]
      ).catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
      projectUserPhotographyLinks = projectUserPhotographyLinks.concat(
        projectUserPhotographyLinkResults[0]
      )
      const mediasResults = await db.query(
        `SELECT * FROM Media WHERE ProjectID = ?`, [temp.ProjectID])
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
      medias = medias.concat(mediasResults[0])
    }
    //turning into buffer
    const jsonProjectData = JSON.parse(JSON.stringify(projectData))
    const bufferProjectData = await fastcsv.writeToBuffer(jsonProjectData,
      { headers: true, })
    const jsonImagingPlatformInstanceData = JSON.parse(
      JSON.stringify(imagingPlatformInstances)
    )
    const bufferImagingPlatformInstanceData = await fastcsv.writeToBuffer(
      jsonImagingPlatformInstanceData, { headers: true, })
    const jsonProjectUserPhotographyLinkData = JSON.parse(
      JSON.stringify(projectUserPhotographyLinks)
    )
    const bufferProjectUserPhotographyLinkData = await fastcsv.writeToBuffer(
      jsonProjectUserPhotographyLinkData, { headers: true })
    const jsonMediaData = JSON.parse(JSON.stringify(medias))
    const bufferMediaData = await fastcsv.writeToBuffer(jsonMediaData,
      { headers: true })

    //Zipping
    const zip = new AdmZip()
    zip.addFile("purged project data.csv", bufferProjectData)
    zip.addFile(
      "purged imaging platform instance data.csv",
      bufferImagingPlatformInstanceData
    )
    zip.addFile(
      "purged project user photography link data.csv",
      bufferProjectUserPhotographyLinkData
    )
    zip.addFile("purged media data.csv", bufferMediaData)

    await db.query(`DELETE FROM Project WHERE IsDeleted = 1`)
    return res.status(200).json({
      success: true,
      message:
        "Deleted any project data that is soft deleted (or anotherwords, marked for deletion).",
      buffer: zip.toBuffer(),
    })
  }
)

router.post(
  "/purge-soft-deleted-users",
  isAuthenticated,
  isAdmin,
  reconfirmPasswordFunctionForAdmin,
  async (req: Request, res: Response) => {
    const result: any = await db
      .query(`SELECT * FROM User WHERE IsDeleted = 1`)
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })

    const userData: Array<Object> = Array.from(result[0])
    if (userData.length == 0)
      return res.status(400).json({
        success: false,
        message:
          "There is no user data that is soft deleted or another words, marked for deletion",
      })

    const ids = []
    var projectUserPhotographyLinks = []
    for (const x of userData) {
      const temp: any = x
      ids.push(temp.UserID)

      //query pupl
      const projectUserPhotographyLinkResults = await db.query(
        `SELECT * 
        FROM ProjectUserPhotographyLink
        WHERE PhotographerID = ?`,
        [temp.UserID]
      ).catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
      projectUserPhotographyLinks = projectUserPhotographyLinks.concat(
        projectUserPhotographyLinkResults[0]
      )
    }

    // creating buffer
    const jsonUserData = JSON.parse(JSON.stringify(userData))
    const bufferUserData = await fastcsv.writeToBuffer(jsonUserData,
      { headers: true, })
    const jsonProjectUserPhotographyLinkData = JSON.parse(
      JSON.stringify(projectUserPhotographyLinks)
    )
    const bufferProjectUserPhotographyLinkData = await fastcsv.writeToBuffer(
      jsonProjectUserPhotographyLinkData, { headers: true, }
    )

    //zipping
    const zip = new AdmZip()
    zip.addFile("purge user data.csv", bufferUserData)
    zip.addFile(
      "purged project user photography link data.csv",
      bufferProjectUserPhotographyLinkData
    )

    //nulling uncascaded values to prevent errors
    for (const id of ids) {
      await Promise.all([
        db.query("UPDATE Media SET CreatedByID = null WHERE CreatedByID = ?",
          [id]),
        db.query("UPDATE Media SET UpdatedByID = null WHERE UpdatedByID = ?",
          [id]),
        db.query(
          "UPDATE Project SET ProjectOwnerID = null WHERE ProjectOwnerID = ?",
          [id]),
        db.query("UPDATE Project SET CreatedByID = null WHERE CreatedByID = ?",
          [id]),
        db.query("UPDATE Project SET UpdatedByID = null WHERE UpdatedByID = ?",
          [id]),
        db.query("UPDATE User SET CreatedByID = null WHERE CreatedByID = ? ",
          [id]),
        db.query("UPDATE User SET UpdatedByID = null WHERE UpdatedByID = ? ",
          [id])])
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })
    }

    //main purge
    await db.query(`DELETE FROM User WHERE IsDeleted = 1`)
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    return res.status(200).json({
      success: true,
      message:
        "Deleted any User data that is soft deleted (or anotherwords, marked for deletion).",
      buffer: zip.toBuffer(),
    })
  }
)

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Download Data
router.post(
  "/download-system-data",
  reconfirmPasswordFunctionForAdmin,
  isAuthenticated,
  isAdmin,
  async (req: Request, res: Response) => {
    //MEDIA
    const temp5: any = await db.query(`SELECT * FROM Media`)
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

    //USER
    const temp4: any =
      await db.query(`SELECT UserID,Email,UserType,FullName,RegisteredDate,LastLoginDate,
          IsDeleted,ContactNumber,StaffType,Comments,UpdatedDate,UpdatedByID,CreatedByID 
          FROM User`)
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })

    const userData = temp4[0]
    const userData2: Array<Object> = Array.from(userData)
    const jsonUserData = JSON.parse(JSON.stringify(userData2))
    const userData3 = await fastcsv.writeToBuffer(jsonUserData, { headers: true, })

    //PROJECT
    const temp3: any = await db.query(`SELECT * FROM Project`)
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

    //IMAGINGPLATFORMINSTANCE
    const temp2: any =
      await db.query(`SELECT * FROM ImagingPlatformInstance`)
        .catch((e: any) => {
          console.error(e)
          res.status(500).json({ error: e, success: false })
        })

    const imagingPlatformInstanceData = temp2[0]
    const imagingPlatformInstanceData2: Array<Object> = Array.from(
      imagingPlatformInstanceData
    )
    const jsonImagingPlatformInstanceData = JSON.parse(
      JSON.stringify(imagingPlatformInstanceData2)
    )
    const imagingPlatformInstanceData3 = await fastcsv.writeToBuffer(
      jsonImagingPlatformInstanceData, { headers: true }
    )

    //PROJECT USER PHOTOGRAPHY LINK
    const temp1: any = await db.query(`SELECT * FROM ProjectUserPhotographyLink`)
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    const projectUserPhotographyLinkData = temp1[0]
    const projectUserPhotographyLinkData2: Array<Object> = Array.from(
      projectUserPhotographyLinkData
    )
    const jsonProjectUserPhotographyLinkData = JSON.parse(
      JSON.stringify(projectUserPhotographyLinkData2)
    )
    const projectUserPhotographyLinkData3 = await fastcsv.writeToBuffer(
      jsonProjectUserPhotographyLinkData, { headers: true }
    )

    //ENUM
    const EnumerationValuesString =
      "ImagingPlatforms Enumeration Values:\n" +
      req.session.imagingPlatforms +
      "\n\nImageEditingTools Enumeration Values:\n" +
      req.session.imageEditingTools +
      "\n\nProjectTypes Enumeration Values:\n" +
      req.session.projectTypes

    const zip = new AdmZip()
    zip.addFile("media.csv", mediaData3)
    zip.addFile("user.csv", userData3)
    zip.addFile("project.csv", projectData3)
    zip.addFile("imagingPlatformInstance.csv", imagingPlatformInstanceData3)
    zip.addFile("projectUserPhotographyLink.csv", projectUserPhotographyLinkData3)
    zip.addFile("EnumerationValues.txt", Buffer.from(EnumerationValuesString))

    res.json({
      success: true,
      message: "zipfile in blob",
      buffer: zip.toBuffer(),
    })
  }
)

router.post('/enable-or-disable-user-registration',
  isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const isEnabled = req.body.IsEnabled
    const txt = isEnabled == 1 ? 'enabled' : 'disabled'
    await db.query('UPDATE IsUserRegistrationEnabled SET IsEnabled = ?', [isEnabled])
      .catch((e: any) => {
        console.error(e)
        res.status(500).json({ error: e, success: false })
      })
    return res.json({ success: true, message: 'User Registration Is now ' + txt })
  }
)

router.post("/upload-extraction-tool",
  isAdmin, isAuthenticated,
  upload.single("upload-extraction-tool"),
  async (req: Request, res: Response) => {
    return res.status(200).json(
      { message: 'Sucessfully uploaded' ,success:true}
    )
  }
)

module.exports = router
