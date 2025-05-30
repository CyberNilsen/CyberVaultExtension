let passwordsCache = {
    data: null,
    timestamp: 0,
    expiryTime: 5 * 60 * 1000
};

let isValidating = false;
let validationInterval;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const VALIDATION_INTERVAL = 10000;
const TOKEN_EXPIRY_TIME = 24 * 60 * 60 * 1000;

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

function getTokenTimestamp() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['tokenSavedTimestamp'], (result) => {
            resolve(result.tokenSavedTimestamp || 0);
        });
    });
}

async function isTokenExpired() {
    const timestamp = await getTokenTimestamp();
    if (!timestamp) return true;
    
    const now = Date.now();
    return (now - timestamp) > TOKEN_EXPIRY_TIME;
}

async function validateToken(token) {
    if (isValidating) {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!isValidating) {
                    clearInterval(checkInterval);
                    validateTokenInternal(token).then(resolve);
                }
            }, 100);
        });
    }
    
    return validateTokenInternal(token);
}

async function validateTokenInternal(token) {
    if (!token) return false;
    
    if (await isTokenExpired()) {
        console.log('Token expired by time, clearing storage');
        await clearStoredToken();
        return false;
    }
    
    isValidating = true;
    try {
        let response;
        try {
            response = await fetch('http://localhost:8765/validate', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                signal: AbortSignal.timeout(3000)
            });
        } catch (error) {
            response = await fetch('http://localhost:8766/validate', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                signal: AbortSignal.timeout(3000)
            });
        }
        
        const isValid = response.ok;
        
        if (isValid) {
            consecutiveFailures = 0;
        } else {
            consecutiveFailures++;
            console.log(`Token validation failed. Consecutive failures: ${consecutiveFailures}`);
            
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                console.log('Max consecutive failures reached, clearing storage');
                await clearStoredToken();
                clearPasswordsCache();
                consecutiveFailures = 0;
            }
        }
        
        return isValid;
    } catch (error) {
        consecutiveFailures++;
        console.log(`Token validation error: ${error.message}. Consecutive failures: ${consecutiveFailures}`);
        
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.log('Max consecutive failures reached due to errors, clearing storage');
            await clearStoredToken();
            clearPasswordsCache();
            consecutiveFailures = 0;
        }
        
        return false;
    } finally {
        isValidating = false;
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
            clearPasswordsCache();
            throw new Error('Invalid access token');
        }
        
        let response;
        let controller = new AbortController();
        let timeoutId = setTimeout(() => controller.abort(), 8000);
        
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
            timeoutId = setTimeout(() => controller.abort(), 8000);
            
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

            consecutiveFailures++;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                await clearStoredToken();
                clearPasswordsCache();
                consecutiveFailures = 0;
            }
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const passwords = await response.json();
        
        passwordsCache.data = passwords;
        passwordsCache.timestamp = now;
        consecutiveFailures = 0;
        
        return passwords;
    } catch (error) {
        clearPasswordsCache();
        throw error;
    }
}

function clearPasswordsCache() {
    passwordsCache.data = null;
    passwordsCache.timestamp = 0;
}

function clearStoredToken() {
    return new Promise((resolve) => {
        chrome.storage.sync.remove(['cybervaultAccessToken', 'tokenSavedTimestamp'], () => {
            console.log('Cleared stored token and timestamp');
            resolve();
        });
    });
}

async function checkTokenValidity() {
    try {
        const token = await getAccessToken();
        const isValid = await validateToken(token);
        
        if (!isValid) {
            await clearStoredToken();
            clearPasswordsCache();

            chrome.runtime.sendMessage({
                type: 'TOKEN_INVALIDATED'
            }).catch(() => {}); 
        }
    } catch (error) {

    }
}

async function checkApplicationStatus() {
    try {

        const controller = new AbortController();
        setTimeout(() => controller.abort(), 1000);
        
        try {
            await fetch('http://localhost:8765/validate', {
                method: 'HEAD',
                signal: controller.signal
            });
            return true;
        } catch {
            try {
                await fetch('http://localhost:8766/validate', {
                    method: 'HEAD',
                    signal: controller.signal
                });
                return true;
            } catch {
                return false;
            }
        }
    } catch {
        return false;
    }
}

async function enhancedTokenCheck() {
    try {
        const token = await getAccessToken();
        if (!token) return;
        
        const appRunning = await checkApplicationStatus();
        if (!appRunning) {
            consecutiveFailures++;
            console.log(`CyberVault app not running. Consecutive failures: ${consecutiveFailures}`);
            
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                console.log('CyberVault app not running for too long, clearing storage');
                await clearStoredToken();
                clearPasswordsCache();
                consecutiveFailures = 0;
                chrome.runtime.sendMessage({
                    type: 'TOKEN_INVALIDATED'
                }).catch(() => {});
            }
            return;
        }
        
        const isValid = await validateToken(token);
        if (!isValid) {
            await clearStoredToken();
            clearPasswordsCache();
            chrome.runtime.sendMessage({
                type: 'TOKEN_INVALIDATED'
            }).catch(() => {});
        }
    } catch (error) {
        console.error('Enhanced token check error:', error);
    }
}

function startValidationInterval() {
    if (validationInterval) {
        clearInterval(validationInterval);
    }
    validationInterval = setInterval(enhancedTokenCheck, VALIDATION_INTERVAL);
}

function stopValidationInterval() {
    if (validationInterval) {
        clearInterval(validationInterval);
        validationInterval = null;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_SAVED_PASSWORDS') {
        fetchPasswords(request.forceRefresh)
            .then(passwords => {
                if (request.url) {
                    try {
                        const currentUrl = new URL(request.url);
                        const currentDomain = currentUrl.hostname.toLowerCase();
                        
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
                        sendResponse({ success: false, error: 'Invalid URL' });
                    }
                } else {
                    sendResponse({ success: true, passwords: passwords });
                }
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        
        return true;
    }
    
    if (request.type === 'CLEAR_CACHE') {
        clearPasswordsCache();
        sendResponse({ success: true });
        return false;
    }
    
    if (request.type === 'VALIDATE_TOKEN') {
        getAccessToken()
            .then(token => validateToken(token))
            .then(isValid => {
                if (!isValid) {
                    clearStoredToken();
                    clearPasswordsCache();
                }
                sendResponse({ success: true, valid: isValid });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    if (request.type === 'NEW_TOKEN_SAVED') {
        clearPasswordsCache();
        consecutiveFailures = 0;
        stopValidationInterval();
        startValidationInterval();
        sendResponse({ success: true });
        return false;
    }
    
    if (request.type === 'CLEAR_STORAGE') {
        clearStoredToken().then(() => {
            clearPasswordsCache();
            consecutiveFailures = 0;
            sendResponse({ success: true });
        });
        return true;
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.cybervaultAccessToken) {
        clearPasswordsCache();
        isValidating = false;
        consecutiveFailures = 0;
        
        if (changes.cybervaultAccessToken.newValue) {
            stopValidationInterval();
            startValidationInterval();
        } else {
            stopValidationInterval();
        }
    }
});

chrome.runtime.onStartup.addListener(() => {
    enhancedTokenCheck();
    startValidationInterval();
});

chrome.runtime.onInstalled.addListener(() => {
    startValidationInterval();
});

chrome.runtime.onSuspend.addListener(() => {
    console.log('Extension suspending, performing cleanup');
    stopValidationInterval();
});