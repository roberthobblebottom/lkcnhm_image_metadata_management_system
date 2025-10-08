DROP DATABASE IF EXISTS museum;
CREATE DATABASE museum;
USE museum;

CREATE TABLE User (
    UserID INT AUTO_INCREMENT PRIMARY KEY,
    Email VARCHAR(255) UNIQUE NOT NULL,
    Password VARCHAR(50) NOT NULL,
    TemporaryPassword VARCHAR(50) NULL,
    UserType VARCHAR(50) NOT NULL DEFAULT 'Non-admin',
    Name VARCHAR(255),
    RegisteredDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    LastLoginDate DATETIME NULL,
    UpdatedDate DATETIME NULL,
    IsDeleted BOOLEAN NULL DEFAULT 0,
    ContactNumber VARCHAR(255), 
    Organisation VARCHAR(255), 
    Comments VARCHAR(255), 
    ReasonForRequest VARCHAR(255), 
    UpdatedByID INT, 
    CreatedByID INT,
    FOREIGN KEY (UpdatedByID) REFERENCES User(UserID),
    FOREIGN KEY (CreatedByID) REFERENCES User(UserID)
);

CREATE TABLE ImagingRequest (
        ImagingRequestID INT AUTO_INCREMENT PRIMARY KEY,
        ImagingRequestorID INT NOT NULL,
        DateOfRequest DATETIME NOT NULL,
        ImagingStartDate DATETIME NOT NULL,
        ImagingEndDate DATETIME NOT NULL,
        SummaryOfProject VARCHAR(255),
        SpecimenDetails VARCHAR(255),
        SpecimenLocationName VARCHAR(255),
        ImagingPlatform VARCHAR(255),
        Comments VARCHAR(255),
        CreatedDate DATETIME NOT NULL ,
        CreatedByID INT,
        UpdatedDate DATETIME NOT NULL,
        UpdatedByID INT,
        IsDeleted BOOL NOT NULL DEFAULT 0,
        RequestStatus VARCHAR(255),
        FOREIGN KEY (ImagingRequestorID) REFERENCES User(UserID),
        FOREIGN KEY (UpdatedByID) REFERENCES User(UserID),
        FOREIGN KEY (CreatedByID) REFERENCES User(UserID)
);

CREATE TABLE ImagingRequestUserPhotographylink (
   ID INT AUTO_INCREMENT PRIMARY KEY,
   ImagingRequestID INT NOT NULL,
   PhotographerID INT NOT NULL,
   FOREIGN KEY (ImagingRequestID) REFERENCES User(UserID), 
   FOREIGN KEY (PhotographerID) REFERENCES User(UserID) 
);

CREATE TABLE Media (
        MediaID INT AUTO_INCREMENT PRIMARY KEY,
        ImagingRequestID INT NOT NULL,
        photographerID INT NOT NULL,
        MediaFileName VARCHAR(255),
        FilePath VARCHAR(255),
        CatalogID INT,
        MorphoID INT,
        ClusterID INT,
        ImagingDate DATETIME,
        Resolution VARCHAR(255),
        ColorDepth VARCHAR(255),
        FileSizeBytes VARCHAR(50),
        FileFormat VARCHAR(50),
        Description VARCHAR(225),
        CameraModel VARCHAR(255),
        ImageEditingTool VARCHAR(255),
        Comments VARCHAR(255),
        CreatedDate DATETIME,
        CreatedByID INT,
        UpdatedDate DATETIME,
        UpdatedByID INT,
        IsDeleted BOOL NOT NULL DEFAULT 0,
        FOREIGN KEY (ImagingRequestID) REFERENCES ImagingRequest(ImagingRequestID),
        FOREIGN KEY (photographerID) REFERENCES User(UserID),
        FOREIGN KEY (UpdatedByID) REFERENCES User(UserID),
        FOREIGN KEY (CreatedByID) REFERENCES User(UserID)

);

-- Test Data, do not use them for production
INSERT INTO User (Email,Password,UserType,Name) VALUES ('admin@gmail.com','1','admin',"jeff");
INSERT INTO ImagingRequest (ImagingRequestorID ,DateOfRequest ,ImagingStartDate ,ImagingEndDate ,CreatedDate ,UpdatedDate ,RequestStatus) 
VALUES (1,NOW(),NOW(),NOW(),NOW(),NOW(),'approved');
SELECT * FROM User WHERE Email = 'admin@gmail.com';
SELECT * FROM ImagingRequest;