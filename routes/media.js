const express = require("express");
const router = express.Router();
const db = require("./db"); // Database connection
const { isAuthenticated, isAdmin } = require("../middleware/auth"); // Middleware
const { formatDisplayDate, userTypesEnumeration, imageEditingToolEnumeration, mediaFileFormatEnumeration, imagingPlatformEnumeration } = require("../middleware/utils");



// ✅ Admin Media Management Main Page Controller
router.get('/view-all', isAuthenticated, (req, res) => {
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
    const user = req.session.passport.user
    const query = user.UserType == userTypesEnumeration().admin
        ? baseQuery + "\nORDER BY m.CreatedDate DESC"
        : baseQuery + "\nWHERE m.IsDeleted = 0 AND photographer.UserID =" + user.UserID + " ORDER BY m.CreatedDate DESC";

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
            currentUser: user,
            title: "Admin Media "   // For success messages
        });

        // Clear session message if it exists
        if (req.session.message) {
            delete req.session.message;
        }
    });
});



router.get('/select-user-for/:mediaID/:projectID', isAuthenticated, async (req, res) => {
    const mediaID = req.params.mediaID;
    const projectID = req.params.projectID;
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
    const users = (await db.promise().query(query))[0];

    const currentProjectQuery = "SELECT ProjectID, ProjectName FROM Project WHERE ProjectID = " + projectID;
    const currentProject = mediaID != 'create-for-media'
        ? await db.promise().query(currentProjectQuery, [users.ProjectID])
        : null;
    // console.log(mediaID)
    const isEdit = mediaID != 'create-for-media';
    console.log('isEdit', isEdit)

    res.render('media/user-list', {
        users: users,
        currentUser: req.session.passport.user,
        title: 'Media Image List',
        isEdit: isEdit,
        mediaID: mediaID,
        currentProject: mediaID != 'create-for-media' ? currentProject[0][0] : ""
    });

});



router.get('/create-or-edit-for-project/:mediaID/:projectID/', isAuthenticated, async (req, res) => {
    const projectID = req.params.projectID;
    const mediaID = req.params.mediaID;
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

    //For EDIT
    const currentMediaQuery = mediaID != 'none' ? 'SELECT * FROM Media WHERE Media.MediaID = ' + mediaID : '';

    const project = (await db.promise().query(query, [projectID]))[0][0];
    const currentMedia = mediaID != 'none' ? (await db.promise().query(currentMediaQuery))[0][0] : "none";

    console.log(project)
    console.log('currentMedia', currentMedia)
    // console.log(imagingPlatformEnumeration())
    res.render('media/create-or-edit', {
        currentUser: req.session.passport.user,
        imageEditingTools: Object.values(imageEditingToolEnumeration()),
        imagingPlatforms: Object.values(imagingPlatformEnumeration()),
        fileFormats: Object.values(mediaFileFormatEnumeration()),
        currentMedia,
        imagingDate: formatDisplayDate(currentMedia.ImagingDate),
        project,  // contains projectID, photographerId, projectOwnerId + names
        title: 'Media Form'
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
            fileSizeBytes,
            fileFormat,
            description,
            imagingPlatform,
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
        if (!imagingPlatform) missingFields.push("imagingPlatform");
        console.log('imagingPlatform', imagingPlatform)
        console.log('createdBy', createdBy)
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
      ) VALUES (?,  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(),?)
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
            fileSizeBytes || null,
            fileFormat || null,
            description,
            imagingPlatform,
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

// Controller for handling form submission
router.post('/edit', isAuthenticated, (req, res) => {
    const mediaData = req.body;

    const isEdit = mediaData.MediaID !== '';

    if (isEdit) {
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
                ProjectID, PhotographerID, FileName, FilePath,
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

router.post('/restore/:mediaId', isAuthenticated, (req, res) => {
    const mediaId = req.params.mediaId;
    const userId = req.session.passport.user.UserID;

    // First verify the media exists and isn't already restored
    const checkQuery = 'SELECT * FROM Media WHERE MediaID = ? AND IsDeleted = 1';

    db.promise().query(checkQuery, [mediaId])
        .then(([results]) => {
            if (results.length === 0) {
                req.flash('error', 'Media not found or already restored');
                return res.redirect('/media/view-all');
            }

            // Perform soft restore
            const updateQuery = `
                UPDATE Media 
                SET IsDeleted = 0, 
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