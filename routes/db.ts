import mysql, { QueryError } from 'mysql2/promise';

export const db = mysql.createPool({
    host: process.env.DB_HOST, // Change to your MySQL host
    user: process.env.DB_USER,   // Change to your MySQL username
    password: process.env.DB_PASS, // Change to your MySQL password
    database: process.env.DB_NAME, // Change to your database name
    port: parseInt(process.env.DB_PORT!)
});
// db.connect((err: QueryError | null) => {
//     if (err) {
//         console.error('Database Connection Failed:', err);
//     } else {
//         console.log('Connected to Database');
//     }
// });
// export const query = async (sql: string, params?: any[]) => {
//     console.log(".....................")
//     return await db.query(sql, params);
// };
// export { db };
module.exports = db;
