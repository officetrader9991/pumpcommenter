// Serverless function entry point for Vercel
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const { PublicKey } = require('@solana/web3.js');
const serverless = require('serverless-http');

const app = express();

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

    // Wait for content to load
    console.log('Waiting for content and scrolling...');
    await page.waitForTimeout(3000);

    // Scroll down multiple times to load all dynamic content
    console.log('Scrolling to load all comments...');
    
    // Scroll down the page multiple times to load all comments
    const scrollCount = 10;
    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      // Wait a bit after each scroll to allow content to load
      await page.waitForTimeout(1000);
      console.log(`Scroll ${i + 1}/${scrollCount} complete`);
    }

    // Take a screenshot after scrolling
    await page.screenshot({ path: 'after-extraction.png' });
    console.log('Saved after-extraction screenshot');

    // Extract commenters
    console.log('Extracting commenters...');
    
    let commenters;
    
    if (xpath) {
      // Use provided XPath
      commenters = await page.evaluate((xpath) => {
        const results = [];
        const commentNodes = document.evaluate(
          xpath, 
          document, 
          null, 
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
          null
        );
        
        console.log(`Found ${commentNodes.snapshotLength} comment nodes using XPath`);
        
        for (let i = 0; i < commentNodes.snapshotLength; i++) {
          const node = commentNodes.snapshotItem(i);
          const text = node.textContent.trim();
          results.push(text);
        }
        
        return results;
      }, xpath);
      
      console.log(`Extracted ${commenters.length} commenters using provided XPath`);
    } else {
      // Default extraction method - use hardcoded CSS selector
      commenters = await page.evaluate(() => {
        // Try to collect comments from the page
        const results = [];
        const uniqueUsernames = new Set(); // To de-duplicate usernames
        const commentsData = [];
        
        // Find all comment username elements
        const commentElements = document.querySelectorAll('.truncate.font-medium.text-white');
        
        if (commentElements.length === 0) {
          console.log('No comment username elements found with primary selector');
        } else {
          console.log(`Found ${commentElements.length} comment username elements`);
        }
        
        for (let i = 0; i < commentElements.length; i++) {
          try {
            const usernameElement = commentElements[i];
            const username = usernameElement.textContent.trim();
            
            // Get the full comment text (if available)
            let commentText = '';
            const commentTextElement = usernameElement.closest('.flex.flex-col.gap-1')?.querySelector('.break-words.text-slate-300');
            if (commentTextElement) {
              commentText = commentTextElement.textContent.trim();
            }
            
            // Only add if it's a new unique username
            if (username && !uniqueUsernames.has(username)) {
              uniqueUsernames.add(username);
              commentsData.push({
                username,
                commentText
              });
            }
          } catch (e) {
            console.error(`Error processing comment element ${i}:`, e);
          }
        }
        
        console.log(`Extracted ${commentsData.length} unique commenters`);
        
        // Try alternative selector if nothing found
        if (commentsData.length === 0) {
          console.log('Trying alternative selectors...');
          
          // Try alternative selector 1
          const alternativeElements1 = document.querySelectorAll('.flex.items-center.gap-1.truncate > .truncate.font-medium');
          console.log(`Alternative selector 1 found ${alternativeElements1.length} elements`);
          
          for (let i = 0; i < alternativeElements1.length; i++) {
            try {
              const username = alternativeElements1[i].textContent.trim();
              if (username && !uniqueUsernames.has(username)) {
                uniqueUsernames.add(username);
                commentsData.push({
                  username,
                  commentText: 'Comment text not available with alternative selector'
                });
              }
            } catch (e) {
              console.error(`Error processing alternative element ${i}:`, e);
            }
          }
          
          // Try alternative selector 2
          const alternativeElements2 = document.querySelectorAll('[class*="text-white"][class*="font-medium"]');
          console.log(`Alternative selector 2 found ${alternativeElements2.length} elements`);
          
          for (let i = 0; i < alternativeElements2.length; i++) {
            try {
              const username = alternativeElements2[i].textContent.trim();
              if (username && !uniqueUsernames.has(username) && username.length < 30) { // Basic filter for usernames
                uniqueUsernames.add(username);
                commentsData.push({
                  username,
                  commentText: 'Comment text not available with alternative selector'
                });
              }
            } catch (e) {
              console.error(`Error processing alternative element 2 ${i}:`, e);
            }
          }
        }
        
        console.log(`Final extraction: ${commentsData.length} unique commenters`);
        
        // Process user data with comment count
        const userCounts = {};
        for (const data of commentsData) {
          if (!userCounts[data.username]) {
            userCounts[data.username] = 1;
          } else {
            userCounts[data.username]++;
          }
        }
        
        // Convert to array of objects with username and count
        for (const [username, count] of Object.entries(userCounts)) {
          results.push({
            username,
            commentCount: count
          });
        }
        
        return results;
      });
      
      console.log(`Extracted ${commenters.length} unique commenters using default extraction method`);
    }

    // If commenters were found, resolve their wallet addresses
    console.log(`Starting wallet resolution for ${commenters.length} commenters...`);
    const resolvedCommenters = [];

    // Process all commenters and resolve their wallet addresses
    for (const commenter of commenters) {
      try {
        let username, commentCount;
        
        if (typeof commenter === 'string') {
          username = commenter;
          commentCount = 1;
        } else {
          username = commenter.username;
          commentCount = commenter.commentCount || 1;
        }
        
        console.log(`Processing commenter: ${username} with ${commentCount} comments`);
        
        // Try to resolve wallet address
        const walletAddress = await resolveWallet(username, page);
        
        resolvedCommenters.push({
          username,
          walletAddress,
          commentCount
        });
        
        console.log(`Added commenter ${username} with wallet ${walletAddress} and ${commentCount} comments`);
      } catch (error) {
        console.error(`Error processing commenter ${JSON.stringify(commenter)}:`, error);
      }
    }

    // Close browser
    await browser.close();

    return {
      status: 'success',
      commenters: resolvedCommenters,
      url
    };
  } catch (error) {
    console.error('Error during scraping:', error);
    
    // Make sure to close browser in case of error
    if (browser) {
      await browser.close();
    }
    
    return {
      status: 'error',
      message: error.message,
      url
    };
  }
}

// Route to scrape commenters
app.post('/extract-commenters', async (req, res) => {
  const { url, xpath } = req.body;
  
  if (!url) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'URL parameter is required' 
    });
  }
  
  try {
    const result = await scrapeCommenters(url, xpath);
    return res.json(result);
  } catch (error) {
    console.error('Error in extract-commenters route:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Export the serverless handler
module.exports = serverless(app); 