// Retrieve access token
function getAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['cybervaultAccessToken'], (result) => {
            resolve(result.cybervaultAccessToken);
        });
    });
}

// Fetch passwords from the server
async function fetchPasswords() {
    try {
        const token = await getAccessToken();
        const response = await fetch('http://localhost:8765/passwords', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching passwords:', error);
        return [];
    }
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_SAVED_PASSWORDS') {
        // Fetch and filter passwords
        fetchPasswords().then(passwords => {
            // Filter passwords by current domain
            const currentDomain = new URL(request.url).hostname;
            const matchedPasswords = passwords.filter(password => 
                password.Website && password.Website.includes(currentDomain)
            );

            // Send response
            sendResponse({ passwords: matchedPasswords });
        });

        // Return true to indicate async response
        return true;
    }
});