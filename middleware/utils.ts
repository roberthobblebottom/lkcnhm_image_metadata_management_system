const { Passport } = require("passport");

// Date formatting helper function (place this BEFORE your route handler)
const formatDate = (dateString:string) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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

const imagingPlatformEnumeration = () => {
    return {
        LeicaL5: 'Leica(L5)',
        MistutoyoL5: 'Mitutoyo(L5)',
        OlympusL4Prep: 'Olympus(L4Prep)',
        OlympusL5: 'Olympus(L5)',
        PassportL5: 'Passport(L5)',
        VDL4Prep: 'VD(L4Prep)',
        Other: 'Other'
    };
}

const userTypesEnumeration = () => {
    return {
        photographerOnly: 'photographerOnly',
        projectOwner: 'projectOwner',
        admin: 'admin'
    }
}

export {
    formatDate, formatDisplayDate, requestStatusEnumeration, projectStatusEnumeration, projectTypeEnumeration,
    mediaFileFormatEnumeration, imagingPlatformEnumeration, userTypesEnumeration
};