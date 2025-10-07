CREATE DATABASE museum;
USE museum;

CREATE TABLE LoginUser (
    LoginUserID INT AUTO_INCREMENT PRIMARY KEY,
    LoginUserName VARCHAR(255) UNIQUE NOT NULL,
    Password VARCHAR(50) NOT NULL,
    TempPassword VARCHAR(50) NULL,
    LoginUserType VARCHAR(50) NOT NULL DEFAULT 'Non-admin',
    RegisteredDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    LastLoginDate DATETIME NULL,
    UpdatedDate DATETIME NULL,
    IsDelete BOOLEAN NULL DEFAULT 0
);

UPDATE LoginUser 
SET LoginUserType = 'admin' 
WHERE LoginUserName = 'admin@gmail.com';

SELECT * FROM LoginUser;
DESC LoginUser;
