
const { userTypesEnumeration } = require('./utils');
const isAuthenticated = (req, res, next) => {
    const user = req.session.passport.user
    console.log("Checking Auth:", user.Email);
    if (user) {
        console.log("✅ User is authenticated.");
        return next(); // ✅ User is logged in
    }
    else {
        return res.redirect("/login"); // 🔁 Redirect to login
    }
};

const isAdmin = (req, res, next) => {

    const user = req.session.passport.user
    if (!user || user.UserType !== userTypesEnumeration().admin) {
        console.log("🚫 Forbidden: User is not an admin");
        return res.redirect("/login"); // 🔁 Send to login page if not admin
    }
    next();
};

module.exports = { isAuthenticated, isAdmin };
