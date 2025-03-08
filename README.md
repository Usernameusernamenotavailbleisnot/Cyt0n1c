# Cyt0n1c Ethereum Testnet Automation Tool

## Overview

The Cyt0n1c Ethereum Testnet Automation Tool is a comprehensive automation solution designed for interacting with the Cyt0n1c Ethereum Testnet. This tool automates various blockchain operations including faucet claims with captcha solving, token transfers, smart contract deployment, ERC20 token creation, and NFT collection management.

## Features

- **Faucet Claims**: Automated token claiming from the Cyt0n1c testnet faucet with hc4ptch4 solving
- **Token Transfers**: Self-transfers to keep wallets active and test transaction functionalities
- **Smart Contract Deployment**: Deploy and interact with sample smart contracts
- **ERC20 Token Management**: Create, deploy, mint, and burn custom ERC20 tokens
- **NFT Collection Management**: Create NFT collections, mint NFTs with metadata, and burn tokens
- **Proxy Support**: Rotate through HTTP proxies for distributed operations
- **Gas Price Optimization**: Automatic gas price calculation with retry mechanisms
- **Detailed Logging**: Comprehensive color-coded console output for tracking operations

## Requirements

- Node.js 14.x or higher
- NPM 6.x or higher
- A Scrappey API key for captcha solving (optional but recommended)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Usernameusernamenotavailbleisnot/Cyt0n1c.git
   cd Cyt0n1c
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Add your private keys to `pk.txt`, one per line:
   ```
   0x1234567890abcdef...
   0x9876543210abcdef...
   ```

4. Optional: Add HTTP proxies to `proxy.txt`, one per line:
   ```
   http://username:password@ip:port
   http://username:password@ip:port
   ```

5. Configure the tool by editing `config.json` (see Configuration section below)

## Configuration

The tool is configured through the `config.json` file. Here's an explanation of the main configuration options:

```json
{
  "enable_faucet": true,          // Enable/disable faucet claiming
  "enable_transfer": true,        // Enable/disable token transfers
  "enable_contract_deploy": true, // Enable/disable smart contract deployment
  "gas_price_multiplier": 1.2,    // Gas price multiplier for faster confirmations
  "max_retries": 5,               // Maximum retry attempts for failed operations
  "base_wait_time": 10,           // Base wait time between retries (seconds)
  "transfer_amount_percentage": 90, // Percentage of balance to transfer in self-transfers

  "contract": {
    "contract_interactions": {
      "enabled": true,            // Enable/disable contract interactions after deployment
      "count": {                  // Number of interactions to perform
        "min": 3,
        "max": 8
      },
      "types": ["setValue", "increment", "decrement", "reset", "contribute"]  // Available interaction types
    }
  },

  "erc20": {
    "enable_erc20": true,         // Enable/disable ERC20 token operations
    "mint_amount": {              // Range for token minting amounts
      "min": 1000000,
      "max": 10000000
    },
    "burn_percentage": 10,        // Percentage of tokens to burn after minting
    "decimals": 18                // Number of decimals for the ERC20 token
  },

  "nft": {
    "enable_nft": true,           // Enable/disable NFT collection operations
    "mint_count": {               // Number of NFTs to mint per collection
      "min": 2,
      "max": 5
    },
    "burn_percentage": 20,        // Percentage of NFTs to burn after minting
    "supply": {                   // Range for NFT collection total supply
      "min": 100,
      "max": 500
    }
  }
}
```

## Usage

To start the automation tool:

```bash
npm start
```

The tool will process each wallet from the `pk.txt` file, performing the enabled operations in sequence:

1. Claiming tokens from the Cyt0n1c testnet faucet
2. Performing token self-transfers
3. Deploying and interacting with smart contracts
4. Creating, minting, and burning ERC20 tokens
5. Creating NFT collections, minting NFTs, and burning tokens

After processing all wallets, the tool will wait for 8 hours before starting the next cycle.

## File Structure

```
Cyt0n1c-testnet-automation/
├── index.js              # Main entry point
├── config.json           # Configuration file
├── pk.txt                # Private keys (one per line)
├── proxy.txt             # Proxies (one per line)
├── package.json          # Node.js dependencies
├── utils/
│   └── constants.js      # Constants and templates
└── src/
    ├── faucet.js         # Faucet claims with captcha solving
    ├── transfer.js       # Token transfer functionality
    ├── ContractDeployer.js   # Smart contract deployment
    ├── ERC20TokenDeployer.js # ERC20 token operations
    └── NFTManager.js     # NFT collection management
```

## How It Works

The tool is modular and each operation is handled by a specialized class:

- **FaucetClaimer**: Solves hc4ptch4 and claims tokens from the faucet
- **TokenTransfer**: Handles token self-transfers
- **ContractDeployer**: Compiles and deploys smart contracts, then interacts with them
- **ERC20TokenDeployer**: Creates, deploys, mints, and burns ERC20 tokens
- **NFTManager**: Creates, deploys, mints, and burns NFT collections

All operations include:
- Proper nonce management to prevent transaction failures
- Gas price optimization for faster confirmations
- Exponential backoff retry mechanisms for failed operations
- Detailed logging with timestamp and wallet identification

### Common Issues

1. **Faucet Claims Failing**:
   - Ensure your hc4ptch4 API key is valid
   - Check for rate limiting (the tool will detect and report this)
   - Verify your IP isn't blocked (try using proxies)

2. **Transaction Errors**:
   - Ensure your wallet has sufficient funds
   - Check if the gas price is appropriate (adjust `gas_price_multiplier`)
   - Increase `max_retries` if network is congested

3. **Contract Deployment Failures**:
   - Ensure the Solidity version is compatible with the network
   - Check for compilation errors in the logs
   - Verify the contract size isn't too large

### Logs

The tool provides detailed color-coded console output:
- 🟢 Green: Successful operations
- 🔴 Red: Errors
- 🟡 Yellow: Warnings/Notices
- 🔵 Blue: Operation headings
- 🔷 Cyan: Informational messages

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This tool is for educational and testing purposes only. Use it responsibly and in accordance with the terms of service of the Cyt0n1c Ethereum Testnet.
