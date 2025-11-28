const extractToken = async (statusDiv) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('facebook.com')) {
        statusDiv.textContent = 'Error: Please use on Facebook Ads Manager.';
        statusDiv.className = 'status error';
        return null;
    }

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: () => {
                let token = null;
                try {
                    // @ts-ignore
                    if (window.require) {
                        // @ts-ignore
                        const config = window.require("BusinessUserConfig");
                        if (config && config.accessToken) token = config.accessToken;
                    }
                } catch (e) { }
                if (!token && window.__accessToken) token = window.__accessToken;
                if (!token) {
                    const html = document.documentElement.innerHTML;
                    const match = html.match(/EAAB[a-zA-Z0-9]+/);
                    if (match) token = match[0];
                }
                return token;
            }
        });
        return results[0].result;
    } catch (error) {
        console.error(error);
        statusDiv.textContent = 'Error: ' + error.message;
        statusDiv.className = 'status error';
        return null;
    }
};

document.getElementById('extractBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    const tokenDisplay = document.getElementById('tokenDisplay');
    const copyBtn = document.getElementById('copyBtn');

    statusDiv.textContent = 'Extracting...';
    statusDiv.className = 'status';
    tokenDisplay.value = '';
    copyBtn.style.display = 'none';

    const token = await extractToken(statusDiv);

    if (token) {
        statusDiv.textContent = 'Token found!';
        statusDiv.className = 'status success';
        tokenDisplay.value = token;
        copyBtn.style.display = 'block';
    } else if (!statusDiv.textContent.includes('Error')) {
        statusDiv.textContent = 'Error: Token not found.';
        statusDiv.className = 'status error';
    }
});

document.getElementById('syncBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'Syncing...';

    const token = await extractToken(statusDiv);

    if (token) {
        chrome.tabs.create({ url: `http://localhost:3000/?token=${token}` });
    } else if (!statusDiv.textContent.includes('Error')) {
        statusDiv.textContent = 'Error: Token not found.';
        statusDiv.className = 'status error';
    }
});

document.getElementById('copyBtn').addEventListener('click', () => {
    const tokenDisplay = document.getElementById('tokenDisplay');
    tokenDisplay.select();
    document.execCommand('copy');
    document.getElementById('copyBtn').textContent = 'Copied!';
    setTimeout(() => {
        document.getElementById('copyBtn').textContent = 'Copy to Clipboard';
    }, 2000);
});
