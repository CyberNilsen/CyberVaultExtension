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

async function validateToken(token) {
    try {

        let response;
        try {
            response = await fetch('http://localhost:8765/validate', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                signal: AbortSignal.timeout(2000)
            });
        } catch (error) {
            
            response = await fetch('http://localhost:8766/validate', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                signal: AbortSignal.timeout(2000)
            });
        }
        
        return response.ok;
    } catch (error) {
        console.error("Token validation error:", error);
        return false;
    }
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
        
        const isTokenValid = await validateToken(token);
        if (!isTokenValid) {

            await clearStoredToken();
            passwordsCache.data = null;
            passwordsCache.timestamp = 0;
            throw new Error('Invalid access token');
        }
        
        let response;
        let controller = new AbortController();
        let timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
            response = await fetch('http://localhost:8765/passwords', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                signal: controller.signal
            });
        } catch (error) {

            controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 5000);
            
            response = await fetch('http://localhost:8766/passwords', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                signal: controller.signal
            });
        }
        
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

function clearStoredToken() {
    return new Promise((resolve) => {
        chrome.storage.sync.remove(['cybervaultAccessToken', 'tokenSavedTimestamp'], () => {
            resolve();
        });
    });
}

async function checkTokenValidity() {
    try {
        const token = await getAccessToken();
        const isValid = await validateToken(token);
        
        if (!isValid) {
            console.log('Token is no longer valid, clearing cache and stored token');
            await clearStoredToken();
            passwordsCache.data = null;
            passwordsCache.timestamp = 0;
        }
    } catch (error) {
        console.log('No token stored or error checking validity');
    }
}

setInterval(checkTokenValidity, 3000);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_SAVED_PASSWORDS') {
        fetchPasswords(request.forceRefresh)
            .then(passwords => {
                if (request.url) {
                    try {
                        const currentUrl = new URL(request.url);
                        const currentDomain = currentUrl.hostname.toLowerCase();
                        const currentPath = currentUrl.pathname.toLowerCase();
                        
                        const matchedPasswords = passwords.filter(password => {
                            if (!password.Website) return false;
                            
                            let passwordUrl = password.Website;
                            if (!passwordUrl.startsWith('http') && !passwordUrl.includes('://')) {
                                passwordUrl = 'https://' + passwordUrl;
                            }
                            
                            try {
                                const passwordUrlObj = new URL(passwordUrl);
                                const passwordDomain = passwordUrlObj.hostname.toLowerCase();
                                
                                const domainMatch = 
                                    passwordDomain === currentDomain || 
                                    currentDomain.endsWith('.' + passwordDomain) ||
                                    passwordDomain.endsWith('.' + currentDomain);
                                
                                return domainMatch;
                            } catch {

                                return currentDomain.includes(password.Website.toLowerCase()) || 
                                       password.Website.toLowerCase().includes(currentDomain);
                            }
                        });
                        
                        sendResponse({ success: true, passwords: matchedPasswords });
                    } catch (error) {
                        console.error('Error parsing URL:', error);
                        sendResponse({ success: false, error: 'Invalid URL' });
                    }
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
    
    if (request.type === 'VALIDATE_TOKEN') {
        getAccessToken()
            .then(token => validateToken(token))
            .then(isValid => {
                if (!isValid) {
                    clearStoredToken();
                }
                sendResponse({ success: true, valid: isValid });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
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
    checkTokenValidity();
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('CyberVault extension installed');
});