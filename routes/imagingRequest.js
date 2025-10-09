const express = require("express");
const router = express.Router();
const db = require("./db"); // This now imports the promise-based version

// router.post("/submit-imaging-request", async (req, res) => {
//     console.log('\n📥 Received imaging request at:', new Date().toISOString());
//     console.log('📦 Request body:', req.body);

//     try {
//         const {
//             requestorName,
//             photographerName,
//             imagingStartDate,
//             imagingEndDate,
//             projectSummary,
//             specimenDetails,
//             specimenLocation,
//             imagingPlatform,
//             comments
//         } = req.body;

//         // Validate required fields
//         if (!requestorName || !imagingStartDate || !imagingEndDate) {
//             console.warn('❌ Validation failed: Missing required fields');
//             return res.status(400).json({
//                 success: false,
//                 message: "Missing required fields: Requestor Name, Start Date, and End Date are required."
//             });
//         }

//         // Date validation
//         if (new Date(imagingEndDate) < new Date(imagingStartDate)) {
//             console.warn('❌ Validation failed: End date before start date');
//             return res.status(400).json({
//                 success: false,
//                 message: "End date must be after start date"
//             });
//         }

//         // Prepare data
//         const imagingRequestData = {
//             requestorName,
//             photographerName: photographerName || null,
//             dateOfRequest: new Date().toISOString().slice(0, 19).replace('T', ' '),
//             imagingStartDate,
//             imagingEndDate,
//             projectSummary: projectSummary || null,
//             specimenDetails: specimenDetails || null,
//             specimenLocation: specimenLocation || null,
//             imagingPlatform: imagingPlatform || null,
//             comments: comments || null,
//             status: "pending"
//         };

//         // Execute query with promise
//         const [result] = await db.query(
//             `INSERT INTO ImagingRequest SET ?`,
//             [imagingRequestData]
//         );

//         console.log('✅ Successfully inserted imaging request with ID:', result.insertId);

//         res.status(201).json({
//             success: true,
//             message: "Imaging request submitted successfully",
//             requestId: result.insertId
//         });

//     } catch (err) {
//         console.error('❌ Database Error:', err);
//         res.status(500).json({
//             success: false,
//             message: "Database operation failed",
//             error: process.env.NODE_ENV === 'development' ? err.message : undefined
//         });
//     }
// });

module.exports = router;