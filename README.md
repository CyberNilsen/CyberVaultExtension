# CyberVault Extension

A secure browser extension that integrates with the CyberVault password manager to provide seamless password management directly in your browser.

## Features

- **Token-based Authentication** - Securely connects to your CyberVault application using authentication tokens
- **Password Autofill** - Automatically fill login credentials on websites
- **Secure Password Retrieval** - Access your stored passwords without leaving your browser
- **Cross-Platform Compatibility** - Works with the main CyberVault desktop application
- **Lightweight & Fast** - Minimal resource usage with quick response times

## Prerequisites

- [CyberVault](https://github.com/CyberNilsen/CyberVault) desktop application must be installed and configured
- Valid authentication token from your CyberVault application

## Installation

### From Chrome Web Store
*Coming soon - Extension is currently under review*

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The CyberVault Extension should now appear in your extensions

## Setup

1. **Generate Token in CyberVault**
   - Open your CyberVault desktop application
   - Navigate to CyberVault Dashboard *(main page)* -> Copy extension key/token 

2. **Configure Extension**
   - Click the CyberVault Extension icon in your browser toolbar
   - Enter your authentication token in the setup screen
   - Verify connection to your CyberVault application

## Usage

1. **Automatic Detection**
   - Navigate to any login page
   - The extension will automatically detect login forms

2. **Fill Credentials**
   - Click the CyberVault icon when on a login page
   - Select the appropriate account from your vault
   - Credentials will be automatically filled

3. **Manual Access**
   - Click the extension icon at any time
   - Browse and copy passwords as needed
   - Search through your stored credentials

## Security

- All communication between the extension and CyberVault application is encrypted
- Tokens are stored securely using browser's secure storage APIs
- No passwords are stored locally in the browser
- All data remains in your CyberVault application

## Supported Browsers

- Google Chrome (Manifest V3)
- Microsoft Edge
- Other Chromium-based browsers

## Development

### Project Structure
```
CyberVaultExtension/
├── manifest.json          # Extension configuration
├── background.js          # Background service worker
├── content.js            # Content script for web pages
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
└── images/               # Extension icons and assets
```

### Building from Source
1. Clone the repository
2. Make your modifications
3. Test in developer mode
4. Package for distribution

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Related Projects

- [**CyberVault**](https://github.com/CyberNilsen/CyberVault) - Main password manager application
- [**CyberVault Website**](https://github.com/CyberNilsen/CyberVault-website) - Official project website

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please:
1. Check the [Issues](https://github.com/CyberNilsen/CyberVaultExtension/issues) page
2. Create a new issue if your problem isn't already reported
3. Contact the development team

---

**Note:** This extension requires the CyberVault desktop application to function. Make sure you have it installed and configured before using this extension.
