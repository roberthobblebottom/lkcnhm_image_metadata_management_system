-- REMEMBER WHEN UPDATING ENUMS, UPDATE MIDDLEWARE/UTILS ENUM LIKE OBJECT TOO
-- When creating Project Entry, there needs to be a ProjectuserPhotographyLink Entry that reflects the project owner being a photographer too.
DROP DATABASE IF EXISTS museum;
CREATE DATABASE museum;
USE museum;

CREATE TABLE User (
    UserID INT AUTO_INCREMENT PRIMARY KEY,
    Email VARCHAR(100) UNIQUE NOT NULL,
    HashedPassword BLOB(255) NOT NULL ,
    PasswordSalt VARCHAR(255) NOT NULL UNIQUE,
    TemporaryPassword VARCHAR(50) NULL,
    UserType ENUM('photographerOnly','projectOwner','admin') NOT NULL,
    FullName VARCHAR(200) NOT NULL,
    RegisteredDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    LastLoginDate DATETIME NULL,
    UpdatedDate DATETIME NULL,
    IsDeleted BOOLEAN NULL DEFAULT 0,
    ContactNumber VARCHAR(100), 
    Organisation VARCHAR(150), 
    Comments VARCHAR(255), 
    RequestStatus ENUM('approved','rejected','pending') NOT NULL,
    ReasonForRequest VARCHAR(255), 
    UpdatedByID INT NOT NULL, 
    CreatedByID INT NOT NULL,
    FOREIGN KEY (UpdatedByID) REFERENCES User(UserID),
    FOREIGN KEY (CreatedByID) REFERENCES User(UserID)
);

CREATE TABLE Project (
        ProjectID INT AUTO_INCREMENT PRIMARY KEY,
        ProjectOwnerID INT NOT NULL,
        ProjectName VARCHAR(150) NOT NULL ,
        ProjectType 
        ENUM('BDP','GalleryBDP','InternalResearch','StudentProject','Visitor') 
        NOT NULL,
        ImagingStartDate DATETIME NOT NULL,
        ImagingEndDate DATETIME NOT NULL,
        SummaryOfProject VARCHAR(255),
        DetailsOfSpecimens VARCHAR(255),
        LocationsOfSpecimens VARCHAR(255),
        Comments VARCHAR(255),
        CreatedDate DATETIME NOT NULL ,
        CreatedByID INT NOT NULL,
        UpdatedDate DATETIME NOT NULL,
        UpdatedByID INT NOT NULL,
        IsDeleted BOOL NOT NULL DEFAULT 0,
        ProjectStatus 
        ENUM('started','on hiatus','completed') 
        NOT NULL,
        FOREIGN KEY (ProjectOwnerID) REFERENCES User(UserID),
        FOREIGN KEY (UpdatedByID) REFERENCES User(UserID),
        FOREIGN KEY (CreatedByID) REFERENCES User(UserID)
);

CREATE TABLE ImagingPlatformInstance(
        ImagingPlatformInstanceID INT AUTO_INCREMENT PRIMARY KEY,
        ProjectID INT NOT NULL,
        ImagingPlatform ENUM('Leica(L5)','Mitutoyo(L5)','Olympus(L4Prep)',
        'Olympus(L5)','Passport(L5)','VD(L4Prep)') NOT NULL,
        FOREIGN KEY (ProjectID) REFERENCES Project(ProjectID)
);

CREATE TABLE ProjectUserPhotographyLink (
   ProjectUserPhotographyLinkID INT AUTO_INCREMENT PRIMARY KEY,
   ProjectID INT NOT NULL,
   PhotographerID INT NOT NULL,
   FOREIGN KEY (ProjectID) REFERENCES Project(ProjectID), 
   FOREIGN KEY (PhotographerID) REFERENCES User(UserID) 
);

CREATE TABLE Media (
        MediaID INT AUTO_INCREMENT PRIMARY KEY,
        ProjectID INT NOT NULL,
        PhotographerID INT NOT NULL,
        FileName VARCHAR(100) NOT NULL ,
        FilePath VARCHAR(200) NOT NULL ,
        CatalogID VARCHAR(100) ,
        MorphoID VARCHAR(100),
        ClusterID VARCHAR(100),
        ImagingDate DATETIME,
        Resolution VARCHAR(255),
        FileSizeBytes BIGINT NOT NULl,
        FileFormat ENUM(".jpg", ".jpeg", ".png",".tiff", ".svg", ".raw",".tif") NOT NULL,
        Description VARCHAR(225),
        ImagingPlatform ENUM('Leica(L5)','Mitutoyo(L5)','Olympus(L4Prep)',
        'Olympus(L5)','Passport(L5)','VD(L4Prep)','Other'),
        ImageEditingTool ENUM('photoshop','gimp'),
        Comments VARCHAR(255),
        CreatedDate DATETIME NOT NULL,
        CreatedByID INT NOT NULL,
        UpdatedDate DATETIME NOT NULL,
        UpdatedByID INT NOT NULL,
        IsDeleted BOOL NOT NULL DEFAULT 0,
        FOREIGN KEY (ProjectID) REFERENCES Project(ProjectID),
        FOREIGN KEY (PhotographerID) REFERENCES User(UserID),
        FOREIGN KEY (UpdatedByID) REFERENCES User(UserID),
        FOREIGN KEY (CreatedByID) REFERENCES User(UserID)

);

-- Test Data, do not use them for production
INSERT INTO User (Email,HashedPassword,PasswordSalt,UserType,FullName,
CreatedByID,UpdatedByID,RequestStatus) 
VALUES ('admin@gmail.com',FROM_BASE64('W8VK+3eef900fOpSgH0HZmeD2E9wEr7hevUHM+GEQ3c='),
'JR6lq3JUFxejg39f','admin',"jeff Jack",'1','1','approved');
INSERT INTO User (Email,HashedPassword,PasswordSalt,UserType,FullName,
CreatedByID,UpdatedByID,RequestStatus) 
VALUES ('r1@gmail.com',FROM_BASE64("hwXpWnraI+KqYkaChBAc4EjTdAEtXxKZXBn/cMss2/4="),
'ZdYThKAg1ZD4ULyd','projectOwner',"Zesty wong",'2','2','approved');

INSERT INTO User (Email,HashedPassword,PasswordSalt,UserType,FullName,
CreatedByID,UpdatedByID,RequestStatus) 
VALUES ('p1@gmail.com',FROM_BASE64("sj1O+m695SCDA0cyNiHK/aEknLFcYPhoxP9YOZe0pvA="),
'UkSbEVvinkts1Dbb','photographerOnly',"Ron Pass",'3','3','approved');


INSERT INTO Project (ProjectOwnerID ,ProjectName ,ProjectType,ImagingStartDate ,ImagingEndDate ,
CreatedDate ,UpdatedDate ,ProjectStatus,CreatedByID,UpdatedByID,SummaryOfProject,DetailsOfSpecimens) 
VALUES (1,"test project 1","BDP",NOW(),DATE_ADD(NOW(), INTERVAL 2 DAY),NOW(),NOW(),
'started','1','1','sample project summary','sample specimen details');
-- link the project owner as a phtogragpher
INSERT INTO ProjectUserPhotographyLink (ProjectID,PhotographerID) VALUES ("1",'1'); 
INSERT INTO ImagingPlatformInstance(ProjectID,ImagingPlatform) VALUES (1,'Olympus(L5)');
INSERT INTO ImagingPlatformInstance(ProjectID,ImagingPlatform) VALUES (1,'VD(L4Prep)');

INSERT INTO Project (ProjectOwnerID ,ProjectName,ProjectType,ImagingStartDate ,ImagingEndDate ,
CreatedDate ,UpdatedDate ,ProjectStatus,CreatedByID,UpdatedByID,SummaryOfProject,DetailsOfSpecimens) 
VALUES (2,"test project 2",'BDP',NOW(),DATE_ADD(NOW(),INTERVAL 2 DAY),NOW(),NOW(),
'started','1','1','sample project summary','sample specimen details');
-- link the project owner as a phtogragpher
INSERT INTO ProjectUserPhotographyLink (ProjectID,PhotographerID) VALUES ("2",2); 
INSERT INTO ImagingPlatformInstance(ProjectID,ImagingPlatform) VALUES (2,'Leica(L5)');



INSERT INTO Media (ProjectID,PhotographerID,FileName,FilePath,CatalogID,
MorphoID,ClusterID,ImagingDate,Resolution,FileSizeBytes,FileFormat,
Description,ImagingPlatform,ImageEditingTool,
Comments,CreatedDate,CreatedByID,UpdatedDate,UpdatedByID) VALUES (
1,1,"photo.png","filepath",'catelogid',"MorphoID","ClusterID",NOW(),
"1000x1000",1000,".png","Description",
"Leica(L5)", "photoshop", 'comments', NOW(),1,NOW(),1);



SELECT * FROM User;
SELECT 1 FROM User limit 1;
SELECT * FROM Project;
SELECT 1 FROM User limit 1;
SELECT * FROM Media;

