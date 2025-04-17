class CyberVaultAutofill {
    constructor() {
        this.createStyles();
        this.createPopup();
        this.attachEventListeners();
    }

    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #cybervault-autofill-popup {
                position: absolute;
                background: white;
                border: 1px solid #403E43;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                width: 250px;
                max-height: 300px;
                overflow-y: auto;
                display: none;
                font-family: Arial, sans-serif;
            }
            .cybervault-popup-item {
                padding: 10px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                display: flex;
                align-items: center;
            }
            .cybervault-popup-item:hover {
                background-color: #f0f0f0;
            }
            .cybervault-popup-item-details {
                flex-grow: 1;
            }
            .cybervault-popup-item-details strong {
                color: #403E43;
                display: block;
            }
            .cybervault-popup-item-details small {
                color: #666;
            }
        `;
        document.head.appendChild(style);
    }

    createPopup() {
        this.popup = document.createElement('div');
        this.popup.id = 'cybervault-autofill-popup';
        document.body.appendChild(this.popup);
    }

    attachEventListeners() {
        document.addEventListener('focus', (e) => {
            if (this.isLoginField(e.target)) {
                this.currentField = e.target;
                this.showAutofillOptions(e.target);
            }
        }, true);

        document.addEventListener('click', (e) => {
            const popup = document.getElementById('cybervault-autofill-popup');
            if (popup && !popup.contains(e.target) && 
                !e.target.matches('input[type="text"], input[type="email"], input[type="password"]')) {
                popup.style.display = 'none';
            }
        });
    }

    isLoginField(element) {
        return element && (
            element.matches('input[type="text"]') || 
            element.matches('input[type="email"]') || 
            element.matches('input[type="password"]')
        );
    }

    showAutofillOptions(field) {
        chrome.runtime.sendMessage(
            { type: 'GET_SAVED_PASSWORDS', url: window.location.href }, 
            (response) => {
                if (response && response.passwords && response.passwords.length) {
                    this.renderPopup(response.passwords, field);
                }
            }
        );
    }

    renderPopup(passwords, field) {
        const popup = document.getElementById('cybervault-autofill-popup');
        popup.innerHTML = ''; 

        const rect = field.getBoundingClientRect();
        popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
        popup.style.left = `${rect.left + window.scrollX}px`;

        passwords.forEach(password => {
            const item = document.createElement('div');
            item.className = 'cybervault-popup-item';
            item.innerHTML = `
                <div class="cybervault-popup-item-details">
                    <strong>${password.Name || password.Website || 'Unnamed'}</strong>
                    <small>${password.Username}</small>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.autofill(password);
            });

            popup.appendChild(item);
        });

        popup.style.display = 'block';
    }

    autofill(credentials) {
        const form = this.findParentForm(this.currentField);
        
        if (form) {
            const usernameField = this.findUsernameField(form);
            const passwordField = this.findPasswordField(form);

            if (usernameField) {
                usernameField.value = credentials.Username;
                this.triggerInputEvents(usernameField);
            }

            if (passwordField) {
                passwordField.value = credentials.Password;
                this.triggerInputEvents(passwordField);
            }
        }

        document.getElementById('cybervault-autofill-popup').style.display = 'none';
    }

    findParentForm(field) {
        return field.closest('form') || 
               field.evaluate('ancestor::form', field, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }

    findUsernameField(form) {
        const selectors = [
            'input[type="email"]',
            'input[type="text"][name*="user"]',
            'input[name*="username"]',
            'input[id*="username"]',
            'input[placeholder*="username"]'
        ];

        for (let selector of selectors) {
            const field = form.querySelector(selector);
            if (field) return field;
        }
        return null;
    }

    findPasswordField(form) {
        return form.querySelector('input[type="password"]');
    }

    triggerInputEvents(element) {
        const events = ['input', 'change', 'keydown', 'keyup', 'blur'];
        events.forEach(eventName => {
            element.dispatchEvent(new Event(eventName, { bubbles: true }));
        });
    }
}

new CyberVaultAutofill();