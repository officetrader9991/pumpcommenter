const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const { PublicKey } = require('@solana/web3.js');

const app = express();
const PORT = process.env.PORT || 3015;

// Middleware
app.use(express.json());
app.use(cors());

// Basic route to test if server is running
app.get('/', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Helper function to resolve wallet addresses using XPath selectors
async function resolveWallet(profileId, page) {
  try {
    // First check if profileId is already a valid Solana address
    try {
      new PublicKey(profileId);
      return profileId;
    } catch {
      // If not a valid address, we need to visit the profile page
      console.log(`Visiting profile page for: ${profileId}`);
      
      // Construct the profile URL and add the include-nsfw parameter
      const profileUrl = `https://pump.fun/profile/${profileId}?include-nsfw=true`;
      console.log(`Navigating to: ${profileUrl}`);
      
      // Navigate to the profile page with longer timeout
      await page.goto(profileUrl, {
        waitUntil: 'networkidle2', // Change to networkidle2 for better compatibility
        timeout: 60000 // Increase timeout to 60 seconds
      });
      
      // Wait longer for dynamic content to load
      console.log(`Waiting for profile page content to load...`);
      await page.waitForTimeout(5000);
      
      // Take a screenshot of the profile page for debugging
      const screenshotPath = `profile-${profileId}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Saved screenshot to ${screenshotPath}`);
      
      // Log the page HTML for debugging
      const pageContent = await page.content();
      console.log(`Page HTML length: ${pageContent.length} characters`);
      
      // Try multiple methods to extract the wallet address
      const walletAddress = await page.evaluate(() => {
        console.log("Starting wallet extraction...");
        
        // Results collector for debugging
        const results = {
          methods: {},
          errors: []
        };
        
        try {
          // METHOD 1: XPath - Exact path specified by user
          try {
            console.log("Trying XPath method 1...");
            const walletXPath = "/html/body/main/div/div[1]/div[1]/div[2]";
            const walletResult = document.evaluate(
              walletXPath, 
              document, 
              null, 
              XPathResult.FIRST_ORDERED_NODE_TYPE, 
              null
            );
            
            const walletElement = walletResult.singleNodeValue;
            
            if (walletElement) {
              const text = walletElement.textContent.trim();
              results.methods.xpath1 = { found: true, text };
              console.log(`XPath method found: "${text}"`);
              
              const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
              if (match) {
                results.methods.xpath1.walletMatch = match[0];
                return match[0];
              }
              return text; // Return full text if no wallet format detected
            } else {
              results.methods.xpath1 = { found: false };
              console.log("XPath method 1 didn't find an element");
            }
          } catch (e) {
            results.errors.push(`XPath method error: ${e.message}`);
            console.error("Error with XPath method:", e);
          }
          
          // METHOD 2: CSS Selector - Original path
          try {
            console.log("Trying CSS Selector method...");
            const cssWalletElement = document.querySelector("body > main > div > div.mt-8.grid.items-start.justify-items-center.gap-4.p-4.text-white > div.grid.gap-1.text-xs.sm\\:text-base > div.rounded.border.border-slate-600.p-2.text-xs.sm\\:text-sm");
            if (cssWalletElement) {
              const text = cssWalletElement.textContent.trim();
              results.methods.cssSelector = { found: true, text };
              console.log(`CSS Selector method found: "${text}"`);
              
              const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
              if (match) {
                results.methods.cssSelector.walletMatch = match[0];
                return match[0];
              }
              return text;
            } else {
              results.methods.cssSelector = { found: false };
              console.log("CSS Selector method didn't find an element");
            }
          } catch (e) {
            results.errors.push(`CSS Selector method error: ${e.message}`);
            console.error("Error with CSS Selector method:", e);
          }
          
          // METHOD 3: Try simpler XPath approaches
          try {
            console.log("Trying simpler XPath approaches...");
            // Try a more general XPath for wallet address sections
            const walletXPath2 = "//div[contains(@class, 'border-slate-600')]";
            const walletResults = document.evaluate(
              walletXPath2, 
              document, 
              null, 
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
              null
            );
            
            console.log(`Found ${walletResults.snapshotLength} potential wallet elements`);
            
            for (let i = 0; i < walletResults.snapshotLength; i++) {
              const element = walletResults.snapshotItem(i);
              const text = element.textContent.trim();
              
              // Check if this text looks like a wallet
              const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
              if (match) {
                results.methods.xpath2 = { found: true, index: i, text, walletMatch: match[0] };
                console.log(`XPath method 2 found wallet in element ${i}: "${match[0]}"`);
                return match[0];
              }
            }
            
            results.methods.xpath2 = { found: false, count: walletResults.snapshotLength };
          } catch (e) {
            results.errors.push(`XPath method 2 error: ${e.message}`);
            console.error("Error with XPath method 2:", e);
          }
          
          // METHOD 4: Look for any text that looks like a wallet address anywhere on the page
          try {
            console.log("Searching entire page for wallet-like text...");
            const pageText = document.body.innerText;
            const walletMatches = pageText.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
            
            if (walletMatches && walletMatches.length > 0) {
              results.methods.fullPageScan = { found: true, matches: walletMatches };
              console.log(`Found ${walletMatches.length} potential wallet addresses in page text`);
              return walletMatches[0]; // Return the first match
            } else {
              results.methods.fullPageScan = { found: false };
              console.log("No wallet-like strings found in page text");
            }
          } catch (e) {
            results.errors.push(`Full page scan error: ${e.message}`);
            console.error("Error with full page scan:", e);
          }
          
          console.log("All extraction methods failed. Results:", JSON.stringify(results, null, 2));
          return null;
        } catch (e) {
          console.error("Error in wallet extraction:", e);
          return null;
        }
      });
      
      if (walletAddress) {
        console.log(`Found wallet address for ${profileId}: ${walletAddress}`);
        return walletAddress;
      } else {
        console.log(`No wallet address found for ${profileId}`);
        return null;
      }
    }
  } catch (e) {
    console.error(`Error resolving wallet for ${profileId}:`, e);
    return null;
  }
}

// Scrape commenters function
async function scrapeCommenters(url, xpath = null) {
  console.log(`Starting to scrape URL: ${url}`);
  console.log(`Using XPath: ${xpath || 'None provided'}`);
  let browser = null;
  
  try {
    // Launch browser with specific arguments to handle common issues
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    console.log('Browser launched successfully');
    const page = await browser.newPage();
    
    // Set a realistic viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set extra headers to look more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    });

    // Navigate to the URL with a timeout
    console.log('Navigating to page...');
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug.png' });
    console.log('Saved debug screenshot');

    // Wait for content to load and scroll to load all comments
    console.log('Waiting for content and scrolling...');
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if(totalHeight >= scrollHeight){
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Wait additional time for dynamic content
    await page.waitForTimeout(5000); // Increased timeout for more reliable loading

    // Extract commenters with detailed logging
    const commenters = await page.evaluate((xpath) => {
      console.log('Starting comment extraction...');
      const commentersArray = []; // Use array to keep all comments including duplicates
      
      try {
        // If we have an XPath, use it directly
        if (xpath) {
          console.log(`Using provided XPath: ${xpath}`);
          
          // Use XPath to find elements
          const xpathResult = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          console.log(`XPath found ${xpathResult.snapshotLength} elements`);
          
          for (let i = 0; i < xpathResult.snapshotLength; i++) {
            const element = xpathResult.snapshotItem(i);
            try {
              // Process the element based on its structure
              let username = '';
              let profileLink = '';
              
              // If this is a link element
              if (element.tagName === 'A') {
                profileLink = element.getAttribute('href');
                
                // Try to find username
                const spanElement = element.querySelector('span span');
                if (spanElement) {
                  username = spanElement.textContent.trim();
                } else {
                  const altSpan = element.querySelector('span');
                  if (altSpan) {
                    username = altSpan.textContent.trim();
                  } else {
                    username = element.textContent.trim();
                  }
                }
              } 
              // If this might be a comment container
              else {
                // Look for profile link inside
                const linkElement = element.querySelector('a[href^="/profile/"]');
                if (linkElement) {
                  profileLink = linkElement.getAttribute('href');
                  
                  // Try to find username
                  const spanElement = linkElement.querySelector('span span');
                  if (spanElement) {
                    username = spanElement.textContent.trim();
                  } else {
                    const altSpan = linkElement.querySelector('span');
                    if (altSpan) {
                      username = altSpan.textContent.trim();
                    } else {
                      username = linkElement.textContent.trim();
                    }
                  }
                }
              }
              
              // Add to our collection if we found valid data
              if (username && profileLink && profileLink.includes('/profile/')) {
                commentersArray.push({
                  username,
                  profileLink,
                  timestamp: new Date().toISOString(),
                  container: 'xpath-match',
                  index: i
                });
              }
            } catch (e) {
              console.log(`Error processing XPath element ${i}:`, e);
            }
          }
        }
        
        // If XPath didn't yield results or wasn't provided, use our default methods
        if (commentersArray.length === 0) {
          // First attempt: look for comment containers with user profiles
          const commentContainers = document.querySelectorAll('[data-testid="comment-item"]');
          console.log(`Found ${commentContainers.length} comment containers`);
          
          if (commentContainers.length > 0) {
            commentContainers.forEach(container => {
              try {
                // Find the user profile link in this comment
                const profileLink = container.querySelector('a[href^="/profile/"]');
                if (!profileLink) return;
                
                // Extract username
                let username = '';
                const spanElement = profileLink.querySelector('span span');
                if (spanElement) {
                  username = spanElement.textContent.trim();
                } else {
                  const altSpan = profileLink.querySelector('span');
                  if (altSpan) {
                    username = altSpan.textContent.trim();
                  } else {
                    username = profileLink.textContent.trim();
                  }
                }
                
                // Try to get comment text
                let commentText = '';
                const textElement = container.querySelector('[data-testid="comment-text"]');
                if (textElement) {
                  commentText = textElement.textContent.trim();
                }
                
                // Add to our collection
                if (username && profileLink.getAttribute('href')) {
                  commentersArray.push({
                    username,
                    profileLink: profileLink.getAttribute('href'),
                    commentText,
                    timestamp: new Date().toISOString(),
                    container: 'comment-item'
                  });
                }
              } catch (e) {
                console.log('Error processing comment container:', e);
              }
            });
          }
          
          // If the above method didn't find any comments, try alternative methods
          if (commentersArray.length === 0) {
            console.log('Falling back to alternative methods');
            
            // Try to find all user profile links
            const userLinks = document.querySelectorAll('a[href^="/profile/"]');
            console.log(`Found ${userLinks.length} user profile links`);
            
            userLinks.forEach(link => {
              try {
                // Check if this link is likely a comment author (heuristic)
                const isInCommentSection = link.closest('[data-testid="comments-section"]') || 
                                          link.closest('.comments') ||
                                          link.closest('[data-comments]');
                
                if (isInCommentSection) {
                  let username = '';
                  const spanElement = link.querySelector('span span');
                  if (spanElement) {
                    username = spanElement.textContent.trim();
                  } else {
                    const altSpan = link.querySelector('span');
                    if (altSpan) {
                      username = altSpan.textContent.trim();
                    } else {
                      username = link.textContent.trim();
                    }
                  }
                  
                  if (username && !username.includes('...')) {
                    commentersArray.push({
                      username,
                      profileLink: link.getAttribute('href'),
                      timestamp: new Date().toISOString(),
                      container: 'user-link-in-comments'
                    });
                  }
                }
              } catch (e) {
                console.log('Error processing user link:', e);
              }
            });
          }
          
          // Last resort - find all UserPreview components
          if (commentersArray.length === 0) {
            console.log('Trying UserPreview components');
            const userPreviews = document.querySelectorAll('a[data-sentry-component="UserPreview"]');
            console.log(`Found ${userPreviews.length} UserPreview components`);
            
            userPreviews.forEach(preview => {
              try {
                let username = '';
                const spanElement = preview.querySelector('span span');
                if (spanElement) {
                  username = spanElement.textContent.trim();
                } else {
                  const altSpan = preview.querySelector('span');
                  if (altSpan) {
                    username = altSpan.textContent.trim();
                  } else {
                    username = preview.textContent.trim();
                  }
                }
                
                if (username && !username.includes('...')) {
                  commentersArray.push({
                    username,
                    profileLink: preview.getAttribute('href'),
                    timestamp: new Date().toISOString(),
                    container: 'user-preview'
                  });
                }
              } catch (e) {
                console.log('Error processing UserPreview:', e);
              }
            });
          }
        }
        
        console.log(`Successfully found ${commentersArray.length} total comments`);
        return commentersArray;
      } catch (e) {
        console.error('Error during comment extraction:', e);
        return [];
      }
    }, xpath);

    console.log(`Found ${commenters.length} comments:`, commenters);

    // Take another screenshot after extraction
    await page.screenshot({ path: 'after-extraction.png' });
    console.log('Saved post-extraction screenshot');

    // Process commenters to resolve wallet addresses - preserving all entries to maintain count
    // Use a for...of loop instead of Promise.all to avoid race conditions and too many open tabs
    const processedCommenters = [];
    for (const commenter of commenters) {
      const profileId = commenter.profileLink.split('/profile/')[1];
      const wallet = await resolveWallet(profileId, page);
      processedCommenters.push({
        username: commenter.username,
        profileLink: commenter.profileLink,
        wallet
      });
    }
    
    // Close browser
    await browser.close();
    console.log('Browser closed');
    
    return processedCommenters;

  } catch (error) {
    console.error('Error during scraping:', error);
    if (browser) {
      try {
        const page = (await browser.pages())[0];
        if (page) {
          await page.screenshot({ path: 'error.png' });
          console.log('Saved error screenshot');
        }
      } catch (e) {
        console.error('Failed to save error screenshot:', e);
      }
      await browser.close();
      console.log('Browser closed after error');
    }
    throw error;
  }
}

// Routes
app.post('/api/scrape', async (req, res) => {
  const { url, xpath } = req.body;
  
  console.log(`Received scrape request for URL:`, url);
  console.log(`Received XPath:`, xpath || 'None provided');
  
  if (!url || !url.includes('pump.fun')) {
    console.log('Invalid URL received');
    return res.status(400).json({ error: 'Invalid URL. Please provide a valid Pump.fun URL.' });
  }
  
  try {
    const commenters = await scrapeCommenters(url, xpath);
    if (commenters.length === 0) {
      return res.status(404).json({ 
        error: 'No commenters found',
        details: 'Could not find any comments on this page. The page might be loading dynamically or the structure might have changed.'
      });
    }
    res.json(commenters);
  } catch (error) {
    console.error('Scraping failed:', error);
    res.status(500).json({ 
      error: 'Failed to scrape commenters',
      details: error.message
    });
  }
});

app.post('/api/airdrop', async (req, res) => {
  const { recipients, tokenMint } = req.body;
  
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'No valid recipients provided' });
  }
  
  if (!tokenMint) {
    return res.status(400).json({ error: 'Token mint address is required' });
  }
  
  try {
    // Validate each recipient wallet address
    const validRecipients = recipients.filter(wallet => {
      try {
        // Check if the wallet is a valid Solana address
        new PublicKey(wallet);
        return true;
      } catch (err) {
        console.error(`Invalid wallet address: ${wallet}`);
        return false;
      }
    });
    
    if (validRecipients.length === 0) {
      return res.status(400).json({ 
        error: 'No valid recipient wallet addresses provided',
        invalidCount: recipients.length - validRecipients.length
      });
    }
    
    // For now, we return a success response immediately
    // In a real implementation, you would call the airdrop logic here
    // or create a job to process the airdrop
    
    res.json({ 
      success: true, 
      message: 'Airdrop request received successfully',
      recipients: validRecipients.length,
      invalidCount: recipients.length - validRecipients.length,
      tokenMint,
      task: 'The airdrop will be performed using the connected wallet in the frontend'
    });
  } catch (error) {
    console.error('Airdrop request failed:', error);
    res.status(500).json({ error: 'Failed to process airdrop request', details: error.message });
  }
});

// Endpoint to request SOL from multiple external faucets
app.post('/api/request-sol', async (req, res) => {
  const { wallet } = req.body;
  
  if (!wallet) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }
  
  try {
    // Validate wallet address
    try {
      new PublicKey(wallet);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    
    // Try to request SOL from multiple faucets
    const faucets = [
      {
        name: 'Solana Official Faucet',
        url: 'https://faucet.solana.com/api/request',
        method: 'direct',
      },
      {
        name: 'QuickNode Faucet',
        url: 'https://faucet.quicknode.com/solana/devnet',
        method: 'proxy',
      }
    ];
    
    let success = false;
    let message = '';
    
    // For now, we'll just return a message and let the frontend handle the request
    // because most faucets require captcha validation
    
    return res.json({
      success: true,
      message: 'Please follow the captcha instructions in the newly opened tab to receive SOL.',
      faucets: faucets.map(f => f.name),
      wallet,
      network: 'devnet'
    });
    
  } catch (error) {
    console.error('SOL request failed:', error);
    res.status(500).json({ 
      error: 'Failed to request SOL',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test the server: http://localhost:${PORT}`);
}); 