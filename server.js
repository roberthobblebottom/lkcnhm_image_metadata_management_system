require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const db = require("./routes/db");
const authRoutes = require("./routes/auth");
const imagingRoutes = require("./routes/imagingRequest");
const adminRoutes = require('./routes/admin/admin');
const adminMediaRoutes = require('./routes/admin/media');
const adminImagingRequestRoutes = require('./routes/admin/imaging-request');
const adminUserManagementRoutes = require('./routes/admin/user-management');
const { isAuthenticated, isAdmin } = require("./middleware/auth");



const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs'); // Set view engine to HTML
// 🔒 Session setup
app.use(
    session({
        secret: process.env.SessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 } // 1-hour expiry
    })
);

app.use("/imaging", imagingRoutes);
// ✅ API Routes
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/admin/media", adminMediaRoutes);
app.use("/admin/imaging-request", adminImagingRequestRoutes);
app.use("/admin/user-management", adminUserManagementRoutes);


// ✅ Serve HTML pages
const serveHTML = (route, file) => {
    app.get(route, (req, res) => {
        res.sendFile(path.resolve(__dirname, "views", file));
    });
};


app.get("/", (req, res) => {
    res.render("index", { title: "register" });
});


app.get("/register", (req, res) => {
    res.render("register", { title: "register" });
});

app.get("/login", (req, res) => {
    res.render("login", { title: "Login Page" });
});


// ✅ User Dashboard (Protected)
app.get("/user-dashboard", isAuthenticated, (req, res) => {
    res.render("user-dashboard", {
        layout: 'layout', // Specify your layout file
        user: req.session.user,
        title: "User Dashboard",
        // Add other data
    });
});

app.get('/api/current-user', (req, res) => {
    if (req.session && req.session.user) {
        res.json({
            email: req.session.user.Email,
            UserType: req.session.user.UserType
        });
    } else {
        res.status(401).json({ error: "Not logged in" });
    }
});



// ✅ Debug Route to Check Session Persistence
app.get("/session", (req, res) => {
    console.log("🟢 Session Check:", req.session.user);
    res.json({ sessionData: req.session.user || "No active session" });
});

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});




/// This is the Main Buisness Logic Starts so Don't touch it ///

app.get("/imagingUser", isAuthenticated, (req, res) => {
    const userId = req.session.user.UserID;

    const query = `
        SELECT u.*, ut.UserTypeName
        FROM User u
        LEFT JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
        WHERE u.CreatedByID = ? AND u.IsDeleted = 0
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("❌ Error fetching imaging requests:", err);
            return res.status(500).send("Server error");
        }

        const mainUserTypes = ['Internal User', 'External User'];

        const userRequests = results.filter(r => mainUserTypes.includes(r.UserTypeName));
        const otherRequests = results.filter(r => !mainUserTypes.includes(r.UserTypeName));

        // ✅ Check if primary user request exists and is not approved
        let showPendingAlert = false;

        if (userRequests.length > 0 && userRequests[0].RequestStatusName !== "approved") {
            showPendingAlert = true;
        }

        res.render("imagingUser", {
            userRequests,
            otherRequests,
            showPendingAlert,
            title: "Imaging User Request",
        });
    });
});







app.get("/form", isAuthenticated, (req, res) => {
    const loginUserId = req.session.user.UserID;
    const isAdmin = req.session.user.UserType === "admin";

    // Get all user type data first
    const userTypeQuery = `SELECT * FROM UserType`;

    db.query(userTypeQuery, (err, userTypes) => {
        if (err) {
            console.error("❌ Error fetching user types:", err);
            return res.status(500).send("Server error.");
        }

        // If admin, send all user types directly
        if (isAdmin) {
            return res.render("form", {
                userTypes,
                isAdmin,
                isPrimaryUserRegistered: false // Admin doesn't register themselves
            });
        }

        // Check if the user has registered already as Internal/External User
        const userCheckQuery = `
            SELECT u.*, u.RequestStatus, ut.UserType
            FROM User u
            WHERE u.CreatedByID = ? AND ut.UserTypeName IN ('Internal User', 'External User') AND u.IsDeleted = 0
            LIMIT 1
        `; // TODO Wrong Filter

        db.query(userCheckQuery, [loginUserId], (err, results) => {
            if (err) {
                console.error("❌ Error checking user registration:", err);
                return res.status(500).send("Server error.");
            }

            const user = results[0];

            if (!user) {
                // Not registered yet: send only Internal/External
                const filtered = userTypes.filter(type =>
                    type.UserTypeName === "Internal User" || type.UserTypeName === "External User"
                );

                return res.render("form", {
                    userTypes: filtered,
                    isAdmin: false,
                    isPrimaryUserRegistered: false
                });
            }

            if (user.RequestStatusName !== "approved") {
                return res.redirect("/user/UserRequest?status=pending");
            }

            // Already registered & approved, so show only other user types
            const filtered = userTypes.filter(type =>
                type.UserTypeName !== "Internal User" && type.UserTypeName !== "External User"
            );

            return res.render("form", {
                userTypes: filtered,
                isAdmin: false,
                isPrimaryUserRegistered: true,
                title: "User Request Form" // Add title here
            });


        });
    });
});



app.get("/admin/UserRequest", isAuthenticated, isAdmin, (req, res) => {
    res.render("admin", { user: req.session.user });
});

app.get("/check-email", (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const query = `SELECT id FROM User WHERE email = ? AND IsDeleted = 0`;
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error("❌ DB Error while checking email:", err);
            return res.status(500).json({ error: "Server error" });
        }

        const exists = results.length > 0;
        res.json({ exists });
    });
});



app.post('/submit', isAuthenticated, (req, res) => {
    const { email, ContactNumber, organisation, UserType, comments } = req.body;


    const created_by = req.session.user.UserID;
    const date_of_req = new Date().toISOString().slice(0, 19).replace("T", " ");
    const reason_for_req = null;
    const IsDeleted = 0;
    const RequestStatusID = 1; // 'New' status from RequestStatus table
    const CreatedDate = date_of_req; // Assuming CreatedDate is the same as date_of_req
    const checkQuery = `SELECT UserID FROM User WHERE Email = ? AND IsDeleted = 0`;

    db.query(checkQuery, [email], (err, results) => {
        if (err) {
            console.error("❌ Email Check Error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: "This email is already in use." });
        }

        const insertQuery = `
            INSERT INTO User 
            (Email, ContactNumber, Organisation, UserType, RequestStatus, Comments, date_of_req, ReasonForRequest IsDeleted, CreatedByID, CreatedDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [email, ContactNumber, organisation, UserType, RequestStatusID, comments, date_of_req, reason_for_req, IsDeleted, created_by, CreatedDate];

        db.query(insertQuery, values, (err) => {
            if (err) {
                console.error('❌ Insert Failed:', err);
                return res.status(500).json({ error: "Database Insert Error" });
            }

            console.log('✅ Data Inserted Successfully with RequestStatusID = 1');
            res.json({ message: "User request submitted successfully!" });
        });
    });
});



// API Route to Get All Users (deleted + active)
app.get("/api/users", isAuthenticated, isAdmin, (req, res) => {
    const query = `
        SELECT * FROM User 
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("❌ Error fetching users:", err);
            return res.status(500).json({ error: "Error fetching user data" });
        }

        console.log("📄 All User Data Fetched:", results.length);
        res.json(results); // Send all user data including joined fields
    });
});
app.get('/view/:user_id', isAuthenticated, (req, res) => {
    const { user_id } = req.params;
    const isAdminRequestor = req.session.user?.UserType === 'admin';
    const isAdmin = req.session.user.UserType === "admin";

    const query = `
        SELECT 
            u.*, 
            creator.Email AS CreatedByName,
            updater.Email AS UpdatedByName,
            ut.UserTypeName,
            u.RequestStatus
        FROM User u
        LEFT JOIN User creator ON u.CreatedByID = creator.UserID
        LEFT JOIN User updater ON u.updated_by = updater.UserID
        LEFT JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
        WHERE u.UserID = ? AND u.IsDeleted = 0
    `;

    db.query(query, [user_id], (err, results) => {
        if (err) {
            console.error('❌ Error fetching user with joins:', err);
            return res.status(500).send('Error fetching user.');
        }

        if (results.length === 0) {
            return res.status(404).send('User not found or has been deleted.');
        }

        console.log("📄 User Data Fetched:", results[0]);
        res.render('view', { user: results[0], isAdminRequestor, isAdmin, title: "Imaging User Details" });
    });
});


// Delete User Route
app.get("/delete/:id", isAuthenticated, isAdmin, (req, res) => {
    const { id } = req.params;
    db.query("UPDATE User SET IsDeleted = 1 WHERE id = ?", [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Error deleting user" });
        }
        console.log(`🗑️ User with ID ${id} soft-deleted`);
        res.redirect('/admin/UserRequest');
    });
});



app.get("/recover/:id", isAuthenticated, isAdmin, (req, res) => {
    const { id } = req.params;
    db.query("UPDATE User SET IsDeleted = 0 WHERE id = ?", [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Error recovering user" });
        }
        console.log(`✅ User with ID ${id} recovered`);
        res.redirect('/admin/UserRequest'); // Redirect to admin page after recovery
    });
});





app.get("/edit/:user_id", isAuthenticated, isAdmin, (req, res) => {
    const userId = req.params.user_id;

    const query = `
        SELECT 
            u.*, 
            u.UserType, 
            u.RequestStatus 
        FROM User u
        WHERE u.UserID = ?
    `;

    const getUserTypes = `SELECT * FROM UserType`;
    const getStatuses = `SELECT * FROM RequestStatus`;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("❌ Error fetching user:", err);
            return res.status(500).send("Internal Server Error");
        }

        if (results.length === 0) {
            return res.status(404).send("User not found");
        }

        const user = results[0];

        db.query(getUserTypes, (err, userTypes) => {
            if (err) return res.status(500).send("Error fetching user types");

            db.query(getStatuses, (err, requestStatuses) => {
                if (err) return res.status(500).send("Error fetching request statuses");

                res.render("edit", {
                    user,
                    userTypes,
                    requestStatuses,
                    title: "Edit User",
                });
            });
        });
    });
});
app.post("/edit/:user_id", isAuthenticated, isAdmin, (req, res) => {
    const { user_id } = req.params;
    const {
        email,
        ContactNumber,
        organisation,
        UserType,           // This is the UserTypeID from the form
        request_status,      // This is the RequestStatusID from the form
        comments,
        reason_for_req
    } = req.body;

    const updated_time = new Date().toISOString().slice(0, 19).replace("T", " ");
    const updated_by = req.session.user.UserID;

    const query = `
        UPDATE User 
        SET 
            email = ?, 
            ContactNumber = ?, 
            organisation = ?, 
            UserTypeID = ?, 
            RequestStatusID = ?, 
            comments = ?, 
            reason_for_req = ?, 
            updated_date = ?, 
            updated_by = ? 
        WHERE id = ?
    `;

    const values = [
        email,
        ContactNumber,
        organisation,
        UserType,
        request_status,
        comments,
        reason_for_req,
        updated_time,
        updated_by,
        user_id
    ];

    db.query(query, values, (err) => {
        if (err) {
            console.error('❌ Error updating user:', err);
            return res.status(500).json({ message: "Internal Server Error" });
        }

        console.log("✅ User Updated:", user_id);
        res.redirect('/admin/UserRequest');
    });
});


// Handle forgot password page
app.get("/forgot-password", (req, res) => {
    res.render("forgot-password", {
        title: "Forgot Password",
        adminEmail: "admin@gmail.com",
        forgotPasswordPath: "/forgot-password", // POST endpoint
        redirectPath: "/login" // redirect after success
    });
});

// Handle forgot password
app.post("/forgot-password", (req, res) => {
    const { userId, Password, newPassword } = req.body;

    console.log("🟢 Forgot Password Request:", req.body);

    // Step 1: Verify userId and Password
    const selectQuery = "SELECT * FROM User WHERE Email = ? AND TemporaryPassword = ?";
    db.query(selectQuery, [userId, Password], (err, results) => {
        if (err) {
            console.error("DB error:", err);
            return res.status(500).json({ success: false, error: "Server error" });
        }

        if (results.length === 0) {
            return res.json({ success: false, error: "Invalid user ID or temp password" });
        }

        // Step 2: Update the password
        const updateQuery = "UPDATE User SET Password = ?, TemporaryPassword = NULL WHERE Email = ?";
        db.query(updateQuery, [newPassword, userId], (err2, result) => {
            if (err2) {
                console.error("DB error:", err2);
                return res.status(500).json({ success: false, error: "Update failed" });
            }

            res.json({ success: true, message: "Password updated successfully" });
        });
    });
});



//change [password] route

// app.get("/user-dashboard",isAuthenticated,(req, res) => {
//     res.sendFile(path.resolve(__dirname, "views", "user-dashboard.html"));
// });
app.get('/change-password', isAuthenticated, (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    res.render('change-password', { user: req.session.user.Email, title: "Change Password" }); // ✅ pass `user` to EJS
});


app.post('/change-password', isAuthenticated, (req, res) => {
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











app.post('/submit-imaging-request', isAuthenticated, async (req, res) => {
    try {
        const requiredFields = [
            'requestor', 'photographer', 'requestDate',
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

        const createdBy = req.session.user.UserID;
        if (!createdBy) {
            console.error("User ID not found in session");
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Please login first."
            });
        }

        const requestStatusId = 1; // Hardcoded for now – represents 'New'

        const insertQuery = `
      INSERT INTO ImagingRequest (
        ImagingRequestorID,
        PhotographerID,
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
        RequestStatusID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NULL, NULL, 0, ?)
    `;

        const [result] = await db.promise().query(insertQuery, [
            req.body.requestor,
            req.body.photographer,
            req.body.requestDate,
            req.body.startDate,
            req.body.endDate,
            req.body.summary,
            req.body.specimenDetails,
            req.body.location,
            req.body.platform || null,
            req.body.comments || null,
            createdBy,
            requestStatusId
        ]);

        console.log('📸 Imaging request inserted with RequestStatusID =', requestStatusId, ' ID:', result.insertId);

        const role = req.session.user.UserType; // Example: 'Admin' or 'User'
        const redirectUrl = role === 'admin'
            ? `/admin/view-imaging-request/${result.insertId}`
            : `/user/view-imaging-request/${result.insertId}`;

        res.json({
            success: true,
            message: "Imaging request submitted successfully!",
            requestId: result.insertId,
            redirectUrl // 💥 include this in the response
        });


    } catch (err) {
        console.error("❌ Error in submitImagingRequest:", err);
        res.status(500).json({
            success: false,
            message: "Error submitting the imaging request.",
            error: err.message
        });
    }
});



app.get('/user/imaging-requests', isAuthenticated, (req, res) => {
    const loginUserId = req.session.user.UserID;

    const findUserQuery = `
      SELECT u.UserID AS userId, u.RequestStatus, ut.UserTypeName
      FROM User u
      JOIN RequestStatus rs ON u.RequestStatusID = rs.RequestStatusID
      JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
      WHERE u.CreatedByID = ? 
        AND ut.UserTypeName IN ('Internal User', 'External User')
        AND u.IsDeleted = 0
      LIMIT 1
    `;

    db.query(findUserQuery, [loginUserId], (err1, userResult) => {
        if (err1) {
            console.error("❌ Error checking user approval:", err1);
            return res.status(500).render("error", {
                message: "Server error while checking user approval.",
                error: process.env.NODE_ENV === 'development' ? err1 : null
            });
        }

        // No such user created OR not approved
        if (!userResult[0] || userResult[0].RequestStatusName !== "approved") {
            console.log("🔒 User not approved or not registered as Internal/External");
            return res.render("imaging_request_index", {
                imagingRequests: [],
                showPendingAlert: true
            });
        }

        const approvedUserId = userResult[0].userId;

        const requestQuery = `
          SELECT 
              ir.*,
              r.Name AS requestor_name,
              photographer.Email AS photographer_name,
              u.RequestStatus AS RequestStatusName
          FROM ImagingRequest ir
          LEFT JOIN User r ON ir.ImagingRequestorID = r.UserID
          JOIN ImagingRequestUserPhotographyLink irupl ON irupl.ImagingRequestID = ir.ImagingRequestID
          JOIN User photographer on irupl.PhotographerID = photographer.UserID
          WHERE ir.IsDeleted = 0 AND ir.ImagingRequestorID = ?
          ORDER BY ir.CreatedDate DESC
        `;

        db.query(requestQuery, [approvedUserId], (err2, imagingRequests) => {
            if (err2) {
                console.error("❌ Error fetching imaging requests:", err2);
                return res.status(500).render("error", {
                    message: "Error loading imaging requests",
                    error: process.env.NODE_ENV === 'development' ? err2 : null
                });
            }

            console.log(`📄 Imaging requests for approved user ${approvedUserId}: ${imagingRequests.length}`);
            res.render("imaging_request_index", {
                imagingRequests,
                showPendingAlert: false,
                title: "Imaging Requests" // Add title here
            });
        });
    });
});






// View Request (GET)
app.get('/user/view-imaging-request/:id', isAuthenticated, isAdmin, (req, res) => {
    const imagingRequestID = req.params.id;
    const query = `
        SELECT 
            ir.*,
            r.Name AS requestor_name,
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
        console.log(isAdmin)
        res.render('imaging_request_view_user', {
            request: request,
            currentUser: req.user,
            title: "User View Imaging Request", // Add title here
            isAdmin: isAdmin
        });
    });
});



////////////////////// For the imaging request user page only /////////////////////////



// Changes Done by Rex to this Module of Non_admin Imaging Request Form page Loading Controller

app.get('/imaging-request-user', isAuthenticated, (req, res) => {
    try {
        const { UserID, Email } = req.session.user;
        console.log("🔍 [DEBUG] Current User - ID:", UserID, "Name:", Email);

        // ✅ Get requestor that matches this login user's approved user record
        const getRequestorQuery = `
            SELECT id, Email 
            FROM User 
            WHERE CreatedByID = ? 
              AND UserTypeID IN (1, 2) 
              AND IsDeleted = 0
              AND RequestStatusID = (
                SELECT RequestStatusID FROM RequestStatus WHERE RequestStatusName = 'approved'
              )
            LIMIT 1
        `;

        // ✅ Get photographers created by this user, and are approved
        const getPhotographersQuery = `
            SELECT id, Email 
            FROM User 
            WHERE CreatedByID = ? 
              AND UserTypeID IN (3, 4)
              AND IsDeleted = 0
              AND RequestStatusID = (
                SELECT RequestStatusID FROM RequestStatus WHERE RequestStatusName = 'approved'
              )
        `;

        db.query(getRequestorQuery, [UserID], (err1, requestorResults) => {
            if (err1) {
                console.error("❌ Error loading requestor:", err1);
                return res.status(500).render('error', { message: "Error loading requestor" });
            }

            const requestor = requestorResults[0];
            if (!requestor) {
                console.log("⚠️ No approved requestor found for this login user.");
                return res.redirect('/user/imaging-requests?status=pending');
            }

            db.query(getPhotographersQuery, [UserID], (err2, photographerResults) => {
                if (err2) {
                    console.error("❌ Error loading photographers:", err2);
                    return res.status(500).render('error', { message: "Error loading photographers" });
                }

                console.log("✅ [Final] Rendering form with requestor:", requestor, "and photographers:", photographerResults);

                res.render('imaging-request-user', {
                    requestor, // only one
                    photographers: photographerResults || [],
                    title: 'Imaging Request Form',
                    currentUser: req.session.user,
                    title: "Imaging Request Form" // Add title here
                });
            });
        });

    } catch (err) {
        console.error("❌ Unexpected error:", err);
        res.status(500).render('error', {
            message: "Unexpected server error.",
            error: process.env.NODE_ENV === 'development' ? err : null
        });
    }
});