function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    res.status(401).json({ error: "Unauthorized" });
}

function isAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === "admin") {
        return next();
    }
    res.status(403).json({ error: "Forbidden: Admin access required" });
}

module.exports = { isAuthenticated, isAdmin };
