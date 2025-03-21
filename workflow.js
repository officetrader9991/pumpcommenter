/*
Workflow and Task List for Cursor AI
1. Project Setup
Objective: Initialize the project structure and install dependencies.

Tasks:
Create Project Directory
Open Cursor AI, create a new folder (e.g., pumpfun-airdrop), and open it as a workspace.

Use the terminal: npx create-next-app@latest frontend to scaffold a Next.js app in /frontend.

Create a /backend folder manually for the Node.js server.

Install Dependencies
In /frontend, run:

npm install axios tailwindcss postcss autoprefixer
npx tailwindcss init -p

Use Cursor’s AI to configure tailwind.config.js by typing “Configure Tailwind CSS for Next.js” and letting it generate the setup.

In /backend, run:

npm init -y
npm install express puppeteer @solana/web3.js

Use Cursor’s autocomplete to create a basic package.json.

Set Up File Structure
In /frontend, ensure /pages, /components, and /styles exist (Next.js creates these).

In /backend, create server.js, /routes, and /utils.

Use Cursor’s “Generate folder structure” prompt if needed.

2. Frontend Development
Objective: Build a UI for URL input and commenter display with airdrop controls.

Tasks:
Create InputForm Component
In /frontend/components/InputForm.js, start typing:
jsx

import { useState } from 'react';
export default function InputForm({ onSubmit }) {

Use Cursor’s AI completion (Ctrl+Enter) to generate the form logic (e.g., “Create a form with a URL input and submit button styled with Tailwind”).

Expected output:
jsx

import { useState } from 'react';

export default function InputForm({ onSubmit }) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(url);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <label className="block mb-2">Enter Pump.fun Token URL:</label>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://pump.fun/coin/..."
        className="w-full p-2 border rounded mb-4"
      />
      <button type="submit" className="bg-blue-500 text-white p-2 rounded">
        Get Commenters
      </button>
    </form>
  );
}

Build Homepage
In /frontend/pages/index.js, type “Create a Next.js page with a form and list” and let Cursor generate a skeleton:
jsx

import InputForm from '../components/InputForm';
import axios from 'axios';
import { useState } from 'react';

export default function Home() {
  const [commenters, setCommenters] = useState([]);
  const [selected, setSelected] = useState([]);

  const handleSubmit = async (url) => {
    try {
      const response = await axios.post('/api/scrape', { url });
      setCommenters(response.data);
    } catch (error) {
      console.error('Error fetching commenters:', error);
    }
  };

  const toggleSelect = (wallet) => {
    setSelected(prev => 
      prev.includes(wallet) ? prev.filter(w => w !== wallet) : [...prev, wallet]
    );
  };

  const handleAirdrop = async () => {
    await axios.post('/api/airdrop', { recipients: selected, tokenMint: 'YOUR_TOKEN_MINT' });
    alert('Airdrop executed!');
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl mb-4">Pump.fun Airdrop Tool</h1>
      <InputForm onSubmit={handleSubmit} />
      {commenters.length > 0 && (
        <div>
          <h2 className="text-xl mt-4">Commenters:</h2>
          <ul>
            {commenters.map((commenter, index) => (
              <li key={index}>
                <input
                  type="checkbox"
                  checked={selected.includes(commenter.wallet)}
                  onChange={() => toggleSelect(commenter.wallet)}
                />
                {commenter.username} - {commenter.wallet || 'Wallet TBD'}
              </li>
            ))}
          </ul>
          <button
            onClick={handleAirdrop}
            className="mt-4 bg-green-500 text-white p-2 rounded"
            disabled={selected.length === 0}
          >
            Airdrop to Selected
          </button>
        </div>
      )}
    </div>
  );
}

Use Cursor’s “Refactor” feature to clean up or add error handling if needed.

Style with Tailwind
Cursor’s AI can auto-suggest Tailwind classes as you type (e.g., className="p-4" triggers suggestions like px-4 py-4).

3. Backend Development - Scraping
Objective: Scrape commenters from the Pump.fun page.

Tasks:
Set Up Express Server
In /backend/server.js, type “Create an Express server with a POST endpoint” and let Cursor generate:
javascript

const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.use(express.json());

app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  try {
    const commenters = await scrapeCommenters(url);
    res.json(commenters);
  } catch (error) {
    res.status(500).json({ error: 'Failed to scrape commenters' });
  }
});

app.listen(3001, () => console.log('Server running on port 3001'));

Implement Scraper
Add the scrapeCommenters function by typing “Write a Puppeteer function to scrape elements with data-sentry-component=UserPreview”:
javascript

async function scrapeCommenters(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const commenters = await page.evaluate(() => {
    const commentElements = document.querySelectorAll('a[data-sentry-component="UserPreview"]');
    return Array.from(commentElements).map(element => ({
      username: element.querySelector('span > span').textContent.trim(),
      profileLink: element.getAttribute('href')
    }));
  });

  await browser.close();
  return commenters;
}

Use Cursor’s “Debug” feature to test scraping locally with a sample URL.

4. Resolve Solana Wallet Addresses
Objective: Convert profile IDs to Solana wallets (placeholder logic).

Tasks:
Add Wallet Resolution
In server.js, extend scrapeCommenters with wallet logic:
javascript

const { PublicKey } = require('@solana/web3.js');

async function resolveWallet(profileId) {
  try {
    new PublicKey(profileId);
    return profileId; // If valid Solana address
  } catch (e) {
    return null; // Placeholder: Actual resolution TBD
  }
}

async function scrapeCommenters(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const commenters = await page.evaluate(() => {
    const commentElements = document.querySelectorAll('a[data-sentry-component="UserPreview"]');
    return Array.from(commentElements).map(element => ({
      username: element.querySelector('span > span').textContent.trim(),
      profileLink: element.getAttribute('href')
    }));
  });

  await browser.close();

  return Promise.all(commenters.map(async (commenter) => {
    const profileId = commenter.profileLink.split('/profile/')[1];
    const wallet = await resolveWallet(profileId);
    return { username: commenter.username, wallet };
  }));
}

Use Cursor’s “Explain” feature (highlight code, ask “How does this work?”) to understand the PublicKey check.

Placeholder Note
Add a comment via Cursor’s AI: “Add a TODO comment for future wallet resolution” to remind yourself this needs refinement.

5. Airdrop Functionality
Objective: Enable token airdrops on Solana.

Tasks:
Implement Airdrop Endpoint
In server.js, type “Create a Solana token airdrop function with @solana
/web3.js”:
javascript

const { Connection, Keypair, Transaction, PublicKey, TOKEN_PROGRAM_ID, createTransferInstruction } = require('@solana/web3.js');
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

app.post('/api/airdrop', async (req, res) => {
  const { recipients, tokenMint } = req.body;
  const senderKeypair = Keypair.fromSecretKey(Uint8Array.from( Your private key array ));

  const transaction = new Transaction();
  const tokenPublicKey = new PublicKey(tokenMint);

  for (const recipient of recipients) {
    const recipientPublicKey = new PublicKey(recipient);
    transaction.add(
      createTransferInstruction(
        senderKeypair.publicKey, // Sender’s token account TBD
        recipientPublicKey,
        senderKeypair.publicKey,
        1000000, // 1 token (adjust decimals)
        TOKEN_PROGRAM_ID
      )
    );
  }

  const signature = await connection.sendTransaction(transaction, [senderKeypair]);
  await connection.confirmTransaction(signature);

  res.json({ success: true, signature });
});

Use Cursor’s AI to fix syntax errors or suggest secure key handling (e.g., “How to load private key from env?”).

Secure Key Management
Add .env support: Install dotenv, then prompt Cursor: “Add dotenv to load private key securely”.

6. Testing and Debugging
Objective: Test the app end-to-end.

Tasks:
Local Testing
Run /frontend: npm run dev (port 3000).

Run /backend: node server.js (port 3001).

Use Cursor’s terminal integration to monitor logs.

Test with a URL like https://pump.fun/coin/E3i1tHrbwtoBpgMuLeBZ6PsqNXjwxXbPfdeanpyrpump.

Debugging
Use Cursor’s “Debug” panel or ask “Why isn’t my API call working?” to troubleshoot issues (e.g., CORS, scraping failures).

7. Deployment Prep
Objective: Prepare for deployment.

Tasks:
Frontend Deployment
Use Cursor to generate a vercel.json file: “Create a Vercel config for Next.js”.

Backend Deployment
Add a Procfile for Heroku: “Generate a Heroku Procfile for Node.js with Puppeteer”.

