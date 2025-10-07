const express = require("express");
const router = express.Router();
const db = require("./db"); // Database connection

router.post("/register", (req, res) => {
    const { email, password } = req.body;
    console.log(`🔹 Register Attempt: ${email}`);

    const checkEmailQuery = "SELECT * FROM LoginUser WHERE LoginUserName = ?";
    db.query(checkEmailQuery, [email], (err, result) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).send("Database Error");
        }

        if (result.length > 0) {
            console.warn("⚠️ User already exists:", email);
            return res.status(400).send("User already exists. Please enter a new email.");
        }

        const insertUserQuery = `
            INSERT INTO LoginUser 
            (LoginUserName, Password, TempPassword, LoginUserType, RegisteredDate, LastLoginDate, UpdatedDate, IsDelete) 
            VALUES (?, ?, NULL, ?, NOW(), NULL, NULL, 0)`;

        db.query(insertUserQuery, [email, password, "Non-admin"], (err) => {
            if (err) {
                console.error("❌ Error Registering User:", err);
                return res.status(500).send("Error Registering User");
            }
            console.log(`✅ User Registered Successfully: ${email}`);
            // 🚀 Redirect from the backend itself
            res.redirect("/login");
        });
    });
});


// Login User
router.post("/login", (req, res) => {
    console.log("🔵 Received Login Request");
    // console.log("📩 Request Body:", req.body);

    const { email, password } = req.body;

    if (!email || !password) {
        console.log("⚠️ Missing Email or Password");
        return res.status(400).json({ error: "Email and password required" });
    }

    const query = "SELECT * FROM LoginUser WHERE LoginUserName = ?";
    db.query(query, [email], (err, result) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        console.log("🔎 Query Result:", result);

        if (result.length === 0) {
            console.log("🚫 User Not Found");
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const user = result[0];
        console.log("🆔 Found User:", user.LoginUserName);

        if (password !== user.Password) {
            console.log("❌ Invalid Password");
            return res.status(400).json({ error: "Invalid email or password" });
        }

        // ✅ Store Session Data
        req.session.user = {
            LoginUserID: user.LoginUserID,
            LoginUserName: user.LoginUserName,
            LoginUserType: user.LoginUserType
        };

        // 🔄 Update LastLoginDate
        const updateQuery = "UPDATE LoginUser SET LastLoginDate = NOW() WHERE LoginUserID = ?";
        db.query(updateQuery, [user.LoginUserID], (updateErr) => {
            if (updateErr) {
                console.error("❌ Failed to update LastLoginDate:", updateErr);
                // Not blocking login if date update fails
            } else {
                console.log("🕓 LastLoginDate updated");
            }

            req.session.save(err => {
                if (err) {
                    console.error("❌ Session Save Error:", err);
                    return res.status(500).json({ error: "Session error" });
                }

                // console.log("✅ Login Successful! User:", req.session.user.LoginUserName,);

                return res.json({
                    success: true,
                    redirect: user.LoginUserType === "admin" ? "/admin-dashboard" : "/user-dashboard"
                });
            });
        });
    });
});





// Logout User
router.get("/logout", (req, res) => {
    try {
        if (!req.session.user || !req.session.user.LoginUserID) {
            console.warn("⚠️ Logout Attempt Without Login");
            return res.redirect('/');
        }

        console.log(`🔹 Logout Attempt: ${req.session.user.LoginUserName}`);

        req.session.destroy((err) => {
            if (err) {
                console.error("❌ Logout Error:", err);
                return res.status(500).json({ error: "Logout failed" });
            }
            console.log("✅ User Logged Out");
            res.redirect("/"); // Redirect to login page after logout
        });

    } catch (error) {
        console.error("❌ Logout Try-Catch Error:", error);
        res.status(500).json({ error: "Something went wrong during logout" });
    }
});


// Get Logged-in User
router.get("/user", (req, res) => {
    if (!req.session.user) {
        console.warn("⚠️ Unauthorized User Info Request");
        return res.status(401).json({ error: "Not logged in" });
    }
    
    console.log(`🔹 User Info Requested: ${req.session.user.LoginUserName}`);
    res.json({ user: req.session.user });
});

module.exports = router;
