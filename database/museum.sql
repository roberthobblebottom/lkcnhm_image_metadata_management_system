DROP DATABASE IF EXISTS museum;
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
    IsDelete BOOLEAN NULL DEFAULT 0,
);
-- New tables not in the original script

CREATE TABLE user (
                username = ?, 
            email = ?, 
            contact_number = ?, 
            organisation = ?, 
            UserTypeID = ?, 
            RequestStatusID = ?, 
            comments = ?, 
            reason_for_req = ?, 
            updated_date = ?, 
            updated_by = ?
            created_by,

)

CREATE TABLE RequestStatus(
RequestStatusID INT AUTO_INCREMENT PRIMARY KEY,
RequestStatusName VARCHAR(50) NOT NULL,

)

CREATE TABLE ImagingRequest(
        INSERT INTO ImagingRequest (
        ImagingRequestorID,
        PhotographerID,
        DateofRequest,
        ImagingStartDate,
        ImagingEndDate,
        SummaryofProject,
        SpecimenDetails,
        SpecimenLocationName,
        ImagingPlatform,
        Comments,
        CreatedDate,
        CreatedBy,
        UpdatedDate,
        UpdatedBy,
        IsDelete,
        RequestStatusID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NULL, NULL, 0, ?)
    
)
CREATE TABLE Media(
            ImagingRequestID,
        PhotographerID,
        MediaFileName,
        FilePath,
        CatalogID,
        MorphoID,
        ClusterID,
        ImagingDate,
        Resolution,
        ColorDepth,
        FileSize,
        FileFormat,
        Description,
        CameraModel,
        ImageEditingTool,
        Comments,
        CreatedDate,
        CreatedBy,
        UpdatedDate,
        UpdatedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NULL, NULL)
    
)
-- end of new tables to be created

-- UPDATE LoginUser 
-- SET LoginUserType = 'admin' 
-- WHERE LoginUserName = 'admin@gmail.com';

-- DESC LoginUser;

INSERT INTO LoginUser (LoginUserName,Password,LoginUserType) VALUES ('admin@gmail.com','password','admin');
SELECT * FROM LoginUser WHERE LoginUserName = 'admin@gmail.com';