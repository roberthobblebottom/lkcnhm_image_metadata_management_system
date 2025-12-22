const express = require("express");
const router = express.Router();
const path = require("path");

import { QueryResult } from "mysql2";
import { User, Request, Session } from "../../@types/types";
import { db } from "../db"; // Database connection
const { isAuthenticated, isAdmin } = require("../../middleware/auth"); // Middleware
const fastcsv = require("fast-csv");
const fs = require("fs");



import AdmZip  from "adm-zip";
// 📌 Serve Admin Users Page (HTML)
router.get(
  "/admin-users",
  isAuthenticated,
  isAdmin,
  (req: any, res: { sendFile: (arg0: any) => void }) => {
    res.sendFile(path.join(__dirname, "../views/admin-users.html"));
  }
);

// 🔒 Admin Routes (Protected)
router.get(
  "/dashboard",
  isAuthenticated,
  isAdmin,
  (
    req: Request,
    res: { render: (arg0: string, arg1: { user: User; title: string }) => void }
  ) => {
    console.log(
      "🟢 Accessing Admin Dashboard ",
    );
    res.render("admin/dashboard", {
      user: req.session.passport.user,
      title: "Admin Dashboard",
    });
  }
);

router.get(
  "/other-admin-settings",
  isAuthenticated,
  isAdmin,
  (
    req: Request,
    res: {
      render: (
        arg0: string,
        arg1: {
          projectTypes: string[];
          imagingPlatforms: string[];
          imageEditingTools: string[];
        }
      ) => void;
    }
  ) => {
    res.render("admin/other-admin-settings", {
      projectTypes: req.session.projectTypes,
      imagingPlatforms: req.session.imagingPlatforms,
      imageEditingTools: req.session.imageEditingTools,
    });
  }
);

router.post(
  "/add-enumeration-value",
  isAuthenticated,
  isAdmin,
  async (
    req: {
      body: { feature: string; value: string };
      session: Session;
    },
    res: {
      json: (arg0: {
        success: boolean;
        message: string;
        redirectUrl: string;
      }) => any;
    }
  ) => {
    const feature = req.body.feature;
    const value = req.body.value;
    switch (feature) {
      case "projectType":
        req.session.projectTypes.push(value);
        await db
          .promise()
          .query("ALTER TABLE Project MODIFY COLUMN `ProjectType` enum(?)", [
            req.session.projectTypes,
          ]);

        break;
      case "imagingPlatform":
        req.session.imagingPlatforms.push(value);
        await db
          .promise()
          .query(
            "ALTER TABLE ImagingPlatformInstance MODIFY COLUMN `ImagingPlatform` enum(?)",
            [req.session.imagingPlatforms]
          );
        await db
          .promise()
          .query("ALTER TABLE Media MODIFY COLUMN `ImagingPlatform` enum(?)", [
            req.session.imagingPlatforms,
          ]);
        break;
      case "imageEditingTool":
        req.session.imageEditingTools.push(value);
        await db
          .promise()
          .query("ALTER TABLE Media MODIFY COLUMN `ImageEditingTool` enum(?)", [
            req.session.imageEditingTools,
          ]);
        break;
    }
    return res.json({
      success: true,
      message: "altered table enums for project table project type.",
      redirectUrl: "/admin/other-admin-settings",
    });
  }
);
router.post(
  "/edit-enumeration-value",
  isAuthenticated,
  isAdmin,
  async (
    req: {
      body: { feature: any; oldValue: any; newValue: any };
      session: {
        projectTypes: string[];
        save: () => void;
        imagingPlatforms: string[];
        imageEditingTools: string[];
      };
    },
    res: {
      json: (arg0: {
        success: boolean;
        message: string;
        redirectUrl: string;
      }) => any;
    }
  ) => {
    const feature = req.body.feature;
    const oldValue = req.body.oldValue;
    const newValue = req.body.newValue;
    switch (feature) {
      case "projectType":
        console.log(feature, oldValue, newValue);
        const projectTypes = req.session.projectTypes;
        projectTypes.includes(oldValue) &&
          projectTypes.splice(projectTypes.indexOf(oldValue), 1);
        projectTypes.push(newValue);
        req.session.save();
        await db
          .promise()
          .query("UPDATE Project SET ProjectType =NULL WHERE ProjectType = ?", [
            oldValue,
          ]);
        await db
          .promise()
          .query("ALTER TABLE Project CHANGE ProjectType ProjectType ENUM(?)", [
            projectTypes,
          ]);
        await db
          .promise()
          .query(
            "UPDATE Project SET ProjectType = ? WHERE ProjectType IS NULL",
            [newValue]
          );

        break;
      case "imagingPlatform":
        const imagingPlatforms = req.session.imagingPlatforms;
        imagingPlatforms.includes(oldValue) &&
          imagingPlatforms.splice(imagingPlatforms.indexOf(oldValue), 1);
        imagingPlatforms.push(newValue);
        req.session.save();
        const x: any[] = await db
          .promise()
          .query(
            "SELECT ImagingPlatformInstanceID FROM ImagingPlatformInstance WHERE ImagingPlatform = ?",
            [oldValue]
          );
        const imagingPlatformInstanceIDs: string[] = Object.values(x[0][0]);
        console.log(imagingPlatformInstanceIDs);
        await db
          .promise()
          .query(
            "UPDATE ImagingPlatformInstance SET ImagingPlatform =NULL WHERE ImagingPlatform = ?",
            [oldValue]
          );
        await db
          .promise()
          .query(
            "ALTER TABLE ImagingPlatformInstance CHANGE ImagingPlatform ImagingPlatform ENUM(?)",
            [imagingPlatforms]
          );
        await db
          .promise()
          .query(
            "UPDATE ImagingPlatformInstance SET ImagingPlatform = ? WHERE ImagingPlatformInstanceID in (?)",
            [newValue, imagingPlatformInstanceIDs]
          );

        const x3: any[] = await db
          .promise()
          .query("SELECT MediaID FROM Media WHERE ImagingPlatform = ?", [
            oldValue,
          ]);
        const mediaIDs: string[] = Object.values(x3[0][0]);
        await db
          .promise()
          .query(
            "UPDATE Media SET ImagingPlatform =NULL WHERE ImagingPlatform = ?",
            [oldValue]
          );
        await db
          .promise()
          .query(
            "ALTER TABLE Media CHANGE ImagingPlatform ImagingPlatform ENUM(?)",
            [imagingPlatforms]
          );
        await db
          .promise()
          .query("UPDATE Media SET ImagingPlatform = ? WHERE MediaID in (?)", [
            newValue,
            mediaIDs,
          ]);
        break;
      case "imageEditingTool":
        const imageEditingTools = req.session.imageEditingTools;
        imageEditingTools.includes(oldValue) &&
          imageEditingTools.splice(imageEditingTools.indexOf(oldValue), 1);
        imageEditingTools.push(newValue);
        req.session.save();
        await db
          .promise()
          .query(
            "UPDATE Media SET ImageEditingTool =NULL WHERE ImageEditingTool = ?",
            [oldValue]
          );
        await db
          .promise()
          .query(
            "ALTER TABLE Media CHANGE ImageEditingTool ImageEditingTool ENUM(?)",
            [imageEditingTools]
          );
        await db
          .promise()
          .query(
            "UPDATE Media SET ImageEditingTool  = ? WHERE ImageEditingTool IS NULL",
            [newValue]
          );
        break;
    }
    return res.json({
      success: true,
      message: "edited table enum value for " + feature,
      redirectUrl: "/admin/other-admin-settings",
    });
  }
);
router.post(
  "/delete-enumeration-value",
  isAuthenticated,
  isAdmin,
  async (
    req: {
      body: { feature: string; value: string };
      session: {
        projectTypes: string[];
        imagingPlatforms: string[];
        imageEditingTools: string[];
      };
    },
    res: {
      json: (arg0: {
        success: boolean;
        message: string;
        redirectUrl: string;
      }) => any;
    }
  ) => {
    const feature = req.body.feature;
    const value = req.body.value;
    switch (feature) {
      case "projectType":
        const projectTypes = req.session.projectTypes;
        projectTypes.includes(value) &&
          projectTypes.splice(projectTypes.indexOf(value), 1);
        await db
          .promise()
          .query("UPDATE Project SET ProjectType =NULL WHERE ProjectType = ?", [
            value,
          ]);
        await db
          .promise()
          .query("ALTER TABLE Project CHANGE ProjectType ProjectType ENUM(?)", [
            req.session.projectTypes,
          ]);
        break;
      case "imagingPlatform":
        const imagingPlatforms = req.session.imagingPlatforms;
        imagingPlatforms.includes(value) &&
          imagingPlatforms.splice(imagingPlatforms.indexOf(value), 1);
        await db
          .promise()
          .query(
            "DELETE FROM ImagingPlatformInstance  WHERE ImagingPlatform = ?",
            [value]
          );
        console.log(req.session.imagingPlatforms);
        await db
          .promise()
          .query(
            "ALTER TABLE ImagingPlatformInstance CHANGE ImagingPlatform ImagingPlatform enum(?)",
            [req.session.imagingPlatforms]
          );

        await db
          .promise()
          .query(
            "UPDATE Media SET ImagingPlatform= NULL WHERE ImagingPlatform = ?",
            [value]
          );

        await db
          .promise()
          .query(
            "ALTER TABLE Media CHANGE  ImagingPlatform ImagingPlatform enum(?)",
            [req.session.imagingPlatforms]
          );
        break;
      case "imageEditingTool":
        const imageEditingTools = req.session.imageEditingTools;
        imageEditingTools.includes(value) &&
          imageEditingTools.splice(imageEditingTools.indexOf(value), 1);
        await db
          .promise()
          .query(
            "UPDATE Media SET ImageEditingTool=NULL WHERE ImageEditingTool = ?",
            [value]
          );

        await db
          .promise()
          .query(
            "ALTER TABLE Media CHANGE COLUMN ImageEditingTool ImageEditingTool enum(?)",
            [req.session.imageEditingTools]
          );
        break;
    }
    return res.json({
      success: true,
      message: "deleted table enum value for " + feature,
      redirectUrl: "/admin/other-admin-settings",
    });
  }
);

router.get(
  "/download-system-data",
  isAuthenticated,
  isAdmin,
  async (req: any, res:  any) => {

    //MEDIA
    const mediaData: any = (  await db.promise().query(`SELECT * FROM Media;`))[0];
    const mediaData2: Array<Object> = Array.from(mediaData);
    const jsonMediaData2 = JSON.parse(JSON.stringify(mediaData2));
    const mediaData3 =await  fastcsv
      .writeToBuffer(jsonMediaData2, { headers: true })

    //USER
    const userData: any = (await db.promise().query(`SELECT UserID,Email,UserType,FullName,RegisteredDate,LastLoginDate,IsDeleted,ContactNumber,Organisation,Comments,RequestStatus,ReasonForRequest,UpdatedDate,UpdatedByID,CreatedByID FROM User;`))[0];
    const userData2: Array<Object> = Array.from(userData);
    const jsonUserData = JSON.parse(JSON.stringify(userData2));
    const userData3 = await fastcsv
      .writeToBuffer(jsonUserData, { headers: true })
   

    //PROJECT
    const projectData: any = (await db.promise().query(`SELECT * FROM Project;`))[0];
    const projectData2: Array<Object> = Array.from(projectData);
    const jsonProjectData = JSON.parse(JSON.stringify(projectData2));
    const projectData3 = await fastcsv
      .writeToBuffer(jsonProjectData, { headers: true })

    //IMAGINGPLATFORMINSTANCE
    const imagingPlatformInstanceData: any = (
      await db.promise().query(`SELECT * FROM ImagingPlatformInstance;`)
    )[0];
    const imagingPlatformInstanceData2: Array<Object> = Array.from( imagingPlatformInstanceData);
    const jsonImagingPlatformInstanceData = JSON.parse( JSON.stringify(imagingPlatformInstanceData2));
    const imagingPlatformInstanceData3 = await fastcsv
      .writeToBuffer(jsonImagingPlatformInstanceData, { headers: true })

    //PROJECT USER PHOTOGRAPHY LINK
    const projectUserPhotographyLinkData: any = (
      await db.promise().query(`SELECT * FROM ProjectUserPhotographyLink;`)
    )[0];
    const projectUserPhotographyLinkData2: Array<Object> = Array.from(projectUserPhotographyLinkData);
    const jsonProjectUserPhotographyLinkData = JSON.parse(JSON.stringify(projectUserPhotographyLinkData2));
    const projectUserPhotographyLinkData3 = await fastcsv
      .writeToBuffer(jsonProjectUserPhotographyLinkData, { headers: true })
    
    const zip = new AdmZip()
    zip.addFile("media.csv",mediaData3)
    zip.addFile("user.csv",userData3)
    zip.addFile("project.csv",projectData3)
    zip.addFile("imagingPlatformInstance",imagingPlatformInstanceData3)
    zip.addFile("projectUserPhotographyLink.csv",projectUserPhotographyLinkData3)

    res.json({success:true,message:'zipfile in blob',buffer:zip.toBuffer()})
  }
);
module.exports = router;
