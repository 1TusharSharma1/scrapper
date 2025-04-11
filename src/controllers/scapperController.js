import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import puppeteer from "puppeteer";
import https from "https";
import { URL } from "url";

// Global browser instance
let browser;
let browserInitializationPromise;

// Initialize browser
const initBrowser = async () => {
  if (browserInitializationPromise) {
    return browserInitializationPromise;
  }

  browserInitializationPromise = puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    browser = await browserInitializationPromise;
    console.log("Browser initialized successfully");
    return browser;
  } catch (error) {
    browserInitializationPromise = null;
    console.error("Error initializing browser:", error);
    throw error;
  }
};

// Initialize browser when module is loaded
initBrowser().catch(console.error);

// Function to capture Swiggy API request using existing browser instance
const captureSwiggyApiRequest = async (item) => {
  if (!browser) {
    await initBrowser();
  }

  const page = await browser.newPage();
  let v3ApiRequest = null;

  try {
    await page.setRequestInterception(true);

    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("v3?")) {
        v3ApiRequest = {
          url: url,
          method: request.method(),
          headers: request.headers(),
        };
      }
      request.continue();
    });

    await page.goto(`https://www.swiggy.com/search?query=${item}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    return v3ApiRequest;
  } catch (error) {
    console.error("Error capturing Swiggy API request:", error);
    throw error;
  } finally {
    await page.close(); // Close page but keep browser open
  }
};

// Function to make the API request with modified parameters
const fetchSwiggyData = async (v3ApiRequest, lat, long, item) => {
  const modifiedUrl = new URL(v3ApiRequest.url);

  modifiedUrl.searchParams.set("lat", lat);
  modifiedUrl.searchParams.set("lng", long);
  modifiedUrl.searchParams.set("str", item);

  return new Promise((resolve, reject) => {
    const apiReq = https.get(
      modifiedUrl.toString(),
      {
        headers: {
          ...v3ApiRequest.headers,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        },
      },
      (apiRes) => {
        let data = "";
        apiRes.on("data", (chunk) => {
          data += chunk;
        });
        apiRes.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("Failed to parse API response: " + e.message));
          }
        });
      }
    );
    apiReq.on("error", (error) => reject(error));
    apiReq.end();
  });
};

// Extract cards array from API response structure
const extractCardsArray = (apiResponse) => {
  if (!apiResponse?.data?.cards) {
    return [];
  }

  // Try primary path
  if (apiResponse.data.cards[1]?.groupedCard?.cardGroupMap?.DISH?.cards) {
    return apiResponse.data.cards[1].groupedCard.cardGroupMap.DISH.cards;
  }

  // Try alternative paths
  for (const card of apiResponse.data.cards) {
    if (card?.groupedCard?.cardGroupMap?.DISH?.cards) {
      return card.groupedCard.cardGroupMap.DISH.cards;
    }
  }

  return [];
};

// Process and transform cards data with parallelism
const processCards = async (cardsArray) => {
  // Filter eligible cards first
  const eligibleCards = cardsArray.filter(
    (card) =>
      card?.card?.card?.["@type"]?.includes("Dish") &&
      card?.card?.card?.info &&
      card?.card?.card?.restaurant?.info
  );

  // Process cards in parallel
  const processedCardsPromises = eligibleCards.map(async (card) => {
    try {
      const info = card.card.card.info || {};
      const restaurant = card.card.card.restaurant.info || {};

      const result = {
        restaurantName: restaurant.name || "",
        imageId: info.imageId || "",
        price: info.price || 0,
        locality: restaurant.locality || "",
        deliveryTime: restaurant.sla?.deliveryTime || "",
        avgRatingRestaurant: restaurant.avgRating || "",
        aggregatedRating: info.ratings?.aggregatedRating?.rating || 0,
        ratingCount: info.ratings?.aggregatedRating?.ratingCount || 0,
        ratingCountV2: info.ratings?.aggregatedRating?.ratingCountV2 || 0,
        lastMileTravel: restaurant.sla?.lastMileTravel || 0,
      };

      // Early filter
      if (
        result.aggregatedRating === 0 ||
        result.ratingCount === 0 ||
        result.ratingCountV2 === 0
      ) {
        return null;
      }

      return result;
    } catch (error) {
      console.error("Error processing card:", error);
      return null;
    }
  });

  const processedCards = await Promise.all(processedCardsPromises);
  return processedCards.filter(Boolean); // Remove null entries
};

// Calculate analytics from processed cards data - optimized
const calculateAnalytics = (processedCards) => {
  if (!processedCards.length) {
    return {
      min: null,
      max: null,
      avgPrice: 0,
      priceVSrating: [],
      priceVSdistance: [],
    };
  }

  // Calculate min, max and sum in a single pass
  const { min, max, totalPrice, validPriceCount } = processedCards.reduce(
    (acc, card) => {
      if (typeof card.price !== "number" || card.price <= 0) {
        return acc;
      }

      if (!acc.min || card.price < acc.min.price) acc.min = card;
      if (!acc.max || card.price > acc.max.price) acc.max = card;

      acc.totalPrice += card.price;
      acc.validPriceCount++;

      return acc;
    },
    { min: null, max: null, totalPrice: 0, validPriceCount: 0 }
  );

  const avgPrice = validPriceCount > 0 ? totalPrice / validPriceCount : 0;

  const priceVSrating = processedCards
    .map((card) => ({
      price: card.price,
      rating: parseFloat(card.aggregatedRating) || 0,
    }))
    .filter((item) => !isNaN(item.rating) && item.price > 0);

  const priceVSdistance = processedCards
    .filter((card) => card.price > 0)
    .map((card) => ({
      price: card.price,
      distance: card.lastMileTravel,
    }));

  return {
    min: min
      ? {
          name: min.restaurantName,
          price: min.price,
          locality: min.locality,
          deliveryTime: min.deliveryTime,
          avgRating: min.avgRatingRestaurant,
        }
      : null,
    max: max
      ? {
          name: max.restaurantName,
          price: max.price,
          locality: max.locality,
          deliveryTime: max.deliveryTime,
          avgRating: max.avgRatingRestaurant,
        }
      : null,
    avgPrice,
    priceVSrating,
    priceVSdistance,
  };
};

// Prepare top rated cards for response
const prepareTopRatedCards = (processedCards) => {
  return processedCards
    .sort(
      (a, b) =>
        (parseFloat(b.aggregatedRating) || 0) -
        (parseFloat(a.aggregatedRating) || 0)
    )
    .slice(0, 5)
    .map((card) => ({
      name: card.restaurantName,
      imageId:
        "https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_208,h_208,c_fit/" +
        card.imageId,
      price: card.price,
      ratings: {
        rating: card.aggregatedRating,
        ratingCount: card.ratingCount,
        ratingCountV2: card.ratingCountV2,
      },
    }));
};

// Main scrape controller function
const scrape = asyncHandler(async (req, res) => {
  const { lat = "28.65420", long = "77.23730", item = "Biryani" } = req.query;

  try {
    const v3ApiRequest = await captureSwiggyApiRequest(item);

    if (!v3ApiRequest) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "v3 API request not found"));
    }

    const apiResponse = await fetchSwiggyData(v3ApiRequest, lat, long, item);
    const cardsArray = extractCardsArray(apiResponse);
    const processedCards = await processCards(cardsArray);

    if (processedCards.length === 0) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { data: { analytics: {}, cards: [] } },
            "No valid cards found to process"
          )
        );
    }

    // Run calculations in parallel
    const [analytics, topRatedCards] = await Promise.all([
      Promise.resolve(calculateAnalytics(processedCards)),
      Promise.resolve(prepareTopRatedCards(processedCards)),
    ]);

    const response = {
      data: {
        analytics,
        cards: topRatedCards,
      },
    };

    return res
      .status(200)
      .json(
        new ApiResponse(200, response, "API response retrieved successfully")
      );
  } catch (error) {
    console.error("Error in scrape controller:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, "Internal Server Error: " + error.message)
      );
  }
});

// Handle process termination for proper cleanup
process.on("SIGINT", async () => {
  console.log("Received SIGINT. Closing browser before exit...");
  if (browser) await browser.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM. Closing browser before exit...");
  if (browser) await browser.close();
  process.exit(0);
});

const scrapev2 = asyncHandler(async (req, res) => {
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
    
    // Transform each card to get specific fields needed for analytics and final structure
    const processedCards = cardsArray
      .filter(card => 
        // Filter out cards without proper structure
        card?.card?.card?.["@type"]?.includes("Dish") && 
        card?.card?.card?.info &&
        card?.card?.card?.restaurant?.info
      )
      .map(card => {
        try {
          const info = card.card.card.info || {};
          const restaurant = card.card.card.restaurant.info || {};
          
          return {
            restaurantName: restaurant.name || '',
            imageId: info.imageId || '',
            price: info.price || 0,
            locality: restaurant.locality || '',
            deliveryTime: restaurant.sla?.deliveryTime || '',
            avgRatingRestaurant: restaurant.avgRating || '', // Renamed to avoid conflict
            aggregatedRating: info.ratings?.aggregatedRating?.rating || 0,
            ratingCount: info.ratings?.aggregatedRating?.ratingCount || 0,
            ratingCountV2: info.ratings?.aggregatedRating?.ratingCountV2 || 0,
            lastMileTravel: restaurant.sla?.lastMileTravel || 0
          };
        } catch (error) {
          console.error("Error processing card:", error); // Log error for debugging
          return null;
        }
      })
      .filter(Boolean) // Remove null entries
      // Filter out cards with zero rating fields
      .filter(card => 
        card.aggregatedRating !== 0 && 
        card.ratingCount !== 0 && 
        card.ratingCountV2 !== 0
      );

    if (processedCards.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, { data: { analytics: {}, cards: [] } }, "No valid cards found to process")
      );
    }

    // Calculate analytics
    const prices = processedCards.map(card => card.price).filter(price => typeof price === 'number' && price > 0 );
    
    // Find min/max based on price
    let minCard = processedCards[0];
    let maxCard = processedCards[0];
    processedCards.forEach(card => {
      if (card.price < minCard.price) minCard = card;
      if (card.price > maxCard.price) maxCard = card;
    });
    
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    
    const priceVSrating = processedCards
      .map(card => ({
        price: card.price,
        rating: parseFloat(card.aggregatedRating) || 0
      }))
      .filter(item => !isNaN(item.rating)); // Ensure rating is a valid number
    
    const priceVSdistance = processedCards
      .map(card => ({
        price: card.price,
        distance: card.lastMileTravel // Using lastMileTravel as distance
      }));

    // Sort cards by aggregatedRating (high to low) and take top 5 for the 'cards' section
    const topRatedCards = processedCards
      .sort((a, b) => (parseFloat(b.aggregatedRating) || 0) - (parseFloat(a.aggregatedRating) || 0))
      .slice(0, 5)
      .map(card => ({
        name: card.restaurantName,
        imageId: 'https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_208,h_208,c_fit/'+card.imageId,
        price: card.price,
        ratings: {
          rating: card.aggregatedRating,
          ratingCount: card.ratingCount,
          ratingCountV2: card.ratingCountV2
        }
      }));

    // Construct the final response object
    const response = {
      data: {
        analytics: {
          min: {
            name: minCard.restaurantName,
            price: minCard.price,
            locality: minCard.locality,
            deliveryTime: minCard.deliveryTime,
            avgRating: minCard.avgRatingRestaurant // Use the specific restaurant avgRating
          },
          max: {
            name: maxCard.restaurantName,
            price: maxCard.price,
            locality: maxCard.locality,
            deliveryTime: maxCard.deliveryTime,
            avgRating: maxCard.avgRatingRestaurant // Use the specific restaurant avgRating
          },
          avgPrice: avgPrice,
          priceVSrating: priceVSrating,
          priceVSdistance: priceVSdistance
        },
        cards: topRatedCards 
      }
    };
    
    return res.status(200).json(
      new ApiResponse(200, response, "API response retrieved successfully")
    );
  } catch (error) {
    return res.status(500).json(
      new ApiResponse(500, null, "Error: " + error.message)
    );
  }
});


export { 
  scrape, 
  scrapev2,
  initBrowser, 
  captureSwiggyApiRequest, 
  fetchSwiggyData, 
  extractCardsArray, 
  processCards, 
  calculateAnalytics 
};
