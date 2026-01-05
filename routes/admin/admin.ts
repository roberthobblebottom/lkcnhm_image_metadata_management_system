const express = require("express");
import { Response, Request } from "express";
const router = express.Router();
const path = require("path");

import { QueryResult } from "mysql2";
import { db } from "../db"; // Database connection
const { isAuthenticated, isAdmin } = require("../../middleware/auth"); // Middleware
const fastcsv = require("fast-csv");
const fs = require("fs");

import AdmZip from "adm-zip";
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
  (req: Request, res: Response) => {
    console.log("🟢 Accessing Admin Dashboard ");
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
  (req: Request, res: Response) => {
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
  async (req: Request, res: Response) => {
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
  async (req: Request, res: Response) => {
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
        //QUERY IDs
        const temp1: QueryResult = (
          await db
            .promise()
            .query(
              "SELECT ImagingPlatformInstanceID FROM ImagingPlatformInstance WHERE ImagingPlatform = ?",
              [oldValue]
            )
        )[0];
        const imagingPlatformIDsResults: any = temp1;
        console.log("imagingPlatformIDsResults", imagingPlatformIDsResults);

        //SET  ImagingPlatform of certain types to null so that data truncated error won't appear
        if (imagingPlatformIDsResults.length != 0)
          await db
            .promise()
            .query(
              "UPDATE ImagingPlatformInstance SET ImagingPlatform =NULL WHERE ImagingPlatform = ?",
              [oldValue]
            );

        // update enum
        await db
          .promise()
          .query(
            "ALTER TABLE ImagingPlatformInstance CHANGE ImagingPlatform ImagingPlatform ENUM(?)",
            [imagingPlatforms]
          );

        if (imagingPlatformIDsResults.length != 0) {
          console.log("imagingPlatformIDsResults", imagingPlatformIDsResults);
          const imagingPlatformInstanceIDs: string[] = [];
          for (const r of imagingPlatformIDsResults) {
            imagingPlatformInstanceIDs.push(
              r.ImagingPlatformInstanceID.toString()
            );
          }
          await db
            .promise()
            .query(
              "UPDATE ImagingPlatformInstance SET ImagingPlatform = ? WHERE ImagingPlatformInstanceID in (?)",
              [newValue, imagingPlatformInstanceIDs]
            );
        }

        console.log("oldValue", oldValue);

        //QUERY IDs
        const temp = (
          await db
            .promise()
            .query("SELECT MediaID FROM Media WHERE ImagingPlatform = ?", [
              oldValue,
            ])
        )[0];
        const mediaIDsResults: any = temp;
        console.log("mediaIDsResults", mediaIDsResults);
        //SET  ImagingPlatform of certain types to null so that data truncated error won't appear
        if (mediaIDsResults.length != 0)
          await db
            .promise()
            .query(
              "UPDATE Media SET ImagingPlatform =NULL WHERE ImagingPlatform = ?",
              [oldValue]
            );

        //update enums
        await db
          .promise()
          .query(
            "ALTER TABLE Media CHANGE ImagingPlatform ImagingPlatform ENUM(?)",
            [imagingPlatforms]
          );

        //update media with said enum
        if (mediaIDsResults.length != 0) {
          const mediaIDs: string[] = [];
          for (const r of mediaIDsResults) {
            mediaIDs.push(r.MediaID.toString());
          }
          await db
            .promise()
            .query(
              "UPDATE Media SET ImagingPlatform = ? WHERE MediaID in (?)",
              [newValue, mediaIDs]
            );
        }
        console.log(mediaIDsResults);

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
  async (req: Request, res: Response) => {
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
  async (req: Request, res: Response) => {
    //MEDIA
    const mediaData: any = (
      await db.promise().query(`SELECT * FROM Media;`)
    )[0];
    const mediaData2: Array<Object> = Array.from(mediaData);
    const jsonMediaData2 = JSON.parse(JSON.stringify(mediaData2));
    const mediaData3 = await fastcsv.writeToBuffer(jsonMediaData2, {
      headers: true,
    });

    //USER
    const userData: any = (
      await db
        .promise()
        .query(
          `SELECT UserID,Email,UserType,FullName,RegisteredDate,LastLoginDate,IsDeleted,ContactNumber,Organisation,Comments,UpdatedDate,UpdatedByID,CreatedByID FROM User;`
        )
    )[0];
    const userData2: Array<Object> = Array.from(userData);
    const jsonUserData = JSON.parse(JSON.stringify(userData2));
    const userData3 = await fastcsv.writeToBuffer(jsonUserData, {
      headers: true,
    });

    //PROJECT
    const projectData: any = (
      await db.promise().query(`SELECT * FROM Project;`)
    )[0];
    const projectData2: Array<Object> = Array.from(projectData);
    const jsonProjectData = JSON.parse(JSON.stringify(projectData2));
    const projectData3 = await fastcsv.writeToBuffer(jsonProjectData, {
      headers: true,
    });

    //IMAGINGPLATFORMINSTANCE
    const imagingPlatformInstanceData: any = (
      await db.promise().query(`SELECT * FROM ImagingPlatformInstance;`)
    )[0];
    const imagingPlatformInstanceData2: Array<Object> = Array.from(
      imagingPlatformInstanceData
    );
    const jsonImagingPlatformInstanceData = JSON.parse(
      JSON.stringify(imagingPlatformInstanceData2)
    );
    const imagingPlatformInstanceData3 = await fastcsv.writeToBuffer(
      jsonImagingPlatformInstanceData,
      { headers: true }
    );

    //PROJECT USER PHOTOGRAPHY LINK
    const projectUserPhotographyLinkData: any = (
      await db.promise().query(`SELECT * FROM ProjectUserPhotographyLink;`)
    )[0];
    const projectUserPhotographyLinkData2: Array<Object> = Array.from(
      projectUserPhotographyLinkData
    );
    const jsonProjectUserPhotographyLinkData = JSON.parse(
      JSON.stringify(projectUserPhotographyLinkData2)
    );
    const projectUserPhotographyLinkData3 = await fastcsv.writeToBuffer(
      jsonProjectUserPhotographyLinkData,
      { headers: true }
    );

    //ENUM
    const EnumerationValuesString =
      "ImagingPlatforms Enumeration Values:\n" +
      req.session.imagingPlatforms +
      "\n\nImageEditingTools Enumeration Values:\n" +
      req.session.imageEditingTools +
      "\n\nProjectTypes Enumeration Values:\n" +
      req.session.projectTypes;

    const zip = new AdmZip();
    zip.addFile("media.csv", mediaData3);
    zip.addFile("user.csv", userData3);
    zip.addFile("project.csv", projectData3);
    zip.addFile("imagingPlatformInstance.csv", imagingPlatformInstanceData3);
    zip.addFile(
      "projectUserPhotographyLink.csv",
      projectUserPhotographyLinkData3
    );
    zip.addFile("EnumerationValues.txt", Buffer.from(EnumerationValuesString));

    res.json({
      success: true,
      message: "zipfile in blob",
      buffer: zip.toBuffer(),
    });
  }
);
module.exports = router;
