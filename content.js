class CyberVaultAutofill {
    constructor() {
        this.createStyles();
        this.createPopup();
        this.attachEventListeners();
        this.passwordFields = new Set();
        this.formObservers = new Map();
        this.lastFormScanned = null;
    }

    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #cybervault-autofill-popup {
                position: absolute;
                background: white;
                border: 1px solid #403E43;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                width: 280px;
                max-height: 300px;
                overflow-y: auto;
                display: none;
                font-family: Arial, sans-serif;
                animation: cybervault-fade-in 0.2s ease;
            }
            
            @keyframes cybervault-fade-in {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .cybervault-popup-item {
                padding: 12px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                display: flex;
                align-items: center;
                transition: background-color 0.15s ease;
            }
            
            .cybervault-popup-item:last-child {
                border-bottom: none;
            }
            
            .cybervault-popup-item:hover {
                background-color: #f5f5f5;
            }
            
            .cybervault-popup-item-icon {
                width: 24px;
                height: 24px;
                margin-right: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #403E43;
                color: white;
                border-radius: 4px;
                font-weight: bold;
                font-size: 10px;
            }
            
            .cybervault-popup-item-details {
                flex-grow: 1;
            }
            
            .cybervault-popup-item-details strong {
                color: #403E43;
                display: block;
                font-size: 14px;
                margin-bottom: 2px;
            }
            
            .cybervault-popup-item-details small {
                color: #666;
                font-size: 12px;
            }
            
            .cybervault-autofill-success {
                background-color: rgba(76, 175, 80, 0.1);
                transition: background-color 0.5s ease;
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
            if (this.isInputField(e.target)) {
                this.currentField = e.target;
                const form = this.findParentForm(e.target);
                if (form) {
                    this.scanFormFields(form);
                }
                this.showAutofillOptions(e.target);
            }
        }, true);

        document.addEventListener('click', (e) => {
            const popup = document.getElementById('cybervault-autofill-popup');
            if (popup && !popup.contains(e.target) && 
                !this.isInputField(e.target)) {
                popup.style.display = 'none';
            }
        });

        this.observeDynamicFields();
        
    }
    
    observeDynamicFields() {

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {

                            const forms = node.tagName === 'FORM' ? [node] : Array.from(node.querySelectorAll('form'));
                            forms.forEach(form => {
                                this.setupFormObserver(form);
                                this.scanFormFields(form);
                            });
                            
                            const inputs = node.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]');
                            if (inputs.length) {
                                inputs.forEach(input => {
                                    if (this.isLoginField(input)) {
                                        const form = this.findParentForm(input);
                                        if (form) {
                                            this.setupFormObserver(form);
                                            this.scanFormFields(form);
                                        }
                                    }
                                });
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    setupFormObserver(form) {

        if (this.formObservers.has(form)) return;
        
        const observer = new MutationObserver(() => {
            this.scanFormFields(form);
        });
        
        observer.observe(form, {
            childList: true,
            attributes: true,
            subtree: true,
            attributeFilter: ['type', 'name', 'id', 'class', 'placeholder']
        });
        
        this.formObservers.set(form, observer);
    }

    scanFormFields(form) {

        if (this.lastFormScanned === form && Date.now() - this.lastFormScanTime < 500) {
            return;
        }
        
        this.lastFormScanned = form;
        this.lastFormScanTime = Date.now();
        
        this.passwordFields.clear();
        
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
            if (input.type === 'password') {
                this.passwordFields.add(input);
            }
        });
    }

    isInputField(element) {
        return element && element.tagName === 'INPUT' && element.type !== 'hidden' && element.type !== 'submit' && element.type !== 'button';
    }

    isLoginField(element) {
        if (!this.isInputField(element)) return false;
        
        const type = element.type.toLowerCase();
        const name = (element.name || '').toLowerCase();
        const id = (element.id || '').toLowerCase();
        const placeholder = (element.placeholder || '').toLowerCase();
        const classes = (element.className || '').toLowerCase();
        
        const searchTerms = ['search', 'query', 'find', 'filter', 'keyword'];
        
        for (const term of searchTerms) {
            if (name.includes(term) || id.includes(term) || placeholder.includes(term) || 
                classes.includes(term)) {
                return false;
            }
        }
        
        if (type === 'email' || type === 'password') return true;
        
        const loginTerms = ['user', 'email', 'login', 'name', 'account', 'id', 'username', 'signin', 'sign-in'];
        
        const form = this.findParentForm(element);
        if (form) {
            const formId = (form.id || '').toLowerCase();
            const formClasses = (form.className || '').toLowerCase();
            
            for (const term of loginTerms) {
                if (formId.includes(term) || formClasses.includes(term)) {
                    return true;
                }
            }
            
            const inputs = Array.from(form.querySelectorAll('input'));
            const index = inputs.indexOf(element);
            if (index !== -1) {
                const nextField = inputs[index + 1];
                if (nextField && nextField.type === 'password') {
                    return true;
                }
            }
        }
        
        for (const term of loginTerms) {
            if (name.includes(term) || id.includes(term) || placeholder.includes(term) || classes.includes(term)) {
                return true;
            }
        }
        
        return false;
    }

    showAutofillOptions(field) {
        chrome.runtime.sendMessage(
            { type: 'GET_SAVED_PASSWORDS', url: window.location.href }, 
            (response) => {
                if (response && response.passwords && response.passwords.length) {
                    this.renderPopup(response.passwords, field);
                } else {

                    const currentUrl = window.location.href;
                    const normalizedCurrentUrl = this.normalizeUrl(currentUrl);
                    
                    chrome.runtime.sendMessage(
                        { type: 'GET_SAVED_PASSWORDS' }, 
                        (fullResponse) => {
                            if (fullResponse && fullResponse.passwords) {

                                const matches = fullResponse.passwords.filter(password => {
                                    if (!password.Website) return false;
                                    
                                    const normalizedSavedUrl = this.normalizeUrl(password.Website);
                                    const currentDomain = new URL(currentUrl).hostname;
                                    const savedDomain = this.extractDomainFromUrl(password.Website);
                                    
                                    return currentDomain.includes(savedDomain) || 
                                           savedDomain.includes(currentDomain) ||
                                           normalizedCurrentUrl.includes(normalizedSavedUrl) ||
                                           normalizedSavedUrl.includes(normalizedCurrentUrl);
                                });
                                
                                if (matches.length) {
                                    this.renderPopup(matches, field);
                                } else {
                                    console.log('No saved passwords found for this site');
                                }
                            }
                        }
                    );
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

        if (passwords.length > 1) {
            const header = document.createElement('div');
            header.style.padding = '10px';
            header.style.borderBottom = '1px solid #eee';
            header.style.fontSize = '12px';
            header.style.color = '#666';
            header.textContent = 'Select credentials to autofill';
            popup.appendChild(header);
        }

        passwords.forEach(password => {
            const item = document.createElement('div');
            item.className = 'cybervault-popup-item';
            
            const siteName = password.Name || this.extractDomainFromUrl(password.Website) || 'Unnamed';
            const firstLetter = siteName.charAt(0).toUpperCase();
            
            item.innerHTML = `
                <div class="cybervault-popup-item-icon">${firstLetter}</div>
                <div class="cybervault-popup-item-details">
                    <strong>${siteName}</strong>
                    <small>${password.Username}</small>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.autofill(password);
            });

            popup.appendChild(item);
        });

        popup.style.display = 'block';
        
        this.adjustPopupPosition(popup);
    }
    
    adjustPopupPosition(popup) {
        const rect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (rect.right > viewportWidth) {
            popup.style.left = `${viewportWidth - rect.width - 10}px`;
        }
        
        if (rect.bottom > viewportHeight) {
            const currentField = this.currentField;
            const fieldRect = currentField.getBoundingClientRect();
            popup.style.top = `${fieldRect.top + window.scrollY - rect.height - 5}px`;
        }
    }
    
    extractDomainFromUrl(url) {
        try {
            if (!url) return '';

            if (!url.startsWith('http') && !url.includes('://')) {
                url = 'https://' + url;
            }
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            const parts = hostname.split('.');

            if (parts.length > 2) {

                const commonTLDs = ['co.uk', 'com.au', 'co.jp', 'org.uk', 'net.au'];

                const lastTwoParts = parts.slice(-2).join('.');
                if (commonTLDs.includes(lastTwoParts)) {
                    return `${parts[parts.length-3]}.${lastTwoParts}`;
                }

                return parts.slice(-2).join('.');
            }
            return hostname;
        } catch (e) {
            return url.toLowerCase();
        }
    }

    autofill(credentials) {
        const form = this.findParentForm(this.currentField);
        let success = false;
        
        if (form) {

            success = this.intelligentAutofill(form, credentials);
            
            if (!success) {
                success = this.basicAutofill(form, credentials);
            }
        } else {

            success = this.noFormAutofill(credentials);
        }
        
        if (success) {
            this.showAutofillSuccess();
        } else {

            if (this.currentField) {
                if (this.currentField.type === 'password') {

                    this.currentField.value = credentials.Password;
                    this.triggerInputEvents(this.currentField);
                    
                    const possibleContainer = this.currentField.closest('div, form, section');
                    if (possibleContainer) {
                        const inputs = Array.from(possibleContainer.querySelectorAll('input'));
                        const currentIndex = inputs.indexOf(this.currentField);
                        
                        if (currentIndex > 0) {
                            for (let i = 0; i < currentIndex; i++) {
                                if (this.isLikelyUsernameField(inputs[i])) {
                                    inputs[i].value = credentials.Username;
                                    this.triggerInputEvents(inputs[i]);
                                    success = true;
                                    break;
                                }
                            }
                        }
                    }
                } else {

                    this.currentField.value = credentials.Username;
                    this.triggerInputEvents(this.currentField);
                    
                    const possibleContainer = this.currentField.closest('div, form, section');
                    if (possibleContainer) {
                        const passwordFields = Array.from(possibleContainer.querySelectorAll('input[type="password"]'));
                        if (passwordFields.length > 0) {
                            passwordFields[0].value = credentials.Password;
                            this.triggerInputEvents(passwordFields[0]);
                            success = true;
                        }
                    }
                }
                
                this.showAutofillSuccess();
            }
        }
        
        document.getElementById('cybervault-autofill-popup').style.display = 'none';
    }
    
    intelligentAutofill(form, credentials) {

        const usernameFields = this.findAllUsernameFields(form);
        const passwordFields = Array.from(this.passwordFields);
        
        if (!usernameFields.length || !passwordFields.length) {
            return false;
        }
        
        let bestUsernameField = this.findBestUsernameField(usernameFields, credentials.Username);
        
        if (bestUsernameField) {
            bestUsernameField.value = credentials.Username;
            this.triggerInputEvents(bestUsernameField);
        }
        
        if (passwordFields.length === 1) {

            passwordFields[0].value = credentials.Password;
            this.triggerInputEvents(passwordFields[0]);
            return true;
        } else if (passwordFields.length >= 2) {

            passwordFields.forEach(field => {
                field.value = credentials.Password;
                this.triggerInputEvents(field);
            });
            return true;
        }
        
        return bestUsernameField != null;
    }
    
    basicAutofill(form, credentials) {

        const usernameField = this.findUsernameField(form);
        const passwordField = this.findPasswordField(form);
        
        let success = false;
        
        if (usernameField) {
            usernameField.value = credentials.Username;
            this.triggerInputEvents(usernameField);
            success = true;
        }
        
        if (passwordField) {
            passwordField.value = credentials.Password;
            this.triggerInputEvents(passwordField);
            success = true;
        }
        
        return success;
    }
    
    noFormAutofill(credentials) {

        const currentField = this.currentField;
        if (!currentField) return false;
        
        const container = currentField.closest('div, section, main, article');
        if (!container) return false;
        
        const inputs = Array.from(container.querySelectorAll('input'));
        const currentIndex = inputs.indexOf(currentField);
        
        if (currentIndex === -1) return false;
        
        let usernameField = null;
        let passwordField = null;
        
        if (currentField.type === 'password') {
            passwordField = currentField;

            for (let i = currentIndex - 1; i >= 0; i--) {
                if (this.isLikelyUsernameField(inputs[i])) {
                    usernameField = inputs[i];
                    break;
                }
            }
        } else {
            usernameField = currentField;

            for (let i = currentIndex + 1; i < inputs.length; i++) {
                if (inputs[i].type === 'password') {
                    passwordField = inputs[i];
                    break;
                }
            }
        }
        
        let success = false;
        
        if (usernameField) {
            usernameField.value = credentials.Username;
            this.triggerInputEvents(usernameField);
            success = true;
        }
        
        if (passwordField) {
            passwordField.value = credentials.Password;
            this.triggerInputEvents(passwordField);
            success = true;
        }
        
        return success;
    }
    
    showAutofillSuccess() {

      
    }

    findParentForm(field) {
        if (!field) return null;
        
        const form = field.closest('form');
        if (form) return form;
        
        try {
            const xpathResult = document.evaluate(
                'ancestor::form', 
                field, 
                null, 
                XPathResult.FIRST_ORDERED_NODE_TYPE, 
                null
            );
            if (xpathResult && xpathResult.singleNodeValue) {
                return xpathResult.singleNodeValue;
            }
        } catch (e) {
            console.log('XPath evaluation failed:', e);
        }
        
        const formLikeSelectors = [
            '.login-form', '.signin-form', '.form', '[role="form"]',
            '.login', '.signin', '.signup', '.sign-up', '.authentication',
            '.auth-form', '.account-form', '[data-form]', '[data-login]',
            '.login-container', '.auth-container', '.login-box', '.auth-box',
            '.input-container', '.credential-form', '.credentials'
        ];
        
        for (const selector of formLikeSelectors) {
            const formLike = field.closest(selector);
            if (formLike) return formLike;
        }
        
        const containers = [
            field.closest('div'), 
            field.closest('section'), 
            field.closest('main'), 
            field.closest('article'),
            field.closest('[class*="login"]'),
            field.closest('[class*="auth"]'),
            field.closest('[class*="account"]')
        ].filter(Boolean);
        
        for (const container of containers) {
            if (!container) continue;
            
            const hasUsernameField = !!container.querySelector('input[type="email"], input[type="text"]');
            const hasPasswordField = !!container.querySelector('input[type="password"]');
            
            if (hasUsernameField && hasPasswordField) {
                return container;
            }
        }
        
        return null;
    }

    normalizeUrl(url) {
        try {
            if (!url) return '';
            
            if (!url.startsWith('http') && !url.includes('://')) {
                url = 'https://' + url;
            }
            
            const urlObj = new URL(url);
            
            let domain = urlObj.hostname.toLowerCase();
            
            let path = urlObj.pathname.toLowerCase();
            if (path === '/') path = '';
            
            if (path.endsWith('/')) {
                path = path.slice(0, -1);
            }
            
            return domain + path;
        } catch (e) {
            return url.toLowerCase();
        }
    }

    findAllUsernameFields(form) {
        const potentialUsernameFields = [];
        
        const usernameSelectors = [
            'input[type="email"]',
            'input[type="text"][name*="user"]',
            'input[type="text"][name*="email"]',
            'input[type="text"][id*="user"]',
            'input[type="text"][id*="email"]',
            'input[type="text"][name*="login"]',
            'input[type="text"][id*="login"]',
            'input[type="text"][placeholder*="user"]',
            'input[type="text"][placeholder*="email"]',
            'input[name*="username"]',
            'input[id*="username"]',
            'input[placeholder*="username"]',
            'input[name*="userid"]',
            'input[id*="userid"]',
            'input[type="text"]'
        ];
        
        for (const selector of usernameSelectors) {
            const fields = form.querySelectorAll(selector);
            fields.forEach(field => {
                if (!field.type.toLowerCase().includes('password') && 
                    !field.type.toLowerCase().includes('hidden') &&
                    !field.type.toLowerCase().includes('submit')) {
                    potentialUsernameFields.push(field);
                }
            });
        }
        
        return [...new Set(potentialUsernameFields)];
    }
    
    findBestUsernameField(usernameFields, username) {
        if (!usernameFields.length) return null;
        if (usernameFields.length === 1) return usernameFields[0];
        
        const scoredFields = usernameFields.map(field => {
            let score = 0;
            const name = (field.name || '').toLowerCase();
            const id = (field.id || '').toLowerCase();
            const placeholder = (field.placeholder || '').toLowerCase();
            const type = field.type.toLowerCase();
            const value = (field.value || '').toLowerCase();
            
            if (type === 'email' && username.includes('@')) score += 10;
            
            if (name === 'username' || name === 'email' || name === 'user') score += 8;
            if (id === 'username' || id === 'email' || id === 'user') score += 8;
            
            if (name.includes('user')) score += 5;
            if (name.includes('email')) score += 5;
            if (id.includes('user')) score += 5;
            if (id.includes('email')) score += 5;
            
            if (placeholder.includes('user')) score += 3;
            if (placeholder.includes('email')) score += 3;
            if (placeholder.includes('login')) score += 3;
            
            if (value === username.toLowerCase()) score += 15;
            
            if (this.isVisibleElement(field)) score += 4;
            
            return { field, score };
        });
        
        scoredFields.sort((a, b) => b.score - a.score);
        return scoredFields[0].field;
    }
    
    isLikelyUsernameField(field) {
        if (!field || !this.isInputField(field) || field.type === 'password') return false;
        
        const name = (field.name || '').toLowerCase();
        const id = (field.id || '').toLowerCase();
        const placeholder = (field.placeholder || '').toLowerCase();
        const type = field.type.toLowerCase();
        const className = (field.className || '').toLowerCase();
        const ariaLabel = (field.getAttribute('aria-label') || '').toLowerCase();
        
        const usernameTerms = ['user', 'username', 'email', 'login', 'account', 'id', 'identifier', 'name', 'userid'];
        
        if (type === 'email') return true;
        
        for (const term of usernameTerms) {
            if (name.includes(term) || id.includes(term) || placeholder.includes(term) || 
                className.includes(term) || ariaLabel.includes(term)) {
                return true;
            }
        }
        
        return false;
    }

    findUsernameField(form) {
        const selectors = [
            'input[type="email"]',
            'input[type="text"][name*="user"]',
            'input[type="text"][name*="email"]',
            'input[type="text"][id*="user"]',
            'input[type="text"][id*="email"]',
            'input[type="text"][name*="login"]',
            'input[type="text"][id*="login"]',
            'input[name*="username"]',
            'input[id*="username"]',
            'input[placeholder*="username"]',
            'input[placeholder*="email"]',
            'input[placeholder*="user"]',
            'input[name*="userid"]',
            'input[id*="userid"]',
            'input[type="text"]'
        ];

        for (let selector of selectors) {
            const fields = Array.from(form.querySelectorAll(selector))
                .filter(field => this.isVisibleElement(field));
                
            if (fields.length > 0) return fields[0];
        }
        return null;
    }

    findPasswordField(form) {
        const visiblePasswordFields = Array.from(form.querySelectorAll('input[type="password"]'))
            .filter(field => this.isVisibleElement(field));
            
        if (visiblePasswordFields.length > 0) {
            return visiblePasswordFields[0];
        }
        return null;
    }
    
    isVisibleElement(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               element.offsetParent !== null;
    }

    triggerInputEvents(element) {
        if (!element) return;
        
        element.value = element.value;
        
        const events = [
            new Event('focus', { bubbles: true }),
            new Event('input', { bubbles: true }),
            new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
            new KeyboardEvent('keypress', { key: 'a', bubbles: true }),
            new KeyboardEvent('keyup', { key: 'a', bubbles: true }),
            new Event('change', { bubbles: true })
        ];
        
        events.forEach(event => {
            setTimeout(() => {
                element.dispatchEvent(event);
            }, 10);
        });
        
        try {
            
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            ).set;
            
            nativeInputValueSetter.call(element, element.value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e) {
            console.log('Failed to trigger native setter:', e);
        }
    }
    
    triggerFrameworkUpdates(element) {
        try {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            ).set;
            
            nativeInputValueSetter.call(element, element.value);
        } catch (e) {
            console.log('Failed to trigger native setter:', e);
        }
        
        if (typeof angular !== 'undefined') {
            try {
                angular.element(element).triggerHandler('input');
            } catch (e) {
                console.log('Failed to trigger Angular update:', e);
            }
        }
    }
}

new CyberVaultAutofill();