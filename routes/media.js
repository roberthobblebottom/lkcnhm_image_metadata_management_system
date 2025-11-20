const express = require("express");
const router = express.Router();
const db = require("./db"); // Database connection
const { isAuthenticated, isAdmin } = require("../middleware/auth"); // Middleware
const { userTypesEnumeration } = require("../middleware/utils");

// router.get('/create', isAuthenticated, async (req, res) => {

//     res.render('media/create', {
//         currentUser: req.session.passport.user,
//         title: "Media Form"
//     });
// });

// ✅ Admin Media Management Main Page Controller
router.get('/view-all', isAuthenticated, (req, res) => {
    const query = `
      SELECT 
        m.MediaID,
        m.MediaFileName,
        m.FilePath,
        m.CatalogID,
        m.ImagingDate,
        m.Description,
        m.FileFormat,
        m.CreatedDate,
        p.ProjectID,
        projectOwner.FullName AS projectOwnerName,
        projectOwner.Email as projectOwnerEmail,
        photographer.Email AS photographerEmail,
        photographer.FullName As photographerName
      FROM Media m
      JOIN Project p ON m.ProjectID = p.ProjectID
      JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
      JOIN ProjectUserPhotographyLink pupl ON pupl.ProjectID = p.ProjectID
      JOIN User photographer ON pupl.PhotographerID = photographer.UserID  
      WHERE m.IsDeleted = 0
      ORDER BY m.CreatedDate DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Database error:", err);
            // Render the media page with empty results and error message
            return res.render('media-managment-index', {
                title: "Media Management - Error",
                mediaRecords: [],
                errorMessage: "Failed to load media data. Please try again later."
            });
        }

        // Successful query
        res.render('media/view-all', {
            title: "Media Management",
            mediaRecords: results,
            message: req.session.message || null,
            currentUser: req.session.passport.user,
            title: "Admin Media "   // For success messages
        });

        // Clear session message if it exists
        if (req.session.message) {
            delete req.session.message;
        }
    });
});



router.get('/select-user-for', isAuthenticated, (req, res) => {
    const baseQuery = `
            SELECT 
                p.ProjectID,
                p.ProjectName,
                u.UserID AS user_id,
                u.FullName AS projectOwnerName,
                u.Email AS projectOwnerEmail,
                u.ContactNumber,
                u.Organisation,
                photographer.FullName as photographerName,
                photographer.Email as photographerEmail,
                photographer.UserID as PhotographerID,
                p.ImagingStartDate,
                p.ImagingEndDate
            FROM Project p
            JOIN User u ON p.ProjectOwnerID = u.UserID
            JOIN ProjectUserPhotographyLink pupl ON pupl.ProjectID = p.ProjectID
            JOIN User photographer ON pupl.PhotographerID = photographer.UserID  

            WHERE 
                u.IsDeleted = 0 AND 
                p.IsDeleted = 0 AND
                photographer.IsDeleted = 0

      `;


    const query = req.session.passport.user.UserType != userTypesEnumeration().admin
        ? baseQuery + " AND photographer.UserID = " + req.session.passport.user.UserID
        : baseQuery
    console.log(query)
    db.query(query, (err, users) => {
        if (err) {
            console.error("❌ Failed to fetch eligible users for media:", err);
            return res.status(500).render('error', { message: 'Failed to load users for media upload' });
        }

        console.log(`📋 Found ${users.length} eligible users`);
        // console.log("📋 User:", users);
        res.render('media/user-list', {
            users,
            currentUser: req.session.passport.user,
            title: 'Media Image List'
        });
    });
});



router.get('/create-for-project/:projectId', isAuthenticated, (req, res) => {
    const projectId = req.params.projectId;

    const query = `
      SELECT 
        p.ProjectID,
        p.ProjectOwnerID,
        projectOwner.FullName AS projectOwnerName,
        photographer.Email AS photographerName,
        photographer.UserID AS PhotographerID 
      FROM Project p
      JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
      JOIN ProjectUserPhotographyLink pupl ON pupl.ProjectID = p.ProjectID
      JOIN User photographer ON pupl.PhotographerID = photographer.UserID  


      WHERE p.ProjectID = ? AND p.IsDeleted = 0
    `;

    db.query(query, [projectId], (err, results) => {
        if (err) {
            console.error("❌ Error fetching Project:", err);
            return res.status(500).render('error', {
                message: "Failed to load Project details",
                error: process.env.NODE_ENV === 'development' ? err : null
            });
        }

        if (results.length === 0) {
            return res.status(404).render('error', {
                message: "Project not found or deleted"
            });
        }

        const project = results[0];

        res.render('media/create', {
            currentUser: req.session.passport.user,
            project,  // contains projectId, photographerId, projectOwnerId + names
            title: 'Media Form'
        });
    });
});



router.post('/submit', isAuthenticated, async (req, res) => {
    try {
        const {
            ProjectID,
            ProjectOwnerID,
            PhotographerID,
            mediaFileName,
            filePath,
            catalogID,
            morphoID,
            clusterID,
            imagingDate,
            resolution,
            colorDepth,
            fileSizeBytes,
            fileFormat,
            description,
            cameraModel,
            imageEditingTool,
            comments
        } = req.body;

        console.log("📤 Media submission data:", req.body);
        const createdBy = req.session.passport.user.UserID;
        const updatedBy = createdBy;
        // Validation: required fields
        const missingFields = [];
        if (!ProjectID) missingFields.push("ProjectID");
        if (!ProjectOwnerID) missingFields.push("RequestorID");
        if (!PhotographerID) missingFields.push("PhotographerID");
        if (!mediaFileName) missingFields.push("mediaFileName");
        if (!filePath) missingFields.push("filePath");
        if (!catalogID) missingFields.push("catalogID");
        if (!morphoID) missingFields.push("morphoID");
        if (!clusterID) missingFields.push("clusterID");
        if (!imagingDate) missingFields.push("imagingDate");
        if (!description) missingFields.push("description");
        if (!cameraModel) missingFields.push("cameraModel");

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: " + missingFields.join(", ")
            });
        }

        const insertQuery = `
      INSERT INTO Media (
        ProjectID,
        PhotographerID,
        MediaFileName,
        FilePath,
        CatalogID,
        MorphoID,
        ClusterID,
        ImagingDate,
        Resolution,
        FileSizeBytes,
        FileFormat,
        Description,
        CameraModel,
        ImageEditingTool,
        Comments,
        CreatedDate,
        CreatedByID,
        UpdatedDate,
        UpdatedByID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(),?)
    `;

        const values = [
            ProjectID,
            PhotographerID,
            mediaFileName,
            filePath,
            catalogID,
            morphoID,
            clusterID,
            imagingDate,
            resolution || null,
            colorDepth || null,
            fileSizeBytes || null,
            fileFormat || null,
            description,
            cameraModel,
            imageEditingTool || null,
            comments || null,
            createdBy,
            updatedBy
        ];

        const [result] = await db.promise().query(insertQuery, values);

        console.log("✅ Media submitted successfully, ID:", result.insertId);


        res.redirect(`/media/view/${result.insertId}`);

    } catch (error) {
        console.error("❌ Media submission failed:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during media submission.",
            error: error.message
        });
    }
});

router.get('/view/:mediaId', isAuthenticated, (req, res) => {
    const mediaId = req.params.mediaId;

    const query = `
      SELECT 
        m.*,
        u1.Email AS CreatedByName,
        u2.Email AS UpdatedByName
      FROM Media m
      LEFT JOIN User u1 ON m.CreatedByID = u1.UserID
      LEFT JOIN User u2 ON m.UpdatedByID = u2.UserID
      WHERE m.MediaID = ? AND m.IsDeleted = 0
      ORDER BY m.CreatedDate DESC
    `;

    db.query(query, [mediaId], (err, results) => {
        if (err) {
            console.error("❌ Error fetching media record:", err);
            return res.status(500).render('error', {
                message: 'Error loading media entry',
                error: process.env.NODE_ENV === 'development' ? err : null
            });
        }

        if (results.length === 0) {
            return res.status(404).render('error', {
                message: 'Media record not found'
            });
        }
        console.log(results[0])
        res.render('media/view', {
            currentUser: req.session.passport.user,
            media: results[0], // Since we're querying by ID, we'll only get one record
            mediaId,
            title: "View Media",
        });
    });
});

// Controller for rendering the edit form
router.get('/edit/:mediaId', isAuthenticated, (req, res) => {
    const mediaId = req.params.mediaId;

    if (mediaId) {
        // Editing existing media
        const query = `
            SELECT m.*, 
                   p.ProjectOwnerID AS RequestorID,
                   u1.Email AS projectOwnerName,
                   photographer.Email AS photographerName
            FROM Media m
            JOIN Project p ON m.ProjectID = p.ProjectID
            LEFT JOIN User u1 ON p.ProjectOwnerID = u1.UserID
            JOIN ProjectUserPhotographyLink p ON p.ProjectID = p.ProjectID
            JOIN User photographer ON p.PhotographerID = photgrapher.UserID  

            WHERE m.MediaID = ? AND m.IsDeleted = 0
        `;

        db.query(query, [mediaId], (err, results) => {
            if (err || results.length === 0) {
                console.error("❌ Error fetching media:", err);
                return res.status(404).render('error', {
                    message: 'Media not found'
                });
            }

            res.render('media-edit', {
                media: results[0],
                editing: true,
                project: {
                    ProjectID: results[0].ProjectID,
                    ProjectOwnerID: results[0].RequestorID,
                    PhotographerID: results[0].PhotographerID,
                    projectOwnerName: results[0].projectOwnerName,
                    photographerName: results[0].photographerName
                }
            });
        });
    } else {
        // Creating new media - you'll need to pass project data
        // This part depends on how you're creating new media
        res.render('media-edit', {
            media: null,
            editing: false,
            project: req.query.project || {},
            title: "Media Edit" // You'll need to pass this
        });
    }
});

// Controller for handling form submission
router.post('/save', isAuthenticated, (req, res) => {
    const mediaData = req.body;

    const isEdit = mediaData.MediaID !== '';

    if (isEdit) {
        // Update existing media
        const query = `
            UPDATE Media SET
                MediaFileName = ?,
                FilePath = ?,
                CatalogID = ?,
                MorphoID = ?,
                ClusterID = ?,
                ImagingDate = ?,
                Resolution = ?,
                FileSize = ?,
                FileFormat = ?,
                Description = ?,
                CameraModel = ?,
                ImageEditingTool = ?,
                Comments = ?,
                UpdatedDate = NOW(),
                UpdatedByID = ?
            WHERE MediaID = ?
        `;
        const updatedBy = req.session.passport.user.UserID;
        const params = [
            mediaData.mediaFileName,
            mediaData.filePath,
            mediaData.catalogID,
            mediaData.morphoID,
            mediaData.clusterID,
            mediaData.imagingDate,
            mediaData.resolution,
            mediaData.colorDepth,
            mediaData.fileSize,
            mediaData.fileFormat,
            mediaData.description,
            mediaData.cameraModel,
            mediaData.imageEditingTool,
            mediaData.comments,
            updatedBy, // current user making the update
            mediaData.MediaID
        ];

        db.query(query, params, (err, result) => {
            if (err) {
                console.error("❌ Error updating media:", err);
                return res.status(500).json({ success: false, message: 'Error updating media' });
            }
            res.json({ success: true, message: 'Media updated successfully' });
        });
    } else {
        // Create new media
        const query = `
            INSERT INTO Media (
                ProjectID, PhotographerID, MediaFileName, FilePath,
                CatalogID, MorphoID, ClusterID, ImagingDate, Resolution,
                FileSize, FileFormat, Description, CameraModel,
                ImageEditingTool, Comments, CreatedByID, CreatedDate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        const params = [
            mediaData.ProjectID,
            mediaData.PhotographerID,
            mediaData.mediaFileName,
            mediaData.filePath,
            mediaData.catalogID,
            mediaData.morphoID,
            mediaData.clusterID,
            mediaData.imagingDate,
            mediaData.resolution,
            mediaData.colorDepth,
            mediaData.fileSize,
            mediaData.fileFormat,
            mediaData.description,
            mediaData.cameraModel,
            mediaData.imageEditingTool,
            mediaData.comments,
            req.user.id
        ];

        db.query(query, params, (err, result) => {
            if (err) {
                console.error("❌ Error creating media:", err);
                return res.status(500).json({ success: false, message: 'Error creating media' });
            }
            res.json({ success: true, message: 'Media created successfully', mediaId: result.insertId });
            // res.redirect(`/admin/view-all-media/view/${result.insertId}`); // Redirect to the view page of the newly created media
        });
    }
});

// Soft delete media by setting IsDelete = 1 and redirect
router.post('/delete/:mediaId', isAuthenticated, (req, res) => {
    const mediaId = req.params.mediaId;
    const userId = req.session.passport.user.UserID;

    // First verify the media exists and isn't already deleted
    const checkQuery = 'SELECT * FROM Media WHERE MediaID = ? AND IsDeleted = 0';

    db.promise().query(checkQuery, [mediaId])
        .then(([results]) => {
            if (results.length === 0) {
                req.flash('error', 'Media not found or already deleted');
                return res.redirect('/media/view-all');
            }

            // Perform soft delete
            const updateQuery = `
                UPDATE Media 
                SET IsDeleted = 1, 
                    UpdatedByID = ?, 
                    UpdatedDate = NOW() 
                WHERE MediaID = ?
            `;

            return db.promise().query(updateQuery, [userId, mediaId]);
        })
        .then(() => {
            // req.flash('success', 'Media has been archived successfully');
            res.redirect('/media/view-all');
        })
        .catch(error => {
            console.error("❌ Error soft deleting media:", error);
            req.flash('error', 'Error archiving media');
            res.redirect('/media/view-all');
        });
});
module.exports = router;