const express = require("express");
const router = express.Router();
const db = require("../db"); // Database connection
const { isAuthenticated, isAdmin } = require("../../middleware/auth"); // Middleware
const { formatDate, formatDisplayDate, requestStatusTuple } = require("../../middleware/utils");


router.get('/view-all-projects', isAuthenticated, async (req, res) => {
    const loginUserId = req.session.passport.user.UserID;
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
    //     return res.render("user/view_all_project_index", {
    //         projects: [],
    //         showPendingAlert: false
    //     });
    // }
    console.log(Object.keys(userResult[0]))
    console.log(Object.values(userResult[0]))
    const approvedUserId = userResult[0].UserID;
    const requestQuery = `
          SELECT 
              p.*,
              projectOwner.Name AS requestor_name,
              photographer.Email AS photographer_name
          FROM Project p
          LEFT JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
          JOIN ProjectUserPhotographyLink irupl ON irupl.ProjectID = p.ProjectID
          JOIN User photographer on irupl.PhotographerID = photographer.UserID
          WHERE p.IsDeleted = 0 AND p.ProjectOwnerID = ?
          ORDER BY p.CreatedDate DESC
        `;


    const [projects] = await db.promise().query(requestQuery, [approvedUserId], (err2, projects) => {
        if (err2) {
            console.error("❌ Error fetching projects:", err2);
            return res.status(500).render("error", {
                message: "Error loading projects",
                error: process.env.NODE_ENV === 'development' ? err2 : null
            });
        }

        console.log(`📄 projects for approved user ${approvedUserId}: ${projects.length}`);

    });
    res.render("user/view-all-project-index", {
        projects,
        showPendingAlert: false,
        title: "Projects" // Add title here
    });
});



// Changes Done by Rex to this Module of Non_admin Project Form page Loading Controller
//I don't know where this is from. I may need to remove - Ryan
router.get('/view-project', isAuthenticated, (req, res) => {
    try {
        const { UserID, Email } = req.session.passport.user;
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
                return res.redirect('/user/project/view-all-projects?status=pending');
            }

            db.query(getPhotographersQuery, [UserID], (err2, photographerResults) => {
                if (err2) {
                    console.error("❌ Error loading photographers:", err2);
                    return res.status(500).render('error', { message: "Error loading photographers" });
                }

                console.log("✅ [Final] Rendering form with requestor:", requestor, "and photographers:", photographerResults);

                res.render('user/view-project', {
                    requestor, // only one
                    photographers: photographerResults || [],
                    title: 'Project Form',
                    currentUser: req.session.passport.user,
                    title: "Project Form" // Add title here
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

// View Request (GET)
router.get('/view-project/:id', isAuthenticated, (req, res) => {
    const projectID = req.params.id;
    const query = `
        SELECT 
            p.*,
            projectOwner.Name AS requestor_name,
            projectOwner.Email,
            photographer.Email,
            photographer.Name AS photographer_name,
            projectOwner.RequestStatus AS status_name,
            creator.Email AS creator_name,
            updater.Email AS updater_name
        FROM Project p
        LEFT JOIN User projectOwner ON p.ProjectOwnerID = projectOwner.UserID
        JOIN ProjectUserPhotographyLink irupl ON irupl.ProjectID = p.ProjectID
        JOIN User photographer on irupl.PhotographerID = photographer.UserID
        LEFT JOIN User creator ON p.CreatedByID = creator.UserID
        LEFT JOIN User updater ON p.UpdatedByID = updater.UserID
        WHERE p.ProjectID = ?
    `;

    db.query(query, [projectID], (err, results) => {
        if (err) {
            console.error('Error fetching project:', err);
            return res.status(500).render('error', {
                message: 'Error loading project',
                error: process.env.NODE_ENV === 'development' ? err : null
            });
        }

        if (results.length === 0) {
            return res.status(404).render('error', {
                message: 'project not found'
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
        res.render('view-project', {
            request: request,
            currentUser: req.user,
            title: "User View Project", // Add title here
            userType: req.session.passport.user.UserType
        });
    });
});


router.get('/add-new-project', isAuthenticated, async (req, res) => {


    const getPhotographers = `
      SELECT u.UserID, u.Name,u.Email 
      FROM User u
        WHERE u.RequestStatus = 'approved'
        AND u.IsDeleted = 0
    `; // todo wrong user type id filter these are hard coded.

    const [photographers] = await db.promise().query(getPhotographers);
    res.render('user/create-project', {
        requestor: req.session.passport.user,
        photographers: photographers,
        title: "Project Form",
    });
});


module.exports = router;