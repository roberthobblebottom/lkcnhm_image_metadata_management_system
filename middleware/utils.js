
// Date formatting helper function (place this BEFORE your route handler)
const formatDate = (dateString) => {
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
const formatDisplayDate = (date) => {
    const d = date ? new Date(date).toISOString().split('T')[0] : null;
    return d
}

const requestStatusTuple = () => {
    return { approved: 'approved', rejected: 'rejected', pending: 'pending' }
};

const mediaFormats = () => {
    return {
        jpg: ".jpg", jpeg: ".jpeg", png: ".png", gif: ".gif",
        tiff: ".tiff", bmp: ".bmp", svg: ".svg", raw: ".raw"
    };
}

const cameraModels = () => {
    return {
        nikon: "nikon", sony: "sony", canon: "canon"
    };
}

const imageEditingTools = () => {
    return {
        photoshop: "photoshop"
    }
}

module.exports = { formatDate, formatDisplayDate, requestStatusTuple, mediaFormats };