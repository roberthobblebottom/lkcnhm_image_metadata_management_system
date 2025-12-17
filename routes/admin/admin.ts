const express = require("express");
const router = express.Router();
const path = require("path");
import { db } from "../db"; // Database connection
const { isAuthenticated, isAdmin } = require("../../middleware/auth"); // Middleware
const userTypesEnumeration = require("../../middleware/utils").userTypesEnum;
// 📌 Serve Admin Users Page (HTML)
router.get("/admin-users", isAuthenticated, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "../views/admin-users.html"));
});

// 🔒 Admin Routes (Protected)
router.get("/dashboard", isAuthenticated, isAdmin, (req, res) => {
  console.log(
    "🟢 Accessing Admin Dashboard - Session Data:",
    req.session.passport.user
  );
  res.render("admin/dashboard", {
    user: req.session.passport.user,
    title: "Admin Dashboard",
  });
});

router.get("/other-admin-settings", isAuthenticated, isAdmin, (req, res) => {
  res.render("admin/other-admin-settings", {
    projectTypes: req.session.projectTypes,
    imagingPlatforms: req.session.imagingPlatforms,
    imageEditingTools: req.session.imageEditingTools,
  });
});

router.post(
  "/add-enumeration-value",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
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
  (req, res) => {}
);




router.post(
  "/delete-enumeration-value",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    const feature = req.body.feature;
    const value = req.body.value;
    switch (feature) {
      case "projectType":
        req.session.projectTypes.pop(value);
        await db
          .promise()
          .query("UPDATE Project SET ProjectType ='' WHERE ProjectType = ?", [
            value,
          ]);
        await db
          .promise()
          .query("ALTER TABLE Project CHANGE ProjectType ProjectType ENUM(?)", [
            req.session.projectTypes,
          ]);
        break;
      case "imagingPlatform":
        req.session.imagingPlatforms.pop(value);
        await db
          .promise()
          .query(
            "UPDATE  ImagingPlatformInstance  SET ImagingPlatform='' WHERE ImagingPlatform = ?",
            [value]
          );
        await db
          .promise()
          .query(
            "ALTER TABLE ImagingPlatformInstance CHANGE ImagingPlatform ImagingPlatform enum(?)",
            [req.session.imagingPlatforms]
          );

        await db
          .promise()
          .query(
            "UPDATE Media SET ImagingPlatform='' WHERE ImagingPlatform = ?",
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
        req.session.imageEditingTools.pop(value);
        await db
          .promise()
          .query(
            "UPDATE Media SET ImageEditingTool='' WHERE ImageEditingTool = ?",
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
module.exports = router;
