
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

module.exports = { formatDate, formatDisplayDate, requestStatusTuple };