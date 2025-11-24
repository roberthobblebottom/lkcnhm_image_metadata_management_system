const express = require("express");
const router = express.Router();
const db = require("./db"); // Database connection
const { isAuthenticated, isAdmin } = require("../middleware/auth"); // Middleware

const { formatDate, formatDisplayDate, projectStatusEnumeration, projectTypeEnumeration,
    mediaFileFormatEnumeration, imagingPlatformEnumeration, imageEditingToolEnumeration, userTypesEnumeration,
    requestStatusEnumeration } = require('../middleware/utils');
router.get('/create', isAuthenticated, async (req, res) => {
    const getProjectOwners = `
      SELECT u.UserID,u.FullName, u.Email, u.UserType 
      FROM User u
      WHERE u.UserType IN ('projectOwner','admin')
        AND u.RequestStatus = 'approved'
        AND u.IsDeleted = 0
    `; // TODO wrong usertypeid filter

    const getPhotographers = `
      SELECT u.UserID,u.FullName, u.Email 
      FROM User u
        WHERE u.RequestStatus = 'approved'
        AND u.IsDeleted = 0
    `; // todo wrong user type id filter these are hard coded.

    const [projectOwners, photographers] = await Promise.all(
        [
            db.promise().query(getProjectOwners),
            db.promise().query(getPhotographers),
        ]
    )
    // console.log('projectOwners', projectOwners)
    // console.log(req.session.passport.user)

    res.render('project/create', {
        currentUser: req.session.passport.user,
        projectOwners: projectOwners[0],
        photographers: photographers[0],
        projectTypes: Object.values(projectTypeEnumeration()),
        imagingPlatforms: Object.values(imagingPlatformEnumeration()),
        title: "Project Form"
    });
});

//  for creation of new project
router.post('/create', isAuthenticated, async (req, res) => {
    console.log("in /create-project")
    try {
        const requiredFields = [
            'projectOwner', 'projectName', 'projectType',
            'startDate', 'endDate', 'summary',
            'specimenDetails',
        ];
        console.log("req.body", req.body)
        const missingFields = requiredFields.filter(field => !req.body[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        const startDate = new Date(req.body.startDate);
        const endDate = new Date(req.body.endDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format provided"
            });
        }

        if (endDate < startDate) {
            return res.status(400).json({
                success: false,
                message: "End date cannot be before start date"
            });
        }

        const createdBy = req.session.passport.user.UserID;
        if (!createdBy) {
            console.error("User ID not found in session");
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Please login first."
            });
        }

        if (req.body.selectedImagingPlatforms.length == 0) {
            return res.status(400).json({
                success: false,
                message: "there are no selected Imaging Platforms"
            });
        }
        if (req.body.selectedPhotographers.length == 0) {
            return res.status(400).json({
                success: false,
                message: "there are no selected selected photographers"
            });
        }
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
        await db.promise().query(insertQuery, [
            req.body.projectName,
            req.body.projectType,
            req.body.projectOwner,
            req.body.startDate,
            req.body.endDate,
            req.body.summary,
            req.body.specimenDetails,
            req.body.comments || null,
            createdBy,
            createdBy,
            projectStatusEnumeration().in_progress
        ]);

        // Getting new project id
        const r2 = await db.promise().query(
            "SELECT ProjectID FROM Project ORDER BY ProjectID DESC LIMIT 1",
            [])
        projectID2 = r2[0][0].ProjectID

        photographersTuple = []
        for (x of req.body.selectedPhotographers) {
            photographersTuple.push([x, projectID2])
        }
        await db.promise().query(insertPhotographersQuery, [photographersTuple])

        imagingPlatformsTuple = []
        for (x of req.body.selectedImagingPlatforms) {
            imagingPlatformsTuple.push([x, projectID2])
        }

        await db.promise().query(insertImagingPlatformsQuery, [imagingPlatformsTuple])

        console.log('📸 project inserted with  UserID:', projectID2);

        const redirectUrl = `/project/view/${projectID2}`
        // Return success response
        res.json({
            success: true,
            message: 'project submitted successfully',
            redirectUrl: redirectUrl
        });

    } catch (err) {
        console.error("❌ Error in submitProject:", err);
        res.status(500).json({
            success: false,
            message: "Error submitting the project.",
            error: err.message
        });
    }
});

// Route to view projects
router.get('/view-all', isAuthenticated, async (req, res) => {
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
    SELECT pupl.ProjectID, GROUP_CONCAT(DISTINCT user.FullName SEPARATOR ', ') as photographersNames 
    FROM ProjectUserPhotographyLink pupl JOIN User user ON user.UserID = pupl.PhotographerID
    GROUP BY pupl.ProjectID 
    ORDER BY pupl.ProjectID
    `;

    const user = req.session.passport.user
    const query = user.UserType != 'admin' ? queryForNonAdmin : queryForAdmin
    console.log(query)
    const adminID = user.UserType != 'admin' ? [user.UserID] : []

    console.log("📩 Fetching Projects...");
    const photographersTemp = (await db.promise().query(queryForPhotographers, [user.UserID]))[0]
    const photographers = {}
    for (x of photographersTemp) {
        photographers[x.ProjectID] = x.photographersNames
    }
    console.log('photographers', photographers)

    db.query(query, adminID, (err, results) => {
        if (err) {
            console.error('❌ Error fetching projects:', err);
            return res.status(500).render('error', {
                message: 'Error loading projects',
                error: process.env.NODE_ENV === 'development' ? err : null
            });
        }

        console.log(`📄 Fetched ${results.length} projects`);
        // console.log(results)

        if (results.length === 0) {
            return res.render('project/view-all', {
                projects: [],
                message: 'No projects found'
            });
        }
        res.render('project/view-all', {
            projects: results,
            currentUser: req.user,
            photographers: photographers,
            title: "Projects Dashboard" // Add title here
        });
    });
});


// View Request (GET)
router.get('/view/:id', isAuthenticated, async (req, res) => {
    const projectID = req.params.id;
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

    const photographersQuery =
        `SELECT user.FullName FROM ProjectUserPhotographyLink pupl 
        JOIN User user ON user.UserID = pupl.PhotographerID
        WHERE pupl.ProjectID = ? `;
    const imagingPlatformsQuery = `
    SELECT ImagingPlatform FROM ImagingPlatformInstance WHERE ProjectID = ?
    `;


    const photographersTemp1 = (await db.promise().query(photographersQuery, [projectID]))[0]
    const photographers = []
    // console.log('temp', photographersTemp1)
    for (x of photographersTemp1) {
        photographers.push(x.FullName)
    }
    console.log('photographers', photographers)



    const imagingPlatformsTemp1 = (await db.promise().query(imagingPlatformsQuery, [projectID]))[0]
    const imagingPlatforms = []
    // console.log('temp', imagingPlatformsTemp1)
    for (x of imagingPlatformsTemp1) {
        imagingPlatforms.push(x.ImagingPlatform)
    }
    console.log('imagingPlatforms', imagingPlatforms)
    // return
    db.query(query, [projectID], (err, results) => {
        if (err) {
            console.error('Error fetching project:', err);
            return res.status(500).render('error', {
                message: 'Error loading project',
                error: process.env.NODE_ENV === 'development' ? err : null
            });
        }

        if (results.length === 0) {
            return res.status(404).render('error', {
                message: 'project not found'
            });
        }
        // Format dates for display
        console.log(results[0].statusName)
        const request = {
            ...results[0],
            CreatedDate: formatDate(results[0].CreatedDate),
            ImagingStartDate: formatDate(results[0].ImagingStartDate),
            ImagingEndDate: formatDate(results[0].ImagingEndDate),
            CreatedDate: formatDate(results[0].CreatedDate),
            UpdatedDate: results[0].UpdatedDate ? formatDate(results[0].UpdatedDate) : null,
            IsDeleted: results[0].IsDeleted,
            photographers: photographers.length != 0
                ? photographers.toString().replace(",", ", ")
                : 'Not Specified',
            imagingPlatforms: imagingPlatforms.length != 0
                ? imagingPlatforms.toString().replace(",", ", ")
                : 'Not Specified'
        };

        res.render('project/view', {
            request: request,
            currentUser: req.user,
            title: "View Project" // Add title here
        });
    });
});

// Delete Request (POST)
// Soft Delete Request (POST) 
router.post('/delete/:id', isAuthenticated, (req, res) => {
    const projectID = req.params.id;
    const query = `
        UPDATE Project
    SET
    IsDeleted = 1,
        UpdatedByID = ?,
        UpdatedDate = NOW()
        WHERE ProjectID = ?
        `;
    db.query(query, [req.session.passport.user.UserID, projectID], (err, results) => {
        if (err) {
            console.error('Error soft deleting request:', err);
            return res.status(500).send('Error marking request as deleted.');
        }

        res.redirect('/project/view-all');
    });
});

//undo soft delete
router.post('/restore/:id', isAuthenticated, (req, res) => {
    const projectID = req.params.id;
    const query = `
        UPDATE Project
    SET
    IsDeleted = 0,
        UpdatedByID = ?,
        UpdatedDate = NOW()
        WHERE ProjectID = ?
        `;
    console.log(req.user)
    db.query(query, [req.session.passport.user.UserID, projectID], (err, results) => {
        if (err) {
            console.error('Error soft deleting request:', err);
            return res.status(500).send('Error marking request as deleted.');
        }

        res.redirect('/project/view-all');
    });
});

// Edit Project (GET)
// Define queries at the top of your file for better maintainability
router.get('/edit/:id', isAuthenticated, async (req, res) => {
    try {
        const projectID = req.params.id;
        const requestQuery = `
            SELECT
            p.*,
            projectOwner.FullName AS RequestorName,
            projectOwner.Email AS RequestorEmail,
            projectOwner.UserID AS RequestorID
            FROM Project p
            JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
            WHERE p.ProjectID = ?;
    `;
        // Get all needed data in parallel for better performance
        const [requestResults, imagingPlatformTemp, selectedPhotographersTemp, allPhotographers] = await Promise.all([
            db.promise().query(requestQuery, [projectID]),
            db.promise().query("SELECT ImagingPlatform FROM ImagingPlatformInstance WHERE ProjectID = ? ORDER BY ImagingPlatform",
                [projectID]
            ),
            db.promise().query("SELECT user.UserID ,user.FullName FROM ProjectUserPhotographyLink p JOIN User user on user.UserID = p.PhotographerID WHERE p.ProjectID = ? ", [projectID])
            , db.promise().query("SELECT UserID,FullName FROM User WHERE RequestStatus = '" + requestStatusEnumeration().approved + "'")
        ])
        if (requestResults[0].length === 0) {
            return res.status(404).render('error', { message: 'Request not found' });
        }
        const currentlySelectedPhotographers = []
        for (i of selectedPhotographersTemp[0]) {
            currentlySelectedPhotographers.push(i);
        }
        console.log('currentlySelectedPhotographersResults', currentlySelectedPhotographers)
        console.log("all", allPhotographers[0])
        const imagingPlatforms = []
        for (i of imagingPlatformTemp[0]) {
            imagingPlatforms.push(Object.values(i)[0]);
        }

        // Format dates for display
        const request = {
            ...requestResults[0][0],
            CreatedDate: formatDisplayDate(requestResults[0][0].CreatedDate),
            ImagingStartDate: formatDisplayDate(requestResults[0][0].ImagingStartDate),
            ImagingEndDate: formatDisplayDate(requestResults[0][0].ImagingEndDate)
        };

        res.render(`project/edit`, {
            request: request,
            allPhotographers: allPhotographers[0],
            selectedPhotographers: currentlySelectedPhotographers,
            statuses: Object.values(projectStatusEnumeration()),
            projectTypes: Object.values(projectTypeEnumeration()),
            imagingPlatforms: Object.values(imagingPlatformEnumeration()),
            selectedImagingPlatforms: imagingPlatforms,
            currentUser: req.user,
            title: "Edit Project"// Add title here
        });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).render('error', { message: 'Server error' });
    }
});

router.post('/edit/:id', isAuthenticated, async (req, res) => {
    try {
        if (!req.session.passport.user || !req.session.passport.user.UserID) {
            console.error("❌ No user in session");
            return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
        }

        const projectID = req.params.id;
        const {
            ProjectName,
            PhotographerID,
            ImagingStartDate,
            ImagingEndDate,
            SummaryOfProject,
            DetailsOfSpecimens,
            LocationsOfSpecimens,
            ProjectStatus,
            selectedImagingPlatforms,
            selectedPhotographers,
        } = req.body;

        newSelectedImagingPlatforms = selectedImagingPlatforms.split(",")
        console.log(newSelectedImagingPlatforms)

        newSelectedPhotographers = selectedPhotographers.split(",")
        console.log('newSelectedPhotographers', newSelectedPhotographers)

        // === 1. VALIDATION ===
        if (!ImagingStartDate || !ImagingEndDate || !ProjectStatus) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        if (newSelectedImagingPlatforms.length == 0
            || newSelectedImagingPlatforms.length == 1
            && newSelectedImagingPlatforms[0] == '') {
            return res.status(400).json({ success: false, message: "No Selected Imaging Platforms" })
        }
        if (newSelectedPhotographers.length == 0
            || newSelectedPhotographers.length == 1
            && newSelectedPhotographers[0] == '') {
            return res.status(400).json({ success: false, message: "no Selected Photographers" })
        }

        // Date validation
        const startDate = new Date(ImagingStartDate);
        const endDate = new Date(ImagingEndDate);
        if (isNaN(startDate.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid start date format' });
        }
        if (isNaN(endDate.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid end date format' });
        }
        if (startDate >= endDate) {
            return res.status(400).json({ success: false, message: 'End date must be after start date' });
        }

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
        UpdatedDate = NOW()
        WHERE ProjectID = ?
        `;
        // const updateQuery2 =
        //     `
        // UPDATE ProjectUserPhotographyLink
        // SET PhotographerID = ?
        // WHERE ProjectID = ?
        // `;

        /// IMAGING PLATFORMS OPERATIONS START
        const selectImagingQuery = `
        SELECT ImagingPlatform FROM ImagingPlatformInstance WHERE ProjectID = ?`;
        const temp = (await db.promise().query(selectImagingQuery, [projectID]))[0]
        currentSelectedImagingPlatforms = []
        for (x of temp) {
            currentSelectedImagingPlatforms.push(x.ImagingPlatform)
        }
        console.log("currentSelectedImagingPlatforms", currentSelectedImagingPlatforms)

        //Getting differences
        const temp2 = newSelectedImagingPlatforms.filter((e) => !currentSelectedImagingPlatforms.includes(e))
        imagingPlatformsToBeAdded = []
        for (x of temp2) {
            imagingPlatformsToBeAdded.push([x, projectID])
        }
        console.log('imagingPlatforms to be added', imagingPlatformsToBeAdded)
        imagingPlatformsToBeRemoved = currentSelectedImagingPlatforms.filter((e) => !newSelectedImagingPlatforms.includes(e))
        console.log('imagingPlatformsToBeRemoved', imagingPlatformsToBeRemoved)

        //the update
        if (imagingPlatformsToBeRemoved.length != 0) {
            await db.promise().query("DELETE FROM ImagingPlatformInstance WHERE ImagingPlatform in (?) AND ProjectID =?", [imagingPlatformsToBeRemoved, projectID])
        }
        if (imagingPlatformsToBeAdded.length != 0) {
            await db.promise().query("INSERT INTO ImagingPlatformInstance(ImagingPlatform,ProjectID) VALUES ? ", [imagingPlatformsToBeAdded])
        }

        /// IMAGING PLATFORMS OPERATIONS END
        console.log("\n")

        /// Photographers OPERATIONS START
        const selectPhotographerQuery = `
        SELECT PhotographerID FROM ProjectUserPhotographyLink WHERE ProjectID = ?`;
        const temp3 = (await db.promise().query(selectPhotographerQuery, [projectID]))[0]
        currentSelectedPhotographers = []
        for (x of temp3) {
            currentSelectedPhotographers.push(x.PhotographerID.toString())
        }
        console.log("currentSelectedPhotographers", currentSelectedPhotographers)

        //Getting differences
        const temp4 = newSelectedPhotographers.filter((e) => !currentSelectedPhotographers.includes(e))
        photographersToBeAdded = []
        for (x of temp4) {
            photographersToBeAdded.push([x, projectID])
        }
        console.log('photographers to be added (photographerID,projectID)', photographersToBeAdded)
        photographersToBeRemoved = currentSelectedPhotographers.filter((e) => !newSelectedPhotographers.includes(e))
        console.log('photographersToBeRemoved', photographersToBeRemoved)
        // return;
        //the update
        if (photographersToBeRemoved.length != 0) {
            await db.promise().query("DELETE FROM ProjectUserPhotographyLink WHERE PhotographerID in (?) AND ProjectID =?", [photographersToBeRemoved, projectID])
        }
        if (photographersToBeAdded.length != 0) {
            await db.promise().query("INSERT INTO ProjectUserPhotographyLink(PhotographerID,ProjectID) VALUES ? ", [photographersToBeAdded])
        }
        /// Photographers OPERATIONS END

        await db.promise().query(updateQuery, [
            ProjectName,
            startDate,
            endDate,
            SummaryOfProject || null,
            DetailsOfSpecimens || null,
            LocationsOfSpecimens || null,
            ProjectStatus,
            req.session.passport.user.UserID,
            projectID
        ])
        // await db.promise().query(updateQuery2, [
        //     PhotographerID,
        //     projectID
        // ]);
        // Return success response
        console.log("route edit here")
        res.json({
            success: true,
            message: 'project updated successfully',
            redirectUrl: `/project/view/${projectID}`
        });
        console.log("route edit here")
    } catch (err) {
        console.error("❌ Error in editing project:", err);
        res.status(500).json({
            success: false,
            message: "Error submitting the project.",
            error: err.message
        });
    }

});

module.exports = router;