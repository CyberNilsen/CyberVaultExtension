let passwordsCache = {
    data: null,
    timestamp: 0,
    expiryTime: 5 * 60 * 1000
};

function getAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['cybervaultAccessToken'], (result) => {
            if (result.cybervaultAccessToken) {
                resolve(result.cybervaultAccessToken);
            } else {
                reject(new Error('No access token found'));
            }
        });
    });
}

async function fetchPasswords(forceRefresh = false) {
    try {

        const now = Date.now();
        if (!forceRefresh && 
            passwordsCache.data && 
            (now - passwordsCache.timestamp) < passwordsCache.expiryTime) {
            return passwordsCache.data;
        }

        const token = await getAccessToken();
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('http://localhost:8765/passwords', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const passwords = await response.json();
        
        passwordsCache.data = passwords;
        passwordsCache.timestamp = now;
        
        return passwords;
    } catch (error) {
        console.error('Error fetching passwords:', error);
        
        passwordsCache.data = null;
        passwordsCache.timestamp = 0;
        
        throw error;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_SAVED_PASSWORDS') {
        fetchPasswords(request.forceRefresh)
            .then(passwords => {
                if (request.url) {

                    try {
                        const currentDomain = new URL(request.url).hostname;
                        const matchedPasswords = passwords.filter(password => 
                            password.Website && 
                            (password.Website.includes(currentDomain) || 
                             currentDomain.includes(password.Website))
                        );
                        sendResponse({ success: true, passwords: matchedPasswords });
                    } catch (error) {
                        console.error('Error parsing URL:', error);
                        sendResponse({ success: false, error: 'Invalid URL' });
                    }
                } else {

                    sendResponse({ success: true, passwords });
                }
            })
            .catch(error => {
                console.error('Error in GET_SAVED_PASSWORDS handler:', error);
                sendResponse({ success: false, error: error.message });
            });
        
        return true;
    }
    
    if (request.type === 'CLEAR_CACHE') {
        passwordsCache.data = null;
        passwordsCache.timestamp = 0;
        sendResponse({ success: true });
        return false;
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.cybervaultAccessToken) {
        passwordsCache.data = null;
        passwordsCache.timestamp = 0;
    }
});

chrome.runtime.onStartup.addListener(() => {
    console.log('CyberVault extension started');
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('CyberVault extension installed');
});

