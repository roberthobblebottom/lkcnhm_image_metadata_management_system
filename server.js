require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const db = require("./routes/db");
const authRoutes = require("./routes/auth");
const adminRoutes = require('./routes/admin/admin');
const mediaRoutes = require('./routes/media');
const projectRoutes = require('./routes/project');
const adminUserManagementRoutes = require('./routes/admin/user-management');
const { isAuthenticated, isAdmin } = require("./middleware/auth");
const passport = require("passport");
const app = express();
const PORT = process.env.PORT || 5000;
const userTypesEnumeration = require('./middleware/utils').userTypesEnum;
// ✅ Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs'); // Set view engine to HTML
// app.use(cookieParser());

// 🔒 Session setup
app.use(
    session({
        secret: process.env.SessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false, httpOnly: true, } // 1-hour expiry
        //maxAge: 1000 * 60 * 60 
    })
);
app.use(passport.session())

// ✅ API Routes
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/media", mediaRoutes);
app.use("/project", projectRoutes);
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
app.get("/user/dashboard", isAuthenticated, (req, res) => {
    res.render("user/dashboard", {
        layout: 'layout', // Specify your layout file
        user: req.session.passport.user,
        title: "User Dashboard",
        // Add other data
    });
});

app.get('/api/current-user', (req, res) => {

    if (req.session && req.session.passport.user) {
        console.log(req.session.passport.user)
        res.json({
            Email: req.session.passport.user.Email,
            FullName: req.session.passport.user.FullName,
            UserType: req.session.passport.user.UserType
        });
    } else {
        res.status(401).json({ error: "Not logged in" });
    }
});


// ✅ Debug Route to Check Session Persistence
app.get("/session", (req, res) => {
    console.log("🟢 Session Check:", req.session.passport.user);
    res.json({ sessionData: req.session.passport.user || "No active session" });
});

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});

// app.get("/imagingUser", isAuthenticated, (req, res) => {
//     const userId = req.session.passport.user.UserID;

//     const query = `
//         SELECT u.*, ut.UserTypeName
//         FROM User u
//         LEFT JOIN UserType ut ON u.UserTypeID = ut.UserTypeID
//         WHERE u.CreatedByID = ? AND u.IsDeleted = 0
//     `;

//     db.query(query, [userId], (err, results) => {
//         if (err) {
//             console.error("❌ Error fetching projects:", err);
//             return res.status(500).send("Server error");
//         }

//         const mainUserTypes = ['Internal User', 'External User'];

//         const userRequests = results.filter(r => mainUserTypes.includes(r.UserTypeName));
//         const otherRequests = results.filter(r => !mainUserTypes.includes(r.UserTypeName));

//         // ✅ Check if primary user request exists and is not approved
//         let showPendingAlert = false;

//         if (userRequests.length > 0 && userRequests[0].RequestStatusName !== "approved") {
//             showPendingAlert = true;
//         }

//         res.render("imagingUser", {
//             userRequests,
//             otherRequests,
//             showPendingAlert,
//             title: "Imaging User Request",
//         });
//     });
// });

app.get("/form", isAuthenticated, (req, res) => {
    const loginUserId = req.session.passport.user.UserID;
    const isAdmin = req.session.passport.user.UserType === userTypesEnumeration.admin;

    // Get all user type data first
    const userTypeQuery = `SELECT * FROM UserType`;

    db.query(userTypeQuery, (err, userTypesEnum) => {
        if (err) {
            console.error("❌ Error fetching user types:", err);
            return res.status(500).send("Server error.");
        }

        // If admin, send all user types directly
        if (isAdmin) {
            return res.render("form", {
                userTypesEnumeration,
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
    res.render("admin", { user: req.session.passport.user });
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
    const created_by = req.session.passport.user.UserID;
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
// app.get("/user/dashboard",isAuthenticated,(req, res) => {
//     res.sendFile(path.resolve(__dirname, "views", "user/dashboard.html"));
// });
app.get('/change-password', isAuthenticated, (req, res) => {
    if (!req.session.passport.user) {
        return res.redirect('/login');
    }

    res.render('change-password', { user: req.session.passport.user.Email, title: "Change Password" }); // ✅ pass `user` to EJS
});

app.post('/change-password', isAuthenticated, (req, res) => {
    const email = req.session.passport.user.Email;
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

