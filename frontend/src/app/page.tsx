'use client';

import { useState, useEffect } from 'react';
import InputForm from '../components/InputForm';
import CommenterList from '../components/CommenterList';
import axios from 'axios';

// Add imports for web3 and wallet functionality
import {
  PublicKey,
  Transaction,
  Connection,
  Keypair,
  SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  createInitializeMintInstruction,
  createMintToInstruction,
} from '@solana/spl-token';

// Define types for Phantom provider
type PhantomEvent = "disconnect" | "connect" | "accountChanged";

interface ConnectOpts {
    onlyIfTrusted: boolean;
}

interface PhantomProvider {
    connect: (opts?: Partial<ConnectOpts>) => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => Promise<void>;
    on: (event: PhantomEvent, callback: (args: any) => void) => void;
    isPhantom: boolean;
    isConnected: boolean;
    publicKey: PublicKey;
    signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
}

type WindowWithSolana = Window & {
    solana?: PhantomProvider;
}

// Define types for the commenters data
interface Commenter {
  username: string;
  profileLink: string;
  wallet: string | null;
  isDev?: boolean;
  commentCount: number;
  tokenBalance: number | null;
  isLoadingBalance: boolean;
}

export default function Home() {
  const [commenters, setCommenters] = useState<Commenter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAirdropping, setIsAirdropping] = useState(false);
  const [tokenMint, setTokenMint] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [includeDev, setIncludeDev] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isPhantomInstalled, setIsPhantomInstalled] = useState<boolean>(false);
  const [airdropAmount, setAirdropAmount] = useState<number>(1); // Default to 1 token
  const [airdropStatus, setAirdropStatus] = useState<string>(''); 
  const [showAirdropConfig, setShowAirdropConfig] = useState<boolean>(false);
  const [airdropTxSignatures, setAirdropTxSignatures] = useState<string[]>([]);
  const [testTokenMint, setTestTokenMint] = useState<string>('');
  const [isCreatingToken, setIsCreatingToken] = useState<boolean>(false);
  const [useCommentMultiplier, setUseCommentMultiplier] = useState<boolean>(false);
  const [commentMultiplier, setCommentMultiplier] = useState<number>(1);
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState<number>(0);

  // Array of professional loading messages
  const loadingMessages = [
    "Fetching wallet data may take approximately 2 minutes. Thank you for your patience.",
    "Processing all comments and wallet addresses. This may take a moment.",
    "Analyzing token activity. Popular tokens with many comments require additional processing time.",
    "Retrieving commenter information. The more engagement your token has, the longer this process takes.",
    "Collecting wallet addresses from all commenters. Please wait while we ensure accuracy.",
    "Compiling commenter data for airdrop preparation. This thorough process ensures all eligible wallets are included.",
    "Organizing token distribution data. Thank you for your patience during this important step.",
    "Scanning all comments to identify unique wallet addresses. This comprehensive process ensures no one is missed."
  ];

  // Rotate loading messages every 10 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isLoading) {
      interval = setInterval(() => {
        setCurrentLoadingMessage(prev => (prev + 1) % loadingMessages.length);
      }, 10000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, loadingMessages.length]);

  // Check if Phantom is installed
  useEffect(() => {
    const provider = (window as WindowWithSolana).solana;
    setIsPhantomInstalled(provider?.isPhantom || false);
  }, []);

  // Connect to Phantom wallet
  const connectWallet = async () => {
    try {
      const provider = (window as WindowWithSolana).solana;
      if (provider?.isPhantom) {
        const response = await provider.connect();
        const address = response.publicKey.toString();
        setWalletAddress(address);
        setSuccess('Wallet connected successfully!');
      } else {
        window.open('https://phantom.com/', '_blank');
      }
    } catch (error) {
      console.error('Error connecting to wallet:', error);
      setError('Failed to connect wallet. Please try again.');
    }
  };

  // Disconnect from Phantom wallet
  const disconnectWallet = async () => {
    try {
      const provider = (window as WindowWithSolana).solana;
      if (provider?.isPhantom) {
        await provider.disconnect();
        setWalletAddress('');
        setSuccess('Wallet disconnected successfully!');
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      setError('Failed to disconnect wallet. Please try again.');
    }
  };

  // Request a devnet SOL airdrop for testing
  const requestDevnetSol = async () => {
    try {
      const provider = (window as WindowWithSolana).solana;
      if (!provider?.isPhantom || !provider.isConnected) {
        throw new Error('Please connect your wallet first');
      }
      
      setError('');
      setSuccess('');
      setAirdropStatus('Checking your SOL balance...');
      
      // List of fallback RPC endpoints - using PublicNode as primary
      const rpcEndpoints = [
        'https://solana-rpc.publicnode.com', // PublicNode free RPC - primary
        'https://solana-mainnet.g.alchemy.com/v2/demo', // Alchemy demo endpoint
        'https://mainnet.helius-rpc.com/?api-key=1d8740dc-e5f4-421c-b823-e1bad1889eff', // Helius demo endpoint
        'https://api.mainnet-beta.solana.com',
        'https://rpc.ankr.com/solana',
      ];
      
      const publicKey = provider.publicKey;
      
      // Try each endpoint until successful
      for (const endpoint of rpcEndpoints) {
        try {
          const endpointName = endpoint.includes('publicnode') ? 'PublicNode' : 
                              endpoint.split('?')[0].split('/v2')[0];
          setAirdropStatus(`Connecting to ${endpointName}...`);
          const connection = new Connection(endpoint, 'confirmed');
          
          // Check the balance
          const balance = await connection.getBalance(publicKey);
          const solBalance = balance / 1_000_000_000;
          
          setSuccess(`Your mainnet SOL balance is ${solBalance.toFixed(4)} SOL. Use the "Buy SOL" button to purchase SOL from an exchange.`);
          return;
        } catch (err) {
          console.error(`Error checking balance with ${endpoint}:`, err);
          // Continue to the next endpoint
        }
      }
      
      throw new Error('Failed to check your SOL balance. Please try again later or visit https://coinbase.com or https://binance.com to purchase SOL.');
    } catch (error: any) {
      console.error('Error checking mainnet SOL:', error);
      setError(`${error.message}`);
    } finally {
      setAirdropStatus('');
    }
  };

  // Request SOL from an external faucet
  const requestExternalDevnetSol = async () => {
    try {
      const provider = (window as WindowWithSolana).solana;
      if (!provider?.isPhantom || !provider.isConnected) {
        throw new Error('Please connect your wallet first');
      }
      
      setError('');
      setSuccess('');
      
      const walletAddress = provider.publicKey.toString();
      
      // Show options to get SOL
      setAirdropStatus('Opening options to get SOL...');
      
      // Create options for the user
      const coinbaseUrl = 'https://www.coinbase.com/price/solana';
      const binanceUrl = 'https://www.binance.com/en/price/solana';
      const phantomSwapUrl = `https://phantom.app/ul/swap`;
      
      // Determine which option to open based on user choice
      // For simplicity, we'll just open Phantom's built-in swap interface
      window.open(phantomSwapUrl, '_blank');
      
      setSuccess(`Opened Phantom's swap interface in a new tab. You can purchase SOL directly in your wallet.`);
    } catch (error: any) {
      console.error('Error opening SOL purchase options:', error);
      setError(`Failed to open SOL purchase options: ${error.message}`);
    } finally {
      setAirdropStatus('');
    }
  };

  const handleSubmit = async (url: string) => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      console.log("Submitting URL:", url);
      
      // Make sure the URL has the proper format
      let formattedUrl = url;
      if (!url.startsWith('http')) {
        formattedUrl = `https://${url}`;
      }
      
      const backendPort = 3015; // Ensure this matches your backend port
      const response = await axios.post(`http://localhost:${backendPort}/api/scrape`, { 
        url: formattedUrl
      });
      
      if (response.data && Array.isArray(response.data)) {
        console.log("Received raw commenters data:", response.data);
        // Log the length to check how many comments we're getting
        console.log(`Total raw comments: ${response.data.length}`);
        
        // First, group all comments by profile link
        const commentsByProfile: {[key: string]: any[]} = {};
        response.data.forEach((comment: any) => {
          const profileLink = comment.profileLink;
          if (!commentsByProfile[profileLink]) {
            commentsByProfile[profileLink] = [];
          }
          commentsByProfile[profileLink].push(comment);
        });
        
        console.log("Comments grouped by profile:", commentsByProfile);
        Object.entries(commentsByProfile).forEach(([profileLink, comments]) => {
          console.log(`Profile ${profileLink}: ${comments.length} comments`);
        });
        
        // Then process each profile to create a unique commenter with the correct count
        const uniqueCommenters: Commenter[] = Object.entries(commentsByProfile).map(([profileLink, comments]) => {
          // Find if any of the comments have a dev username
          const devComment = comments.find(c => 
            c.username.toLowerCase().includes('(dev)')
          );
          
          // Prefer the dev username if it exists
          const representativeComment = devComment || comments[0];
          
          // Get all the wallets for this profile (should be the same, but just in case)
          const wallets = comments.map(c => c.wallet).filter(w => w);
          const wallet = wallets.length > 0 ? wallets[0] : null;
          
          return {
            username: representativeComment.username,
            profileLink,
            wallet,
            isDev: representativeComment.username.toLowerCase().includes('(dev)'),
            commentCount: comments.length,
            tokenBalance: null,
            isLoadingBalance: false
          };
        });
        
        console.log("Processed unique commenters with counts:", uniqueCommenters);
        setCommenters(uniqueCommenters);
        
        // Extract token mint from URL if possible
        try {
          const urlObj = new URL(formattedUrl);
          const pathParts = urlObj.pathname.split('/');
          if (pathParts.length > 2 && pathParts[1] === 'coin') {
            setTokenMint(pathParts[2]);
          }
        } catch (parseError) {
          console.error("Error parsing URL:", parseError);
          // Use the last part of the URL as a fallback
          const parts = formattedUrl.split('/');
          if (parts.length > 0) {
            setTokenMint(parts[parts.length - 1]);
          }
        }
        
        // Show success message if we got commenters
        const visibleCommenters = uniqueCommenters.filter(c => includeDev || !c.isDev);
        if (visibleCommenters.length > 0) {
          const totalComments = response.data.length;
          setSuccess(`Successfully found ${visibleCommenters.length} unique commenters with a total of ${totalComments} comments!`);
        } else {
          setSuccess("No commenters found for this token.");
        }
      } else {
        throw new Error("Invalid response format from server");
      }
    } catch (err: any) {
      console.error('Error fetching commenters:', err);
      
      // Format error message for display
      let errorMessage = 'Failed to fetch commenters. ';
      if (err.code === 'ECONNREFUSED' || err.message.includes('Network Error')) {
        errorMessage += 'Cannot connect to the server. Please make sure the backend server is running.';
      } else if (err.response?.data?.error) {
        errorMessage += err.response.data.error;
      } else if (err.message) {
        errorMessage += err.message;
      }
      
      setError(errorMessage);
      setCommenters([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to check token balances for commenters
  const checkTokenBalances = async (walletAddresses: string[] = [], showLoadingState = true) => {
    if (!tokenMint) {
      setError('Token mint address not available');
      return;
    }
    
    try {
      // Show loading state for selected wallets
      if (showLoadingState) {
        setCommenters(prev => prev.map(commenter => {
          if (walletAddresses.length === 0 || (commenter.wallet && walletAddresses.includes(commenter.wallet))) {
            return { ...commenter, isLoadingBalance: true };
          }
          return commenter;
        }));
      }
      
      // Use the connected wallet provider
      const provider = (window as WindowWithSolana).solana;
      if (!provider?.isPhantom) {
        throw new Error('Phantom wallet is not connected');
      }
      
      // List of fallback RPC endpoints
      const rpcEndpoints = [
        'https://solana-rpc.publicnode.com', // PublicNode free RPC - primary
        'https://api.mainnet-beta.solana.com',
        'https://solana-api.projectserum.com',
        'https://rpc.ankr.com/solana',
      ];
      
      // Convert the token mint address to a PublicKey
      const mintPublicKey = new PublicKey(tokenMint);
      
      // Try each endpoint until successful
      let success = false;
      
      for (const endpoint of rpcEndpoints) {
        if (success) break;
        
        try {
          console.log(`Checking balances using ${endpoint}...`);
          const connection = new Connection(endpoint, 'confirmed');
          
          // Create an updated copy of commenters
          const updatedCommenters = [...commenters];
          
          // For each commenter with a wallet
          for (let i = 0; i < updatedCommenters.length; i++) {
            const commenter = updatedCommenters[i];
            
            // Skip if wallet is null or not in the target list (if specified)
            if (!commenter.wallet || (walletAddresses.length > 0 && !walletAddresses.includes(commenter.wallet))) {
              continue;
            }
            
            try {
              const walletPublicKey = new PublicKey(commenter.wallet);
              
              // Get the token account address
              const tokenAddress = await getAssociatedTokenAddress(
                mintPublicKey,
                walletPublicKey
              );
              
              try {
                // Try to get the token account info
                const tokenInfo = await connection.getTokenAccountBalance(tokenAddress);
                const balance = Number(tokenInfo.value.amount) / Math.pow(10, tokenInfo.value.decimals);
                
                // Update the commenter with their token balance
                updatedCommenters[i] = {
                  ...commenter,
                  tokenBalance: balance,
                  isLoadingBalance: false
                };
              } catch (err) {
                // If account doesn't exist, set balance to 0
                updatedCommenters[i] = {
                  ...commenter,
                  tokenBalance: 0,
                  isLoadingBalance: false
                };
              }
            } catch (err) {
              console.error(`Error checking balance for ${commenter.wallet}:`, err);
              updatedCommenters[i] = {
                ...commenter,
                tokenBalance: null,
                isLoadingBalance: false
              };
            }
          }
          
          // Update state with all the new balances
          setCommenters(updatedCommenters);
          success = true;
          break;
        } catch (err) {
          console.error(`Error with endpoint ${endpoint}:`, err);
        }
      }
      
      if (!success) {
        throw new Error('Failed to check token balances with any of the available RPC endpoints');
      }
      
    } catch (error: any) {
      console.error('Error checking token balances:', error);
      setError(`Error checking token balances: ${error.message}`);
      
      // Reset loading state
      setCommenters(prev => prev.map(commenter => ({
        ...commenter,
        isLoadingBalance: false
      })));
    }
  };

  const handleAirdrop = async (selectedWallets: string[]) => {
    if (selectedWallets.length === 0 || !walletAddress) {
      setError('You must connect your wallet and select recipients to airdrop');
      return;
    }
    
    setIsAirdropping(true);
    setError('');
    setSuccess('');
    setAirdropStatus('Preparing airdrop...');
    setAirdropTxSignatures([]);
    
    try {
      if (!tokenMint) {
        throw new Error('Token mint address not available');
      }
      
      // Validate token mint address
      try {
        new PublicKey(tokenMint);
      } catch (err) {
        throw new Error('Invalid token mint address');
      }
      
      // First call the backend to validate the request
      const backendPort = 3015;
      const response = await axios.post(`http://localhost:${backendPort}/api/airdrop`, {
        recipients: selectedWallets,
        tokenMint
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Backend validation failed');
      }
      
      setAirdropStatus('Connecting to Solana...');
      
      // Use the connected wallet to perform the airdrop
      const provider = (window as WindowWithSolana).solana;
      if (!provider?.isPhantom) {
        throw new Error('Phantom wallet is not connected');
      }
      
      // List of fallback RPC endpoints
      const rpcEndpoints = [
        'https://solana-rpc.publicnode.com', // PublicNode free RPC - primary
        'https://api.mainnet-beta.solana.com',
        'https://solana-api.projectserum.com',
        'https://rpc.ankr.com/solana',
      ];
      
      // Try each endpoint until successful
      const publicKey = provider.publicKey;
      let success = false;
      let lastError;
      
      for (const endpoint of rpcEndpoints) {
        if (success) break;
        
        try {
          setAirdropStatus(`Connecting to ${endpoint}...`);
          const connection = new Connection(endpoint, 'confirmed');
          
          // Convert the token mint address to a PublicKey
          const mintPublicKey = new PublicKey(tokenMint);
          
          // Get the token account of the sender
          setAirdropStatus('Finding your token account...');
          const senderPublicKey = provider.publicKey;
          const senderTokenAddress = await getAssociatedTokenAddress(
            mintPublicKey,
            senderPublicKey
          );
          
          // Check token balance
          setAirdropStatus('Checking your token balance...');
          const tokenInfo = await connection.getTokenAccountBalance(senderTokenAddress);
          const balance = Number(tokenInfo.value.amount);
          const decimals = tokenInfo.value.decimals;
          
          // Calculate total tokens needed with multiplier if enabled
          let totalNeeded = 0;
          
          // Get the selected commenters from all commenters
          const selectedCommenters = commenters.filter(c => selectedWallets.includes(c.wallet || ''));
          
          // Calculate how many tokens each recipient will get and the total
          if (useCommentMultiplier) {
            totalNeeded = selectedCommenters.reduce((sum, commenter) => {
              const amount = Math.floor(airdropAmount * commentMultiplier * commenter.commentCount * Math.pow(10, decimals));
              return sum + amount;
            }, 0);
            setAirdropStatus(`Using comment multiplier: ${commentMultiplier}x per comment`);
          } else {
            // Standard fixed amount per wallet
            const amountInSmallestUnits = Math.floor(airdropAmount * Math.pow(10, decimals));
            totalNeeded = amountInSmallestUnits * selectedWallets.length;
          }
          
          if (balance < totalNeeded) {
            throw new Error(`Insufficient token balance. You have ${balance / Math.pow(10, decimals)} tokens, need ${totalNeeded / Math.pow(10, decimals)}`);
          }
          
          // Process in batches of 5 to avoid transaction size limits
          const batchSize = 5;
          const signatures: string[] = [];
          
          // Map recipients to their comment counts for multiplier calculations
          const recipientCommentCounts: {[key: string]: number} = {};
          if (useCommentMultiplier) {
            selectedCommenters.forEach(commenter => {
              if (commenter.wallet) {
                recipientCommentCounts[commenter.wallet] = commenter.commentCount;
              }
            });
          }
          
          // Process recipients in batches
          const batches: string[][] = [];
          for (let i = 0; i < selectedWallets.length; i += batchSize) {
            batches.push(selectedWallets.slice(i, i + batchSize));
          }
          
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            const batchNumber = batchIndex + 1;
            const totalBatches = batches.length;
            
            setAirdropStatus(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} recipients)`);
            
            // Create a new transaction
            const transaction = new Transaction();
            
            // Add instructions for each recipient in this batch
            for (const recipient of batch) {
              try {
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
                
                // Calculate amount for this recipient
                let recipientAmount = Math.floor(airdropAmount * Math.pow(10, decimals));
                
                // If using comment multiplier, adjust the amount based on comment count
                if (useCommentMultiplier && recipientCommentCounts[recipient]) {
                  const commentCount = recipientCommentCounts[recipient];
                  recipientAmount = Math.floor(airdropAmount * commentMultiplier * commentCount * Math.pow(10, decimals));
                }
                
                // Add transfer instruction
                transaction.add(
                  createTransferInstruction(
                    senderTokenAddress,
                    recipientTokenAddress,
                    senderPublicKey,
                    recipientAmount,
                    [],
                    TOKEN_PROGRAM_ID
                  )
                );
              } catch (err) {
                console.error(`Error preparing transaction for ${recipient}:`, err);
                // Continue with other recipients
              }
            }
            
            if (transaction.instructions.length > 0) {
              // Get the recent blockhash
              const { blockhash } = await connection.getLatestBlockhash();
              transaction.recentBlockhash = blockhash;
              transaction.feePayer = senderPublicKey;
              
              try {
                // Request signature from the user
                setAirdropStatus(`Please confirm transaction ${batchNumber}/${totalBatches} in your wallet...`);
                const signed = await provider.signAndSendTransaction(transaction);
                
                signatures.push(signed.signature);
                setAirdropTxSignatures(prev => [...prev, signed.signature]);
                
                // Wait for confirmation
                setAirdropStatus(`Confirming transaction ${batchNumber}/${totalBatches}...`);
                const confirmation = await connection.confirmTransaction(signed.signature, 'confirmed');
                
                if (confirmation.value.err) {
                  console.error(`Transaction ${batchNumber} error:`, confirmation.value.err);
                } else {
                  console.log(`Batch ${batchNumber} transaction confirmed:`, signed.signature);
                }
              } catch (err) {
                console.error(`Error in batch ${batchNumber}:`, err);
                // Continue with the next batch
              }
            }
          }
          
          if (signatures.length > 0) {
            const successMessage = useCommentMultiplier 
              ? `Successfully airdropped tokens to ${selectedWallets.length} recipients with a ${commentMultiplier}x comment multiplier!` 
              : `Successfully airdropped ${airdropAmount} tokens to ${selectedWallets.length} recipients!`;
            
            setSuccess(successMessage);
            success = true;
            break;
          } else {
            throw new Error('No transactions were completed successfully');
          }
        } catch (err: any) {
          console.error(`Error with endpoint ${endpoint}:`, err);
          lastError = err;
        }
      }
      
      if (!success) {
        throw new Error(`All airdrop attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Airdrop failed:', err);
      let errorMessage = 'Airdrop failed. ';
      if (err.code === 'ECONNREFUSED' || err.message.includes('Network Error')) {
        errorMessage += 'Cannot connect to the server. Please make sure the backend server is running.';
      } else if (err.response?.data?.error) {
        errorMessage += err.response.data.error;
      } else if (err.message) {
        errorMessage += err.message;
      }
      setError(errorMessage);
    } finally {
      setIsAirdropping(false);
      setAirdropStatus('');
    }
  };

  // Create a test token on devnet for airdrop testing
  const createTestToken = async () => {
    try {
      const provider = (window as WindowWithSolana).solana;
      if (!provider?.isPhantom || !provider.isConnected) {
        throw new Error('Please connect your wallet first');
      }
      
      setError('');
      setSuccess('');
      setIsCreatingToken(true);
      
      // List of fallback RPC endpoints
      const rpcEndpoints = [
        'https://solana-rpc.publicnode.com', // PublicNode free RPC - primary
        'https://api.mainnet-beta.solana.com',
        'https://solana-api.projectserum.com', 
        'https://rpc.ankr.com/solana',
      ];
      
      // Try each endpoint until successful
      const publicKey = provider.publicKey;
      let success = false;
      let lastError;
      
      for (const endpoint of rpcEndpoints) {
        if (success) break;
        
        try {
          setAirdropStatus(`Connecting to ${endpoint}...`);
          const connection = new Connection(endpoint, 'confirmed');
          
          // Check if user has enough SOL for the transaction
          const balance = await connection.getBalance(publicKey);
          if (balance < 10000000) { // 0.01 SOL minimum
            throw new Error('Insufficient SOL balance. Please get SOL from an exchange first.');
          }
          
          // Request signature for creating a token
          setAirdropStatus('Creating your token on mainnet...');
          
          // Setup for token creation - we need to create a transaction
          const lamports = await connection.getMinimumBalanceForRentExemption(82);
          const transaction = new Transaction();
          
          // Create a random keypair for the mint
          const keypair = Keypair.generate();
          
          // Add create mint instruction
          transaction.add(
            SystemProgram.createAccount({
              fromPubkey: publicKey,
              newAccountPubkey: keypair.publicKey,
              space: 82, // Mint account size
              lamports,
              programId: TOKEN_PROGRAM_ID,
            })
          );

          const decimals = 9; // Standard for most tokens
          
          // Initialize mint instruction
          transaction.add(
            createInitializeMintInstruction(
              keypair.publicKey,
              decimals,
              publicKey,
              publicKey,
              TOKEN_PROGRAM_ID
            )
          );
          
          // Get recent blockhash
          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = publicKey;
          
          // Get user to sign the transaction
          setAirdropStatus('Please approve the transaction to create a token...');
          
          // Partial sign with the mint keypair
          transaction.partialSign(keypair);
          
          // Request user signature
          const signed = await provider.signAndSendTransaction(transaction);
          
          // Wait for confirmation
          await connection.confirmTransaction(signed.signature, 'confirmed');
          
          // Save the token mint address
          const mintAddress = keypair.publicKey.toString();
          setTestTokenMint(mintAddress);
          setTokenMint(mintAddress); // Also set as the current token for the form
          
          // Now create a token account for the user and mint some tokens
          setAirdropStatus('Creating your token account and minting tokens...');
          
          // Get or create the associated token account
          const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            {
              publicKey,
              signTransaction: async (tx: Transaction) => {
                tx.feePayer = publicKey;
                const { blockhash } = await connection.getLatestBlockhash();
                tx.recentBlockhash = blockhash;
                
                const signedTx = await provider.signAndSendTransaction(tx);
                await connection.confirmTransaction(signedTx.signature, 'confirmed');
                return tx;
              }
            } as any, // Type casting to work with the provider
            keypair.publicKey,
            publicKey,
            true
          );
          
          // Mint 1000 tokens to the user
          const mintAmount = 1000 * Math.pow(10, decimals);
          
          // Create mint transaction
          const mintTx = new Transaction();
          
          mintTx.add(
            createMintToInstruction(
              keypair.publicKey,
              tokenAccount.address,
              publicKey,
              mintAmount,
              [],
              TOKEN_PROGRAM_ID
            )
          );
          
          // Get recent blockhash
          const { blockhash: mintBlockhash } = await connection.getLatestBlockhash();
          mintTx.recentBlockhash = mintBlockhash;
          mintTx.feePayer = publicKey;
          
          // Partial sign with the mint keypair
          mintTx.partialSign(keypair);
          
          // Request user signature for minting
          setAirdropStatus('Please approve the transaction to mint tokens...');
          const mintSigned = await provider.signAndSendTransaction(mintTx);
          
          // Wait for confirmation
          await connection.confirmTransaction(mintSigned.signature, 'confirmed');
          
          setSuccess(`Successfully created token ${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)} on mainnet with 1000 tokens! You can now use this for airdropping.`);
          
          // If we got here, the token creation was successful
          success = true;
          break;
        } catch (err: any) {
          console.error(`Error with endpoint ${endpoint}:`, err);
          lastError = err;
        }
      }
      
      if (!success) {
        throw new Error(`All token creation attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error creating token:', error);
      setError(`Failed to create token: ${error.message}`);
    } finally {
      setIsCreatingToken(false);
      setAirdropStatus('');
    }
  };

  // Filter commenters based on includeDev setting
  const visibleCommenters = commenters.filter(c => includeDev || !c.isDev);

  // Add an effect to check balances when commenters are loaded
  useEffect(() => {
    // Only check if we have commenters, a token mint, and a connected wallet
    if (commenters.length > 0 && tokenMint && walletAddress) {
      // Check token balances automatically when commenters are loaded
      checkTokenBalances([], false); // false = don't show loading state to avoid flickering
    }
  }, [commenters, tokenMint, walletAddress]);

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-gray-100">
      <div className="w-full max-w-4xl relative">
        {/* Wallet Connection Button */}
        <div className="absolute top-0 right-0">
          {!walletAddress ? (
            <button
              onClick={!isPhantomInstalled ? () => window.open('https://phantom.com/', '_blank') : connectWallet}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded flex items-center space-x-2"
            >
              {!isPhantomInstalled ? (
                <span>Install Phantom</span>
              ) : (
                <>
                  <img src="/phantom.svg" alt="Phantom" className="w-5 h-5" />
                  <span>Connect Wallet</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {`${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`}
              </span>
              <button
                onClick={disconnectWallet}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {walletAddress && (
          <div className="absolute top-12 right-0 mt-2">
            <button
              onClick={requestDevnetSol}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded text-sm"
            >
              Check SOL Balance
            </button>
          </div>
        )}

        {/* Add info box about purchasing SOL */}
        <div className="mt-24 mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          <h3 className="font-medium text-blue-800 mb-2">💡 Working with Real Solana</h3>
          <p className="text-gray-700 mb-2">
            This app is configured to use the <span className="font-semibold">Solana Mainnet</span>, which requires real SOL for transactions. 
          </p>
          <p className="text-gray-700">
            You'll need SOL to create tokens and process airdrops. You can purchase SOL from exchanges like
            <a href="https://www.coinbase.com/price/solana" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mx-1">Coinbase</a>or
            <a href="https://www.binance.com/en/price/solana" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mx-1">Binance</a>.
          </p>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">PumpFun Airdrop Tool</h1>
          <p className="text-gray-600">Airdrop tokens to users who commented on your Pump.fun token</p>
        </div>
        
        <InputForm onSubmit={handleSubmit} isLoading={isLoading} />
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
            <p>{error}</p>
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
            <p>{success}</p>
          </div>
        )}
        
        {tokenMint && commenters.length > 0 && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-600">Token Mint: <span className="font-mono">{tokenMint}</span></p>
              <button
                onClick={() => setShowAirdropConfig(!showAirdropConfig)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showAirdropConfig ? 'Hide Airdrop Settings' : 'Configure Airdrop'}
              </button>
            </div>
            
            {showAirdropConfig && (
              <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base amount per recipient:
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="number"
                      value={airdropAmount}
                      onChange={(e) => setAirdropAmount(Number(e.target.value))}
                      min="0.000001"
                      step="0.000001"
                      className="p-2 border rounded w-32 text-sm"
                    />
                    <span className="text-sm self-center">tokens</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    This is the base amount of tokens each selected wallet will receive.
                  </p>
                </div>
                
                <div className="border-t border-gray-200 pt-3 mb-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCommentMultiplier}
                      onChange={(e) => setUseCommentMultiplier(e.target.checked)}
                      className="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span>Enable comment multiplier</span>
                  </label>
                  
                  {useCommentMultiplier && (
                    <div className="pl-6 mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Multiplier per comment:
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          value={commentMultiplier}
                          onChange={(e) => setCommentMultiplier(Number(e.target.value))}
                          min="0.1"
                          step="0.1"
                          className="p-2 border rounded w-24 text-sm"
                        />
                        <span className="text-sm">x</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Formula: {airdropAmount} × {commentMultiplier} × comment count = tokens per recipient
                      </p>
                      <div className="bg-blue-50 p-2 rounded mt-2 text-xs text-blue-800">
                        <p className="font-medium">Example calculation:</p>
                        <ul className="list-disc pl-4 mt-1 space-y-1">
                          <li>User with 1 comment: {(airdropAmount * commentMultiplier * 1).toFixed(2)} tokens</li>
                          <li>User with 3 comments: {(airdropAmount * commentMultiplier * 3).toFixed(2)} tokens</li>
                          <li>User with 5 comments: {(airdropAmount * commentMultiplier * 5).toFixed(2)} tokens</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {testTokenMint && (
          <div className="my-4 p-4 bg-purple-50 border border-purple-200 rounded">
            <h3 className="font-medium text-purple-800 mb-2">Test Token Info:</h3>
            <p className="text-sm">
              <span className="font-semibold">Mint Address:</span> <span className="font-mono text-xs break-all">{testTokenMint}</span>
            </p>
            <p className="text-sm mt-1">
              <span className="font-semibold">Network:</span> Solana Mainnet
            </p>
            <p className="text-sm mt-1">
              <span className="font-semibold">Initial Supply:</span> 1,000 tokens
            </p>
            <p className="text-xs mt-2 text-gray-600">
              This is a test token on mainnet for demonstration purposes only.
            </p>
          </div>
        )}

        {airdropStatus && (
          <div className="my-4 p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-700">
            <div className="flex items-center">
              <div className="mr-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              </div>
              <p>{airdropStatus}</p>
            </div>
          </div>
        )}
        
        {airdropTxSignatures.length > 0 && (
          <div className="my-4 p-4 bg-green-50 border border-green-200 rounded">
            <h3 className="font-medium text-green-800 mb-2">Transaction Signatures:</h3>
            <ul className="text-xs space-y-1 font-mono max-h-32 overflow-y-auto">
              {airdropTxSignatures.map((sig, i) => (
                <li key={i}>
                  <a 
                    href={`https://solscan.io/tx/${sig}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {sig}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {commenters.length > 0 && (
          <div className="mb-4 flex items-center justify-end">
            <label className="flex items-center space-x-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={includeDev}
                onChange={(e) => setIncludeDev(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600"
              />
              <span>Include dev accounts</span>
            </label>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-6"></div>
            <div className="text-center max-w-md">
              <p className="text-gray-700 mb-2 font-medium">Processing Request</p>
              <p className="text-gray-600 text-sm transition-opacity duration-500 ease-in-out">
                {loadingMessages[currentLoadingMessage]}
              </p>
            </div>
          </div>
        ) : (
          <CommenterList 
            commenters={visibleCommenters}
            onAirdrop={handleAirdrop}
            isAirdropping={isAirdropping}
            checkBalances={checkTokenBalances}
            tokenMint={tokenMint}
          />
        )}
      </div>
    </main>
  );
}
