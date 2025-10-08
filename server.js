require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const db = require("./routes/db");
const authRoutes = require("./routes/auth");
const imagingRoutes = require("./routes/imagingRequest");
const { isAuthenticated, isAdmin } = require("./middleware/auth");
const moment = require('moment');



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

// // ✅ Debug Session Middleware
// app.use((req, res, next) => {
//     console.log("🟢 Current Session Data:", req.session);
//     next();
// });




// ✅ Serve HTML pages
const serveHTML = (route, file) => {
    app.get(route, (req, res) => {
        res.sendFile(path.resolve(__dirname, "views", file));
    });
};

// serveHTML("/", "index.html");
// serveHTML("/register", "register.html");

app.get("/", (req, res) => {
    res.render("index", { title: "register" });
});


app.get("/register", (req, res) => {
    res.render("register", { title: "register" });
});

app.get("/login", (req, res) => {
    res.render("login", { title: "Login Page" });
});

// Date formatting helper function (place this BEFORE your route handler)
function formatDate(dateString) {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}



// ✅ User Dashboard (Protected)
app.get("/user-dashboard", isAuthenticated, (req, res) => {
    res.render("user-dashboard", {
        layout: 'layout', // Specify your layout file
        user: req.session.user,
        title: "User Dashboard",
        // Add other data
    });
});



// 🔒 Admin Routes (Protected)
app.get("/admin-dashboard", isAuthenticated, isAdmin, (req, res) => {
    console.log("🟢 Accessing Admin Dashboard - Session Data:", req.session.user);
    res.render("admin-dashboard", { user: req.session.user, title: "Admin Dashboard" });
});



app.get('/api/current-user', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ name: req.session.user.Email });
    } else {
        res.status(401).json({ error: "Not logged in" });
    }
});


// ✅ Serve edit-user.html
app.get("/edit-user", isAuthenticated, isAdmin, (req, res) => {
    res.render("edit-user", {
        title: "Edit User",
        user: {}, // Default empty object (or fetch from DB if needed)
        message: {} // Optional: for flash messages
    });
});



//✅ API to Fetch All Users
app.get("/admin-users", isAuthenticated, isAdmin, (req, res) => {
    console.log("Route /admin-users hit"); // Debug log 1
    const query = "SELECT UserID,Password,TempPassword,Email,RegisteredDate,UpdatedDate,LastLoginDate, UserType, IsDelete FROM User";

    db.query(query, (err, result) => {
        console.log("Query executed", { err, result }); // Debug log 2
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        console.log("Rendering template"); // Debug log 3
        res.render("admin-users", {
            users: result,
            title: "User Management"
        });
    });
});


//update user details
// Handle form submission from edit page
// Render edit user page (support both singular and plural URLs)
app.get("/edit-users/:id", isAuthenticated, isAdmin, (req, res) => {
    const userId = req.params.id;
    const query = "SELECT * FROM User WHERE UserID = ?";

    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).render("edit-user", {
                title: "Error",
                message: {
                    type: 'error',
                    text: 'Database error occurred'
                },
                user: null
            });
        }

        if (result.length === 0) {
            return res.render("edit-user", {
                title: "User Not Found",
                message: {
                    type: 'error',
                    text: 'User not found or has been deleted'
                },
                user: null
            });
        }

        const message = req.session.message || { type: '', text: '' };

        res.render("edit-user", {
            user: result[0],
            title: `Edit User - ${result[0].Email}`,
            message: message
        });

        if (req.session.message) {
            delete req.session.message;
        }
    });
});


// Handle form submission (support both singular and plural URLs)
app.post(["/update-user/:id", "/update-users/:id"], isAuthenticated, isAdmin, (req, res) => {
    const userId = req.params.id;
    const { TempPassword, UserType, IsDelete } = req.body;

    const query = `
        UPDATE User 
        SET TempPassword = ?, 
            UserType = ?, 
            IsDelete = ?,
            UpdatedDate = NOW()
        WHERE UserID = ? 
    `;

    db.query(query, [TempPassword, UserType, IsDelete, userId], (err, result) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({
                success: false,
                message: 'Failed to update user: ' + err.message
            });
        } else if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found or already deleted'
            });
        } else {
            return res.json({
                success: true,
                message: 'User updated successfully!'
            });
        }
    });
});



// ✅ API to Fetch a Single User by ID
app.get("/api/admin-users/:id", isAuthenticated, isAdmin, (req, res) => {
    const userId = req.params.id;
    const query = "SELECT UserID, Email, Password, TempPassword FROM User WHERE UserID = ? AND IsDelete = 0";

    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ success: true, user: result[0] });
    });
});

// ✅ API to Edit User Details
app.put("/api/admin-users/:id", isAuthenticated, isAdmin, (req, res) => {
    const userId = req.params.id;
    const { Email, Password, TempPassword } = req.body;

    const query = `
        UPDATE User 
        SET Email = ?, Password = ?, TempPassword = ?, UpdatedDate = NOW() 
        WHERE UserID = ? AND IsDelete = 0
    `;

    db.query(query, [Email, Password, TempPassword, userId], (err, result) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        res.json({ success: true, message: "User updated successfully" });
    });
});

// ✅ Delete User (Soft Delete - Update IsDelete to 1)
app.put("/api/delete-user/:id", (req, res) => {
    const userId = req.params.id;
    const query = "UPDATE User SET IsDelete = 1 WHERE UserID = ?";

    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ success: false, error: "Database error" });
        }
        console.log(`🗑️ User ${userId} marked as deleted`);
        res.json({ success: true });
    });
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
        SELECT u.*, ut.UserTypeName, u.RequestStatus
        FROM users u
        LEFT JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
        LEFT JOIN RequestStatus rs ON u.RequestStatusID = rs.RequestStatusID
        WHERE u.CreatedBy = ? AND u.is_delete = 0
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

        if (userRequests.length > 0 && userRequests[0].RequestStatusName !== "Approved") {
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
            SELECT u.*, u.RequestStatus, ut.UserTypeName
            FROM users u
            JOIN RequestStatus rs ON u.RequestStatusID = rs.RequestStatusID
            JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
            WHERE u.CreatedBy = ? AND ut.UserTypeName IN ('Internal User', 'External User') AND u.is_delete = 0
            LIMIT 1
        `;

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

            if (user.RequestStatusName !== "Approved") {
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

    const query = `SELECT id FROM users WHERE email = ? AND is_delete = 0`;
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
    const { username, email, contact_number, organisation, user_type, comments } = req.body;


    const created_by = req.session.user.UserID;
    const date_of_req = new Date().toISOString().slice(0, 19).replace("T", " ");
    const reason_for_req = null;
    const is_delete = 0;
    const RequestStatusID = 1; // 'New' status from RequestStatus table
    const CreatedDate = date_of_req; // Assuming CreatedDate is the same as date_of_req
    const checkQuery = `SELECT id FROM users WHERE email = ? AND is_delete = 0`;

    db.query(checkQuery, [email], (err, results) => {
        if (err) {
            console.error("❌ Email Check Error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: "This email is already in use." });
        }

        const insertQuery = `
            INSERT INTO users 
            (username, email, contact_number, organisation, UserTypeID, RequestStatusID, comments, date_of_req, reason_for_req, is_delete, CreatedBy, CreatedDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [username, email, contact_number, organisation, user_type, RequestStatusID, comments, date_of_req, reason_for_req, is_delete, created_by, CreatedDate];

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
        SELECT 
            u.*, 
            ut.UserTypeName AS user_type,
            u.RequestStatus AS request_status
        FROM users u
        LEFT JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
        LEFT JOIN RequestStatus rs ON u.RequestStatusID = rs.RequestStatusID
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
        FROM users u
        LEFT JOIN User creator ON u.CreatedBy = creator.UserID
        LEFT JOIN User updater ON u.updated_by = updater.UserID
        LEFT JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
        LEFT JOIN RequestStatus rs ON u.RequestStatusID = rs.RequestStatusID
        WHERE u.id = ? AND u.is_delete = 0
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
    db.query("UPDATE users SET is_delete = 1 WHERE id = ?", [id], (err, result) => {
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
    db.query("UPDATE users SET is_delete = 0 WHERE id = ?", [id], (err, result) => {
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
            ut.UserTypeName, 
            u.RequestStatus 
        FROM users u
        LEFT JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
        LEFT JOIN RequestStatus rs ON u.RequestStatusID = rs.RequestStatusID
        WHERE u.id = ?
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
        username,
        email,
        contact_number,
        organisation,
        user_type,           // This is the UserTypeID from the form
        request_status,      // This is the RequestStatusID from the form
        comments,
        reason_for_req
    } = req.body;

    const updated_time = new Date().toISOString().slice(0, 19).replace("T", " ");
    const updated_by = req.session.user.UserID;

    const query = `
        UPDATE users 
        SET 
            username = ?, 
            email = ?, 
            contact_number = ?, 
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
        username,
        email,
        contact_number,
        organisation,
        user_type,
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
    const { userId, tempPassword, newPassword } = req.body;

    console.log("🟢 Forgot Password Request:", req.body);

    // Step 1: Verify userId and tempPassword
    const selectQuery = "SELECT * FROM User WHERE Email = ? AND TempPassword = ?";
    db.query(selectQuery, [userId, tempPassword], (err, results) => {
        if (err) {
            console.error("DB error:", err);
            return res.status(500).json({ success: false, error: "Server error" });
        }

        if (results.length === 0) {
            return res.json({ success: false, error: "Invalid user ID or temp password" });
        }

        // Step 2: Update the password
        const updateQuery = "UPDATE User SET Password = ?, TempPassword = NULL WHERE Email = ?";
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



//change-password-admin.ejs
app.get('/change-password-admin', isAuthenticated, isAdmin, (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    res.render('change-password-admin', { user: req.session.user.Email }); // ✅ pass `user` to EJS
});

app.post('/change-password-admin', isAuthenticated, (req, res) => {
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




// ---------------------------- Revamped Admin Form Table ---------------------------- //
app.get('/imaging-request-admin', isAuthenticated, isAdmin, (req, res) => {
    const getRequestors = `
      SELECT u.id, u.username 
      FROM users u
      JOIN RequestStatus rs ON u.RequestStatusID = rs.RequestStatusID
      WHERE u.UserTypeID IN (1, 2) 
        AND u.RequestStatus = 'Approved'
        AND u.is_delete = 0
    `;

    const getPhotographers = `
      SELECT u.id, u.username 
      FROM users u
      JOIN RequestStatus rs ON u.RequestStatusID = rs.RequestStatusID
      WHERE u.UserTypeID IN (3, 4) 
        AND u.RequestStatus = 'Approved'
        AND u.is_delete = 0
    `;

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
            });
        });
    });
});


app.get('/get-users', isAuthenticated, (req, res) => {
    const getRequestors = "SELECT id, username FROM users WHERE UserTypeID IN (1, 2)";
    const getPhotographers = "SELECT id, username FROM users WHERE UserTypeID IN (3, 4)";

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
        CreatedBy,
        UpdatedDate,
        UpdatedBy,
        IsDelete,
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

// Route to view imaging requests
app.get('/admin/imaging-requests', isAuthenticated, isAdmin, (req, res) => {
    const query = `
        SELECT 
            ir.*,
            r.Name AS requestor_name,
            p.username AS photographer_name,
            u.RequestStatus AS status_name,
            cb.username AS created_by_name,
            ub.username AS updated_by_name
        FROM ImagingRequest ir
        LEFT JOIN User r ON ir.ImagingRequestorID = r.id
        LEFT JOIN User p ON ir.PhotographerID = p.id
        LEFT JOIN RequestStatus rs ON ir.RequestStatusID = rs.RequestStatusID
        LEFT JOIN User cb ON ir.CreatedBy = cb.id
        LEFT JOIN User ub ON ir.UpdatedBy = ub.id
        WHERE ir.IsDelete = 0
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




app.get('/user/imaging-requests', isAuthenticated, (req, res) => {
    const loginUserId = req.session.user.UserID;

    const findUserQuery = `
      SELECT u.id AS userId, u.RequestStatus, ut.UserTypeName
      FROM users u
      JOIN RequestStatus rs ON u.RequestStatusID = rs.RequestStatusID
      JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
      WHERE u.CreatedBy = ? 
        AND ut.UserTypeName IN ('Internal User', 'External User')
        AND u.is_delete = 0
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
        if (!userResult[0] || userResult[0].RequestStatusName !== "Approved") {
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
              p.username AS photographer_name,
              u.RequestStatus AS RequestStatusName
          FROM ImagingRequest ir
          LEFT JOIN User r ON ir.ImagingRequestorID = r.id
          LEFT JOIN User p ON ir.PhotographerID = p.id
          LEFT JOIN RequestStatus rs ON ir.RequestStatusID = rs.RequestStatusID
          WHERE ir.IsDelete = 0 AND ir.ImagingRequestorID = ?
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
app.get('/admin/view-imaging-request/:id', isAuthenticated, isAdmin, (req, res) => {
    const imagingRequestID = req.params.id;
    const query = `
        SELECT 
            ir.*,
            r.Name AS requestor_name,
            p.username AS photographer_name,
            u.RequestStatus AS status_name,
            creator.Email AS creator_name,
            updater.Email AS updater_name
        FROM ImagingRequest ir
        LEFT JOIN User r ON ir.ImagingRequestorID = r.id
        LEFT JOIN User p ON ir.PhotographerID = p.id
        LEFT JOIN RequestStatus rs ON ir.RequestStatusID = rs.RequestStatusID
        LEFT JOIN User creator ON ir.CreatedBy = creator.UserID
        LEFT JOIN User updater ON ir.UpdatedBy = updater.UserID
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
            IsDelete: results[0].IsDelete ? 'Yes' : 'No'
        };

        res.render('view-imaging-request', {
            request: request,
            currentUser: req.user,
            title: "Admin View Imaging Request" // Add title here
        });
    });
});



// View Request (GET)
app.get('/user/view-imaging-request/:id', isAuthenticated, (req, res) => {
    const imagingRequestID = req.params.id;
    const query = `
        SELECT 
            ir.*,
            r.Name AS requestor_name,
            p.username AS photographer_name,
            u.RequestStatus AS status_name,
            creator.Email AS creator_name,
            updater.Email AS updater_name
        FROM ImagingRequest ir
        LEFT JOIN User r ON ir.ImagingRequestorID = r.id
        LEFT JOIN User p ON ir.PhotographerID = p.id
        LEFT JOIN RequestStatus rs ON ir.RequestStatusID = rs.RequestStatusID
        LEFT JOIN User creator ON ir.CreatedBy = creator.UserID
        LEFT JOIN User updater ON ir.UpdatedBy = updater.UserID
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
            IsDelete: results[0].IsDelete ? 'Yes' : 'No'
        };

        res.render('imaging_request_view_user', {
            request: request,
            currentUser: req.user,
            title: "User View Imaging Request" // Add title here
        });
    });
});




// Delete Request (POST)
// Soft Delete Request (POST) 
app.post('/admin/delete-imaging-request/:id', isAuthenticated, isAdmin, (req, res) => {
    const imagingRequestID = req.params.id;
    const query = `
        UPDATE ImagingRequest 
        SET 
            IsDelete = 1,
            UpdatedBy = ?,
            UpdatedDate = NOW()
        WHERE ImagingRequestID = ?
    `;

    db.query(query, [req.user, imagingRequestID], (err, results) => {
        if (err) {
            console.error('Error soft deleting request:', err);
            return res.status(500).send('Error marking request as deleted.');
        }

        res.redirect('/admin/imaging-requests');
    });
});


// Edit Imaging Request (GET)
// Define queries at the top of your file for better maintainability
app.get('/admin/edit-imaging-request/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const imagingRequestID = req.params.id;

        // Get imaging request with joined data
        const requestQuery = `
            SELECT 
                ir.*,
                requestor.Name AS requestor_name,
                requestor.id AS requestor_id,
                photographer.Name AS photographer_name,
                photographer.id AS photographer_id,
                u.RequestStatus
            FROM ImagingRequest ir
            LEFT JOIN User requestor ON ir.ImagingRequestorID = requestor.id
            LEFT JOIN User photographer ON ir.PhotographerID = photographer.id
            LEFT JOIN RequestStatus rs ON ir.RequestStatusID = rs.RequestStatusID
            WHERE ir.ImagingRequestID = ?
        `;

        // Get all needed data in parallel for better performance
        const [requestResults, photographerResults, statusResults, requestorResults] = await Promise.all([
            db.promise().query(requestQuery, [imagingRequestID]),
            db.promise().query("SELECT id, username FROM User WHERE UserTypeID IN (3, 4) ORDER BY username"),
            db.promise().query("SELECT * FROM RequestStatus ORDER BY RequestStatusName"),
            db.promise().query("SELECT id, username FROM User WHERE UserTypeID IN (1, 2) ORDER BY username")
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
            statuses: statusResults[0],
            requestors: requestorResults[0],
            currentUser: req.user,
            title: "Edit Imaging Request" // Add title here
        });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).render('error', { message: 'Server error' });
    }
});

// Helper function for date formatting
function formatDisplayDate(date) {
    return date ? new Date(date).toISOString().split('T')[0] : null;
}


app.post('/admin/edit-imaging-request/:id', isAuthenticated, isAdmin, (req, res) => {
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
        ReasonforRequestStatus
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
            PhotographerID = ?,
            ImagingStartDate = ?,
            ImagingEndDate = ?,
            SummaryofProject = ?,
            SpecimenDetails = ?,
            SpecimenLocationName = ?,
            ImagingPlatform = ?,
            RequestStatusID = ?,
            ReasonforRequestStatus = ?,
            UpdatedBy = ?,
            UpdatedDate = NOW()
        WHERE ImagingRequestID = ?
    `;

    db.query(updateQuery, [
        PhotographerID || null,  // Fixed: Added PhotographerID to parameters
        startDate,
        endDate,
        SummaryofProject || null,
        SpecimenDetails || null,
        SpecimenLocationName || null,
        ImagingPlatform || null,
        RequestStatusID,
        ReasonforRequestStatus || null,
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

        // Return success response
        res.json({
            success: true,
            message: 'Imaging request updated successfully',
            redirectUrl: `/admin/view-imaging-request/${imagingRequestID}`
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
            SELECT id, username 
            FROM users 
            WHERE CreatedBy = ? 
              AND UserTypeID IN (1, 2) 
              AND is_delete = 0
              AND RequestStatusID = (
                SELECT RequestStatusID FROM RequestStatus WHERE RequestStatusName = 'Approved'
              )
            LIMIT 1
        `;

        // ✅ Get photographers created by this user, and are approved
        const getPhotographersQuery = `
            SELECT id, username 
            FROM users 
            WHERE CreatedBy = ? 
              AND UserTypeID IN (3, 4)
              AND is_delete = 0
              AND RequestStatusID = (
                SELECT RequestStatusID FROM RequestStatus WHERE RequestStatusName = 'Approved'
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

// Media Request
// ✅ Admin Media Management Main Page Controller
app.get('/admin/media', isAuthenticated, isAdmin, (req, res) => {
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
        ir.ImagingRequestID,
        r.Name AS requestor_name,
        u2.Email AS photographer_name
      FROM Media m
      JOIN ImagingRequest ir ON m.ImagingRequestID = ir.ImagingRequestID
      JOIN User r ON ir.ImagingRequestorID = r.UserID
      JOIN ImagingRequestUserPhotographylink p ON ir.ImagingRequestID = p.ImagingRequestID
      JOIN User u2 ON p.PhotographerID = u2.UserID  
      WHERE m.IsDeleted = 0
      ORDER BY m.CreatedDate DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Database error:", err);
            // Render the media page with empty results and error message
            return res.render('media_managment_index', {
                title: "Media Management - Error",
                mediaRecords: [],
                errorMessage: "Failed to load media data. Please try again later."
            });
        }

        // Successful query
        res.render('media_managment_index', {
            title: "Media Management",
            mediaRecords: results,
            message: req.session.message || null,
            title: "Admin Media "   // For success messages
        });

        // Clear session message if it exists
        if (req.session.message) {
            delete req.session.message;
        }
    });
});



app.get('/admin/select-user-for-media', isAuthenticated, isAdmin, (req, res) => {
    // const query = `
    //   SELECT DISTINCT u.id, u.username, u.email, ut.UserTypeName
    //   FROM ImagingRequest ir
    //   JOIN User u ON ir.ImagingRequestorID = u.id
    //   JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
    //   JOIN RequestStatus rs ON ir.RequestStatusID = rs.RequestStatusID
    //   WHERE ut.UserTypeName IN ('Internal User', 'External User')
    //     AND u.RequestStatus = 'Accepted'
    //     AND ir.IsDelete = 0
    //     AND u.is_delete = 0
    // `;
    const query = `
        SELECT 
            ir.ImagingRequestID,
            u.UserID AS user_id,
            u.Email AS requestor_name,
            u.Email,
            u.ContactNumber,
            u.Organisation,
            u.RequestStatus,
            u2.Email AS photographer_name,
            ir.ImagingStartDate,
            ir.ImagingEndDate
        FROM ImagingRequest ir
        JOIN User u ON ir.ImagingRequestorID = u.UserID
        JOIN ImagingRequestUserPhotographylink p ON ir.ImagingRequestID = p.ImagingRequestID
        JOIN User u2 ON p.PhotographerID = u2.UserID  

        WHERE 
            ir.RequestStatus = 'approved' AND
            u.IsDeleted = 0 AND 
            ir.IsDeleted = 0;

  `;

    db.query(query, (err, users) => {
        if (err) {
            console.error("❌ Failed to fetch eligible users for media:", err);
            return res.status(500).render('error', { message: 'Failed to load users for media upload' });
        }

        console.log(`📋 Found ${users.length} eligible users`);
        // console.log("📋 User:", users);
        res.render('media-user-list', {
            users,
            title: 'Media Image List'
        });
    });
});

app.get('/admin/media-form/:imagingRequestId', isAuthenticated, isAdmin, (req, res) => {
    const imagingRequestId = req.params.imagingRequestId;

    const query = `
      SELECT 
        ir.ImagingRequestID,
        ir.ImagingRequestorID,
        ir.PhotographerID,
        r.Name AS requestor_name,
        u2.email AS photographer_name
      FROM ImagingRequest ir
      JOIN User r ON ir.ImagingRequestorID = r.UserID
      JOIN ImagingRequestUserPhotographylink p ON ir.ImagingRequestID = p.ImagingRequestID
      JOIN User u2 ON p.PhotographerID = u2.UserID  


      WHERE ir.ImagingRequestID = ? AND ir.IsDeleted = 0
    `;

    db.query(query, [imagingRequestId], (err, results) => {
        if (err) {
            console.error("❌ Error fetching ImagingRequest:", err);
            return res.status(500).render('error', {
                message: "Failed to load Imaging Request details",
                error: process.env.NODE_ENV === 'development' ? err : null
            });
        }

        if (results.length === 0) {
            return res.status(404).render('error', {
                message: "Imaging Request not found or deleted"
            });
        }

        const imagingRequest = results[0];

        res.render('media_form', {
            imagingRequest,  // contains imagingRequestId, photographerId, requestorId + names
            title: 'Media Form'
        });
    });
});



app.post('/admin/submit-media', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const {
            ImagingRequestID,
            RequestorID,
            PhotographerID,
            mediaFileName,
            filePath,
            catalogID,
            morphoID,
            clusterID,
            imagingDate,
            resolution,
            colorDepth,
            fileSize,
            fileFormat,
            description,
            cameraModel,
            imageEditingTool,
            comments
        } = req.body;

        console.log("📤 Media submission data:", req.body);
        const createdBy = req.session.user.UserID;

        // Validation: required fields
        const missingFields = [];
        if (!ImagingRequestID) missingFields.push("ImagingRequestID");
        if (!RequestorID) missingFields.push("RequestorID");
        if (!PhotographerID) missingFields.push("PhotographerID");
        if (!mediaFileName || !mediaFileName.includes(".")) missingFields.push("mediaFileName");
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
        ImagingRequestID,
        PhotographerID,
        MediaFileName,
        FilePath,
        CatalogID,
        MorphoID,
        ClusterID,
        ImagingDate,
        Resolution,
        ColorDepth,
        FileSize,
        FileFormat,
        Description,
        CameraModel,
        ImageEditingTool,
        Comments,
        CreatedDate,
        CreatedBy,
        UpdatedDate,
        UpdatedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NULL, NULL)
    `;

        const values = [
            ImagingRequestID,
            PhotographerID,
            mediaFileName,
            filePath,
            catalogID,
            morphoID,
            clusterID,
            imagingDate,
            resolution || null,
            colorDepth || null,
            fileSize || null,
            fileFormat || null,
            description,
            cameraModel,
            imageEditingTool || null,
            comments || null,
            createdBy
        ];

        const [result] = await db.promise().query(insertQuery, values);

        console.log("✅ Media submitted successfully, ID:", result.insertId);


        res.redirect(`/admin/media/view/${result.insertId}`);

    } catch (error) {
        console.error("❌ Media submission failed:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during media submission.",
            error: error.message
        });
    }
});

app.get('/admin/media/view/:mediaId', isAuthenticated, isAdmin, (req, res) => {
    const mediaId = req.params.mediaId;

    const query = `
      SELECT 
        m.*,
        u1.email AS created_by_name,
        u2.email AS updated_by_name
      FROM Media m
      LEFT JOIN User u1 ON m.CreatedBy = u1.id
      LEFT JOIN User u2 ON m.UpdatedBy = u2.id
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

        res.render('media_view', {
            media: results[0], // Since we're querying by ID, we'll only get one record
            mediaId,
            title: "View Media",
        });
    });
});

// Controller for rendering the edit form
app.get('/admin/media/edit/:mediaId', isAuthenticated, isAdmin, (req, res) => {
    const mediaId = req.params.mediaId;

    if (mediaId) {
        // Editing existing media
        const query = `
            SELECT m.*, 
                   ir.ImagingRequestorID AS RequestorID,
                   u1.Email AS requestor_name,
                   u2.Email AS photographer_name
            FROM Media m
            JOIN ImagingRequest ir ON m.ImagingRequestID = ir.ImagingRequestID
            LEFT JOIN User u1 ON ir.ImagingRequestorID = u1.id
            OIN ImagingRequestUserPhotographylink p ON ir.ImagingRequestID = p.ImagingRequestID
            JOIN User u2 ON p.PhotographerID = u2.UserID  

            WHERE m.MediaID = ? AND m.IsDeleted = 0
        `;

        db.query(query, [mediaId], (err, results) => {
            if (err || results.length === 0) {
                console.error("❌ Error fetching media:", err);
                return res.status(404).render('error', {
                    message: 'Media not found'
                });
            }

            res.render('media_edit', {
                media: results[0],
                editing: true,
                imagingRequest: {
                    ImagingRequestID: results[0].ImagingRequestID,
                    ImagingRequestorID: results[0].RequestorID,
                    PhotographerID: results[0].PhotographerID,
                    requestor_name: results[0].requestor_name,
                    photographer_name: results[0].photographer_name
                }
            });
        });
    } else {
        // Creating new media - you'll need to pass imagingRequest data
        // This part depends on how you're creating new media
        res.render('media_edit', {
            media: null,
            editing: false,
            imagingRequest: req.query.imagingRequest || {},
            title: "Media Edit" // You'll need to pass this
        });
    }
});

// Controller for handling form submission
app.post('/admin/media/save', isAuthenticated, isAdmin, (req, res) => {
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
                ColorDepth = ?,
                FileSize = ?,
                FileFormat = ?,
                Description = ?,
                CameraModel = ?,
                ImageEditingTool = ?,
                Comments = ?,
                UpdatedDate = NOW(),
                UpdatedBy = ?
            WHERE MediaID = ?
        `;
        const updatedBy = req.session.user.UserID;
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
                ImagingRequestID, PhotographerID, MediaFileName, FilePath,
                CatalogID, MorphoID, ClusterID, ImagingDate, Resolution,
                ColorDepth, FileSize, FileFormat, Description, CameraModel,
                ImageEditingTool, Comments, CreatedBy, CreatedDate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        const params = [
            mediaData.ImagingRequestID,
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
            // res.redirect(`/admin/media/view/${result.insertId}`); // Redirect to the view page of the newly created media
        });
    }
});

// Soft delete media by setting IsDelete = 1 and redirect
app.post('/admin/media/delete/:mediaId', isAuthenticated, isAdmin, (req, res) => {
    const mediaId = req.params.mediaId;
    const userId = req.session.user.UserID;

    // First verify the media exists and isn't already deleted
    const checkQuery = 'SELECT * FROM Media WHERE MediaID = ? AND IsDelete = 0';

    db.promise().query(checkQuery, [mediaId])
        .then(([results]) => {
            if (results.length === 0) {
                req.flash('error', 'Media not found or already deleted');
                return res.redirect('/admin/media');
            }

            // Perform soft delete
            const updateQuery = `
                UPDATE Media 
                SET IsDelete = 1, 
                    UpdatedBy = ?, 
                    UpdatedDate = NOW() 
                WHERE MediaID = ?
            `;

            return db.promise().query(updateQuery, [userId, mediaId]);
        })
        .then(() => {
            // req.flash('success', 'Media has been archived successfully');
            res.redirect('/admin/media');
        })
        .catch(error => {
            console.error("❌ Error soft deleting media:", error);
            req.flash('error', 'Error archiving media');
            res.redirect('/admin/media');
        });
});