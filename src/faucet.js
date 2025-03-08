const { Web3 } = require('web3');
const axios = require('axios');
const chalk = require('chalk');
const { HttpsProxyAgent } = require('https-proxy-agent');
const constants = require('../utils/constants');

function getTimestamp(walletNum = null) {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: false });
    if (walletNum !== null) {
        return `[${timestamp} - Wallet ${walletNum}]`;
    }
    return `[${timestamp}]`;
}

class FaucetClaimer {
    constructor(scrappeyApiKey, config = {}, proxies = []) {
        this.scrappeyApiKey = scrappeyApiKey;
        this.scrappeyUrl = 'https://publisher.scrappey.com/api/v1';
        this.faucetUrl = constants.NETWORK.FAUCET_URL;
        this.web3 = new Web3(constants.NETWORK.RPC_URL);
        
        // Set default config 
        this.config = {
            max_retries: constants.RETRY.MAX_RETRIES,
            base_wait_time: constants.RETRY.BASE_WAIT_TIME,
            enable_faucet: true
        };
        
        // Merge with provided config
        if (config) {
            this.config = { ...this.config, ...config };
            this.maxRetries = this.config.max_retries;
            this.baseWaitTime = this.config.base_wait_time;
        }
        
        // Initialize
        this.proxies = proxies;
        this.currentProxy = null;
        this.retryCodes = new Set([408, 429, 500, 502, 503, 504]);
        this.currentWalletNum = 0;
    }

    getRandomProxy() {
        if (this.proxies.length > 0) {
            this.currentProxy = this.proxies[Math.floor(Math.random() * this.proxies.length)];
            return this.currentProxy;
        }
        return null;
    }

    exponentialBackoff(attempt) {
        const waitTime = Math.min(300, this.baseWaitTime * (2 ** attempt));
        const jitter = 0.5 + Math.random();
        return Math.floor(waitTime * jitter);
    }

    async makeRequestWithRetry(method, url, options = {}) {
        let attempt = 0;
        
        // Handle proxy configuration
        if (url !== this.scrappeyUrl && this.currentProxy) {
            // Create proxy agent
            const proxyUrl = this.currentProxy.startsWith('http') ? 
                this.currentProxy : 
                `http://${this.currentProxy}`;
            
            const httpsAgent = new HttpsProxyAgent(proxyUrl);
            options.httpsAgent = httpsAgent;
            options.proxy = false; // Disable axios proxy handling
        }
        
        // Set appropriate timeout
        if (url === this.faucetUrl) {
            options.timeout = 180000; // 3 minutes for faucet
        } else if (!options.timeout) {
            options.timeout = 30000;
        }
        
        while (attempt < this.maxRetries) {
            try {
                const response = await axios({
                    method,
                    url,
                    ...options,
                    validateStatus: null // Don't throw error on any status
                });
                
                // For faucet requests, check for rate limit messages regardless of status code
                if (url === this.faucetUrl) {
                    console.log(chalk.cyan(`${getTimestamp(this.currentWalletNum)} Server response:`), 
                        typeof response.data === 'object' ? JSON.stringify(response.data) : response.data);
                    
                    // Check for rate limit message in the response
                    if (response.data && response.data.msg && 
                        (response.data.msg.includes("exceeded the rate limit") || 
                         response.data.msg.includes("wait") || 
                         response.data.msg.includes("hour"))) {
                        // This is a rate limit message, consider it as a success to avoid retries
                        console.log(chalk.yellow(`${getTimestamp(this.currentWalletNum)} ⚠ Rate limited: ${response.data.msg}`));
                        return { response, success: true, rateLimited: true };
                    }
                    
                    if (response.status >= 200 && response.status < 300) {
                        return { response, success: true };
                    }
                }
                
                // For other requests, check status code
                if (!this.retryCodes.has(response.status)) {
                    return { response, success: true };
                }
                
                const waitTime = this.exponentialBackoff(attempt);
                console.log(chalk.yellow(`${getTimestamp(this.currentWalletNum)} ⚠ Got status ${response.status}, retrying in ${waitTime}s...`));
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                
                if (url !== this.scrappeyUrl) {
                    this.getRandomProxy();
                    // Update proxy agent if proxy changed
                    if (this.currentProxy) {
                        const newProxyUrl = this.currentProxy.startsWith('http') ? 
                            this.currentProxy : 
                            `http://${this.currentProxy}`;
                        options.httpsAgent = new HttpsProxyAgent(newProxyUrl);
                    }
                }
                
            } catch (error) {
                const waitTime = this.exponentialBackoff(attempt);
                console.log(chalk.red(`${getTimestamp(this.currentWalletNum)} ✗ Request error: ${error.message}`));
                
                if (error.response) {
                    console.log(chalk.cyan(`${getTimestamp(this.currentWalletNum)} Server response:`),
                        typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : error.response.data);
                }
                
                console.log(chalk.yellow(`${getTimestamp(this.currentWalletNum)} ⚠ Retrying in ${waitTime}s...`));
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                
                if (url !== this.scrappeyUrl) {
                    this.getRandomProxy();
                    // Update proxy agent if proxy changed
                    if (this.currentProxy) {
                        const newProxyUrl = this.currentProxy.startsWith('http') ? 
                            this.currentProxy : 
                            `http://${this.currentProxy}`;
                        options.httpsAgent = new HttpsProxyAgent(newProxyUrl);
                    }
                }
            }
            
            attempt++;
        }
        
        return { response: null, success: false };
    }

    getAddressFromPk(privateKey) {
        try {
            if (!privateKey.startsWith('0x')) {
                privateKey = '0x' + privateKey;
            }
            const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
            return account.address;
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(this.currentWalletNum)} ✗ Error generating address: ${error.message}`));
            return null;
        }
    }

    async solveHcaptcha() {
        console.log(chalk.blue.bold(`${getTimestamp(this.currentWalletNum)} Solving hCaptcha for Cytonic faucet...`));
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        const params = {
            'key': this.scrappeyApiKey
        };
        
        const proxy = this.getRandomProxy();
        
        // Using the direct sitekey approach
        const jsonData = {
            'cmd': 'request.get',
            'url': 'https://www.cytonic.com',
            'dontLoadMainSite': true,
            'filter': [
                'javascriptReturn'
            ],
            'browserActions': [
                {
                    'type': 'solve_captcha',
                    'captcha': 'hcaptcha',
                    'captchaData': {
                        'sitekey': constants.FAUCET.HCAPTCHA_SITEKEY
                    }
                }
            ]
        };
        
        if (proxy) {
            jsonData.proxy = proxy;
        }
        
        try {
            const { response, success } = await this.makeRequestWithRetry(
                'POST',
                this.scrappeyUrl,
                {
                    params,
                    headers,
                    data: jsonData,
                    timeout: 120000
                }
            );
            
            if (!success || !response) {
                console.log(chalk.red(`${getTimestamp(this.currentWalletNum)} ✗ Failed to solve captcha after all retries`));
                return null;
            }
            
            if (response.status === 200) {
                const result = response.data;
                
                console.log(chalk.cyan(`${getTimestamp(this.currentWalletNum)} ℹ Captcha response received`));
                
                // The token should be directly in javascriptReturn based on this method
                if (result.solution && result.solution.javascriptReturn && 
                    Array.isArray(result.solution.javascriptReturn) && 
                    result.solution.javascriptReturn.length > 0) {
                    
                    const captchaToken = result.solution.javascriptReturn[0];
                    
                    if (captchaToken && typeof captchaToken === 'string' && captchaToken.length > 20) {
                        console.log(chalk.green(`${getTimestamp(this.currentWalletNum)} ✓ Successfully obtained captcha token`));
                        console.log(chalk.cyan(`${getTimestamp(this.currentWalletNum)} ℹ Token starts with: ${captchaToken.substring(0, 15)}...`));
                        return captchaToken;
                    } else {
                        console.log(chalk.yellow(`${getTimestamp(this.currentWalletNum)} ⚠️ Token in javascriptReturn appears invalid:`, captchaToken));
                    }
                }
                
                // Fallback checks for token in other possible locations
                if (result.solution && result.solution.token) {
                    console.log(chalk.green(`${getTimestamp(this.currentWalletNum)} ✓ Found token in solution.token`));
                    return result.solution.token;
                }
                
                if (result.token) {
                    console.log(chalk.green(`${getTimestamp(this.currentWalletNum)} ✓ Found token directly in result.token`));
                    return result.token;
                }
                
                // Log the response structure for debugging
                console.log(chalk.yellow(`${getTimestamp(this.currentWalletNum)} ⚠️ Could not find token in expected locations. Response structure:`));
                console.log(JSON.stringify(result, null, 2));
            }
            
            console.log(chalk.red(`${getTimestamp(this.currentWalletNum)} ✗ Failed to get captcha solution`));
            return null;
            
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(this.currentWalletNum)} ✗ Error solving captcha: ${error.message}`));
            return null;
        }
    }

    async claimFaucet(privateKey, walletNum = 0) {
        if (!this.config.enable_faucet) {
            return true;
        }
    
        this.currentWalletNum = walletNum;
        
        try {
            const address = this.getAddressFromPk(privateKey);
            if (!address) {
                return false;
            }
            
            // Try to solve captcha up to 3 times
            let captchaToken = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                console.log(chalk.blue(`${getTimestamp(this.currentWalletNum)} Captcha attempt ${attempt+1}/3`));
                captchaToken = await this.solveHcaptcha();
                if (captchaToken) break;
                
                if (attempt < 2) {
                    console.log(chalk.yellow(`${getTimestamp(this.currentWalletNum)} ⚠️ Captcha attempt ${attempt+1} failed, waiting before retry...`));
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
            
            if (!captchaToken) {
                console.log(chalk.red(`${getTimestamp(this.currentWalletNum)} ✗ Failed to solve captcha after multiple attempts`));
                return false;
            }
            
            console.log(chalk.blue.bold(`${getTimestamp(this.currentWalletNum)} Claiming faucet with valid captcha token...`));
            
            const payload = {
                "address": address
            };
            
            // Full set of headers matching browser request exactly as provided in the example
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'Origin': 'https://www.cytonic.com',
                'Referer': constants.FAUCET.REFERER,
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Connection': 'keep-alive',
                'host': 'faucet.evm.testnet.cytonic.com',
                'h-captcha-response': captchaToken
            };
            
            console.log(chalk.cyan(`${getTimestamp(this.currentWalletNum)} ℹ Making faucet request for address: ${address}`));
            
            const { response, success, rateLimited } = await this.makeRequestWithRetry('POST', this.faucetUrl, {
                headers,
                data: payload
            });
            
            if (!success || !response) {
                console.log(chalk.red(`${getTimestamp(this.currentWalletNum)} ✗ No response from faucet request`));
                return false;
            }
            
            // If rate limited, return true to avoid further retries
            if (rateLimited) {
                console.log(chalk.yellow(`${getTimestamp(this.currentWalletNum)} ⚠ Rate limited, moving to next operation`));
                return true;
            }
            
            const responseData = response.data;
            
            // Handle possible responses
            if (responseData.error && responseData.error.includes("Invalid Captcha")) {
                console.log(chalk.red(`${getTimestamp(this.currentWalletNum)} ✗ Invalid captcha response received`));
                return false;  // Return false to allow retry
            } else if (responseData.error && (responseData.error.includes('hours') || responseData.error.includes('hour') || responseData.error.includes('wait'))) {
                console.log(chalk.yellow(`${getTimestamp(this.currentWalletNum)} ⚠ Rate limited: ${responseData.error}`));
                return true;  // Return True to skip retries and move to next task
            } else if (responseData.msg && (responseData.msg.includes('exceeded the rate limit') || responseData.msg.includes('wait'))) {
                console.log(chalk.yellow(`${getTimestamp(this.currentWalletNum)} ⚠ Rate limited: ${responseData.msg}`));
                return true;  // Return True to skip retries and move to next task
            } else if (responseData.msg && (responseData.msg.includes('hash:') || responseData.msg.startsWith('0x') || responseData.msg.includes("Txhash:"))) {
                const txHash = responseData.msg.includes('hash:') ? 
                    responseData.msg.split('hash:')[1].trim() : 
                    responseData.msg.includes('Txhash:') ?
                    responseData.msg.split('Txhash:')[1].trim() :
                    responseData.msg;
                    
                console.log(chalk.green(`${getTimestamp(this.currentWalletNum)} ✓ Success! Transaction: ${constants.NETWORK.EXPLORER_URL}/tx/${txHash}`));
                return true;
            } else {
                console.log(chalk.red(`${getTimestamp(this.currentWalletNum)} ✗ Unexpected response: ${JSON.stringify(responseData)}`));
                return false;
            }
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(this.currentWalletNum)} ✗ Error claiming faucet: ${error.message}`));
            return false;
        }
    }
}

module.exports = FaucetClaimer;