function getAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['cybervaultAccessToken'], (result) => {
            resolve(result.cybervaultAccessToken);
        });
    });
}

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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_SAVED_PASSWORDS') {
        fetchPasswords().then(passwords => {
            const currentDomain = new URL(request.url).hostname;
            const matchedPasswords = passwords.filter(password => 
                password.Website && password.Website.includes(currentDomain)
            );

            sendResponse({ passwords: matchedPasswords });
        });

        return true;
    }
});