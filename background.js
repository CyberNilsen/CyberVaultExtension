// Cache mechanism to improve performance
let passwordsCache = {
    data: null,
    timestamp: 0,
    expiryTime: 5 * 60 * 1000 // 5 minutes in milliseconds
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
        // Check if we have a valid cache
        const now = Date.now();
        if (!forceRefresh && 
            passwordsCache.data && 
            (now - passwordsCache.timestamp) < passwordsCache.expiryTime) {
            return passwordsCache.data;
        }

        const token = await getAccessToken();
        
        // Add timeout to prevent hanging
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
        
        // Update cache
        passwordsCache.data = passwords;
        passwordsCache.timestamp = now;
        
        return passwords;
    } catch (error) {
        console.error('Error fetching passwords:', error);
        
        // Clear cache on error
        passwordsCache.data = null;
        passwordsCache.timestamp = 0;
        
        // Re-throw the error for handling elsewhere
        throw error;
    }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_SAVED_PASSWORDS') {
        fetchPasswords(request.forceRefresh)
            .then(passwords => {
                if (request.url) {
                    // Filter passwords for the current domain
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
                    // Return all passwords
                    sendResponse({ success: true, passwords });
                }
            })
            .catch(error => {
                console.error('Error in GET_SAVED_PASSWORDS handler:', error);
                sendResponse({ success: false, error: error.message });
            });
        
        return true; // Keep the message channel open for the async response
    }
    
    if (request.type === 'CLEAR_CACHE') {
        passwordsCache.data = null;
        passwordsCache.timestamp = 0;
        sendResponse({ success: true });
        return false;
    }
});

// Clear cache when token is changed
chrome.storage.onChanged.addListener((changes) => {
    if (changes.cybervaultAccessToken) {
        passwordsCache.data = null;
        passwordsCache.timestamp = 0;
    }
});

// Keep the service worker alive for better performance
chrome.runtime.onStartup.addListener(() => {
    console.log('CyberVault extension started');
});

// Handle installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('CyberVault extension installed');
});

