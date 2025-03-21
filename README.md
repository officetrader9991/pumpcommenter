# PumpFun Comment Airdrop Tool

A powerful tool for airdropping tokens to users who commented on your Pump.fun tokens. This project allows you to fetch commenters from a Pump.fun token page, check their token balances, filter based on various criteria, and airdrop tokens with custom distribution strategies.

## Features

- **Commenter Discovery**: Fetch all commenters from any Pump.fun token URL
- **Token Balance Checking**: View how many tokens each commenter already holds
- **Balance Filtering**: Filter wallets based on token balance thresholds
- **Comment Multiplier**: Reward users based on their engagement level (comment count)
- **Batch Processing**: Handle large airdrops with efficient batching
- **Multiple RPC Support**: Reliable connections with fallback endpoints

## Prerequisites

- Node.js (v14+)
- Phantom Wallet (Browser Extension)
- Solana tokens for airdropping
- SOL for transaction fees

## Setup

### Backend

```bash
cd backend
npm install
npm start
```

The backend server runs on port 3015 by default.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend development server runs on port 3000 by default.

## Using the Tool

1. Connect your Phantom wallet
2. Enter a Pump.fun token URL
3. Wait for the commenters to be fetched
4. Check token balances of commenters
5. Configure your airdrop settings:
   - Set base amount per recipient
   - Enable comment multiplier (optional)
   - Filter by token balance (optional)
6. Select recipients and perform the airdrop

## Advanced Features

### Token Balance Filtering

Filter commenters based on how many tokens they already hold:
- Greater than or equal to: Include wallets with at least X tokens
- Less than: Include wallets with fewer than X tokens
- Equal to: Include only wallets with exactly X tokens

### Comment Multiplier

Distribute tokens based on engagement level:
- Base amount × Multiplier × comment count = tokens per recipient
- Reward more active community members automatically

## Deployment

This project is configured for easy deployment on Vercel. Follow these steps:

1. Push your code to GitHub (already done)
2. Go to [Vercel](https://vercel.com/) and sign up/log in
3. Click "New Project"
4. Import your GitHub repository (pumpcommenter)
5. Configure the project:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: Will be automatically detected from vercel.json
   - Output Directory: Will be automatically detected from vercel.json
6. Click "Deploy"

The configuration in vercel.json handles both the frontend and backend deployment. Your backend API will be accessible at yourdomain.vercel.app/api/...

## License

MIT 