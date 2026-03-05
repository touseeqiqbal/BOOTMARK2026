/**
 * Universal Export Service
 * Handles transformation of data arrays into downloadable CSV files
 */

export const exportToCSV = (data, filename, headers = null) => {
    if (!data || data.length === 0) return;

    // 1. Determine headers if not provided
    const csvHeaders = headers || Object.keys(data[0]);

    // 2. Escape CSV values
    const escapeCsvValue = (value) => {
        const primitive = value === undefined || value === null ? '' : String(value);
        const needsQuotes = /[",\n]/.test(primitive);
        const safeValue = primitive.replace(/"/g, '""');
        return needsQuotes ? `"${safeValue}"` : safeValue;
    };

    // 3. Build CSV string
    const headerRow = csvHeaders.map(escapeCsvValue).join(',');
    const dataRows = data.map(item => {
        return csvHeaders.map(header => {
            // Handle nested properties or fallback to empty string
            const value = item[header] !== undefined ? item[header] : '';
            return escapeCsvValue(value);
        }).join(',');
    });

    const csvContent = [headerRow, ...dataRows].join('\n');

    // 4. Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
