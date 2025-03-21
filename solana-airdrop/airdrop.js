const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');

/**
 * Airdrops a specified token to multiple recipient wallets
 * 
 * @param {string} tokenMintAddress - The mint address of the token to airdrop
 * @param {string[]} recipientAddresses - Array of recipient wallet addresses
 * @param {number} amount - Amount of tokens to send to each recipient (in smallest units)
 * @param {string} payerKeypairPath - Path to the keypair file for the sender wallet
 * @returns {Promise<string[]>} - Array of transaction signatures
 */
async function airdropTokens(tokenMintAddress, recipientAddresses, amount, payerKeypairPath) {
  try {
    // Load the payer's keypair from a file
    const payerKeypairBuffer = fs.readFileSync(payerKeypairPath);
    const payerKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(payerKeypairBuffer))
    );

    // Connect to the Solana cluster
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );

    console.log(`Connected to Solana cluster. Payer: ${payerKeypair.publicKey.toString()}`);

    // Create the token mint instance
    const tokenMint = new PublicKey(tokenMintAddress);
    const token = new Token(
      connection,
      tokenMint,
      TOKEN_PROGRAM_ID,
      payerKeypair
    );

    // Get the associated token account of the payer
    const payerTokenAccount = await token.getOrCreateAssociatedAccountInfo(
      payerKeypair.publicKey
    );
    
    console.log(`Using payer token account: ${payerTokenAccount.address.toString()}`);

    // Check if payer has enough balance
    const payerBalance = await token.getAccountInfo(payerTokenAccount.address);
    const totalNeeded = amount * recipientAddresses.length;
    
    if (Number(payerBalance.amount) < totalNeeded) {
      throw new Error(`Insufficient token balance. Have: ${payerBalance.amount}, Need: ${totalNeeded}`);
    }

    console.log(`Payer has sufficient balance: ${payerBalance.amount} tokens`);
    console.log(`Airdropping ${amount} tokens to ${recipientAddresses.length} recipients...`);
    
    // Process each recipient in batches to avoid transaction size limits
    const batchSize = 5; // Process 5 transfers per transaction
    const transactionSignatures = [];
    
    for (let i = 0; i < recipientAddresses.length; i += batchSize) {
      const batch = recipientAddresses.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(recipientAddresses.length/batchSize)}`);
      
      // Process this batch
      const batchSignatures = await processBatch(
        connection, token, payerKeypair, payerTokenAccount, batch, amount
      );
      
      transactionSignatures.push(...batchSignatures);
    }
    
    console.log(`Airdrop completed successfully. ${transactionSignatures.length} transactions processed.`);
    return transactionSignatures;
    
  } catch (error) {
    console.error('Error in airdropTokens:', error);
    throw error;
  }
}

/**
 * Process a batch of recipients
 */
async function processBatch(connection, token, payerKeypair, payerTokenAccount, recipients, amount) {
  const signatures = [];
  
  for (const recipient of recipients) {
    try {
      const recipientPublicKey = new PublicKey(recipient);
      
      // Get or create the recipient's associated token account
      const recipientTokenAccount = await token.getOrCreateAssociatedAccountInfo(
        recipientPublicKey
      );
      
      console.log(`Sending ${amount} tokens to ${recipient}`);
      
      // Transfer tokens to the recipient
      const signature = await token.transfer(
        payerTokenAccount.address,
        recipientTokenAccount.address,
        payerKeypair,
        [],
        amount
      );
      
      console.log(`Transfer succeeded: ${signature}`);
      signatures.push(signature);
      
    } catch (error) {
      console.error(`Error sending to ${recipient}:`, error);
      // Continue with the next recipient
    }
  }
  
  return signatures;
}

// Export for use in the API
module.exports = { airdropTokens }; 