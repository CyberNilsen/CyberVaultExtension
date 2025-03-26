document.addEventListener('DOMContentLoaded', () => {

//Kjører bare dokumentet etter at hele html siden har lastet inn.

    const accessKeyInput = document.getElementById('accessKeyInput');
    const connectBtn = document.getElementById('connectBtn');
    const errorMessage = document.getElementById('errorMessage');
    const passwordList = document.getElementById('passwordList');

    // tar knappene og alt ovenfor/velger knappene og feltene

    function saveAccessToken(token) {
        chrome.storage.sync.set({ 
            'cybervaultAccessToken': token,
            'tokenSavedTimestamp': Date.now()
        }, () => {
            // ovenfor så lagres det token og datoen
            fetchPasswords(token);

            //Deretter så laster den inn passordene

        });
    }

    // Tar å laster inn passordene med token.
    async function fetchPasswords(token) {
        try {
        
            errorMessage.textContent = '';
            passwordList.innerHTML = '';

            //Sletter/rensker errorene og passord lista før den prøver 

        
            const response = await fetch('http://localhost:8765/passwords', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            //Deretter så prøver den å gå på lokal nettsiden med get request og passordet er token

            if (!response.ok) {
                throw new Error('Invalid key or CyberVault app not running');
            }

            // Hvis du får en error så kommer dette opp

            const passwords = await response.json();
            
            if (passwords.length === 0) {
                errorMessage.textContent = 'No passwords found';
                return;
            }

            //gjør om fa api til json slik at javascript kan bruke innholdet og hvis det ikke finnes 

            passwords.forEach(password => {
                const passwordItem = document.createElement('div');
                passwordItem.classList.add('password-item');

                // Lager div og passord der den viser det. Gjør dette for alle passordene.
                const displayName = 
                    password.Name || 
                    password.Website || 
                    password.Username || 
                    password.Email || 
                    'Unnamed Entry';
                
                const displayWebsite = password.Website || 'No Website';
                const displayUsername = password.Username || 'No Username';

                //Her setter den navnet til passordet/nettsiden og hvis det er tomt så står det no website/no username/unnamed entry

                
                const title = document.createElement('h3');
                title.textContent = displayName;

                //Her er tittel for passordet som er lagret

                const websitePara = document.createElement('p');
                const websiteStrong = document.createElement('strong');
                websiteStrong.textContent = 'Website: ';
                const websiteSpan = document.createElement('span');
                websiteSpan.textContent = displayWebsite;
                websitePara.appendChild(websiteStrong);
                websitePara.appendChild(websiteSpan);

                //her gjør den om website til paragraf størrelse og gjør den bold og viser website navnet.

                const usernamePara = document.createElement('p');
                const usernameStrong = document.createElement('strong');
                usernameStrong.textContent = 'Username: ';
                const usernameSpan = document.createElement('span');
                usernameSpan.textContent = displayUsername;
                usernamePara.appendChild(usernameStrong);
                usernamePara.appendChild(usernameSpan);

                //her gjør den om website til paragraf størrelse og gjør den bold og viser username.

                const copyUsernameBtn = document.createElement('button');
                copyUsernameBtn.classList.add('copy-btn', 'copy-username');
                copyUsernameBtn.textContent = 'Copy Username';
                copyUsernameBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(password.Username || '')
                        .then(() => alert('Username copied!'))
                        .catch(err => console.error('Failed to copy username', err));
                });

                //Her kan du kopiere username og hvis du kopierer så kommer det opp en alert som sier kopiert! 
                // og hvis du får error melding så får du det i console

                const copyPasswordBtn = document.createElement('button');
                copyPasswordBtn.classList.add('copy-btn', 'copy-password');
                copyPasswordBtn.textContent = 'Copy Password';
                copyPasswordBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(password.Password || '')
                        .then(() => alert('Password copied!'))
                        .catch(err => console.error('Failed to copy password', err));
                });

                //Her kan du kopiere password og hvis du kopierer så kommer det opp en alert som sier kopiert! 
                // og hvis du får error melding så får du det i console

                passwordItem.appendChild(title);
                passwordItem.appendChild(websitePara);
                passwordItem.appendChild(usernamePara);
                passwordItem.appendChild(copyUsernameBtn);
                passwordItem.appendChild(copyPasswordBtn);

                // Legger til alle elementene til passord entry div

                passwordList.appendChild(passwordItem);

                //Så legger den alt til hovedsiden

            });
        } catch (error) {
            console.error('Fetch passwords error or CyberVault app not running:', error);
            errorMessage.textContent = error.message;
        }

        //Hvis feil så får du feilmelding så popper det opp 
    }

   
    chrome.storage.sync.get(['cybervaultAccessToken', 'tokenSavedTimestamp'], (result) => {
        if (result.cybervaultAccessToken) {
            accessKeyInput.value = result.cybervaultAccessToken;
            fetchPasswords(result.cybervaultAccessToken);
        }
    });

     // Hvis du har skrevet inn token før så lagres den og lar det stå i input.

    connectBtn.addEventListener('click', () => {
        const accessToken = accessKeyInput.value.trim();
        
        if (!accessToken) {
            errorMessage.textContent = 'Please enter the Web Extension Key';
            return;
        }

        // Tar token og hvis det ikke er en token skrevet så står det en error melding.

        saveAccessToken(accessToken);

        //Så lagres token 
    });
});
