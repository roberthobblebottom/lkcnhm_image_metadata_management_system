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
    RequestStatus VARCHAR(255),
    ReasonForRequest VARCHAR(255), 
    UpdatedByID INT NOT NULL, 
    CreatedByID INT NOT NULL,
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
        CreatedByID INT NOT NULL,
        UpdatedDate DATETIME NOT NULL,
        UpdatedByID INT NOT NULL,
        IsDeleted BOOL NOT NULL DEFAULT 0,
        RequestStatus VARCHAR(255),
        ReasonForRequest VARCHAR(255),
        FOREIGN KEY (ImagingRequestorID) REFERENCES User(UserID),
        FOREIGN KEY (UpdatedByID) REFERENCES User(UserID),
        FOREIGN KEY (CreatedByID) REFERENCES User(UserID)
);

CREATE TABLE ImagingRequestUserPhotographyLink (
   ID INT AUTO_INCREMENT PRIMARY KEY,
   ImagingRequestID INT NOT NULL,
   PhotographerID INT NOT NULL,
   FOREIGN KEY (ImagingRequestID) REFERENCES ImagingRequest(ImagingRequestID), 
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
        CreatedByID INT NOT NULL,
        UpdatedDate DATETIME,
        UpdatedByID INT NOT NULL,
        IsDeleted BOOL NOT NULL DEFAULT 0,
        FOREIGN KEY (ImagingRequestID) REFERENCES ImagingRequest(ImagingRequestID),
        FOREIGN KEY (photographerID) REFERENCES User(UserID),
        FOREIGN KEY (UpdatedByID) REFERENCES User(UserID),
        FOREIGN KEY (CreatedByID) REFERENCES User(UserID)

);

-- Test Data, do not use them for production
INSERT INTO User (Email,Password,UserType,Name,CreatedByID,UpdatedByID,RequestStatus) VALUES ('admin@gmail.com','1','admin',"jeff",'1','1','approved');
INSERT INTO User (Email,Password,UserType,Name,CreatedByID,UpdatedByID,RequestStatus) VALUES ('r1@gmail.com','1','requestor',"Zesty",'2','2','approved');
INSERT INTO User (Email,Password,UserType,Name,CreatedByID,UpdatedByID,RequestStatus) VALUES ('p1@gmail.com','1','photographer',"Ron",'3','3','approved');
INSERT INTO ImagingRequest (ImagingRequestorID ,DateOfRequest ,ImagingStartDate ,ImagingEndDate ,CreatedDate ,UpdatedDate ,RequestStatus,CreatedByID,UpdatedByID) 
VALUES (1,NOW(),NOW(),NOW(),NOW(),NOW(),'approved','1','1');
INSERT INTO ImagingRequestUserPhotographyLink (ImagingRequestID,PhotographerID) VALUES ("1",'1'); 
-- SELECT * FROM User WHERE Email = 'admin@gmail.com';
-- SELECT * FROM ImagingRequest;
SELECT * FROM ImagingRequestUserPhotographyLink;