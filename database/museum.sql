DROP DATABASE IF EXISTS museum;
CREATE DATABASE museum;
USE museum;

CREATE TABLE User (
    UserID INT AUTO_INCREMENT PRIMARY KEY,
    Email VARCHAR(255) UNIQUE NOT NULL,
    HashedPassword BLOB NOT NULL,
    PasswordSalt VARCHAR(255) NOT NULL,
    TemporaryPassword VARCHAR(50) NULL,
    UserType ENUM('photographerOnly','projectOwner','admin') NOT NULL,
    FullName VARCHAR(255) NOT NULL,
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

CREATE TABLE Project (
        ProjectID INT AUTO_INCREMENT PRIMARY KEY,
        ProjectOwnerID INT NOT NULL,
        ProjectName VARCHAR(255) NOT NULL,
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
        ProjectStatus ENUM('in progress','on hiatus','completed, pending metadata upload','completed') NOT NULL,
        FOREIGN KEY (ProjectOwnerID) REFERENCES User(UserID),
        FOREIGN KEY (UpdatedByID) REFERENCES User(UserID),
        FOREIGN KEY (CreatedByID) REFERENCES User(UserID)
);

CREATE TABLE ImagingPlatformInstance(
        ImagingPlatformInstanceID INT AUTO_INCREMENT PRIMARY KEY,
        ProjectID INT NOT NULL,
        ImagingPlatform ENUM('Leica(L5)','Mitutoyo(L5)','Olympus(L4Prep)',
        'Olympus(L5)','Passport(L5)','VD(L4Prep)','Other') NOT NULL,
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
        MediaFileName VARCHAR(255),
        FilePath VARCHAR(255),
        CatalogID VARCHAR(100) NOT NULL,
        MorphoID VARCHAR(100),
        ClusterID VARCHAR(100),
        ImagingDate DATETIME,
        Resolution VARCHAR(255),
        FileSizeBytes INT,
        FileFormat VARCHAR(50),
        Description VARCHAR(225),
        ImagingPlatform VARCHAR(255),
        ImageEditingTool VARCHAR(255),
        Comments VARCHAR(255),
        CreatedDate DATETIME,
        CreatedByID INT NOT NULL,
        UpdatedDate DATETIME,
        UpdatedByID INT NOT NULL,
        IsDeleted BOOL NOT NULL DEFAULT 0,
        FOREIGN KEY (ProjectID) REFERENCES Project(ProjectID),
        FOREIGN KEY (PhotographerID) REFERENCES User(UserID),
        FOREIGN KEY (UpdatedByID) REFERENCES User(UserID),
        FOREIGN KEY (CreatedByID) REFERENCES User(UserID)

);

-- Test Data, do not use them for production
INSERT INTO User (Email,HashedPassword,PasswordSalt,UserType,FullName,CreatedByID,UpdatedByID,RequestStatus) 
VALUES ('admin@gmail.com',FROM_BASE64('W8VK+3eef900fOpSgH0HZmeD2E9wEr7hevUHM+GEQ3c='),'JR6lq3JUFxejg39f','admin',"jeff Jack",'1','1','approved');
INSERT INTO User (Email,HashedPassword,PasswordSalt,UserType,FullName,CreatedByID,UpdatedByID,RequestStatus) 
VALUES ('r1@gmail.com',FROM_BASE64("hwXpWnraI+KqYkaChBAc4EjTdAEtXxKZXBn/cMss2/4="),'ZdYThKAg1ZD4ULyd','projectOwner',"Zesty wong",'2','2','approved');
INSERT INTO User (Email,HashedPassword,PasswordSalt,UserType,FullName,CreatedByID,UpdatedByID,RequestStatus) 
VALUES ('p1@gmail.com',FROM_BASE64("sj1O+m695SCDA0cyNiHK/aEknLFcYPhoxP9YOZe0pvA="),'UkSbEVvinkts1Dbb','photographerOnly',"Ron Pass",'3','3','approved');


INSERT INTO Project (ProjectOwnerID ,ProjectName ,ProjectType,ImagingStartDate ,ImagingEndDate ,CreatedDate ,UpdatedDate ,ProjectStatus,CreatedByID,UpdatedByID,SummaryOfProject,DetailsOfSpecimens) 
VALUES (1,"Ttest project 1","BDP",NOW(),DATE_ADD(NOW(), INTERVAL 2 DAY),NOW(),NOW(),'in progress','1','1','sample project summary','sample specimen details');
INSERT INTO ProjectUserPhotographyLink (ProjectID,PhotographerID) VALUES ("1",'1'); 
INSERT INTO ImagingPlatformInstance(ProjectID,ImagingPlatform) VALUES (1,'Olympus(L5)');
INSERT INTO ImagingPlatformInstance(ProjectID,ImagingPlatform) VALUES (1,'VD(L4Prep)');

INSERT INTO Project (ProjectOwnerID ,ProjectName,ProjectType,ImagingStartDate ,ImagingEndDate ,CreatedDate ,UpdatedDate ,ProjectStatus,CreatedByID,UpdatedByID,SummaryOfProject,DetailsOfSpecimens) 
VALUES (2,"test project 2",'BDP',NOW(),DATE_ADD(NOW(),INTERVAL 2 DAY),NOW(),NOW(),'in progress','1','1','sample project summary','sample specimen details');
INSERT INTO ProjectUserPhotographyLink (ProjectID,PhotographerID) VALUES ("2",2); 
INSERT INTO ImagingPlatformInstance(ProjectID,ImagingPlatform) VALUES (2,'Leica(L5)');



INSERT INTO Media (ProjectID,PhotographerID,MediaFileName,FilePath,CatalogID,
MorphoID,ClusterID,ImagingDate,Resolution,FileSizeBytes,FileFormat,Description,ImagingPlatform,ImageEditingTool,
Comments,CreatedDate,CreatedByID,UpdatedDate,UpdatedByID) VALUES (
1,1,"photo.png","filepath",'catelogid',"MorphoID","ClusterID",NOW(),
"1000 x 1000",1000,".png","Description",
"nikon_test", "imaging editing tool", 'comments', NOW(),1,NOW(),1);


-- SELECT * FROM User WHERE Email = 'admin@gmail.com';
-- SELECT * FROM Project;
SELECT * FROM Media;
