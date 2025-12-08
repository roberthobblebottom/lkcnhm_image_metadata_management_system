import mysql, { QueryError } from 'mysql2';

// dotenv.config();
const db = mysql.createConnection({
    host: process.env.DB_HOST, // Change to your MySQL host
    user: process.env.DB_USER,   // Change to your MySQL username
    password: process.env.DB_PASS, // Change to your MySQL password
    database: process.env.DB_NAME, // Change to your database name
    port: parseInt(process.env.DB_PORT!)
});
db.connect((err: QueryError | null) => {
    if (err) {
        console.error('Database Connection Failed:', err);
    } else {
        console.log('Connected to Database');
    }
});

export { db };
