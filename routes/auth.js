const express = require("express");
const router = express.Router();
const db = require("./db");
const passport = require('passport');
const LocalStrategy = require('passport-local');
const crypto = require('crypto');
const userTypesEnumeration = require('../middleware/utils').userTypesEnumeration;

passport.use(new LocalStrategy(async function verify(username, password, cb) {
    //Do not change the variable name from username to email, it doesn't work.
    const query = "SELECT PasswordSalt, HashedPassword, UserID,UserType,FullName,Email FROM User WHERE Email = ?";
    const [result] = await db.promise().query(query, [username]).catch(
        error => {
            console.error("❌ Database Error:", error);
            return cb(null, false, { message: "Database error" })
        }
    )

    console.log("🔎 Query Result:", result);

    if (result.length === 0) {
        console.log("🚫 User Not Found");
        return cb(null, false, { message: 'Invalid email or password' })
    }

    const user = result[0];
    console.log("🆔 Found User:", user.Email);

    crypto.pbkdf2(password, user.PasswordSalt, 310000, 32, 'sha256', function (err, hashedPassword) {
        if (err) return cb(err);
        if (!crypto.timingSafeEqual(user.HashedPassword, hashedPassword)) {
            console.log("❌ Invalid Password");
            return cb(null, false, { message: 'Incorrect username or password.' });
        }
        console.log("successful local strategy execution");
        return cb(null, user);
    });
}));

// serialise user to be added into session data.
passport.serializeUser((user, done) => {
    process.nextTick(function () {
        return done(null, {
            UserID: user.UserID,
            FullName: user.FullName,
            Email: user.Email,
            UserType: user.UserType
        })
    })
})

// retrieving session data
passport.deserializeUser((user, cb) => {
    process.nextTick(function () { return cb(null, user) });
})


router.post("/register", (req, res) => {
    const { email, password } = req.body;
    console.log(`🔹 Register Attempt: ${email}`);

    const checkEmailQuery = "SELECT * FROM User WHERE Email = ?";
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
            INSERT INTO User 
            (Email, Password, TempPassword, UserType, RegisteredDate, LastLoginDate, UpdatedDate, IsDelete) 
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
router.post("/login",
    (req, res, next) => {
        passport.authenticate('local', {
            successRedirect: "/", // I don't think this is doing anything.
            successFlash: true,
            failureRedirect: '/login',
            failureFlash: true,
            failureMessage: "CUSTOM",// not working
        },
            (err, user, info) => {
                if (err) return next(err);
                if (!user) return res.status(401).send(info);
                req.login(user, (err) => { // I am not suppose to use this as password authenticate already does it, but somehow this guy's code from stackoverflow works
                    if (err) return res.status(500).json({ error: "Login failed." });

                    // 🔄 Update LastLoginDate
                    const updateQuery = "UPDATE User SET LastLoginDate = NOW() WHERE UserID = ?";
                    db.query(updateQuery, [user.UserID], async (updateErr) => {
                        if (updateErr) {
                            console.error("❌ Failed to update LastLoginDate:", updateErr);
                            // Not blocking login if date update fails
                        } else {
                            console.log("🕓 LastLoginDate updated");
                        }
                        req.session['imageEditingTools'] = (await db.promise().query(
                            "SHOW COLUMNS FROM Media LIKE 'ImageEditingTool' "))
                        [0][0]["Type"]
                            .replace("enum(", "")
                            .replace(")", "")
                            .replaceAll("'", "")
                            .split(",")
                        console.log('imageEditingTools', req.session['imageEditingTools'])

                        const ip = (await db.promise().query(
                            "SHOW COLUMNS FROM Media LIKE 'ImagingPlatform' "))
                        [0][0]["Type"]
                            .replaceAll("enum(", "")
                            .replaceAll("'", "")
                            .split(",")
                        ip.splice(ip.length - 1,1, ip.at(-1).replace(")",""))
                        req.session['imagingPlatforms'] = ip
                        console.log('imagingPlatforms', req.session['imagingPlatforms'])

                        req.session.save(err => {
                            if (err) {
                                console.error("❌ Session Save Error:", err);
                                return res.status(500).json({ error: "Session error" });
                            }
                            return res.json({
                                success: true,
                                redirect: user.UserType === userTypesEnumeration.admin ? "/admin/dashboard" : "/user/dashboard"
                            });
                        });
                    });

                });

            }
        )(req, res, next)
    }
);





// Logout User
router.get("/logout", (req, res) => {
    try {
        if (!req.session.passport.user || !req.session.passport.user.UserID) {
            console.warn("⚠️ Logout Attempt Without Login");
            return res.redirect('/');
        }
        console.log(`🔹 Logout Attempt: ${req.session.passport.user.Email}`);

        req.session.destroy((err) => {
            if (err) {
                console.error("❌ Logout Error:", err);
                return res.status(500).json({ error: "Logout failed" });
            }
            console.log("✅ User Logged Out");
            return res.redirect('/');
        });

    } catch (error) {
        console.error("❌ Logout Try-Catch Error:", error);
        res.status(500).json({ error: "Something went wrong during logout" });
    }
});


// Get Logged-in User
router.get("/user", (req, res) => {
    if (!req.session.paassport.user) {
        console.warn("⚠️ Unauthorized User Info Request");
        return res.status(401).json({ error: "Not logged in" });
    }

    console.log(`🔹 User Info Requested: ${req.session.passport.user.Email}`);
    res.json({ user: req.session.passport.user });
});

module.exports = router;
