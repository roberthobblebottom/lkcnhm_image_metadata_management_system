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
// const catalogIDRegex = /^zrc(bdp|ent|mis|mol|hym|ara|bdo)\d{7}$/
// const catalogIDRegex = /^zrc(bdp|ent)\d{7}$/

//What I created https://regex101.com/?regex=%5E%28ZR%5B%5EC%5D%7C%28ZC%5B%5Cw%5Cs%5Cd%5D%29%7C%28RZ%5B%5Cw%5Cs%5Cd%5D%29%7C%28RC%5B%5Cw%5Cs%5Cd%5D%29%7C%28CZ%5B%5Cw%5Cs%5Cd%5D%29%7C%28CR%5B%5Cw%5Cs%5Cd%5D%29%29%7C%28%5EZRC%28BD%5B%5EP%5D%7CBP%5B%5Cw%5Cs%5Cd%5D%7CDB%5B%5Cw%5Cs%5Cd%5D%7CDP%5B%5Cw%5Cs%5Cd%5D%7CPB%5B%5Cw%5Cs%5Cd%5D%7CPD%5B%5Cw%5Cs%5Cd%5D%7CEN%5B%5ET%5D%7CET%5B%5Cw%5Cs%5Cd%5D%7CNE%5B%5Cw%5Cs%5Cd%5D%7CNT%5B%5Cw%5Cs%5Cd%5D%7CTE%5B%5Cw%5Cs%5Cd%5D%7CTN%5B%5Cw%5Cs%5Cd%5D%29%29%7C%28%28%5Cd%7B8%2C%7D%29%7C%28%5B%5E0%5Cd%5D%5Cd%7B%2C6%7D%29%24%29&testString=ZRCBDP0123456+%2F%2Fcorrect%0AZRCENT0123456+%2F%2Fcorrect%0AZRCENT0183456+%2F%2Fcorrect%0AZRLBDP0123456%0AZRBDP0123456%0AZcRENT0123456%0ARZAENT0123456%0ARCAENT0123456%0ACZABDP0123456%0ACREABDP0123456%0AZRCBDO0123456%0AZRCBDD0123456%0AZRCBD+0123456%0AZRCBDB0123456%0AZRCETN0123456%0AZRCNET0123456%0AZRCBPD0123456%0AZRCDBP0123456%0AZRCDPB0123456%0AZRCPDB0123456%0AZRCEN0123456%0AZRCENA0123456%0AZRCETN0123456%0AZRCETT0123456%0AZRCETA0123456%0AZRCETE0123456%0AZRCNET0123456%0AZRCNEE0123456%0AZRCNEN0123456%0AZRCNTE0123456%0AZRCNTN0123456%0AZRCNTT0123456%0AZRCTEN0123456%0AZRCTNE0123456%0AZRCBDP0123456789%0AZRCBDP0123456789i%0AZRCENT012345%0AZRCENT01234%0AZRCBDP012%0AZRCBDP01%0AZRCBDP0%0AZRCBDP%0AZRCENT01234567%0AZRCENT0123456u&flags=mgi&flavor=pcre2&delimiter=%2F
// REGEX for common mistakes of ZRCENT ZRCBDP prefixed catalog id 
const catalogIDRegex = /^(ZR[^C]|(ZC[\w\s\d])|(RZ[\w\s\d])|(RC[\w\s\d])|(CZ[\w\s\d])|(CR[\w\s\d]))|(^ZRC(BD[^P]|BP[\w\s\d]|DB[\w\s\d]|DP[\w\s\d]|PB[\w\s\d]|PD[\w\s\d]|EN[^T]|ET[\w\s\d]|NE[\w\s\d]|NT[\w\s\d]|TE[\w\s\d]|TN[\w\s\d]))|((\d{8,})|([^0\d]\d{,6}})|\D$)/
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
