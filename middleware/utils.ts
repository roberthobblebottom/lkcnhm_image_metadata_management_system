// Date formatting helper function (place this BEFORE your route handler)

const formatDisplayDate = (date: any) => {
console.log('date',date)
  var d1 = new Date(date)
  console.log('d1',d1)
  const d2 = d1 ? d1.toISOString().split("T")[0] : null;
  console.log('d2',d2)
  return d2;
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

// const emailRegex = /(?:[a-z0-9!#$%&'*+\x2f=?^_`\x7b-\x7d~\x2d]+(?:\.[a-z0-9!#$%&'*+\x2f=?^_`\x7b-\x7d~\x2d]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9\x2d]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9\x2d]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9\x2d]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/
const emailRegex = /[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
const catalogIDRegex = /^[A-Z]{6}\d{7}$/;
const clusterIDRegex = /^[\d][A-Z]o{7}\d{7}$/;
const resolutionRegex = /^\d{1,5}x\d{1,5}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[0-9])\S{7,}$/;
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
  passwordRegex
};
