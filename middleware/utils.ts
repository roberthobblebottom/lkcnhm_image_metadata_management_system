const { Passport } = require("passport");

// Date formatting helper function (place this BEFORE your route handler)
// const formatDate = (dateString: string) => {
//   if (!dateString) return "Not specified";
//   const date = new Date(dateString);
//   return date.toLocaleString("en-US", {
//     year: "numeric",
//     month: "short",
//     day: "numeric",
//   });

// };
const formatDisplayDate = (date: string) => {
  const d = new Date(date) ? new Date(date).toISOString().split("T")[0] : null;
  return d;
};

const projectStatusEnumeration = () => {
  return {
    in_progress: "started",
    on_hiatus: "on hiatus",
    completed: "completed",
  };
};

const mediaFileFormatEnumeration = () => {
  return {
    jpg: ".jpg",
    jpeg: ".jpeg",
    png: ".png",
    tiff: ".tiff",
    tif: ".tif",
    svg: ".svg",
    raw: ".raw",
  };
};

const userTypesEnumeration = () => {
  return {
    photographerOnly: "photographerOnly",
    projectOwner: "projectOwner",
    admin: "admin",
  };
};

const staffTypesEnumeration = () => { 
  return {

    NHMStaff: 'NHM Staff',
    NHMIntern: 'NHM Intern',
    NHMResearchVisitor: 'NHM Research Visitor',
    NUSUndergraduateStudent: 'NUS Undergraduate Student',
    NUSGraduateStudent: 'NUS Graduate Student',
    NonNUSStudent: 'Non-NUS Student',
    Other:'Other'
  }
}

const emailRegex =
  /^[a-zA-Z0-9](\.?[a-zA-Z0-9_-])*[a-zA-Z0-9]@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
const catalogIDRegex = /^[A-Z]{6}\d{7}$/;
const clusterIDRegex = /^[\d][A-Z]o{7}\d{7}$/;
const resolutionRegex = /^\d{1,5}x\d{1,5}$/;

export {
  formatDisplayDate,
  projectStatusEnumeration,
  mediaFileFormatEnumeration,
  userTypesEnumeration,
  staffTypesEnumeration,
  emailRegex,
  catalogIDRegex,
  clusterIDRegex,
  resolutionRegex,
};
