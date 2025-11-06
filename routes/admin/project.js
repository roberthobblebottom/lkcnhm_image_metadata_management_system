const express = require("express");
const router = express.Router();
const db = require("../db"); // Database connection
const { isAuthenticated, isAdmin } = require("../../middleware/auth"); // Middleware
const { formatDate, formatDisplayDate, requestStatusTuple } = require("../../middleware/utils");

router.get('/add-new-project', isAuthenticated, isAdmin, async (req, res) => {
    const getRequestors = `
      SELECT u.UserID, u.Email 
      FROM User u
      WHERE u.UserType IN ('requestor','admin')
        AND u.RequestStatus = 'approved'
        AND u.IsDeleted = 0
    `; // TODO wrong usertypeid filter

    const getPhotographers = `
      SELECT u.UserID, u.Email 
      FROM User u
        WHERE u.RequestStatus = 'approved'
        AND u.IsDeleted = 0
    `; // todo wrong user type id filter these are hard coded.

    const [requestors] = await db.promise().query(getRequestors);
    const [photographers] = await db.promise().query(getPhotographers);
    console.log(requestors)
    res.render('admin/create-project', {
        requestors,
        photographers,
        title: "Project Form",
        isAdmin: isAdmin
    });
});


// Route to view projects
router.get('/view-all-projects', isAuthenticated, isAdmin, (req, res) => {
    const query = `
        SELECT 
            p.*,
            projectOwner.Name AS requestorName,
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
    `;

    console.log("📩 Fetching Projects...");

    db.query(query, (err, results) => {
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
            return res.render('admin/view-all-projects', {
                projects: [],
                message: 'No projects found'
            });
        }

        res.render('admin/view-all-projects', {
            projects: results,
            currentUser: req.user,
            title: "Projects Dashboard" // Add title here
        });
    });
});


// View Request (GET)
router.get('/view-project/:id', isAuthenticated, isAdmin, (req, res) => {
    const projectID = req.params.id;
    const query = `
        SELECT 
            p.*,
            projectOwner.Email AS requestor_name,
            photographer.Email AS photographer_name,
            p.RequestStatus AS status_name,
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
        console.log("dddddd" + results[0].DateOfRequest)
        // Format dates for display
        const request = {
            ...results[0],
            DateOfRequest: formatDate(results[0].DateOfRequest),
            ImagingStartDate: formatDate(results[0].ImagingStartDate),
            ImagingEndDate: formatDate(results[0].ImagingEndDate),
            CreatedDate: formatDate(results[0].CreatedDate),
            UpdatedDate: results[0].UpdatedDate ? formatDate(results[0].UpdatedDate) : null,
            IsDeleted: results[0].IsDeleted ? 'Yes' : 'No'
        };

        res.render('view-project', {
            request: request,
            currentUser: req.user,
            title: "Admin View Project", // Add title here
            isAdmin: isAdmin
        });
    });
});

// Delete Request (POST)
// Soft Delete Request (POST) 
router.post('/delete-project/:id', isAuthenticated, isAdmin, (req, res) => {
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

        res.redirect('/admin/project/view-all-projects');
    });
});


// Edit Project (GET)
// Define queries at the top of your file for better maintainability
router.get('/edit-project/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const projectID = req.params.id;
        const requestQuery = `
            SELECT 
                p.*,
                requestor.Name AS RequestorName,
                requestor.Email AS RequestorEmail,
                requestor.UserID AS RequestorID,
                photographer.Name AS PhotographerName,
                photographer.Email AS PhotographerEmail,
                photographer.UserID AS PhotographerUserID
            FROM Project p
            JOIN User projectOwner ON p.ProjectOwnerID = requestor.UserID
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
        res.render(`admin/edit-project`, {
            request: request,
            photographers: photographerResults[0],
            statuses: Object.values(requestStatusTuple()),
            currentUser: req.user,
            title: "Edit Project", // Add title here
            isAdmin: isAdmin
        });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).render('error', { message: 'Server error' });
    }
});


router.post('/edit-project/:id', isAuthenticated, isAdmin, async (req, res) => {
    // === 0. SESSION VALIDATION ===
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
    if (!ImagingStartDate || !ImagingEndDate || !RequestStatus) {
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
    res.json({
        success: true,
        message: 'project updated successfully',
        redirectUrl: `/admin/project/view-project/${projectID}`
    });
});

module.exports = router;