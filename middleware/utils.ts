const { Passport } = require("passport");

// Date formatting helper function (place this BEFORE your route handler)
const formatDate = (dateString:string) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
   
    });
};
const formatDisplayDate = (date:Date) => {
    const d = date ? new Date(date).toISOString().split('T')[0] : null;
    return d
}

const requestStatusEnumeration = () => {
    return { approved: 'approved', rejected: 'rejected', pending: 'pending' }
};
const projectStatusEnumeration = () => {
    return {
        in_progress: 'started',
        on_hiatus: 'on hiatus',
        completed: 'completed'
    }
};
const projectTypeEnumeration = () => {
    return {
        BDP: 'BDP', GalleryBDP: 'GalleryBDP', InternalResearch: 'InternalResearch',
        StudentProject: 'StudentProject', Visitor: 'Visitor'
    }
};
const mediaFileFormatEnumeration = () => {
    return {
        jpg: ".jpg", jpeg: ".jpeg", png: ".png",
        tiff: ".tiff",tif: ".tif", svg: ".svg", raw: ".raw"
    };
}



const userTypesEnumeration = () => {
    return {
        photographerOnly: 'photographerOnly',
        projectOwner: 'projectOwner',
        admin: 'admin'
    }
}
const emailRegex  = /^[a-zA-Z0-9](\.?[a-zA-Z0-9_-])*[a-zA-Z0-9]@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/
export {
    formatDate, formatDisplayDate, requestStatusEnumeration, projectStatusEnumeration, projectTypeEnumeration,
    mediaFileFormatEnumeration,  userTypesEnumeration,emailRegex
};