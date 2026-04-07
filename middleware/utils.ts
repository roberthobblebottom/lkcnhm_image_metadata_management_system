// Date formatting helper function (place this BEFORE your route handler)

import { Request, Response, NextFunction } from "express"
const formatDisplayDate = (date: any) => {
  var d1 = new Date(date)
  const d2 = d1 ? d1.toISOString().split("T")[0] : null
  return d2
}

const projectStatusEnumeration = () => {
  return {
    in_progress: "started",
    on_hiatus: "on hiatus",
    completed: "completed",
  }
}

const mediaFileFormatEnumeration = () => {
  return {
    jpg: ".jpg",
    jpeg: ".jpeg",
    png: ".png",
    tiff: ".tiff",
    tif: ".tif",
    svg: ".svg",
    raw: ".raw",
  }
}

const userTypesEnumeration = () => {
  return {
    photographerOnly: "photographerOnly",
    projectOwner: "projectOwner",
    admin: "admin",
  }
}

const staffTypesEnumeration = () => {
  return {
    NHMStaff: 'NHM Staff',
    NHMIntern: 'NHM Intern',
    NHMResearchVisitor: 'NHM Research Visitor',
    NUSUndergraduateStudent: 'NUS Undergraduate Student',
    NUSGraduateStudent: 'NUS Graduate Student',
    NonNUSStudent: 'Non-NUS Student',
    Other: 'Other'
  }
}

const emailRegex = /[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
const catalogIDRegex = /^zrc(bdp|ent|mis|mol|hym|ara|bdo)\d{7}$/
const clusterIDRegex = /^[\d][A-Z]o{7}\d{7}$/
const resolutionRegex = /^\d{1,5}x\d{1,5}|\d{1,5}X\d{1,5}$/
const passwordRegex = /^(?=.*[a-z])(?=.*[0-9])\S{7,}$/

function checkIfParamIsPositiveInteger(req: Request, res:Response, next:NextFunction) {
  const key = Object.keys(req.params)[0]
  if (!parseInt(req.params[key]))
    return res.status(400).json({error:key+' is not an integer'})
  if (parseInt(req.params[key]) < 1)
    return res.status(400).json({error:key+' is not a positive integer'})
  next()
}

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
  passwordRegex,
  checkIfParamIsPositiveInteger

}
