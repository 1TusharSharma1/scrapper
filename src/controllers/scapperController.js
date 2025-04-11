import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import puppeteer from "puppeteer";
import https from "https";
import { URL } from "url";

// Function to initialize browser and capture Swiggy API request
const captureSwiggyApiRequest = async (item) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  let v3ApiRequest = null;

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
    timeout: 60000,
  });

  await browser.close();
  return v3ApiRequest;
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
  // Try primary path
  if (apiResponse?.data?.cards?.[1]?.groupedCard?.cardGroupMap?.DISH?.cards) {
    return apiResponse.data.cards[1].groupedCard.cardGroupMap.DISH.cards;
  }

  // Try alternative paths
  if (apiResponse?.data?.cards) {
    for (const card of apiResponse.data.cards) {
      if (card?.groupedCard?.cardGroupMap?.DISH?.cards) {
        return card.groupedCard.cardGroupMap.DISH.cards;
      }
    }
  }

  return [];
};

// Process and transform cards data
const processCards = (cardsArray) => {
  return cardsArray
    .filter(
      (card) =>
        card?.card?.card?.["@type"]?.includes("Dish") &&
        card?.card?.card?.info &&
        card?.card?.card?.restaurant?.info
    )
    .map((card) => {
      try {
        const info = card.card.card.info || {};
        const restaurant = card.card.card.restaurant.info || {};

        return {
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
      } catch (error) {
        console.error("Error processing card:", error);
        return null;
      }
    })
    .filter(Boolean) // Remove null entries
    .filter(
      (card) =>
        card.aggregatedRating !== 0 &&
        card.ratingCount !== 0 &&
        card.ratingCountV2 !== 0
    );
};

// Calculate analytics from processed cards data
const calculateAnalytics = (processedCards) => {
  const prices = processedCards
    .map((card) => card.price)
    .filter((price) => typeof price === "number" && price > 0);

  let minCard = processedCards[0];
  let maxCard = processedCards[0];

  processedCards.forEach((card) => {
    if (card.price < minCard.price) minCard = card;
    if (card.price > maxCard.price) maxCard = card;
  });

  const avgPrice =
    prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  const priceVSrating = processedCards
    .map((card) => ({
      price: card.price,
      rating: parseFloat(card.aggregatedRating) || 0,
    }))
    .filter((item) => !isNaN(item.rating));

  const priceVSdistance = processedCards.map((card) => ({
    price: card.price,
    distance: card.lastMileTravel,
  }));

  return {
    min: {
      name: minCard.restaurantName,
      price: minCard.price,
      locality: minCard.locality,
      deliveryTime: minCard.deliveryTime,
      avgRating: minCard.avgRatingRestaurant,
    },
    max: {
      name: maxCard.restaurantName,
      price: maxCard.price,
      locality: maxCard.locality,
      deliveryTime: maxCard.deliveryTime,
      avgRating: maxCard.avgRatingRestaurant,
    },
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

  const v3ApiRequest = await captureSwiggyApiRequest(item);

  if (!v3ApiRequest) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "v3 API request not found"));
  }

  const apiResponse = await fetchSwiggyData(v3ApiRequest, lat, long, item);
  const cardsArray = extractCardsArray(apiResponse);
  const processedCards = processCards(cardsArray);

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

  const analytics = calculateAnalytics(processedCards);
  const topRatedCards = prepareTopRatedCards(processedCards);

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
});

export { scrape };
