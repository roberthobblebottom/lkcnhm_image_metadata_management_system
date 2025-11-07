const express = require("express");
const router = express.Router();
const db = require("./db"); // Database connection
const { isAuthenticated, isAdmin } = require("../middleware/auth"); // Middleware
const { formatDate, formatDisplayDate, requestStatusTuple } = require("../middleware/utils");

router.get('/create', isAuthenticated, async (req, res) => {
    const getProjectOwners = `
      SELECT u.UserID,u.Name, u.Email, u.UserType 
      FROM User u
      WHERE u.UserType IN ('projectOwner','admin')
        AND u.RequestStatus = 'approved'
        AND u.IsDeleted = 0
    `; // TODO wrong usertypeid filter

    const getPhotographers = `
      SELECT u.UserID,u.Name, u.Email 
      FROM User u
        WHERE u.RequestStatus = 'approved'
        AND u.IsDeleted = 0
    `; // todo wrong user type id filter these are hard coded.

    const [projectOwners] = await db.promise().query(getProjectOwners);
    console.log(projectOwners)
    const [photographers] = await db.promise().query(getPhotographers);
    res.render('project/create', {
        currentUser: req.session.passport.user,
        projectOwners: projectOwners,
        photographers: photographers,
        title: "Project Form"
    });
});

//  for creation of new project
router.post('/submit', isAuthenticated, async (req, res) => {
    console.log("in /submit-project")
    try {
        const requiredFields = [
            'projectOwner', 'photographer', 'requestDate',
            'startDate', 'endDate', 'summary',
            'specimenDetails', 'location'
        ];

        const missingFields = requiredFields.filter(field => !req.body[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        const requestDate = new Date(req.body.requestDate);
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(req.body.endDate);
        console.log('requestDate' + requestDate)
        if (isNaN(requestDate.getTime()) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format provided"
            });
        }

        if (startDate < requestDate) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be before request date"
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

        const requestStatus = "pending"; // Hardcoded for now – represents 'New'

        const insertQuery = `
      INSERT INTO Project (
        ProjectOwnerID,
        DateofRequest,
        ImagingStartDate,
        ImagingEndDate,
        SummaryofProject,
        SpecimenDetails,
        SpecimenLocationName,
        ImagingPlatform,
        Comments,
        CreatedDate,
        CreatedByID,
        UpdatedDate,
        UpdatedByID,
        IsDeleted,
        RequestStatus
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), ?, 0, ?)
        `;
        const updateQuery2 = `
        INSERT INTO ProjectUserPhotographyLink(
         PhotographerID,
         ProjectID)
         VALUES (?,?)
        `;
        const result = await db.promise().query(insertQuery, [
            req.body.projectOwner,
            req.body.requestDate,
            req.body.startDate,
            req.body.endDate,
            req.body.summary,
            req.body.specimenDetails,
            req.body.location,
            req.body.platform || null,
            req.body.comments || null,
            createdBy,
            createdBy,
            requestStatus
        ]);
        const r2 = await db.promise().query(
            "SELECT ProjectID FROM Project ORDER BY ProjectID DESC LIMIT 1",
            [])
        // console.log("r2", r2)
        projectID2 = r2[0][0].ProjectID
        const r3 = await db.promise().query(updateQuery2, [
            req.body.photographer,
            projectID2
        ])
        // console.log('r3', r3)
        console.log('📸 project inserted with RequestStatus =', requestStatus, ' UserID:', projectID2);

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
router.get('/view-all', isAuthenticated, (req, res) => {
    const queryForAdmin = `
        SELECT 
            p.*,
            projectOwner.Name AS projectOwnerName,
            projectOwner.Email,
            photographer.Name AS photographerName,
            photographer.Email AS photographerEmail,
            cb.Name AS CreatedByName,
            ub.Name AS UpdatedByName
        FROM Project p
        LEFT JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
        JOIN ProjectUserPhotographyLink irupl ON irupl.ProjectID = p.ProjectID
        JOIN User photographer on irupl.PhotographerID = photographer.UserID
        LEFT JOIN User cb ON p.CreatedByID = cb.UserID
        LEFT JOIN User ub ON p.UpdatedByID = ub.UserID
        ORDER BY p.CreatedDate DESC
    `;

    const queryForNonAdmin = `
    SELECT 
            p.*,
            projectOwner.Name AS projectOwnerName,
            projectOwner.Email,
            photographer.Name AS photographerName,
            photographer.Email AS photographerEmail,
            cb.Name AS CreatedByName,
            ub.Name AS UpdatedByName
        FROM Project p
        LEFT JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
        JOIN ProjectUserPhotographyLink irupl ON irupl.ProjectID = p.ProjectID
        JOIN User photographer on irupl.PhotographerID = photographer.UserID
        LEFT JOIN User cb ON p.CreatedByID = cb.UserID
        LEFT JOIN User ub ON p.UpdatedByID = ub.UserID
        WHERE p.IsDeleted = 0
        ORDER BY p.CreatedDate DESC
    `
    const user = req.session.passport.user
    const query = user.UserType != 'admin' ? queryForNonAdmin : queryForAdmin
    const adminID = user.UserType != 'admin' ? [user.UserID] : []

    console.log("📩 Fetching Projects...");

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
            title: "Projects Dashboard" // Add title here
        });
    });
});


// View Request (GET)
router.get('/view/:id', isAuthenticated, (req, res) => {
    const projectID = req.params.id;
    const query = `
        SELECT 
            p.*,
            projectOwner.Email AS projectOwnerName,
            photographer.Email AS photographerName,
            p.RequestStatus AS statusName,
            creator.Email AS CreatorEmail,
            creator.Name AS CreatorName,
            updater.Email AS UpdaterEmail,
            updater.Name AS UpdaterName
        FROM Project p
        LEFT JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
        JOIN ProjectUserPhotographyLink irupl ON irupl.ProjectID = p.ProjectID
        JOIN User photographer on irupl.PhotographerID = photographer.UserID
        LEFT JOIN User creator ON p.CreatedByID = creator.UserID
        LEFT JOIN User updater ON p.UpdatedByID = updater.UserID
        WHERE p.ProjectID = ?
    `;

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
            DateOfRequest: formatDate(results[0].DateOfRequest),
            ImagingStartDate: formatDate(results[0].ImagingStartDate),
            ImagingEndDate: formatDate(results[0].ImagingEndDate),
            CreatedDate: formatDate(results[0].CreatedDate),
            UpdatedDate: results[0].UpdatedDate ? formatDate(results[0].UpdatedDate) : null,
            IsDeleted: results[0].IsDeleted
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
    console.log(req.user)
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
                projectOwner.Name AS RequestorName,
                projectOwner.Email AS RequestorEmail,
                projectOwner.UserID AS RequestorID,
                photographer.Name AS PhotographerName,
                photographer.Email AS PhotographerEmail,
                photographer.UserID AS PhotographerUserID
            FROM Project p
            JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
            JOIN ProjectUserPhotographyLink i ON p.ProjectID = i.ProjectID
            JOIN User photographer ON i.PhotographerID = photographer.UserID 
            WHERE p.ProjectID = ?;
        `;
        // Get all needed data in parallel for better performance
        const [requestResults, photographerResults] = await Promise.all([
            db.promise().query(requestQuery, [projectID]),
            db.promise().query("SELECT UserID, Email,Name FROM User ORDER BY Email"),
        ]);
        if (requestResults[0].length === 0) {
            return res.status(404).render('error', { message: 'Request not found' });
        }
        // Format dates for display

        const request = {
            ...requestResults[0][0],
            DateOfRequest: formatDisplayDate(requestResults[0][0].DateOfRequest),
            ImagingStartDate: formatDisplayDate(requestResults[0][0].ImagingStartDate),
            ImagingEndDate: formatDisplayDate(requestResults[0][0].ImagingEndDate)
        };
        res.render(`project/edit`, {
            request: request,
            photographers: photographerResults[0],
            statuses: Object.values(requestStatusTuple()),
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
            PhotographerID,
            ImagingStartDate,
            ImagingEndDate,
            SummaryOfProject,
            SpecimenDetails,
            SpecimenLocationName,
            ImagingPlatform,
            RequestStatus,
            ReasonForRequest
        } = req.body;

        // === 1. VALIDATION ===
        if (!ImagingStartDate || !ImagingEndDate || (!RequestStatus && req.session.passport.user.UserType == 'admin')) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
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
            ImagingStartDate = ?,
            ImagingEndDate = ?,
            SummaryofProject = ?,
            SpecimenDetails = ?,
            SpecimenLocationName = ?,
            ImagingPlatform = ?,
            RequestStatus = ?,
            ReasonforRequest = ?,
            UpdatedByID = ?,
            UpdatedDate = NOW()
        WHERE ProjectID = ?
    `;
        const updateQuery2 =
            `
        UPDATE ProjectUserPhotographyLink
        SET PhotographerID = ?
        WHERE ProjectID = ?
        `;
        const results = await db.promise().query(updateQuery, [
            startDate,
            endDate,
            SummaryOfProject || null,
            SpecimenDetails || null,
            SpecimenLocationName || null,
            ImagingPlatform || null,
            RequestStatus,
            ReasonForRequest || null,
            req.session.passport.user.UserID,
            projectID
        ])
        const r2 = await db.promise().query(updateQuery2, [
            PhotographerID,
            projectID
        ]);
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