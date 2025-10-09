const isAuthenticated = (req, res, next) => {
    console.log("Checking Auth:", req.session.user);
    if (req.session.user) {
        console.log("✅ User is authenticated:", req.session.user);
        return next(); // ✅ User is logged in
    }
    else {
        return res.redirect("/login"); // 🔁 Redirect to login
    }
};

const isAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.UserType !== "admin") {
        console.log("🚫 Forbidden: User is not an admin", req.session.user);
        return res.redirect("/login"); // 🔁 Send to login page if not admin
    }
    next();
};

module.exports = { isAuthenticated, isAdmin };
