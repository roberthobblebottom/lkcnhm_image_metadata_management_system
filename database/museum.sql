DROP DATABASE IF EXISTS museum;
CREATE DATABASE museum;
USE museum;

CREATE TABLE user (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(50) NOT NULL,
    temporary_password VARCHAR(50) NULL,
    user_type VARCHAR(50) NOT NULL DEFAULT 'Non-admin',
    registered_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_date DATETIME NULL,
    updated_date DATETIME NULL,
    is_deleted BOOLEAN NULL DEFAULT 0,
    contact_number VARCHAR(255), 
    organisation VARCHAR(255), 
    comments VARCHAR(255), 
    reason_for_request VARCHAR(255), 
    updated_by_id INT, 
    created_by_id INT,
    FOREIGN KEY (updated_by_id) REFERENCES user(user_id),
    FOREIGN KEY (created_by_id) REFERENCES user(user_id)
);

CREATE TABLE imaging_request (
        imaging_request_id INT AUTO_INCREMENT PRIMARY KEY,
        imaging_requestor_id INT NOT NULL,
        date_of_request DATETIME NOT NULL,
        imaging_start_date DATETIME NOT NULL,
        imaging_end_date DATETIME NOT NULL,
        summary_of_project VARCHAR(255),
        specimen_details VARCHAR(255),
        specimen_location_name VARCHAR(255),
        imaging_platform VARCHAR(255),
        comments VARCHAR(255),
        created_date DATETIME NOT NULL ,
        created_by_id INT,
        updated_date DATETIME NOT NULL,
        updated_by_id INT,
        is_deleted BOOL NOT NULL DEFAULT 0,
        request_status VARCHAR(255),
        FOREIGN KEY (imaging_requestor_id) REFERENCES user(user_id),
        FOREIGN KEY (updated_by_id) REFERENCES user(user_id),
        FOREIGN KEY (created_by_id) REFERENCES user(user_id)
);

CREATE TABLE imaging_request_user_photographer_link (
   id INT AUTO_INCREMENT PRIMARY KEY,
   imaging_requestor_id INT NOT NULL,
   photographer_id INT NOT NULL,
   FOREIGN KEY (imaging_requestor_id) REFERENCES user(user_id), 
   FOREIGN KEY (photographer_id) REFERENCES user(user_id) 
);

CREATE TABLE Media (
        media_id INT AUTO_INCREMENT PRIMARY KEY,
        imaging_request_id INT NOT NULL,
        photographer_id INT NOT NULL,
        media_file_Name VARCHAR(255),
        file_path VARCHAR(255),
        catalog_id INT,
        morpho_id INT,
        cluster_id INT,
        imaging_date DATETIME,
        resolution VARCHAR(255),
        color_depth VARCHAR(255),
        file_size_bytes VARCHAR(50),
        file_format VARCHAR(50),
        description VARCHAR(225),
        camera_model VARCHAR(255),
        image_editing_tool VARCHAR(255),
        comments VARCHAR(255),
        created_date DATETIME,
        created_by_id INT,
        updated_date DATETIME,
        updated_by_id INT,
        FOREIGN KEY (imaging_request_id) REFERENCES imaging_request(imaging_request_id),
        FOREIGN KEY (photographer_id) REFERENCES user(user_id),
        FOREIGN KEY (updated_by_id) REFERENCES user(user_id),
        FOREIGN KEY (created_by_id) REFERENCES user(user_id)

);

-- Test Data, do not use them for production.
INSERT INTO user (email,password,user_type) VALUES ('admin@gmail.com','password','admin');
SELECT * FROM user WHERE email = 'admin@gmail.com';