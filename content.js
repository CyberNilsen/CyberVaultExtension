class CyberVaultAutofill {
    constructor() {
        this.createStyles();
        this.createPopup();
        this.attachEventListeners();
        this.passwordFields = new Set();
        this.formObservers = new Map();
        this.lastFormScanned = null;
        this.currentField = null;
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

    hidePopup() {
        if (this.popup) {
            this.popup.style.display = 'none';
        }
    }

    attachEventListeners() {

        document.addEventListener('focus', (e) => {
            const targetElement = e.target;
            if (this.isInputField(targetElement)) {
                this.currentField = targetElement;

                if (this.isLoginField(targetElement)) {
                    const form = this.findParentForm(targetElement);
                    if (form) {
                        this.setupFormObserver(form)
                        this.scanFormFields(form);
                    }
                    this.showAutofillOptions(targetElement);
                } else {

                    this.hidePopup();
                }
            } else {

                if (!this.popup || (this.popup && !this.popup.contains(targetElement))) {
                     this.hidePopup();
                }
            }
        }, true); 

        document.addEventListener('click', (e) => {
            if (this.popup && this.popup.style.display === 'block') {
               
                if (!this.popup.contains(e.target) && e.target !== this.currentField) {
                    this.hidePopup();
                }
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
            attributeFilter: ['type', 'name', 'id', 'class', 'placeholder', 'style', 'disabled', 'readonly']
        });
        
        this.formObservers.set(form, observer);
    }

    scanFormFields(form) {

        if (this.lastFormScanned === form && Date.now() - (this.lastFormScanTime || 0) < 500) {
            return;
        }
        
        this.lastFormScanned = form;
        this.lastFormScanTime = Date.now();
        
        
        this.passwordFields.clear(); 
        
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
            if (input.type === 'password' && this.isVisibleElement(input)) {
                this.passwordFields.add(input);
            }
        });
    }

    isInputField(element) {

        return element && typeof element.tagName === 'string' && element.tagName === 'INPUT' && 
               element.type !== 'hidden' && element.type !== 'submit' && 
               element.type !== 'button' && element.type !== 'reset' && 
               element.type !== 'file' && element.type !== 'image' &&
               !element.disabled && !element.readOnly;
    }

    isLoginField(element) {
        if (!this.isInputField(element)) return false;

        const elementType = element.type.toLowerCase();
        const elementRole = (element.getAttribute('role') || '').toLowerCase();

        if (elementType === 'search' || elementRole === 'search' || elementRole === 'searchbox') {
            return false;
        }
        const parentForm = element.form || this.findParentForm(element); 
        if (parentForm && parentForm.getAttribute && parentForm.getAttribute('role') === 'search') {
            return false;
        }

        const searchAncestor = element.closest('[role="search"], [role="searchbox"]');
        if (searchAncestor) {
         
            return false;
        }

        const name = (element.name || '').toLowerCase();
        const id = (element.id || '').toLowerCase();
        const placeholder = (element.placeholder || '').toLowerCase();
        const classes = (element.className && typeof element.className === 'string') ? element.className.toLowerCase() : '';
        const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
        
        const searchTerms = [
            'search', 'query', 'find', 'filter', 'keyword', 'keywords',
            'lookup', 'browse', 'seek', 'hunt', 'explore', 'look',
            'buscar', 'suche', 'chercher', 'cerca', 'zoek', 'søk',
            'поиск', '搜索', '検索', 'sök', 'haku', 'ricerca',
            'q', 'term', 'terms', 'words', 'key', 'sökfält', 'søkefelt'
        ];
        
        for (const term of searchTerms) {

            if (name === term || id === term) return false; 
            
            if (name.includes(term) || id.includes(term) || 
                placeholder.includes(term) || classes.includes(term) || 
                ariaLabel.includes(term)) {
                return false;
            }
        }
        
        const searchButtonIndicators = ['search', 'find', 'go', 'lookup', 'magnify', 'lens', 'søk', 'finn'];
        const nearbyElements = this.getNearbyElements(element, 3);
        
        for (const nearElement of nearbyElements) {
            if (nearElement.tagName === 'BUTTON' || 
                (nearElement.tagName === 'INPUT' && nearElement.type === 'submit') ||
                nearElement.tagName === 'A' ||
                (nearElement.getAttribute('role') || '').toLowerCase() === 'button') {
                
                const nearText = (nearElement.textContent || nearElement.innerText || '').toLowerCase();
                const nearValue = (nearElement.value || '').toLowerCase();
                const nearId = (nearElement.id || '').toLowerCase();
                const nearClass = (nearElement.className && typeof nearElement.className === 'string') ? nearElement.className.toLowerCase() : '';
                
                for (const term of searchButtonIndicators) {
                    if (nearText.includes(term) || nearValue.includes(term) || 
                        nearId.includes(term) || nearClass.includes(term)) {
                        return false;
                    }
                }
            }
            
            if ((nearElement.tagName === 'I' || nearElement.tagName === 'SPAN')) {
                const nearClass = (nearElement.className && typeof nearElement.className === 'string') ? nearElement.className.toLowerCase() : '';
                if (nearClass.includes('icon') || nearClass.includes('search') || 
                    nearClass.includes('fa-search') || nearClass.includes('magnifying-glass') ||
                    (nearElement.textContent || '').toLowerCase().trim() === 'search'
                   ) {
                    return false;
                }
            }
        }
        

        
        let parent = element.parentElement;
        for (let i = 0; i < 5 && parent; i++) {

            if (parent.tagName === 'BODY' || parent.tagName === 'HTML') break;

            const parentId = (parent.id || '').toLowerCase();
            const parentClass = (parent.className && typeof parent.className === 'string') ? parent.className.toLowerCase() : '';
            const parentAriaLabel = (parent.getAttribute('aria-label') || '').toLowerCase();
            const parentRole = (parent.getAttribute('role') || '').toLowerCase();

            if (parentRole === 'search' || parentRole === 'searchbox') return false;
            
            for (const term of searchTerms) {
                if (parentId.includes(term) || parentClass.includes(term) || 
                    parentAriaLabel.includes(term)) {
                    return false;
                }
            }
            
            const searchButtonsInParent = parent.querySelectorAll('button, input[type="submit"], [role="button"]');
            for (const btn of searchButtonsInParent) {
                const btnText = (btn.textContent || btn.innerText || '').toLowerCase();
                const btnValue = (btn.value || '').toLowerCase();
                
                for (const term of searchButtonIndicators) {
                    if (btnText.includes(term) || btnValue.includes(term)) {

                        if (parent.contains(element) && Math.abs(Array.from(parent.children).indexOf(element) - Array.from(parent.children).indexOf(btn)) < 3) {
                           return false;
                        }
                    }
                }
            }
            parent = parent.parentElement;
        }
        
        if (elementType === 'email' || elementType === 'password') return true;
        
        const loginTerms = ['user', 'email', 'login', 'name', 'account', 'id', 'username', 'signin', 'sign-in', 'credential', 'auth', 'bruker', 'passord', 'innlogging']; // Added Norwegian
        
        if (parentForm) {
            const formId = (parentForm.id || '').toLowerCase();
            const formClasses = (parentForm.className && typeof parentForm.className === 'string') ? parentForm.className.toLowerCase() : '';
            const formName = (parentForm.name || '').toLowerCase();
            
            for (const term of loginTerms) {
                if (formId.includes(term) || formClasses.includes(term) || formName.includes(term)) {

                    if (parentForm.querySelector('input[type="password"]')) {
                        return true;
                    }
                }
            }
            
            const inputsInForm = Array.from(parentForm.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'));
            const currentIndex = inputsInForm.indexOf(element);
            if (currentIndex !== -1) {
                const nextVisibleInput = inputsInForm.slice(currentIndex + 1).find(el => this.isVisibleElement(el));
                if (nextVisibleInput && nextVisibleInput.type === 'password') {
                    return true;
                }
            }
        }
        
        const specificLoginTerms = ['user', 'email', 'login', 'username', 'signin', 'credential', 'auth', 'bruker', 'passord'];
        for (const term of specificLoginTerms) {
            if (name.includes(term) || id.includes(term) || placeholder.includes(term) || classes.includes(term) || ariaLabel.includes(term)) {
                return true;
            }
        }
        if ( (name === 'id' || name === 'name' || name === 'identifier') && elementType === 'text' && (parentForm && parentForm.querySelector('input[type="password"]')) ) {
             return true;
        }


        return false; 
    }

    getNearbyElements(element, radius) {
        const results = [];
        if (!element) return results;

        let current = element;

        for (let i = 0; i < radius && current.previousElementSibling; i++) {
            current = current.previousElementSibling;
            results.push(current);
        }
        
        current = element;

        for (let i = 0; i < radius && current.nextElementSibling; i++) {
            current = current.nextElementSibling;
            results.push(current);
        }
        
        const parent = element.parentElement;
        if (parent) {
            results.push(parent);
            Array.from(parent.children).forEach(child => {
                if (child !== element && !results.includes(child)) {

                    results.push(child);
                }
            });
        }
        
        return results;
    }
    

    showAutofillOptions(field) {

        if (!field || !this.isVisibleElement(field)) {
            this.hidePopup();
            return;
        }

        chrome.runtime.sendMessage(
            { type: 'GET_SAVED_PASSWORDS', url: window.location.href }, 
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error("CyberVault Autofill (content script): Error getting passwords for current URL - ", chrome.runtime.lastError.message);
                    this.hidePopup();
                    
                    return;
                }

                if (response && response.passwords && response.passwords.length) {
                    this.renderPopup(response.passwords, field);
                } else {
                    const currentUrl = window.location.href;
                    const normalizedCurrentUrl = this.normalizeUrl(currentUrl);
                    const currentDomain = this.extractDomainFromUrl(currentUrl);

                    chrome.runtime.sendMessage(
                        { type: 'GET_SAVED_PASSWORDS' },
                        (fullResponse) => {
                            if (chrome.runtime.lastError) {
                                console.error("CyberVault Autofill (content script): Error getting all passwords - ", chrome.runtime.lastError.message);
                                this.hidePopup();
                                return;
                            }
                            if (fullResponse && fullResponse.passwords) {
                                const matches = fullResponse.passwords.filter(password => {
                                    if (!password.Website) return false;
                                    
                                    const savedDomain = this.extractDomainFromUrl(password.Website);
                                    const normalizedSavedUrl = this.normalizeUrl(password.Website);

                                    
                                    return (currentDomain && savedDomain && currentDomain.endsWith(savedDomain)) ||
                                           (currentDomain && savedDomain && savedDomain.endsWith(currentDomain)) ||
                                           normalizedCurrentUrl.includes(normalizedSavedUrl) ||
                                           normalizedSavedUrl.includes(normalizedCurrentUrl);
                                });
                                
                                if (matches.length) {
                                    this.renderPopup(matches, field);
                                } else {
                                    console.log('CyberVault: No saved passwords found for this site or related domains.');
                                    this.hidePopup(); 
                                }
                            } else {
                                this.hidePopup(); 
                            }
                        }
                    );
                }
            }
        );
    }

    renderPopup(passwords, field) {
        if (!this.popup) this.createPopup(); 

        this.popup.innerHTML = ''; 

        const rect = field.getBoundingClientRect();
        
        this.popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
        this.popup.style.left = `${rect.left + window.scrollX}px`;
        this.popup.style.minWidth = `${rect.width}px`;

        if (passwords.length > 1) {
            const header = document.createElement('div');
            header.style.padding = '10px';
            header.style.borderBottom = '1px solid #eee';
            header.style.fontSize = '12px';
            header.style.color = '#666';
            header.style.textAlign = 'center';
            header.textContent = 'Select credentials to autofill';
            this.popup.appendChild(header);
        }

        passwords.forEach(password => {
            const item = document.createElement('div');
            item.className = 'cybervault-popup-item';
            
            const siteName = password.Name || this.extractDomainFromUrl(password.Website) || 'Unnamed Entry';
            const firstLetter = siteName.charAt(0).toUpperCase();
            
            item.innerHTML = `
                <div class="cybervault-popup-item-icon">${firstLetter}</div>
                <div class="cybervault-popup-item-details">
                    <strong>${siteName}</strong>
                    <small>${password.Username || 'No username'}</small>
                </div>
            `;
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.autofill(password);
                this.hidePopup(); 
            });

            this.popup.appendChild(item);
        });

        this.popup.style.display = 'block';
        this.adjustPopupPosition(this.popup, field); 
    }
    
    adjustPopupPosition(popup, field) {
        if (!popup || !field) return;

        const popupRect = popup.getBoundingClientRect();
        const fieldRect = field.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let newLeft = fieldRect.left + window.scrollX;
        let newTop = fieldRect.bottom + window.scrollY + 5;

        if (newLeft + popupRect.width > viewportWidth - 10) {
            newLeft = viewportWidth - popupRect.width - 10;
        }
   
        if (newLeft < 10) {
            newLeft = 10;
        }
        
        if (newTop + popupRect.height > viewportHeight - 10) {

            newTop = fieldRect.top + window.scrollY - popupRect.height - 5;
        }

        if (newTop < 10) {
            newTop = 10;
        }

        popup.style.left = `${newLeft}px`;
        popup.style.top = `${newTop}px`;
    }
    
    extractDomainFromUrl(url) {
        try {
            if (!url) return '';

            let fullUrl = url;
            if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
                fullUrl = 'https://' + fullUrl;
            }
            const urlObj = new URL(fullUrl);
            let hostname = urlObj.hostname.toLowerCase();
            
            if (hostname.startsWith('www.')) {
                hostname = hostname.substring(4);
            }
            return hostname;
        } catch (e) {

            console.warn("CyberVault: Could not parse URL for domain extraction:", url, e);
            const parts = url.split('/');
            return (parts.length > 0 && parts[0].includes('.')) ? parts[0].toLowerCase() : url.toLowerCase();
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
            this.showAutofillSuccess(form || this.currentField.parentElement);
        } else {

            if (this.currentField) {
                let filledSomething = false;
                if (this.currentField.type === 'password') {
                    this.setValueAndTriggerEvents(this.currentField, credentials.Password);
                    filledSomething = true;

                    const usernameField = this.findPrecedingUsernameField(this.currentField, form);
                    if (usernameField) {
                         this.setValueAndTriggerEvents(usernameField, credentials.Username);
                    }
                } else if (this.isLikelyUsernameField(this.currentField)) {
                    this.setValueAndTriggerEvents(this.currentField, credentials.Username);
                    filledSomething = true;
                    
                    const passwordField = this.findSucceedingPasswordField(this.currentField, form);
                    if (passwordField) {
                        this.setValueAndTriggerEvents(passwordField, credentials.Password);
                    }
                }
                if (filledSomething) this.showAutofillSuccess(this.currentField.parentElement);
            }
        }
        
        this.hidePopup();
    }

    setValueAndTriggerEvents(field, value) {
        if (field && this.isVisibleElement(field)) {
            field.value = value;

            field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

            field.focus(); 
        }
    }
    
    intelligentAutofill(form, credentials) {
        const usernameFields = this.findAllUsernameFields(form).filter(f => this.isVisibleElement(f));
        const passwordFields = Array.from(form.querySelectorAll('input[type="password"]')).filter(f => this.isVisibleElement(f));
        
        if (!usernameFields.length || !passwordFields.length) {
            return false;
        }
        
        let bestUsernameField = this.findBestUsernameField(usernameFields, credentials.Username);
        
        if (bestUsernameField) {
            this.setValueAndTriggerEvents(bestUsernameField, credentials.Username);
        } else if (usernameFields.length === 1) {
            bestUsernameField = usernameFields[0];
            this.setValueAndTriggerEvents(bestUsernameField, credentials.Username);
        }
        
        if (passwordFields.length > 0) {

            let targetPasswordField = passwordFields[0];
            if (bestUsernameField && passwordFields.length > 1) {
                passwordFields.sort((a, b) => Math.abs(this.getFieldDistance(bestUsernameField, a)) - Math.abs(this.getFieldDistance(bestUsernameField, b)));
                targetPasswordField = passwordFields[0];
            }
            this.setValueAndTriggerEvents(targetPasswordField, credentials.Password);
            return true;
        }
        
        return !!bestUsernameField;
    }

    getFieldDistance(field1, field2) {
        const allInputs = Array.from( (field1.form || document).querySelectorAll('input, textarea, select') );
        const index1 = allInputs.indexOf(field1);
        const index2 = allInputs.indexOf(field2);
        if (index1 !== -1 && index2 !== -1) {
            return index2 - index1;
        }
        return Infinity; 
    }
    
    basicAutofill(form, credentials) {
        const usernameField = this.findUsernameField(form); 
        const passwordField = this.findPasswordField(form); 
        
        let success = false;
        
        if (usernameField) {
            this.setValueAndTriggerEvents(usernameField, credentials.Username);
            success = true;
        }
        
        if (passwordField) {
            this.setValueAndTriggerEvents(passwordField, credentials.Password);
            success = true;
        }
        
        return success;
    }
    
    noFormAutofill(credentials) {
        const currentField = this.currentField;
        if (!currentField) return false;
        
        const container = currentField.closest('div, section, main, article, fieldset') || currentField.parentElement;
        if (!container || container.tagName === 'BODY' || container.tagName === 'HTML') return false;
        
        const inputs = Array.from(container.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')).filter(f => this.isVisibleElement(f));
        if (inputs.length < 2 && !(this.isLikelyUsernameField(currentField) || currentField.type === 'password')) return false;

        let usernameField = null;
        let passwordField = null;
        
        if (currentField.type === 'password') {
            passwordField = currentField;

            const currentIndex = inputs.indexOf(currentField);
            for (let i = currentIndex - 1; i >= 0; i--) {
                if (this.isLikelyUsernameField(inputs[i])) {
                    usernameField = inputs[i];
                    break;
                }
            }
        } else if (this.isLikelyUsernameField(currentField)) {
            usernameField = currentField;

            const currentIndex = inputs.indexOf(currentField);
            for (let i = currentIndex + 1; i < inputs.length; i++) {
                if (inputs[i].type === 'password') {
                    passwordField = inputs[i];
                    break;
                }
            }
        } else {
             usernameField = inputs.find(f => this.isLikelyUsernameField(f));
             passwordField = inputs.find(f => f.type === 'password');
        }
        
        let success = false;
        if (usernameField && credentials.Username) {
            this.setValueAndTriggerEvents(usernameField, credentials.Username);
            success = true;
        }
        if (passwordField && credentials.Password) {
            this.setValueAndTriggerEvents(passwordField, credentials.Password);
            success = true;
        }
        return success;
    }
    
    showAutofillSuccess(containerElement) {
       
    }

    findParentForm(field) {
        if (!field) return null;
        
        if (field.form) return field.form;
        
        let current = field.parentElement;
        while (current) {
            if (current.tagName === 'FORM') return current;
            current = current.parentElement;
        }

        
        const formLikeSelectors = [
            '[role="form"]', '.login-form', '.signin-form', '.signup-form',
           
        ];
        for (const selector of formLikeSelectors) {
            const formLike = field.closest(selector);
            if (formLike) return formLike;
        }
        
        let ancestor = field.parentElement;
        for (let i=0; i < 5 && ancestor; i++) {
            if (ancestor.tagName === 'BODY') break;
            const hasUsername = !!ancestor.querySelector('input[type="email"], input[type="text"][name*="user"], input[type="text"][id*="user"]');
            const hasPassword = !!ancestor.querySelector('input[type="password"]');
            if (hasUsername && hasPassword) {

                if (ancestor.querySelector('input[type="submit"], button[type="submit"]')) {
                    return ancestor;
                }
            }
            ancestor = ancestor.parentElement;
        }
        return null;
    }

    normalizeUrl(url) {
        try {
            if (!url) return '';
            
            let fullUrl = url;
            if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
                fullUrl = 'https://' + fullUrl;
            }
            
            const urlObj = new URL(fullUrl);
            let domain = urlObj.hostname.toLowerCase();
            if (domain.startsWith('www.')) {
                domain = domain.substring(4);
            }
            
            let path = urlObj.pathname.toLowerCase();
            if (path === '/' || path === '') path = '';
            else if (path.endsWith('/')) {
                path = path.slice(0, -1);
            }
            
            return domain + path;
        } catch (e) {
            console.warn("CyberVault: Could not normalize URL:", url, e);
            return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('?')[0].split('#')[0].replace(/\/$/, '');
        }
    }

    findAllUsernameFields(form) {
        const potentialUsernameFields = [];
        if (!form) return potentialUsernameFields;
        
        const usernameSelectors = [
            'input[type="email"]',
            'input[autocomplete="username"]',
            'input[autocomplete="email"]',
            'input[name*="username" i]', 'input[id*="username" i]',
            'input[name*="email" i]', 'input[id*="email" i]',
            'input[name*="user_id" i]', 'input[id*="user_id" i]',
            'input[name*="login" i]', 'input[id*="login" i]',
            'input[name*="userid" i]', 'input[id*="userid" i]',
            'input[placeholder*="username" i]', 'input[placeholder*="email" i]',
            'input[placeholder*="user id" i]', 'input[placeholder*="login" i]',
            'input[type="text"]' 
        ];
        
        for (const selector of usernameSelectors) {
            try {
                const fields = form.querySelectorAll(selector);
                fields.forEach(field => {
                    if (this.isInputField(field) && 
                        field.type.toLowerCase() !== 'password' && 
                        this.isVisibleElement(field) && 
                        !potentialUsernameFields.includes(field)) {
                        potentialUsernameFields.push(field);
                    }
                });
            } catch (e) {  }
        }
        
        return [...new Set(potentialUsernameFields)];
    }
    
    findBestUsernameField(usernameFields, usernameValueHint = '') {
        if (!usernameFields || !usernameFields.length) return null;
        if (usernameFields.length === 1) return usernameFields[0];
        
        const scoredFields = usernameFields.map(field => {
            let score = 0;
            const name = (field.name || '').toLowerCase();
            const id = (field.id || '').toLowerCase();
            const placeholder = (field.placeholder || '').toLowerCase();
            const type = field.type.toLowerCase();
            const autocomplete = (field.getAttribute('autocomplete') || '').toLowerCase();
            const value = (field.value || '').toLowerCase();
            
            if (type === 'email') score += 10;
            if (autocomplete === 'username' || autocomplete === 'email') score += 15;

            if (name === 'username' || name === 'email' || name === 'user' || name === 'loginid') score += 8;
            if (id === 'username' || id === 'email' || id === 'user' || id === 'loginid') score += 8;
            
            if (name.includes('user')) score += 3;
            if (name.includes('email')) score += 3;
            if (id.includes('user')) score += 3;
            if (id.includes('email')) score += 3;
            
            if (placeholder.includes('user')) score += 2;
            if (placeholder.includes('email')) score += 2;
            
            if (usernameValueHint && value === usernameValueHint.toLowerCase()) score += 20; 
            if (this.isVisibleElement(field)) score += 5; else score -= 10; 

            if (name.includes('search') || id.includes('search') || placeholder.includes('search')) score -= 20;

            return { field, score };
        });
        
        scoredFields.sort((a, b) => b.score - a.score); 
        return scoredFields[0].score > 0 ? scoredFields[0].field : (usernameFields.find(f => this.isVisibleElement(f)) || usernameFields[0]); // Return best or first visible
    }
    
    isLikelyUsernameField(field) {
        if (!field || !this.isInputField(field) || field.type.toLowerCase() === 'password') return false;
        
        const name = (field.name || '').toLowerCase();
        const id = (field.id || '').toLowerCase();
        const placeholder = (field.placeholder || '').toLowerCase();
        const type = field.type.toLowerCase();
        const autocomplete = (field.getAttribute('autocomplete') || '').toLowerCase();
        const ariaLabel = (field.getAttribute('aria-label') || '').toLowerCase();
        
        if (type === 'email') return true;
        if (autocomplete === 'username' || autocomplete === 'email') return true;
        
        const usernameTerms = ['user', 'username', 'email', 'login', 'account', 'identifier', 'userid', 'e-mail', 'e_mail'];
        
        for (const term of usernameTerms) {
            if (name.includes(term) || id.includes(term) || placeholder.includes(term) || ariaLabel.includes(term)) {

                if (name.includes('password') || id.includes('password') || placeholder.includes('password')) continue;
                return true;
            }
        }
        return false;
    }

    findPrecedingUsernameField(passwordField, form) {
        const container = form || passwordField.closest('form, div, section') || document;
        const inputs = Array.from(container.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'))
                            .filter(f => this.isVisibleElement(f));
        const passwordIndex = inputs.indexOf(passwordField);
        if (passwordIndex > 0) {
            for (let i = passwordIndex - 1; i >= 0; i--) {
                if (this.isLikelyUsernameField(inputs[i])) return inputs[i];
            }
        }
        return null;
    }

    findSucceedingPasswordField(usernameField, form) {
        const container = form || usernameField.closest('form, div, section') || document;
        const inputs = Array.from(container.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'))
                            .filter(f => this.isVisibleElement(f));
        const usernameIndex = inputs.indexOf(usernameField);
        if (usernameIndex !== -1 && usernameIndex < inputs.length -1) {
            for (let i = usernameIndex + 1; i < inputs.length; i++) {
                if (inputs[i].type === 'password') return inputs[i];
            }
        }
        return null;
    }


    findUsernameField(form) {
        if (!form) return null;
        const usernameFields = this.findAllUsernameFields(form);
        if (usernameFields.length === 0) return null;

        return this.findBestUsernameField(usernameFields);
    }

    findPasswordField(form) {
        if (!form) return null;
        const visiblePasswordFields = Array.from(form.querySelectorAll('input[type="password"]'))
            .filter(field => this.isVisibleElement(field));
            
        return visiblePasswordFields.length > 0 ? visiblePasswordFields[0] : null;
    }
    
    isVisibleElement(element) {
        if (!element || typeof element.getBoundingClientRect !== 'function') return false;
        
        if (element.style.display === 'none' || element.style.visibility === 'hidden') return false;

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0 && style.overflow !== 'visible') {

             if (style.position === 'absolute' && (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth)) {
               
             } else {
                return false;
             }
        }
        

        let current = element;
        while (current && current !== document.body) {
            if (current.getAttribute('aria-hidden') === 'true' && window.getComputedStyle(current).display !== 'none') { 
                return false;
            }

            if (current.parentElement && window.getComputedStyle(current.parentElement).display === 'none') {
              
            }
            current = current.parentElement;
        }
        
        return true;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new CyberVaultAutofill());
} else {
    new CyberVaultAutofill();
}

