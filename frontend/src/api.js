// API configuration
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const fetchData = async () => {
    const response = await fetch(`${apiUrl}/data`);
    return response.json();
};

export const postData = async (data) => {
    const response = await fetch(`${apiUrl}/data`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return response.json();
};
