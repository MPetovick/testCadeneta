// Compatible configuration
const CONFIG = {
    PBKDF2_ITERATIONS: 310000,
    SALT_LENGTH: 32,
    IV_LENGTH: 16,
    AES_KEY_LENGTH: 256,
    HMAC_KEY_LENGTH: 256,
    HMAC_LENGTH: 32,
    QR_SIZE: 220,
    MIN_PASSPHRASE_LENGTH: 12,
    QR_ERROR_CORRECTION: 'H'
};

// DOM references
const dom = {
    startBtn: document.getElementById('start-btn'),
    seedModal: document.getElementById('seed-modal'),
    closeModal: document.querySelector('.close-modal'),
    cancelBtn: document.getElementById('cancel-btn'),
    seedPhrase: document.getElementById('seed-phrase'),
    wordCounter: document.getElementById('word-counter'),
    toggleVisibility: document.getElementById('toggle-visibility'),
    encryptBtn: document.getElementById('encrypt-btn'),
    password: document.getElementById('password'),
    passwordToggle: document.getElementById('password-toggle'),
    passwordStrengthBar: document.getElementById('password-strength-bar'),
    passwordStrengthText: document.getElementById('password-strength-text'),
    generatePassword: document.getElementById('generate-password'),
    qrContainer: document.getElementById('qr-container'),
    qrCanvas: document.getElementById('qr-canvas'),
    pdfBtn: document.getElementById('pdf-btn'),
    shareBtn: document.getElementById('share-btn'),
    downloadBtn: document.getElementById('download-btn'),
    toastContainer: document.getElementById('toast-container'),
    suggestionsContainer: document.getElementById('bip39-suggestions'),
    dropArea: document.getElementById('drop-area'),
    qrFile: document.getElementById('qr-file'),
    decryptBtn: document.getElementById('decrypt-btn'),
    decryptedModal: document.getElementById('decrypted-modal'),
    decryptedSeed: document.getElementById('decrypted-seed'),
    seedWordsContainer: document.getElementById('seed-words-container'),
    copySeed: document.getElementById('copy-seed'),
    closeDecrypted: document.getElementById('close-decrypted'),
    closeDecryptedBtn: document.getElementById('close-decrypted-btn'),
    wordCount: document.getElementById('word-count'),
    welcomeModal: document.getElementById('welcome-modal'),
    closeWelcome: document.getElementById('close-welcome'),
    acceptWelcome: document.getElementById('accept-welcome'),
    spinnerOverlay: document.getElementById('spinner-overlay'),
    passwordModal: document.getElementById('password-modal'),
    decryptPassword: document.getElementById('decrypt-password'),
    decryptPasswordToggle: document.getElementById('decrypt-password-toggle'),
    decryptSeedBtn: document.getElementById('decrypt-seed-btn'),
    cancelDecryptBtn: document.getElementById('cancel-decrypt-btn'),
    closePasswordModal: document.getElementById('close-password-modal'),
    qrModal: document.getElementById('qr-modal'),
    closeQRModal: document.getElementById('close-qr-modal')
};

// App state
const appState = {
    wordsVisible: false,
    passwordVisible: false,
    seedPhrase: '',
    password: '',
    encryptedData: '',
    qrImageData: null,
    bip39Wordlist: null,
    currentWordIndex: -1,
    currentWordPartial: ''
};

// Check if running in Telegram
function isTelegram() {
    return window.Telegram && Telegram.WebApp && Telegram.WebApp.initData;
}

// Event Listeners
function initEventListeners() {
    dom.startBtn.addEventListener('click', showSeedModal);
    dom.closeModal.addEventListener('click', closeModal);
    dom.cancelBtn.addEventListener('click', closeModal);
    dom.seedPhrase.addEventListener('input', handleSeedInput);
    dom.toggleVisibility.addEventListener('click', toggleVisibility);
    dom.passwordToggle.addEventListener('click', togglePasswordVisibility);
    dom.password.addEventListener('input', updatePasswordStrength);
    dom.generatePassword.addEventListener('click', generateSecurePassword);
    dom.encryptBtn.addEventListener('click', startEncryption);
    dom.pdfBtn.addEventListener('click', generatePDF);
    dom.shareBtn.addEventListener('click', shareQR);
    dom.downloadBtn.addEventListener('click', downloadQRAsPNG);
    dom.dropArea.addEventListener('click', triggerFileSelect);
    dom.qrFile.addEventListener('change', handleFileSelect);
    dom.decryptBtn.addEventListener('click', showPasswordModal);
    dom.copySeed.addEventListener('click', copySeedToClipboard);
    dom.closeDecrypted.addEventListener('click', closeDecryptedModal);
    dom.closeDecryptedBtn.addEventListener('click', closeDecryptedModal);
    dom.closeWelcome.addEventListener('click', closeWelcomeModal);
    dom.acceptWelcome.addEventListener('click', closeWelcomeModal);
    dom.decryptSeedBtn.addEventListener('click', decryptQR);
    dom.cancelDecryptBtn.addEventListener('click', closePasswordModal);
    dom.closePasswordModal.addEventListener('click', closePasswordModal);
    dom.decryptPasswordToggle.addEventListener('click', toggleDecryptPasswordVisibility);
    dom.closeQRModal.addEventListener('click', closeQRModal);
    
    // Drag and drop
    dom.dropArea.addEventListener('dragover', handleDragOver);
    dom.dropArea.addEventListener('dragleave', handleDragLeave);
    dom.dropArea.addEventListener('drop', handleDrop);
    
    // Suggestions
    document.addEventListener('click', closeSuggestionsOutside);
    
    // Online/offline
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Hide download buttons in Telegram
    if (isTelegram()) {
        dom.downloadBtn.style.display = 'none';
        dom.pdfBtn.style.display = 'none';
    }
}

// Modal functions
function showSeedModal() {
    dom.seedModal.style.display = 'flex';
    dom.seedPhrase.focus();
}

function closeModal() {
    dom.seedModal.style.display = 'none';
    resetModalState();
}

function resetModalState() {
    dom.seedPhrase.value = '';
    dom.password.value = '';
    dom.wordCounter.textContent = '0 words';
    appState.wordsVisible = false;
    appState.passwordVisible = false;
    dom.seedPhrase.type = 'password';
    dom.password.type = 'password';
    dom.toggleVisibility.innerHTML = '<i class="fas fa-eye"></i>';
    dom.passwordToggle.innerHTML = '<i class="fas fa-eye"></i>';
    dom.passwordStrengthBar.style.width = '0%';
    dom.passwordStrengthText.textContent = 'Security: Very weak';
    dom.encryptBtn.disabled = true;
    hideSuggestions();
}

function showPasswordModal() {
    if (!appState.qrImageData) {
        showToast('First load a QR code', 'error');
        return;
    }
    dom.passwordModal.style.display = 'flex';
    dom.decryptPassword.focus();
}

function closePasswordModal() {
    dom.passwordModal.style.display = 'none';
    dom.decryptPassword.value = '';
}

function closeDecryptedModal() {
    dom.decryptedModal.style.display = 'none';
    dom.decryptedSeed.value = '';
    appState.seedPhrase = '';
}

function closeWelcomeModal() {
    dom.welcomeModal.style.display = 'none';
}

function closeQRModal() {
    dom.qrModal.style.display = 'none';
    clearQRData();
}

function clearQRData() {
    // Clear canvas
    const ctx = dom.qrCanvas.getContext('2d');
    ctx.clearRect(0, 0, dom.qrCanvas.width, dom.qrCanvas.height);
    
    // Clear sensitive data
    appState.encryptedData = '';
    appState.password = '';
}

// Seed input handling
function handleSeedInput() {
    const words = dom.seedPhrase.value.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    
    dom.wordCounter.textContent = `${wordCount} words`;
    dom.encryptBtn.disabled = ![12, 18, 24].includes(wordCount);
    appState.seedPhrase = dom.seedPhrase.value;
    
    // Find current word
    const cursorPosition = dom.seedPhrase.selectionStart;
    const text = dom.seedPhrase.value;
    let charCount = 0;
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordStart = text.indexOf(word, charCount);
        const wordEnd = wordStart + word.length;
        
        if (cursorPosition >= wordStart && cursorPosition <= wordEnd) {
            appState.currentWordIndex = i;
            appState.currentWordPartial = word;
            
            if (word.length > 1) {
                showBIP39Suggestions(word);
            } else {
                hideSuggestions();
            }
            break;
        }
        charCount += word.length + 1;
    }
}

function toggleVisibility() {
    appState.wordsVisible = !appState.wordsVisible;
    dom.seedPhrase.type = appState.wordsVisible ? 'text' : 'password';
    dom.toggleVisibility.innerHTML = appState.wordsVisible ? 
        '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}

function togglePasswordVisibility() {
    appState.passwordVisible = !appState.passwordVisible;
    dom.password.type = appState.passwordVisible ? 'text' : 'password';
    dom.passwordToggle.innerHTML = appState.passwordVisible ? 
        '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}

function toggleDecryptPasswordVisibility() {
    const isVisible = dom.decryptPassword.type === 'text';
    dom.decryptPassword.type = isVisible ? 'password' : 'text';
    dom.decryptPasswordToggle.innerHTML = isVisible ? 
        '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
}

// Password strength
function updatePasswordStrength() {
    const strength = calculatePasswordStrength(dom.password.value);
    dom.passwordStrengthBar.style.width = `${strength}%`;
    updatePasswordStrengthText(strength);
}

function calculatePasswordStrength(password) {
    if (!password) return 0;
    
    let strength = 0;
    strength += Math.min(password.length * 4, 40);
    if (/[A-Z]/.test(password)) strength += 10;
    if (/[a-z]/.test(password)) strength += 10;
    if (/[0-9]/.test(password)) strength += 10;
    if (/[^A-Za-z0-9]/.test(password)) strength += 15;
    
    return Math.max(0, Math.min(100, strength));
}

function updatePasswordStrengthText(strength) {
    const levels = [
        {min: 0, text: 'Very weak'},
        {min: 20, text: 'Weak'},
        {min: 40, text: 'Moderate'},
        {min: 60, text: 'Strong'},
        {min: 80, text: 'Very strong'}
    ];
    
    const level = levels.reverse().find(l => strength >= l.min)?.text || 'Very weak';
    dom.passwordStrengthText.textContent = `Security: ${level}`;
}

function generateSecurePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    let password = '';
    
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Ensure complexity
    if (!/[A-Z]/.test(password)) password = 'A' + password.slice(1);
    if (!/[a-z]/.test(password)) password = password.slice(0, -1) + 'a';
    if (!/[0-9]/.test(password)) password = password.slice(0, -1) + '1';
    if (!/[^A-Za-z0-9]/.test(password)) password = password.slice(0, -1) + '!';
    
    dom.password.value = password;
    updatePasswordStrength();
    showToast('Secure password generated', 'success');
}

// BIP39 suggestions
function showBIP39Suggestions(partialWord) {
    if (!appState.bip39Wordlist || partialWord.length < 2) {
        hideSuggestions();
        return;
    }
    
    const lowerPartial = partialWord.toLowerCase();
    const suggestions = appState.bip39Wordlist
        .filter(word => word.toLowerCase().startsWith(lowerPartial))
        .slice(0, 5);
    
    if (suggestions.length === 0) {
        hideSuggestions();
        return;
    }
    
    dom.suggestionsContainer.innerHTML = '';
    suggestions.forEach(word => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `<i class="fas fa-lightbulb"></i> ${word}`;
        item.addEventListener('click', () => selectSuggestion(word));
        dom.suggestionsContainer.appendChild(item);
    });
    
    dom.suggestionsContainer.style.display = 'block';
}

function hideSuggestions() {
    dom.suggestionsContainer.style.display = 'none';
}

function selectSuggestion(word) {
    const words = dom.seedPhrase.value.trim().split(/\s+/);
    if (appState.currentWordIndex >= 0 && appState.currentWordIndex < words.length) {
        words[appState.currentWordIndex] = word;
        dom.seedPhrase.value = words.join(' ');
        const event = new Event('input', { bubbles: true });
        dom.seedPhrase.dispatchEvent(event);
    }
    hideSuggestions();
}

function closeSuggestionsOutside(e) {
    if (!dom.seedPhrase.contains(e.target) && !dom.suggestionsContainer.contains(e.target)) {
        hideSuggestions();
    }
}

// Encryption
async function startEncryption() {
    if (!validateInputs()) return;
    
    try {
        showSpinner(true);
        const words = appState.seedPhrase.trim().split(/\s+/);
        if (![12, 18, 24].includes(words.length)) {
            throw new Error('Seed phrase must contain 12, 18 or 24 words');
        }
        
        const seedData = words.join(' ');
        const encrypted = await cryptoUtils.encryptMessage(seedData, appState.password);
        appState.encryptedData = encrypted;
        
        await generateQR(encrypted);
        
        closeModal();
        dom.qrModal.style.display = 'flex';
        showToast('Seed encrypted successfully', 'success');
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        showSpinner(false);
    }
}

function validateInputs() {
    const words = appState.seedPhrase.trim().split(/\s+/);
    
    if (![12, 18, 24].includes(words.length)) {
        showToast('Seed phrase must contain 12, 18 or 24 words', 'error');
        return false;
    }
    
    if (appState.bip39Wordlist) {
        const invalidWords = words.filter(word => !appState.bip39Wordlist.includes(word));
        if (invalidWords.length > 0) {
            showToast(`Invalid words: ${invalidWords.slice(0, 5).join(', ')}${invalidWords.length > 5 ? '...' : ''}`, 'error');
            return false;
        }
    }
    
    if (dom.password.value.length < CONFIG.MIN_PASSPHRASE_LENGTH) {
        showToast(`Password must be at least ${CONFIG.MIN_PASSPHRASE_LENGTH} characters`, 'error');
        return false;
    }
    
    const strength = calculatePasswordStrength(dom.password.value);
    if (strength < 40) {
        showToast('Password is too weak. Please use a stronger one.', 'warning');
        return false;
    }
    
    appState.password = dom.password.value;
    return true;
}

async function generateQR(data) {
    return new Promise((resolve) => {
        const qrSize = CONFIG.QR_SIZE;
        dom.qrCanvas.width = qrSize;
        dom.qrCanvas.height = qrSize;
        
        QRCode.toCanvas(
            dom.qrCanvas,
            data,
            {
                width: qrSize,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' },
                errorCorrectionLevel: CONFIG.QR_ERROR_CORRECTION
            },
            (error) => {
                if (error) console.error('QR generation error:', error);
                resolve();
            }
        );
    });
}

// QR export functions
function generatePDF() {
    if (!appState.encryptedData) {
        showToast('First generate a QR code', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a5'
        });
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const centerX = pageWidth / 2;
        
        // Background
        doc.setFillColor(245, 245, 245);
        doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
        
        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text('Secure Seed Backup', centerX, 25, null, null, 'center');
        
        // Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.text('Encrypted with AES-256-GCM', centerX, 32, null, null, 'center');
        
        // QR code with border
        const qrSize = 80;
        const qrDataUrl = dom.qrCanvas.toDataURL('image/png');
        const qrX = centerX - (qrSize / 2);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(qrX - 10, 40, qrSize + 20, qrSize + 30, 3, 3, 'S');
        doc.addImage(qrDataUrl, 'PNG', qrX, 50, qrSize, qrSize);
        
        // Security note
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text('Store this securely. Password required for decryption.', 
                centerX, 50 + qrSize + 20, null, null, 'center');
        
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated by MnemoniQR • ${new Date().toLocaleDateString()}`, 
                centerX, doc.internal.pageSize.getHeight() - 10, null, null, 'center');
        
        doc.save(`mnemoniqr-backup-${Date.now()}.pdf`);
        showToast('PDF generated successfully', 'success');
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('Error generating PDF', 'error');
    }
}

async function shareQR() {
    if (!appState.encryptedData) {
        showToast('First generate a QR code', 'error');
        return;
    }
    
    try {
        // Convert canvas to blob
        dom.qrCanvas.toBlob(async blob => {
            if (isTelegram()) {
                // In Telegram: use downloadFile method
                const file = new File([blob], `mnemoniqr-${Date.now()}.png`, {
                    type: 'image/png'
                });
                Telegram.WebApp.downloadFile(file);
                showToast('QR saved. You can now share it.', 'success');
            } else {
                // In browsers: use Web Share API or clipboard
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: 'Secure Seed Backup',
                            files: [new File([blob], 'seed-backup.png', { type: 'image/png' })]
                        });
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            throw err;
                        }
                    }
                } else {
                    // Fallback: copy to clipboard
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    showToast('QR copied to clipboard', 'success');
                }
            }
        });
    } catch (error) {
        console.error('Sharing error:', error);
        showToast('Error sharing QR: ' + error.message, 'error');
    }
}

function downloadQRAsPNG() {
    if (!appState.encryptedData) {
        showToast('First generate a QR code', 'error');
        return;
    }
    
    try {
        const link = document.createElement('a');
        link.download = `mnemoniqr-${Date.now()}.png`;
        link.href = dom.qrCanvas.toDataURL('image/png');
        link.click();
        showToast('QR downloaded successfully', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showToast('Error downloading QR', 'error');
    }
}

// Decryption functions
function triggerFileSelect() {
    dom.qrFile.click();
}

function handleFileSelect(e) {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    dom.dropArea.classList.add('drag-over');
}

function handleDragLeave() {
    dom.dropArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    dom.dropArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
}

function handleFile(file) {
    if (!file.type.match('image.*')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        // Reset drop area appearance
        dom.dropArea.classList.remove('drag-over');
        appState.qrImageData = e.target.result;
        
        // Reset file input
        dom.qrFile.value = '';
        
        // Show password modal directly
        showToast('QR code loaded. Enter password to decrypt.', 'success');
        showPasswordModal();
    };
    reader.readAsDataURL(file);
}

async function decryptQR() {
    try {
        if (!appState.qrImageData) {
            throw new Error('First load a QR code');
        }
        
        const img = new Image();
        img.src = appState.qrImageData;
        await img.decode();
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (!code) {
            throw new Error('Could not read QR code');
        }
        
        const password = dom.decryptPassword.value;
        if (!password) {
            throw new Error('Password is required');
        }
        
        showSpinner(true);
        const decrypted = await cryptoUtils.decryptMessage(code.data, password);
        showDecryptedSeed(decrypted);
        closePasswordModal();
        
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        showSpinner(false);
    }
}

function showDecryptedSeed(seedPhrase) {
    const words = seedPhrase.split(' ');
    const wordCount = words.length;
    
    dom.decryptedSeed.value = seedPhrase;
    dom.wordCount.textContent = `${wordCount} words`;
    
    dom.seedWordsContainer.innerHTML = '';
    words.forEach((word, index) => {
        const wordEl = document.createElement('div');
        wordEl.className = 'seed-word';
        wordEl.textContent = word;
        wordEl.setAttribute('data-index', index + 1);
        dom.seedWordsContainer.appendChild(wordEl);
    });
    
    dom.decryptedModal.style.display = 'flex';
}

function copySeedToClipboard() {
    dom.decryptedSeed.select();
    document.execCommand('copy');
    showToast('Seed copied to clipboard', 'success');
}

// Crypto utilities
const cryptoUtils = {
    async encryptMessage(message, passphrase) {
        if (!message || !passphrase) {
            throw new Error('Message and password are required');
        }
        
        if (passphrase.length < CONFIG.MIN_PASSPHRASE_LENGTH) {
            throw new Error(`Password must be at least ${CONFIG.MIN_PASSPHRASE_LENGTH} characters`);
        }
        
        const dataToEncrypt = new TextEncoder().encode(message);
        const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(CONFIG.IV_LENGTH));
        
        const baseKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt,
                iterations: CONFIG.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            baseKey,
            CONFIG.AES_KEY_LENGTH + CONFIG.HMAC_KEY_LENGTH
        );
        
        const derivedBitsArray = new Uint8Array(derivedBits);
        const aesKeyBytes = derivedBitsArray.slice(0, CONFIG.AES_KEY_LENGTH / 8);
        const hmacKeyBytes = derivedBitsArray.slice(CONFIG.AES_KEY_LENGTH / 8);
        
        const aesKey = await crypto.subtle.importKey(
            'raw',
            aesKeyBytes,
            { name: 'AES-GCM' },
            false,
            ['encrypt']
        );
        
        const hmacKey = await crypto.subtle.importKey(
            'raw',
            hmacKeyBytes,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, tagLength: 128 },
            aesKey,
            dataToEncrypt
        );
        
        const ciphertext = new Uint8Array(encrypted);
        const hmac = await crypto.subtle.sign('HMAC', hmacKey, ciphertext);
        
        const combined = new Uint8Array([
            ...salt,
            ...iv,
            ...ciphertext,
            ...new Uint8Array(hmac)
        ]);
        
        return btoa(String.fromCharCode(...combined));
    },
    
    async decryptMessage(encryptedBase64, passphrase) {
        const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        
        const salt = encryptedData.slice(0, CONFIG.SALT_LENGTH);
        const iv = encryptedData.slice(CONFIG.SALT_LENGTH, CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH);
        const ciphertext = encryptedData.slice(
            CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH, 
            encryptedData.length - CONFIG.HMAC_LENGTH
        );
        const hmac = encryptedData.slice(encryptedData.length - CONFIG.HMAC_LENGTH);
        
        const baseKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt,
                iterations: CONFIG.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            baseKey,
            CONFIG.AES_KEY_LENGTH + CONFIG.HMAC_KEY_LENGTH
        );
        
        const derivedBitsArray = new Uint8Array(derivedBits);
        const aesKeyBytes = derivedBitsArray.slice(0, CONFIG.AES_KEY_LENGTH / 8);
        const hmacKeyBytes = derivedBitsArray.slice(CONFIG.AES_KEY_LENGTH / 8);
        
        const aesKey = await crypto.subtle.importKey(
            'raw',
            aesKeyBytes,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );
        
        const hmacKey = await crypto.subtle.importKey(
            'raw',
            hmacKeyBytes,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        
        const hmacValid = await crypto.subtle.verify(
            'HMAC',
            hmacKey,
            hmac,
            ciphertext
        );
        
        if (!hmacValid) {
            throw new Error('HMAC mismatch. Wrong password or corrupted file.');
        }
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, tagLength: 128 },
            aesKey,
            ciphertext
        );
        
        return new TextDecoder().decode(decrypted);
    }
};

// UI utilities
function showToast(message, type = 'info') {
    const icons = {
        error: 'fa-exclamation-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    
    dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function showSpinner(show) {
    dom.spinnerOverlay.style.display = show ? 'flex' : 'none';
}

// Offline mode indicator
function updateOnlineStatus() {
    if (!navigator.onLine) {
        if (!document.getElementById('offline-badge')) {
            const badge = document.createElement('div');
            badge.id = 'offline-badge';
            badge.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline Mode';
            badge.style.position = 'fixed';
            badge.style.bottom = '15px';
            badge.style.left = '15px';
            badge.style.background = 'var(--accent-color)';
            badge.style.color = 'white';
            badge.style.padding = '6px 12px';
            badge.style.borderRadius = '20px';
            badge.style.zIndex = '10000';
            badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            badge.style.fontWeight = '600';
            badge.style.display = 'flex';
            badge.style.alignItems = 'center';
            badge.style.gap = '6px';
            badge.style.fontSize = '0.9rem';
            document.body.appendChild(badge);
        }
        showToast('Offline mode activated - Maximum security', 'success');
    } else {
        const badge = document.getElementById('offline-badge');
        if (badge) badge.remove();
    }
}

// Load BIP39 wordlist
async function loadBIP39Wordlist() {
    const STORAGE_KEY = 'bip39-wordlist';
    try {
        const cachedWordlist = localStorage.getItem(STORAGE_KEY);
        if (cachedWordlist) {
            appState.bip39Wordlist = JSON.parse(cachedWordlist);
            return;
        }

        const response = await fetch('https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/english.txt');
        if (!response.ok) throw new Error('Failed to fetch wordlist');
        const text = await response.text();
        const wordlist = text.split('\n').map(word => word.trim()).filter(word => word);
        appState.bip39Wordlist = wordlist;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wordlist));
    } catch (error) {
        console.error('Error loading BIP39 wordlist:', error);
        showToast('Warning: BIP39 validation not available', 'warning');
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadBIP39Wordlist();
    updateOnlineStatus();
    dom.welcomeModal.style.display = 'flex';
});
