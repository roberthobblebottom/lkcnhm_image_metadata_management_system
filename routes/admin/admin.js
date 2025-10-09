const express = require("express");
const router = express.Router();
const path = require("path");
const db = require("../db"); // Database connection
const mediaRoutes = require("./media");
const { isAuthenticated, isAdmin } = require("../../middleware/auth"); // Middleware
const { formatDate } = require("../../middleware/utils");

router.use("/media", mediaRoutes);
// 📌 Serve Admin Users Page (HTML)
router.get("/admin-users", isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, "../views/admin-users.html"));
});

// 📌 API: Fetch Users Data
router.get("/api/users", isAuthenticated, isAdmin, (req, res) => {
    const query = "SELECT LoginUserID as id, LoginUserName as name, Email as email, LoginUserType as role FROM LoginUser WHERE IsDelete = 0";

    db.query(query, (err, results) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// 🔒 Admin Routes (Protected)
router.get("/dashboard", isAuthenticated, isAdmin, (req, res) => {
    console.log("🟢 Accessing Admin Dashboard - Session Data:", req.session.user);
    res.render("admin-dashboard", { user: req.session.user, title: "Admin Dashboard" });
});

//change-password.ejs
router.get('/change-password', isAuthenticated, isAdmin, (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    res.render('change-password', { user: req.session.user.Email }); // ✅ pass `user` to EJS
});

router.post('/change-password', isAuthenticated, (req, res) => {
    const email = req.session.user.Email;
    const { old_password, new_password } = req.body;

    console.log("📩 Change Password Request for:", email);
    console.log("🧾 Request Body:", req.body);

    const checkQuery = 'SELECT Password FROM User WHERE Email = ?';

    db.query(checkQuery, [email], (err, results) => {
        if (err) {
            console.error("❌ MySQL SELECT error:", err);
            return res.json({ success: false, message: "❌ Database error" });
        }

        if (results.length === 0) {
            return res.json({ success: false, message: "❌ Email not found" });
        }

        const currentPassword = results[0].Password;

        if (old_password !== currentPassword) {
            return res.json({ success: false, message: "❌ Old password is incorrect" });
        }

        if (old_password === new_password) {
            return res.json({ success: false, message: "❌ New password must be different from old password" });
        }

        const updateQuery = 'UPDATE User SET Password = ?, UpdatedDate = NOW() WHERE Email = ?';

        db.query(updateQuery, [new_password, email], (err, updateResult) => {
            if (err) {
                console.error("❌ MySQL UPDATE error:", err);
                return res.json({ success: false, message: "❌ Failed to update password" });
            }

            if (updateResult.affectedRows === 0) {
                return res.json({ success: false, message: "❌ No rows were updated" });
            }

            console.log("✅ Password updated for:", email);
            return res.json({ success: true, message: "✅ Password changed successfully!" });

        });
    });
});

router.get('/add-new-imaging-request', isAuthenticated, isAdmin, (req, res) => {
    const getRequestors = `
      SELECT u.UserID, u.Email 
      FROM User u
      WHERE u.UserType = 'requestor'
        AND u.RequestStatus = 'approved'
        AND u.IsDeleted = 0
    `; // TODO wrong usertypeid filter

    const getPhotographers = `
      SELECT u.UserID, u.Email 
      FROM User u
      WHERE u.UserType = 'photographer' 
        AND u.RequestStatus = 'approved'
        AND u.IsDeleted = 0
    `; // todo wrong user type id filter these are hard coded.

    db.query(getRequestors, (err1, requestors) => {
        if (err1) {
            console.error("❌ Error loading requestors:", err1);
            return res.status(500).render('error', { message: "Error loading requestors" });
        }

        db.query(getPhotographers, (err2, photographers) => {
            if (err2) {
                console.error("❌ Error loading photographers:", err2);
                return res.status(500).render('error', { message: "Error loading photographers" });
            }

            res.render('imaging-request-admin', {
                requestors,
                photographers,
                title: "Imaging Request Form",
                isAdmin: isAdmin
            });
        });
    });
});


router.get('/get-user', isAuthenticated, (req, res) => {
    const getRequestors = "SELECT id, Email FROM User WHERE UserTypeID IN (1, 2)";
    const getPhotographers = "SELECT id, Email FROM User WHERE UserTypeID IN (3, 4)";

    db.query(getRequestors, (err1, requestors) => {
        if (err1) {
            console.error("Error loading requestors:", err1);
            return res.status(500).json({
                success: false,
                message: "Error loading requestors"
            });
        }

        db.query(getPhotographers, (err2, photographers) => {
            if (err2) {
                console.error("Error loading photographers:", err2);
                return res.status(500).json({
                    success: false,
                    message: "Error loading photographers"
                });
            }

            res.json({
                success: true,
                requestors: requestors,
                photographers: photographers
            });
        });
    });
});

// Route to view imaging requests
router.get('/view-all-imaging-requests', isAuthenticated, isAdmin, (req, res) => {
    const query = `
        SELECT 
            ir.*,
            r.Name AS requestor_name,
            photographer.Email AS photographer_name,
            cb.Email AS CreatedByName,
            ub.Email AS UpdatedByName
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
            return res.render('imaging-request-view-admin', {
                imagingRequests: [],
                message: 'No imaging requests found'
            });
        }

        res.render('imaging-request-view-admin', {
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
            creator.Email AS creator_name,
            updater.Email AS updater_name
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

        // Format dates for display
        const request = {
            ...results[0],
            DateofRequest: formatDate(results[0].DateofRequest),
            ImagingStartDate: formatDate(results[0].ImagingStartDate),
            ImagingEndDate: formatDate(results[0].ImagingEndDate),
            CreatedDate: formatDate(results[0].CreatedDate),
            UpdatedDate: results[0].UpdatedDate ? formatDate(results[0].UpdatedDate) : null,
            IsDeleted: results[0].IsDeleted ? 'Yes' : 'No'
        };

        res.render('view-imaging-request', {
            request: request,
            currentUser: req.user,
            title: "Admin View Imaging Request" // Add title here
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

        res.redirect('/admin/view-all-imaging-requests');
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
                requestor.Name AS requestor_name,
                requestor.UserID AS requestor_id,
                photographer.Name AS photographer_name,
                photographer.UserID AS photographer_id,
                requestor.RequestStatus
            FROM ImagingRequest ir
            LEFT JOIN User requestor ON ir.ImagingRequestorID = requestor.UserID
            JOIN ImagingRequestUserPhotographyLink p ON ir.ImagingRequestID = p.ImagingRequestID
            JOIN User photographer ON p.PhotographerID = requestor.UserID  
            WHERE ir.ImagingRequestID = ?
        `;

        // Get all needed data in parallel for better performance
        const [requestResults, photographerResults, requestorResults] = await Promise.all([
            db.promise().query(requestQuery, [imagingRequestID]),
            db.promise().query("SELECT UserID, Email FROM User WHERE UserType = 'photographer' ORDER BY Email"),
            db.promise().query("SELECT UserID, Email FROM User WHERE UserType = 'requestor' ORDER BY Email")
        ]);

        if (requestResults[0].length === 0) {
            return res.status(404).render('error', { message: 'Request not found' });
        }

        // Format dates for display
        const request = {
            ...requestResults[0][0],
            DateofRequest: formatDisplayDate(requestResults[0][0].DateofRequest),
            ImagingStartDate: formatDisplayDate(requestResults[0][0].ImagingStartDate),
            ImagingEndDate: formatDisplayDate(requestResults[0][0].ImagingEndDate)
        };
        res.render('edit-imaging-request', {
            request: request,
            photographers: photographerResults[0],
            statuses: requestStatusTuple(),
            requestors: requestorResults[0],
            currentUser: req.user,
            title: "Edit Imaging Request", // Add title here
            isAdmin: isAdmin
        });

    } catch (err) {
        console.error('------Error:', err);
        res.status(500).render('error', { message: 'Server error' });
    }
});

// Helper function for date formatting
function formatDisplayDate(date) {
    return date ? new Date(date).toISOString().split('T')[0] : null;
}


router.post('/edit-imaging-request/:id', isAuthenticated, isAdmin, (req, res) => {
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
        RequestStatusID,
        ReasonforRequest
    } = req.body;

    // === 1. VALIDATION ===
    if (!ImagingStartDate || !ImagingEndDate || !RequestStatusID) {
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
    db.query(updateQuery, [
        startDate,
        endDate,
        SummaryofProject || null,
        SpecimenDetails || null,
        SpecimenLocationName || null,
        ImagingPlatform || null,
        RequestStatusID,
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
        db.query(updateQuery2, [
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

            // Return success response
            res.json({
                success: true,
                message: 'Imaging request updated successfully',
                redirectUrl: `/admin/view-imaging-request/${imagingRequestID}`
            });
        });
        // Return success response
        // res.json({
        //     success: true,
        //     message: 'Imaging request updated successfully',
        //     redirectUrl: `/admin/view-imaging-request/${imagingRequestID}`
        // });
    });
});
module.exports = router;
