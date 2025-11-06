function isAuthenticated(req, res, next) {
    if (req.session && req.session.passport.user) {
        return next();
    }
    res.status(401).json({ error: "Unauthorized" });
}

function isAdmin(req, res, next) {
    if (req.session && req.session.passport.user && req.session.passport.user.UserType === "admin") {
        return next();
    }
    res.status(403).json({ error: "Forbidden: Admin access required" });
}

module.exports = { isAuthenticated, isAdmin };
