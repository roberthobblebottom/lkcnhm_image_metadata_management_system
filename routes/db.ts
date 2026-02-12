import mysql from 'mysql2/promise';

export const db = mysql.createPool({
    host: process.env.DB_HOST, // Change to your MySQL host
    user: process.env.DB_USER,   // Change to your MySQL username
    password: process.env.DB_PASS, // Change to your MySQL password
    database: process.env.DB_NAME, // Change to your database name
    port: parseInt(process.env.DB_PORT!)
});

module.exports = db;
