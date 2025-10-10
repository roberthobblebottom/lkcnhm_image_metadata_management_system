const express = require("express");
const router = express.Router();
const db = require("../db"); // Database connection
const { isAuthenticated, isAdmin } = require("../../middleware/auth"); // Middleware

const { formatDate, formatDisplayDate, requestStatusTuple } = require("../../middleware/utils");

router.get('/add-new-imaging-request', isAuthenticated, isAdmin, async (req, res) => {
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
    res.render('admin/create-imaging-request', {
        requestors,
        photographers,
        title: "Imaging Request Form",
        isAdmin: isAdmin
    });
});


// Route to view imaging requests
router.get('/view-all-imaging-requests', isAuthenticated, isAdmin, (req, res) => {
    const query = `
        SELECT 
            ir.*,
            r.Name AS requestorName,
            r.Email,
            photographer.Name AS photographerName,
            photographer.Email AS photographerEmail,
            cb.Name AS CreatedByName,
            ub.Name AS UpdatedByName
        FROM ImagingRequest ir
        LEFT JOIN User r ON ir.ImagingRequestorID = r.UserID
        JOIN ImagingRequestUserPhotographyLink irupl ON irupl.ImagingRequestID = ir.ImagingRequestID
        JOIN User photographer on irupl.PhotographerID = photographer.UserID
        LEFT JOIN User cb ON ir.CreatedByID = cb.UserID
        LEFT JOIN User ub ON ir.UpdatedByID = ub.UserID
        WHERE ir.IsDeleted = 0
        ORDER BY ir.CreatedDate DESC
    `;

    console.log("📩 Fetching Imaging Requests...");

    db.query(query, (err, results) => {
        if (err) {
            console.error('❌ Error fetching imaging requests:', err);
            return res.status(500).render('error', {
                message: 'Error loading imaging requests',
                error: process.env.NODE_ENV === 'development' ? err : null
            });
        }

        console.log(`📄 Fetched ${results.length} imaging requests`);
        // console.log(results)

        if (results.length === 0) {
            return res.render('admin/imaging-request-view-admin', {
                imagingRequests: [],
                message: 'No imaging requests found'
            });
        }

        res.render('admin/view-all-imaging-requests', {
            imagingRequests: results,
            currentUser: req.user,
            title: "Imaging Requests Dashboard" // Add title here
        });
    });
});


// View Request (GET)
router.get('/view-imaging-request/:id', isAuthenticated, isAdmin, (req, res) => {
    const imagingRequestID = req.params.id;
    const query = `
        SELECT 
            ir.*,
            r.Email AS requestor_name,
            photographer.Email AS photographer_name,
            r.RequestStatus AS status_name,
            creator.Email AS CreatorEmail,
            creator.Name AS CreatorName,
            updater.Email AS UpdaterEmail,
            updater.Name AS UpdaterName
        FROM ImagingRequest ir
        LEFT JOIN User r ON ir.ImagingRequestorID = r.UserID
        JOIN ImagingRequestUserPhotographyLink irupl ON irupl.ImagingRequestID = ir.ImagingRequestID
        JOIN User photographer on irupl.PhotographerID = photographer.UserID
        LEFT JOIN User creator ON ir.CreatedByID = creator.UserID
        LEFT JOIN User updater ON ir.UpdatedByID = updater.UserID
        WHERE ir.ImagingRequestID = ?
    `;

    db.query(query, [imagingRequestID], (err, results) => {
        if (err) {
            console.error('Error fetching imaging request:', err);
            return res.status(500).render('error', {
                message: 'Error loading imaging request',
                error: process.env.NODE_ENV === 'development' ? err : null
            });
        }

        if (results.length === 0) {
            return res.status(404).render('error', {
                message: 'Imaging request not found'
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

        res.render('view-imaging-request', {
            request: request,
            currentUser: req.user,
            title: "Admin View Imaging Request", // Add title here
            isAdmin: isAdmin
        });
    });
});

// Delete Request (POST)
// Soft Delete Request (POST) 
router.post('/delete-imaging-request/:id', isAuthenticated, isAdmin, (req, res) => {
    const imagingRequestID = req.params.id;
    const query = `
        UPDATE ImagingRequest 
        SET 
            IsDeleted = 1,
            UpdatedByID = ?,
            UpdatedDate = NOW()
        WHERE ImagingRequestID = ?
    `;
    console.log(req.user)
    db.query(query, [req.session.user.UserID, imagingRequestID], (err, results) => {
        if (err) {
            console.error('Error soft deleting request:', err);
            return res.status(500).send('Error marking request as deleted.');
        }

        res.redirect('/admin/imaging-request/view-all-imaging-requests');
    });
});


// Edit Imaging Request (GET)
// Define queries at the top of your file for better maintainability
router.get('/edit-imaging-request/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const imagingRequestID = req.params.id;
        // Get imaging request with joined data
        const requestQuery = `
            SELECT 
                ir.*,
                requestor.Name AS RequestorName,
                requestor.Email AS RequestorEmail,
                requestor.UserID AS RequestorID,
                
                photographer.Name AS PhotographerName,
                photographer.Email as PhotographerEmail,
                photographer.UserID AS PhotographerUserID,
                requestor.RequestStatus
            FROM ImagingRequest ir
            JOIN User requestor ON ir.ImagingRequestorID = requestor.UserID
            JOIN ImagingRequestUserPhotographyLink i ON ir.ImagingRequestID = i.ImagingRequestID
            JOIN User photographer ON i.PhotographerID = photographer.UserID 
            WHERE ir.ImagingRequestID = ?;
        `;
        console.log('imaging request id ' + imagingRequestID)
        // Get all needed data in parallel for better performance
        const [requestResults, photographerResults, requestorResults] = await Promise.all([
            db.promise().query(requestQuery, [imagingRequestID]),
            db.promise().query("SELECT UserID, Email,Name FROM User WHERE UserType = 'photographer' ORDER BY Email"),
            db.promise().query("SELECT UserID, Email FROM User WHERE UserType = 'requestor' ORDER BY Email")
        ]);
        if (requestResults[0].length === 0) {
            return res.status(404).render('error', { message: 'Request not found' });
        }
        // Format dates for display
        const request = {
            ...requestResults[0][0],
            DateOfRequest: formatDisplayDate(requestResults[0][0].DateofRequest),
            ImagingStartDate: formatDisplayDate(requestResults[0][0].ImagingStartDate),
            ImagingEndDate: formatDisplayDate(requestResults[0][0].ImagingEndDate)
        };
        console.log("---" + Object.keys(request))
        console.log("---" + Object.values(request))
        console.log(request.RequestStatus)

        res.render(`admin/edit-imaging-request`, {
            request: request,
            photographers: photographerResults[0],
            statuses: Object.values(requestStatusTuple()),
            requestors: requestorResults[0],
            currentUser: req.user,
            title: "Edit Imaging Request", // Add title here
            isAdmin: isAdmin
        });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).render('error', { message: 'Server error' });
    }
});

// Helper function for date formatting



router.post('/edit-imaging-request/:id', isAuthenticated, isAdmin, async (req, res) => {
    // === 0. SESSION VALIDATION ===
    if (!req.session.user || !req.session.user.UserID) {
        console.error("❌ No user in session");
        return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
    }

    const imagingRequestID = req.params.id;
    const {
        PhotographerID,
        ImagingStartDate,
        ImagingEndDate,
        SummaryofProject,
        SpecimenDetails,
        SpecimenLocationName,
        ImagingPlatform,
        RequestStatus,
        ReasonforRequest
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
        UPDATE ImagingRequest 
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
        WHERE ImagingRequestID = ?
    `;
    const updateQuery2 =
        `
        UPDATE ImagingRequestUserPhotographyLink
        SET PhotographerID = ?
        WHERE ImagingRequestID = ?
        `;
    console.log("a")
    const results = await db.promise().query(updateQuery, [
        startDate,
        endDate,
        SummaryofProject || null,
        SpecimenDetails || null,
        SpecimenLocationName || null,
        ImagingPlatform || null,
        RequestStatus,
        ReasonforRequest || null,
        req.session.user.UserID,
        imagingRequestID
    ], (err, result) => {
        if (err) {
            console.error('❌ Error updating request:', err);
            return res.status(500).json({
                success: false,
                message: 'Server error during update',
                details: process.env.NODE_ENV === 'development' ? err.message : null
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Request not found or no changes made' });
        }

    });
    console.log('b')
    console.log(results)
    const r2 = await db.promise().query(updateQuery2, [
        PhotographerID,
        imagingRequestID
    ], (err, result) => {
        if (err) {
            console.error('❌ Error updating request:', err);
            return res.status(500).json({
                success: false,
                message: 'Server error during update',
                details: process.env.NODE_ENV === 'development' ? err.message : null
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Request not found or no changes made' });
        }
    });
    console.log("c")
    console.log(r2)
    // Return success response
    res.json({
        success: true,
        message: 'Imaging request updated successfully',
        redirectUrl: `/admin/imaging-request/view-imaging-request/${imagingRequestID}`
    });
});

module.exports = router;