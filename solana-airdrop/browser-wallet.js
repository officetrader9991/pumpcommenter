// This module provides functions for browser-based wallet connections and token transfers
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Connection,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

/**
 * Checks if a browser wallet is available
 */
export const checkWalletAvailable = () => {
  return window?.solana?.isPhantom;
};

/**
 * Connect to wallet and get public key
 */
export const connectWallet = async () => {
  try {
    if (!checkWalletAvailable()) {
      throw new Error('No wallet adapter found. Please install Phantom');
    }
    
    const resp = await window.solana.connect();
    return resp.publicKey.toString();
  } catch (err) {
    console.error('Error connecting to wallet:', err);
    throw err;
  }
};

/**
 * Disconnect wallet
 */
export const disconnectWallet = async () => {
  try {
    if (checkWalletAvailable()) {
      await window.solana.disconnect();
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error disconnecting wallet:', err);
    throw err;
  }
};

/**
 * Get signer public key
 */
export const getPublicKey = () => {
  if (!checkWalletAvailable() || !window.solana.isConnected) {
    return null;
  }
  return window.solana.publicKey.toString();
};

/**
 * Airdrop tokens to multiple recipients
 * 
 * @param {string} tokenMintAddress - The token mint address
 * @param {string[]} recipients - Array of recipient wallet addresses
 * @param {number} amount - Amount to send to each recipient (in token's smallest units)
 * @param {string} rpcUrl - The Solana RPC URL to use
 * @returns {Promise<{success: boolean, signatures: string[]}>} Result of the operation
 */
export const airdropTokenToMultipleRecipients = async (
  tokenMintAddress,
  recipients,
  amount,
  rpcUrl = 'https://api.mainnet-beta.solana.com'
) => {
  try {
    if (!checkWalletAvailable() || !window.solana.isConnected) {
      throw new Error('Wallet not connected');
    }
    
    // Connect to the Solana cluster
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Convert the mint address string to a public key
    const mintPublicKey = new PublicKey(tokenMintAddress);
    
    // Get the token account of the wallet
    const senderPublicKey = window.solana.publicKey;
    const senderTokenAddress = await getAssociatedTokenAddress(
      mintPublicKey,
      senderPublicKey
    );
    
    // Check token balance
    const tokenInfo = await connection.getTokenAccountBalance(senderTokenAddress);
    const balance = Number(tokenInfo.value.amount);
    const totalNeeded = amount * recipients.length;
    
    if (balance < totalNeeded) {
      throw new Error(`Insufficient token balance. Have: ${balance}, Need: ${totalNeeded}`);
    }
    
    // Process in batches of 5 to avoid transaction size limits
    const batchSize = 5;
    const signatures = [];
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(recipients.length/batchSize)}`);
      
      // Create a new transaction
      const transaction = new Transaction();
      
      // Add instructions for each recipient in this batch
      for (const recipient of batch) {
        const recipientPublicKey = new PublicKey(recipient);
        const recipientTokenAddress = await getAssociatedTokenAddress(
          mintPublicKey,
          recipientPublicKey
        );
        
        // Check if the recipient's token account exists
        const recipientTokenAccount = await connection.getAccountInfo(recipientTokenAddress);
        
        // If the token account doesn't exist, create it
        if (!recipientTokenAccount) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              senderPublicKey,
              recipientTokenAddress,
              recipientPublicKey,
              mintPublicKey,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }
        
        // Add transfer instruction
        transaction.add(
          createTransferInstruction(
            senderTokenAddress,
            recipientTokenAddress,
            senderPublicKey,
            amount,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }
      
      // Get the recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = senderPublicKey;
      
      // Request signature from the user
      try {
        const signed = await window.solana.signAndSendTransaction(transaction);
        signatures.push(signed.signature);
        console.log(`Batch transaction succeeded:`, signed.signature);
      } catch (err) {
        console.error(`Error in batch ${Math.floor(i/batchSize) + 1}:`, err);
        // Continue with the next batch
      }
    }
    
    return {
      success: signatures.length > 0,
      signatures,
    };
  } catch (err) {
    console.error('Error in airdropTokenToMultipleRecipients:', err);
    throw err;
  }
}; 