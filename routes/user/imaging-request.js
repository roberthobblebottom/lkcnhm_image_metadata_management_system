const express = require("express");
const router = express.Router();
const db = require("../db"); // Database connection
const { isAuthenticated, isAdmin } = require("../../middleware/auth"); // Middleware
const { formatDate, formatDisplayDate, requestStatusTuple } = require("../../middleware/utils");


router.get('/view-all-imaging-requests', isAuthenticated, async (req, res) => {
    const loginUserId = req.session.user.UserID;
    const findUserQuery = `
      SELECT u.UserID , u.RequestStatus, u.UserType
      FROM User u
      WHERE u.CreatedByID = ? 
        AND u.IsDeleted = 0
      LIMIT 1
    `;

    const [userResult] = await db.promise().query(findUserQuery, [loginUserId], (err1, userResult) => {
        if (err1) {
            console.error("❌ Error checking user approval:", err1);
            return res.status(500).render("error", {
                message: "Server error while checking user approval.",
                error: process.env.NODE_ENV === 'development' ? err1 : null
            });
        }
    });
    // No such user created OR not approved
    // if (!userResult[0]) {
    //     // console.log("🔒 User not approved or not registered as Internal/External");
    //     return res.render("user/view_all_imaging_request_index", {
    //         imagingRequests: [],
    //         showPendingAlert: false
    //     });
    // }
    console.log(Object.keys(userResult[0]))
    console.log(Object.values(userResult[0]))
    const approvedUserId = userResult[0].UserID;
    const requestQuery = `
          SELECT 
              ir.*,
              r.Name AS requestor_name,
              photographer.Email AS photographer_name
          FROM ImagingRequest ir
          LEFT JOIN User r ON ir.ImagingRequestorID = r.UserID
          JOIN ImagingRequestUserPhotographyLink irupl ON irupl.ImagingRequestID = ir.ImagingRequestID
          JOIN User photographer on irupl.PhotographerID = photographer.UserID
          WHERE ir.IsDeleted = 0 AND ir.ImagingRequestorID = ?
          ORDER BY ir.CreatedDate DESC
        `;


    const [imagingRequests] = await db.promise().query(requestQuery, [approvedUserId], (err2, imagingRequests) => {
        if (err2) {
            console.error("❌ Error fetching imaging requests:", err2);
            return res.status(500).render("error", {
                message: "Error loading imaging requests",
                error: process.env.NODE_ENV === 'development' ? err2 : null
            });
        }

        console.log(`📄 Imaging requests for approved user ${approvedUserId}: ${imagingRequests.length}`);

    });
    res.render("user/view_all_imaging_request_index", {
        imagingRequests,
        showPendingAlert: false,
        title: "Imaging Requests" // Add title here
    });
});




module.exports = router;