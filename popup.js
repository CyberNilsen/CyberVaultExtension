document.addEventListener('DOMContentLoaded', () => {

    const loginContainer = document.querySelector('.login-container');
    const passwordsContainer = document.querySelector('.passwords-container');
    const accessKeyInput = document.getElementById('accessKeyInput');
    const connectBtn = document.getElementById('connectBtn');
    const searchInput = document.getElementById('searchInput');
    const passwordList = document.getElementById('passwordList');
    const errorMessageElements = document.querySelectorAll('#errorMessage');
    const copiedPopup = document.getElementById('copiedPopup');

    let allPasswords = [];
    let isLoading = false;

    init();

    async function init() {
        try {
            const token = await getAccessToken();
            if (token) {
                
                const isValid = await validateToken(token);
                if (isValid) {
                    showPasswordsContainer();
                    fetchPasswords(token);
                } else {

                    await clearAccessToken();
                    showLoginContainer();
                }
            } else {
                showLoginContainer();
            }
        } catch (error) {
            showLoginContainer();
            displayError('Failed to initialize extension');
        }
    }

    function getAccessToken() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['cybervaultAccessToken'], (result) => {
                resolve(result.cybervaultAccessToken || null);
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

    function showLoginContainer() {
        loginContainer.style.display = 'block';
        passwordsContainer.style.display = 'none';
    }

    function showPasswordsContainer() {
        loginContainer.style.display = 'none';
        passwordsContainer.style.display = 'block';
    }

    function showCopiedPopup() {
        copiedPopup.classList.add('show');
        setTimeout(() => {
            copiedPopup.classList.remove('show');
        }, 1500);
    }

    function displayError(message) {
        errorMessageElements.forEach(el => {
            el.textContent = message;
        });
    }

    function clearError() {
        errorMessageElements.forEach(el => {
            el.textContent = '';
        });
    }

    function showLoading() {
        isLoading = true;
        passwordList.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading passwords...</p>
            </div>
        `;
    }

    function renderPasswords(passwords) {
        isLoading = false;
        passwordList.innerHTML = '';

        if (passwords.length === 0) {
            const noPasswordsMsg = document.createElement('div');
            noPasswordsMsg.classList.add('no-passwords');
            noPasswordsMsg.textContent = 'No passwords found';
            passwordList.appendChild(noPasswordsMsg);
            return;
        }

        passwords.forEach(password => {
            const passwordItem = document.createElement('div');
            passwordItem.classList.add('password-item');

            const passwordDetails = document.createElement('div');
            passwordDetails.classList.add('password-item-details');

            const title = document.createElement('h3');
            title.textContent = password.Name || password.Website || 'Unnamed Entry';

            const websitePara = document.createElement('p');
            websitePara.innerHTML = `<strong>Website:</strong> ${password.Website || 'No Website'}`;

            const usernamePara = document.createElement('p');
            usernamePara.innerHTML = `<strong>Username:</strong> ${password.Username || 'No Username'}`;

            const actionButtons = document.createElement('div');
            actionButtons.classList.add('action-buttons');

            const copyUsernameBtn = document.createElement('button');
            copyUsernameBtn.classList.add('copy-btn');
            copyUsernameBtn.textContent = 'Copy Username';
            copyUsernameBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(password.Username || '');
                showCopiedPopup();
            });

            const copyPasswordBtn = document.createElement('button');
            copyPasswordBtn.classList.add('copy-btn');  
            copyPasswordBtn.textContent = 'Copy Password';
            copyPasswordBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(password.Password || '');
                showCopiedPopup();
            });

            passwordDetails.appendChild(title);
            passwordDetails.appendChild(websitePara);
            passwordDetails.appendChild(usernamePara);

            actionButtons.appendChild(copyUsernameBtn);
            actionButtons.appendChild(copyPasswordBtn);

            passwordItem.appendChild(passwordDetails);
            passwordItem.appendChild(actionButtons);

            passwordList.appendChild(passwordItem);
        });
    }

    function saveAccessToken(token) {
        return new Promise((resolve) => {
            chrome.storage.sync.set({ 
                'cybervaultAccessToken': token,
                'tokenSavedTimestamp': Date.now()
            }, () => {
                resolve();
            });
        });
    }

    async function fetchPasswords(token) {
        clearError();
        showLoading();

        try {

            let response;
            try {
                response = await fetch('http://localhost:8765/passwords', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    signal: AbortSignal.timeout(5000)
                });

            } catch (error) {
                response = await fetch('http://localhost:8766/passwords', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    signal: AbortSignal.timeout(5000)
                });
            }

            if (!response.ok) {
                throw new Error('Authentication failed');
            }

            const passwords = await response.json();
            allPasswords = passwords;
            renderPasswords(allPasswords);
        } catch (error) {
            if (error.name === 'AbortError') {
                displayError('Request timed out. Please try again.');
            } else if (error.message === 'Authentication failed') {
                displayError('Authentication failed. Please login again.');
                await clearAccessToken();
                showLoginContainer();
            } else {
                showLoginContainer();
                displayError('Failed to fetch passwords. Please try again.');
                console.error('Error fetching passwords:', error);
            }
            passwordList.innerHTML = '';
        }
    }

    

    function clearAccessToken() {
        return new Promise((resolve) => {
            chrome.storage.sync.remove(['cybervaultAccessToken', 'tokenSavedTimestamp'], () => {
                resolve();
            });
        });
    }

    connectBtn.addEventListener('click', async () => {
        const accessToken = accessKeyInput.value.trim();
        
        if (!accessToken) {
            displayError('Please enter the Web Extension Key');
            return;
        }

        clearError();
        connectBtn.textContent = 'Connecting...';
        connectBtn.disabled = true;

        try {

            const isValid = await validateToken(accessToken);
            if (!isValid) {
                throw new Error('Invalid access token');
            }
            
            await saveAccessToken(accessToken);
            showPasswordsContainer();
            await fetchPasswords(accessToken);
        } catch (error) {
            displayError('Failed to connect. Please make sure CyberVault is running and the key is correct.');
        } finally {
            connectBtn.textContent = 'Connect to CyberVault';
            connectBtn.disabled = false;
        }
    });

    accessKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            connectBtn.click();
        }
    });

    searchInput.addEventListener('input', debounce((e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredPasswords = allPasswords.filter(password => 
            (password.Name?.toLowerCase().includes(searchTerm)) ||
            (password.Website?.toLowerCase().includes(searchTerm)) ||
            (password.Username?.toLowerCase().includes(searchTerm))
        );
        renderPasswords(filteredPasswords);
    }, 300));


    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(this, args);
            }, wait);
        };
    }
});