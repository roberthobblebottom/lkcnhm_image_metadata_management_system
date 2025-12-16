const express = require("express");
const router = express.Router();
import { FieldPacket, QueryError, QueryResult, RowDataPacket } from "mysql2";
import { db } from "./db";
import { Request, Session, User } from "../@types/types";

const {
  isAuthenticated,
  isAdminOrProjectOwner,
} = require("../middleware/auth");
const {
  formatDate,
  formatDisplayDate,
  projectStatusEnumeration,
  projectTypeEnumeration,
  requestStatusEnumeration,
} = require("../middleware/utils");

router.get(
  "/create",
  isAuthenticated,
  isAdminOrProjectOwner,
  async (
    req: Request,
    res: {
      render: (
        arg0: string,
        arg1: {
          currentUser: User;
          projectOwners: QueryResult;
          photographers: QueryResult;
          projectTypes: string[];
          imagingPlatforms: string[];
          title: string;
        }
      ) => void;
    }
  ) => {
    const getProjectOwners = `
    SELECT u.UserID,u.FullName, u.Email, u.UserType 
    FROM User u
    WHERE u.UserType IN ('projectOwner','admin')
    AND u.RequestStatus = 'approved'
    AND u.IsDeleted = 0
    `;

    const getPhotographers = `
    SELECT u.UserID,u.FullName, u.Email 
    FROM User u
    WHERE u.RequestStatus = 'approved'
    AND u.IsDeleted = 0
    `;

    const [projectOwners, photographers] = await Promise.all([
      db.promise().query(getProjectOwners),
      db.promise().query(getPhotographers),
    ]);

    res.render("project/create", {
      currentUser: req.session.passport.user,
      projectOwners: projectOwners[0],
      photographers: photographers[0],
      projectTypes: req.session.projectTypes,
      imagingPlatforms: req.session.imagingPlatforms,
      title: "Project Form",
    });
  }
);

//  for creation of new project
router.post(
  "/create",
  isAuthenticated,
  isAdminOrProjectOwner,
  async (
    req: {
      body: {
        [x: string]: any;
        startDate: string | number | Date;
        endDate: string | number | Date;
        selectedImagingPlatforms: string[];
        selectedPhotographers: string[];
        projectName: string;
        projectType: string;
        projectOwner: string;
        summary: string;
        specimenDetails: string;
        comments: string;
      };
      session: Session;
    },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: {
          (arg0: { success: boolean; message: string; error?: any }): void;
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
      const requiredFields = [
        "projectOwner",
        "projectName",
        "projectType",
        "startDate",
        "endDate",
        "summary",
        "specimenDetails",
      ];
      const missingFields = requiredFields.filter((field) => !req.body[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
      }

      const startDate = new Date(req.body.startDate);
      const endDate = new Date(req.body.endDate);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format provided",
        });
      }

      if (endDate < startDate) {
        return res.status(400).json({
          success: false,
          message: "End date cannot be before start date",
        });
      }

      const userID = req.session.passport.user.UserID;
      if (!userID) {
        console.error("User ID not found in session");
        return res.status(401).json({
          success: false,
          message: "Unauthorized: Please login first.",
        });
      }

      if (req.body.selectedImagingPlatforms.length == 0) {
        return res.status(400).json({
          success: false,
          message: "there are no selected Imaging Platforms",
        });
      }
      
      if (req.body.selectedPhotographers.length == 0) {
        return res.status(400).json({
          success: false,
          message: "there are no selected selected photographers",
        });
      } else if (!req.body.selectedPhotographers.includes(userID.toString())) {
        return res.status(400).json({
          success: false,
          message: "Photographers must include him or herself.",
        });
      }


      const selectedImagingPlatforms = req.body.selectedImagingPlatforms;
      var hasNewImagingPlatform = false;
      for (const i of selectedImagingPlatforms) {
        if (
          i != null &&
          i != "" &&
          !req.session["imagingPlatforms"].includes(i)
        ) {
          req.session["imagingPlatforms"].push(i);
          hasNewImagingPlatform = true;
        }
      }
      if (hasNewImagingPlatform) {
        const i2: string[] = req.session.imagingPlatforms;
        await db
          .promise()
          .query("ALTER TABLE Media MODIFY COLUMN `ImagingPlatform` enum(?)", [
            i2,
          ]);
        await db
          .promise()
          .query<RowDataPacket[]>(
            "ALTER TABLE ImagingPlatformInstance MODIFY COLUMN `ImagingPlatform` enum(?)",
            [i2]
          );
      }


      const projectType = req.body.projectType;
      if (
        projectType != null &&
        projectType != "" &&
        !req.session["projectTypes"].includes(projectType)
      ) 
        req.session["projectTypes"].push(projectType);

      const i3: string[] = req.session.projectTypes;
      await db
        .promise()
        .query("ALTER TABLE Project MODIFY COLUMN `ProjectType` enum(?)", [i3]);

      
      
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), ?, 0, ?)
        `;
      const insertPhotographersQuery = `
        INSERT INTO ProjectUserPhotographyLink (PhotographerID,ProjectID)
        VALUES ?
        `;
      const insertImagingPlatformsQuery = `
        INSERT INTO ImagingPlatformInstance
        (ImagingPlatform,ProjectID)
        VALUES ?
        `;
      await db
        .promise()
        .query(insertQuery, [
          req.body.projectName,
          req.body.projectType,
          req.body.projectOwner,
          req.body.startDate,
          req.body.endDate,
          req.body.summary,
          req.body.specimenDetails,
          req.body.comments || null,
          userID,
          userID,
          projectStatusEnumeration().in_progress,
        ]);

      // Getting new project id
      const r2: [RowDataPacket[], FieldPacket[]] = await db
        .promise()
        .query("SELECT ProjectID FROM Project ORDER BY ProjectID DESC LIMIT 1");
      const projectID2: number = r2[0][0].ProjectID;

      const photographersTuple: string[][] = [];
      for (var x of req.body.selectedPhotographers) {
        photographersTuple.push([x, projectID2.toString()]);
      }
      await db.promise().query(insertPhotographersQuery, [photographersTuple]);

      const imagingPlatformsTuple: string[][] = [];
      for (x of req.body.selectedImagingPlatforms) {
        imagingPlatformsTuple.push([x, projectID2.toString()]);
      }
      await db
        .promise()
        .query(insertImagingPlatformsQuery, [imagingPlatformsTuple]);

      console.log("📸 project inserted with  UserID:", projectID2);

      const redirectUrl = `/project/view/${projectID2}`;
      // Return success response
      res.json({
        success: true,
        message: "project submitted successfully",
        redirectUrl: redirectUrl,
      });
    } catch (err: any) {
      console.error("❌ Error in submitProject:", err);
      res.status(500).json({
        success: false,
        message: "Error submitting the project.",
        error: err.message,
      });
    }
  }
);

// Route to view projects
router.get(
  "/view-all",
  isAuthenticated,
  isAdminOrProjectOwner,
  async (
    req: Request,
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        render: {
          (arg0: string, arg1: { message: string; error: any }): any;
          new (): any;
        };
      };
      render: (
        arg0: string,
        arg1: {
          projects: any;
          message?: string;
          currentUser: User;
          photographers?: {};
          title?: string;
        }
      ) => void;
    }
  ) => {
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
        ORDER BY p.CreatedDate DESC
    `;

    const queryForNonAdmin = `
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
   `;
    const queryForPhotographers = `
    SELECT
        pupl.ProjectID,
        GROUP_CONCAT(DISTINCT user.FullName SEPARATOR ', ') as photographersNames
    FROM ProjectUserPhotographyLink pupl JOIN User user ON user.UserID = pupl.PhotographerID
    GROUP BY pupl.ProjectID 
    ORDER BY pupl.ProjectID
    `;

    const user = req.session.passport.user;
    const query = user.UserType != "admin" ? queryForNonAdmin : queryForAdmin;
    const adminID = user.UserType != "admin" ? [user.UserID] : [];

    console.log("📩 Fetching Projects...");
    const photographersTemp: any = (
      await db.promise().query(queryForPhotographers, [user.UserID])
    )[0];
    const photographers: any = {};
    for (var x of photographersTemp) {
      photographers[x.ProjectID] = x.photographersNames;
    }

    db.query(query, adminID, (err: any, result: any, fields: FieldPacket[]) => {
      if (err) {
        console.error("❌ Error fetching projects:", err);
        return res.status(500).render("error", {
          message: "Error loading projects",
          error: process.env.NODE_ENV === "development" ? err : null,
        });
      }

      console.log(`📄 Fetched ${result.length} projects`);
      // console.log(results)

      if (result.length === 0) {
        return res.render("project/view-all", {
          projects: [],
          message: "No projects found",
          currentUser: user,
        });
      }
      res.render("project/view-all", {
        projects: result,
        currentUser: user,
        photographers: photographers,
        title: "Projects Dashboard", // Add title here
      });
    });
  }
);

router.get(
  "/view/:projectID",
  isAuthenticated,
  isAdminOrProjectOwner,
  async (
    req: { params: { projectID: number }; user: User },
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
        arg1: { project: any; currentUser: User; title: string }
      ) => void;
    }
  ) => {
    const projectID = req.params.projectID;
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
    WHERE p.ProjectID = ?
        `;

    const photographersQuery = `SELECT user.FullName FROM ProjectUserPhotographyLink pupl 
        JOIN User user ON user.UserID = pupl.PhotographerID
        WHERE pupl.ProjectID = ? `;
    const imagingPlatformsQuery = `
    SELECT ImagingPlatform FROM ImagingPlatformInstance WHERE ProjectID = ?
    `;

    const photographersTemp1: any = (
      await db.promise().query(photographersQuery, [projectID])
    )[0];
    const photographers: any[] = [];
    for (var x of photographersTemp1) {
      photographers.push(x.FullName);
    }

    const imagingPlatformsTemp1: any = (
      await db.promise().query(imagingPlatformsQuery, [projectID])
    )[0];
    const imagingPlatforms: any[] = [];
    for (const x of imagingPlatformsTemp1) {
      imagingPlatforms.push(x.ImagingPlatform);
    }
    db.query(
      query,
      [projectID],
      (err: QueryError | null, results: any, field: FieldPacket[]) => {
        if (err) {
          console.error("Error fetching project:", err);
          return res.status(500).render("error", {
            message: "Error loading project",
            error: process.env.NODE_ENV === "development" ? err : null,
          });
        }

        if (results.length === 0) {
          return res.status(404).render("error", {
            message: "project not found",
          });
        }
        // Format dates for display
        const project = {
          ...results[0],
          CreatedDate: formatDate(results[0].CreatedDate),
          ImagingStartDate: formatDate(results[0].ImagingStartDate),
          ImagingEndDate: formatDate(results[0].ImagingEndDate),
          UpdatedDate: results[0].UpdatedDate
            ? formatDate(results[0].UpdatedDate)
            : null,
          IsDeleted: results[0].IsDeleted,
          photographers:
            photographers.length != 0
              ? photographers.toString().replace(",", ", ")
              : "Not Specified",
          imagingPlatforms:
            imagingPlatforms.length != 0
              ? imagingPlatforms.toString().replace(",", ", ")
              : "Not Specified",
        };

        res.render("project/view", {
          project: project,
          currentUser: req.user,
          title: "View Project", // Add title here
        });
      }
    );
  }
);

// Edit Project (GET)
// Define queries at the top of your file for better maintainability
router.get(
  "/edit/:projectID",
  isAuthenticated,
  isAdminOrProjectOwner,
  async (
    req: { params: { projectID: number }; user: User; session: Session },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        render: {
          (arg0: string, arg1: { message: string }): void;
          new (): any;
        };
      };
      render: (
        arg0: string,
        arg1: {
          project: any;
          allPhotographers: any;
          selectedPhotographers: any[];
          statuses: unknown[];
          projectTypes: string[];
          imagingPlatforms: string[];
          selectedImagingPlatforms: string[];
          currentUser: User;
          title: string;
        }
      ) => void;
    }
  ) => {
    try {
      const projectID = req.params.projectID;
      const requestQuery = `
            SELECT
            p.*,
            projectOwner.FullName ,
            projectOwner.Email 
            FROM Project p
            JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
            WHERE p.ProjectID = ?;
    `;
      // Get all needed data in parallel for better performance
      const [
        requestResults,
        imagingPlatformTemp,
        selectedPhotographersTemp,
        allPhotographers,
      ]: [any, any, any, any] = await Promise.all([
        db.promise().query(requestQuery, [projectID]),
        db
          .promise()
          .query(
            "SELECT ImagingPlatform FROM ImagingPlatformInstance WHERE ProjectID = ? ORDER BY ImagingPlatform",
            [projectID]
          ),
        db
          .promise()
          .query(
            "SELECT user.UserID  FROM ProjectUserPhotographyLink p JOIN User user on user.UserID = p.PhotographerID WHERE p.ProjectID = ? ",
            [projectID]
          ),
        db
          .promise()
          .query("SELECT UserID,FullName FROM User WHERE RequestStatus = ?", [
            requestStatusEnumeration().approved,
          ]),
      ]);
      if (requestResults[0].length === 0) {
        return res
          .status(404)
          .render("error", { message: "Request not found" });
      }
      const currentlySelectedPhotographers: string[] = [];
      for (var i of selectedPhotographersTemp[0]) {
        currentlySelectedPhotographers.push(i.UserID);
      }
      
      const imagingPlatforms: any[] = [];
      for (const i of imagingPlatformTemp[0]) {
        imagingPlatforms.push(Object.values(i)[0]);
      }

      // Format dates for display
      const project = {
        ...requestResults[0][0],
        CreatedDate: formatDisplayDate(requestResults[0][0].CreatedDate),
        ImagingStartDate: formatDisplayDate(
          requestResults[0][0].ImagingStartDate
        ),
        ImagingEndDate: formatDisplayDate(requestResults[0][0].ImagingEndDate),
      };

      res.render(`project/edit`, {
        project: project,
        allPhotographers: allPhotographers[0],
        selectedPhotographers: currentlySelectedPhotographers,
        statuses: Object.values(projectStatusEnumeration()),
        projectTypes: req.session.projectTypes,
        imagingPlatforms: req.session.imagingPlatforms,
        selectedImagingPlatforms: imagingPlatforms,
        currentUser: req.user,
        title: "Edit Project", // Add title here
      });
    } catch (err) {
      console.error("Error:", err);
      res.status(500).render("error", { message: "Server error" });
    }
  }
);

router.post(
  "/edit/:projectID",
  isAuthenticated,
  isAdminOrProjectOwner,
  async (
    req: {
      session: Session;
      params: { projectID: number };
      body: {
        projectType: string;
        ProjectName: string;
        ImagingStartDate: string | number | Date;
        ImagingEndDate: string | number | Date;
        SummaryOfProject: string;
        DetailsOfSpecimens: string;
        LocationsOfSpecimens: string;
        ProjectStatus: string;
        projectOwnerID: string;
        selectedImagingPlatforms: string;
        selectedPhotographers: string;
      };
    },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: {
          (arg0: { success: boolean; message: string; error?: any }): void;
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
      const userID = req.session.passport.user.UserID;
      if (!req.session.passport.user || !userID) {
        console.error("❌ No user in session");
        return res.status(401).json({
          success: false,
          message: "Session expired. Please login again.",
        });
      }

      const projectID: number = req.params.projectID;
      const {
        ProjectName,
        ImagingStartDate,
        ImagingEndDate,
        SummaryOfProject,
        DetailsOfSpecimens,
        LocationsOfSpecimens,
        ProjectStatus,
        projectOwnerID,
        selectedImagingPlatforms,
        selectedPhotographers,
      } = req.body;

      let newSelectedImagingPlatforms: string[] =
        selectedImagingPlatforms.split(",");
      let newSelectedPhotographers: string[] = selectedPhotographers.split(",");

      // === 1. VALIDATION ===
      if (!ImagingStartDate || !ImagingEndDate || !ProjectStatus) {
        return res
          .status(400)
          .json({ success: false, message: "Missing required fields" });
      }

      if (
        newSelectedImagingPlatforms.length == 0 ||
        (newSelectedImagingPlatforms.length == 1 &&
          newSelectedImagingPlatforms[0] == "")
      ) {
        return res
          .status(400)
          .json({ success: false, message: "No Selected Imaging Platforms" });
      }
      if (newSelectedPhotographers.length == 0) {
        return res
          .status(400)
          .json({ success: false, message: "no Selected Photographers" });
      }
      if (!newSelectedPhotographers.includes(projectOwnerID.toString())) {
        return res.status(400).json({
          success: false,
          message: "Photographers must include him or herself.",
        });
      }

      // Date validation
      const startDate = new Date(ImagingStartDate);
      const endDate = new Date(ImagingEndDate);
      if (isNaN(startDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid start date format" });
      }
      if (isNaN(endDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid end date format" });
      }
      if (startDate >= endDate) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }

      // imaging Platforms operations for updating enum if any
      var hasNewImagingPlatform = false;
      for (const i of selectedImagingPlatforms.split(",")) {
        if (
          i != null &&
          i != "" &&
          !req.session["imagingPlatforms"].includes(i)
        ) {
          
          console.log('adding ',i)
          req.session["imagingPlatforms"].push(i);
          hasNewImagingPlatform = true;
        }
      }
      if (hasNewImagingPlatform) {
        const i2: string[] = req.session.imagingPlatforms;
        console.log(i2)
        await db
          .promise()
          .query("ALTER TABLE Media MODIFY COLUMN `ImagingPlatform` enum(?)", [
            i2,
          ]);
        await db
          .promise()
          .query<RowDataPacket[]>(
            "ALTER TABLE ImagingPlatformInstance MODIFY COLUMN `ImagingPlatform` enum(?)",
            [i2]
          );
      }


      // project Type operations for updating enum if any
      const projectType = req.body.projectType;
      if (
        projectType != null &&
        projectType != "" &&
        !req.session["projectTypes"].includes(projectType)
      ) 
        req.session["projectTypes"].push(projectType);

      const i3: string[] = req.session.projectTypes;
      console.log(i3)
      await db
        .promise()
        .query("ALTER TABLE Project MODIFY COLUMN `ProjectType` enum(?)", [i3]);




      /// IMAGING PLATFORMS OPERATIONS START
      const selectImagingQuery = `
        SELECT ImagingPlatform FROM ImagingPlatformInstance WHERE ProjectID = ?`;
      const temp: any = (
        await db.promise().query(selectImagingQuery, [projectID])
      )[0];
      const currentSelectedImagingPlatforms: string[] = [];
      for (var x of temp) {
        currentSelectedImagingPlatforms.push(x.ImagingPlatform);
      }
      

      //Getting differences
      const temp2 = newSelectedImagingPlatforms.filter(
        (e: any) => !currentSelectedImagingPlatforms.includes(e)
      );
      const imagingPlatformsToBeAdded: string[][] = [];
      for (x of temp2) {
        imagingPlatformsToBeAdded.push([x, projectID]);
      }
      const imagingPlatformsToBeRemoved: any =
        currentSelectedImagingPlatforms.filter(
          (e: any) => !newSelectedImagingPlatforms.includes(e)
        );

      //the update
      if (imagingPlatformsToBeRemoved.length != 0) {
        await db
          .promise()
          .query(
            "DELETE FROM ImagingPlatformInstance WHERE ImagingPlatform in (?) AND ProjectID =?",
            [imagingPlatformsToBeRemoved, projectID]
          );
      }
      if (imagingPlatformsToBeAdded.length != 0) {
        await db
          .promise()
          .query(
            "INSERT INTO ImagingPlatformInstance(ImagingPlatform,ProjectID) VALUES ? ",
            [imagingPlatformsToBeAdded]
          );
      }
      /// IMAGING PLATFORMS OPERATIONS END

      /// Photographers OPERATIONS START
      const selectPhotographerQuery = `
        SELECT PhotographerID FROM ProjectUserPhotographyLink WHERE ProjectID = ?`;
      const temp3: any = (
        await db.promise().query(selectPhotographerQuery, [projectID])
      )[0];
      var currentSelectedPhotographers: string[] = [];
      for (x of temp3)
        currentSelectedPhotographers.push(x.PhotographerID.toString());


      //Getting differences
      const temp4 = newSelectedPhotographers.filter(
        (e: any) => !currentSelectedPhotographers.includes(e)
      );
      const photographersToBeAdded: string[][] = [];
      for (x of temp4) photographersToBeAdded.push([x, projectID.toString()]);

      const photographersToBeRemoved: string[] =
        currentSelectedPhotographers.filter(
          (e: any) => !newSelectedPhotographers.includes(e)
        );
      //the update
      if (photographersToBeRemoved.length != 0) {
        await db
          .promise()
          .query(
            "DELETE FROM ProjectUserPhotographyLink WHERE PhotographerID in (?) AND ProjectID =?",
            [photographersToBeRemoved, projectID]
          );
      }
      if (photographersToBeAdded.length != 0) {
        await db
          .promise()
          .query(
            "INSERT INTO ProjectUserPhotographyLink(PhotographerID,ProjectID) VALUES ? ",
            [photographersToBeAdded]
          );
      }
      /// Photographers OPERATIONS END

      // === 2. DATABASE UPDATE ===
      const updateQuery = `
        UPDATE Project
        SET
        projectName =?,
        ImagingStartDate = ?,
        ImagingEndDate = ?,
        SummaryofProject = ?,
        DetailsOfSpecimens = ?,
        LocationsOfSpecimens = ?,
        ProjectStatus = ?,
        UpdatedByID = ?,
        UpdatedDate = NOW(),
        ProjectType = ?
        WHERE ProjectID = ?
        `;
      await db
        .promise()
        .query(updateQuery, [
          ProjectName,
          startDate,
          endDate,
          SummaryOfProject || null,
          DetailsOfSpecimens || null,
          LocationsOfSpecimens || null,
          ProjectStatus,
          req.session.passport.user.UserID,
          projectType,
          projectID,
        ]);

      res.json({
        success: true,
        message: "project updated successfully",
        redirectUrl: `/project/view/${projectID}`,
      });
    } catch (err: any) {
      console.error("❌ Error in editing project:", err);
      res.status(500).json({
        success: false,
        message: "Error submitting the project.",
        error: err.message,
      });
    }
  }
);
// Delete Request (POST)
// Soft Delete Request (POST)
router.post(
  "/delete/:projectID",
  isAuthenticated,
  isAdminOrProjectOwner,
  (
    req: {
      params: { projectID: number };
      session: Session;
    },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        send: { (arg0: string): any; new (): any };
      };
      redirect: (arg0: string) => void;
    }
  ) => {
    const projectID = req.params.projectID;
    const query = `
        UPDATE Project
        SET
            IsDeleted = 1,
            UpdatedByID = ?,
            UpdatedDate = NOW()
        WHERE ProjectID = ?
        `;
    db.query(
      query,
      [req.session.passport.user.UserID, projectID],
      (err: any) => {
        if (err) {
          console.error("Error soft deleting request:", err);
          return res.status(500).send("Error marking request as deleted.");
        }

        res.redirect("/project/view-all");
      }
    );
  }
);

//undo soft delete
router.post(
  "/restore/:projectID",
  isAuthenticated,
  isAdminOrProjectOwner,
  (
    req: {
      params: { projectID: number };
      session: Session;
    },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        send: { (arg0: string): any; new (): any };
      };
      redirect: (arg0: string) => void;
    }
  ) => {
    const projectID = req.params.projectID;
    const query = `
        UPDATE Project
        SET
            IsDeleted = 0,
            UpdatedByID = ?,
            UpdatedDate = NOW()
        WHERE ProjectID = ?
        `;
    db.query(
      query,
      [req.session.passport.user.UserID, projectID],
      (err: any) => {
        if (err) {
          console.error("Error soft deleting request:", err);
          return res.status(500).send("Error marking request as deleted.");
        }

        res.redirect("/project/view-all");
      }
    );
  }
);

module.exports = router;
