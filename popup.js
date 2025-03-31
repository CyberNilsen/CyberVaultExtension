document.addEventListener('DOMContentLoaded', () => {
    const loginContainer = document.querySelector('.login-container');
    const passwordsContainer = document.querySelector('.passwords-container');
    const accessKeyInput = document.getElementById('accessKeyInput');
    const connectBtn = document.getElementById('connectBtn');
    const searchInput = document.getElementById('searchInput');
    const passwordList = document.getElementById('passwordList');
    const errorMessage = document.getElementById('errorMessage');
    const copiedPopup = document.getElementById('copiedPopup');

    let allPasswords = [];

    chrome.storage.sync.get(['cybervaultAccessToken'], (result) => {
        if (result.cybervaultAccessToken) {
            showPasswordsContainer();
            fetchPasswords(result.cybervaultAccessToken);
        } else {
            showLoginContainer();
        }
    });

    function showLoginContainer() {
        loginContainer.style.display = 'block';
        passwordsContainer.style.display = 'none';
    }

    function showPasswordsContainer() {
        loginContainer.style.display = 'none';
        passwordsContainer.style.display = 'block';
    }

    function showCopiedPopup() {
        copiedPopup.style.display = 'block';
        setTimeout(() => {
            copiedPopup.style.display = 'none';
        }, 1500);
    }

    function renderPasswords(passwords) {
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
                navigator.clipboard.writeText(password.Username);
                showCopiedPopup();
            });

            const copyPasswordBtn = document.createElement('button');
            copyPasswordBtn.classList.add('copy-btn');  
            copyPasswordBtn.textContent = 'Copy Password';
            copyPasswordBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(password.Password);
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
        chrome.storage.sync.set({ 
            'cybervaultAccessToken': token,
            'tokenSavedTimestamp': Date.now()
        }, () => {
            showPasswordsContainer();
            fetchPasswords(token);
        });
    }

    function fetchPasswords(token) {
        errorMessage.textContent = '';

        fetch('http://localhost:8765/passwords', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch passwords');
            }
            return response.json();
        })
        .then(passwords => {
            allPasswords = passwords;
            renderPasswords(allPasswords);
        })
        .catch(error => {
            errorMessage.textContent = error.message;
            showLoginContainer();
        });
    }

    connectBtn.addEventListener('click', () => {
        const accessToken = accessKeyInput.value.trim();
        
        if (!accessToken) {
            errorMessage.textContent = 'Please enter the Web Extension Key';
            return;
        }

        saveAccessToken(accessToken);
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredPasswords = allPasswords.filter(password => 
            password.Name?.toLowerCase().includes(searchTerm) ||
            password.Website?.toLowerCase().includes(searchTerm) ||
            password.Username?.toLowerCase().includes(searchTerm)
        );
        renderPasswords(filteredPasswords);
    });
});