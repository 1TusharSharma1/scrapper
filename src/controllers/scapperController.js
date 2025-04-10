import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import puppeteer from 'puppeteer-core';
import https from 'https';
import { URL } from 'url';

const scrape = asyncHandler(async (req, res) => {
  try {
    const { lat = '28.65420', long = '77.23730', item = 'Biryani' } = req.query;
    const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    let v3ApiRequest = null;
    
    // Enable request interception
    await page.setRequestInterception(true);
    
    // Listen to all requests
    page.on('request', request => {
      const url = request.url();
      // Capture v3 API requests
      if (url.includes('v3?')) {
        v3ApiRequest = {
          url: url,
          method: request.method(),
          headers: request.headers()
        };
      }
      request.continue();
    });
    
    // Navigate to Swiggy
    await page.goto(`https://www.swiggy.com/search?query=${item}`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Get page title
    const title = await page.title();
    
    // Close browser - we're done with puppeteer
    await browser.close();
    
    // Check if we found a v3 API request
    if (!v3ApiRequest) {
      return res.status(404).json(
        new ApiResponse(404, null, "v3 API request not found")
      );
    }
    
    const modifiedUrl = new URL(v3ApiRequest.url);
    
    // Update query parameters
    modifiedUrl.searchParams.set('lat', lat);
    modifiedUrl.searchParams.set('lng', long);
    modifiedUrl.searchParams.set('str', item);
    
    // Make a direct HTTP request to the modified URL
    const apiResponse = await new Promise((resolve, reject) => {
      const apiReq = https.get(modifiedUrl.toString(), {
        headers: {
          ...v3ApiRequest.headers,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        }
      }, (apiRes) => {
        let data = '';
        
        apiRes.on('data', (chunk) => {
          data += chunk;
        });
        
        apiRes.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (e) {
            reject(new Error('Failed to parse API response: ' + e.message));
          }
        });
      });
      
      apiReq.on('error', (error) => {
        reject(error);
      });
      
      apiReq.end();
    });
    
    // Extract cards array from the API response
    let cardsArray = [];
    
    try {
      // Navigate through the nested structure to find the cards array
      if (apiResponse?.data?.cards?.[1]?.groupedCard?.cardGroupMap?.DISH?.cards) {
        cardsArray = apiResponse.data.cards[1].groupedCard.cardGroupMap.DISH.cards;
      }
    } catch (error) {
      // If the structure doesn't match, try alternative paths
      if (apiResponse?.data?.cards) {
        // Look for groupedCard in any of the cards
        for (const card of apiResponse.data.cards) {
          if (card?.groupedCard?.cardGroupMap?.DISH?.cards) {
            cardsArray = card.groupedCard.cardGroupMap.DISH.cards;
            break;
          }
        }
      }
    }
    
    // Transform each card to get specific fields
    const transformedCards = cardsArray
      .filter(card => 
        // Filter out cards without proper structure
        card?.card?.card?.["@type"]?.includes("Dish") && 
        card?.card?.card?.info
      )
      .map(card => {
        try {
          const info = card.card.card.info || {};
          const restaurant = card.card.card.restaurant.info || {};
          
          return {
            name: info.name || '',
            category: info.category || '',
            description: info.description || '',
            imageId: info.imageId || '',
            price: info.price || 0,
            isVeg: info.isVeg === 1 ? true : false,
            ratings: {
              rating: info.ratings?.aggregatedRating?.rating || '',
              ratingCount: info.ratings?.aggregatedRating?.ratingCount || '',
              ratingCountV2: info.ratings?.aggregatedRating?.ratingCountV2 || ''
            },
            restaurant: {
              name: restaurant.name || '',
              id: restaurant.id || '',
              address: restaurant.address || '',
              locality: restaurant.locality || '',
              areaName: restaurant.areaName || '',
              costForTwo: restaurant.costForTwo || '',
              costForTwoMessage: restaurant.costForTwoMessage || '',
              cuisines: restaurant.cuisines || [],
              avgRating: restaurant.avgRating || '',
              sla: {
                deliveryTime: restaurant.sla?.deliveryTime || '',
                lastMileTravel: restaurant.sla?.lastMileTravel || '',
                serviceability: restaurant.sla?.serviceability || '',
                slaString: restaurant.sla?.slaString || '',
                lastMileTravelString: restaurant.sla?.lastMileTravelString || '',
                iconType: restaurant.sla?.iconType || ''
              }
            }
          };
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean); // Remove null entries
    
    return res.status(200).json(
      new ApiResponse(200, transformedCards, "API response retrieved successfully")
    );
  } catch (error) {
    return res.status(500).json(
      new ApiResponse(500, null, "Error: " + error.message)
    );
  }
});

export { scrape };