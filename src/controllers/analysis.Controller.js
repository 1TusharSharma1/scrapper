import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";
import {APIError} from "../utils/apiError.js";
import Menu from "../models/menuModel.js";
import User from "../models/userModel.js";
import MenuItem from "../models/menuItemModel.js"; // Add this import for MenuItem model
// Assuming scraper functions can be imported or accessed
// You might need to adjust imports based on how scrapperController is structured/exported
import {
    scrapev2
} from "./scapperController.js"; // Adjust path if necessary
import axios from "axios";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import { WritableStreamBuffer } from 'stream-buffers'; // Helper for PDF buffer
import https from 'https'; // Required for the mock request


// Example using Ethereal for testing (prints credentials to console)
let transporter;
async function configureNodemailer() {
    if (process.env.NODE_ENV === 'production') {
         // Configure your real transporter here
         transporter = nodemailer.createTransport({
             // Your production settings (e.g., SendGrid, SES, Gmail with OAuth2)
             // Example (replace with your actual service)
             host: process.env.EMAIL_HOST, // Add to .env
             port: process.env.EMAIL_PORT, // Add to .env (e.g., 587 or 465)
             secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
             auth: {
                 user: process.env.EMAIL_USER, // Add to .env
                 pass: process.env.EMAIL_PASS, // Add to .env
             },
         });
         console.log("Using production email transporter.");
    } else {
        // Use Ethereal for development/testing
        try {
            let testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: testAccount.user, // generated ethereal user
                    pass: testAccount.pass, // generated ethereal password
                },
            });
            console.log("Using Ethereal email transporter. Preview URL will be logged upon sending.");
        } catch (error) {
            console.error("Failed to create Ethereal test account:", error);
            // Fallback to a simple console log transporter if Ethereal fails
            transporter = {
                sendMail: async (mailOptions) => {
                    console.log("--- EMAIL WOULD BE SENT ---");
                    console.log("To:", mailOptions.to);
                    console.log("Subject:", mailOptions.subject);
                    console.log("Text:", mailOptions.text);
                    console.log("Attachments:", mailOptions.attachments ? mailOptions.attachments.length : 0);
                    console.log("--------------------------");
                    return { messageId: "console-log-fallback" };
                }
            };
        }
    }
}

// Configure nodemailer when the server starts or before the first request
configureNodemailer();


// New helper function to get competitor data using scrapev2
const getCompetitorDataWithScrapev2 = async (itemName, latitude, longitude) => {
    // Set default values for latitude and longitude if they're undefined
    const lat = latitude || '28.65420'; // Default latitude (Delhi)
    const lng = longitude || '77.23730'; // Default longitude (Delhi)
    
    console.log(`Scraping for item using scrapev2: ${itemName}`);
    console.log(`Using coordinates - Lat: ${lat}, Lng: ${lng} (${typeof lat}, ${typeof lng})`);
    
    try {
        // Create mock request and response objects for scrapev2
        const mockReq = {
            query: {
                item: itemName,
                lat: lat.toString(),
                long: lng.toString()
            }
        };
        
        console.log(`Mock request query params: ${JSON.stringify(mockReq.query)}`);
        
        // Create a mock response object with methods that scrapev2 will use
        let responseData = null;
        const mockRes = {
            status: (statusCode) => {
                return {
                    json: (apiResponse) => {
                        responseData = apiResponse;
                    }
                };
            }
        };
        
        // Call scrapev2 with our mock objects
        await scrapev2(mockReq, mockRes);
        
        // Return the analytics part if successful
        if (responseData && responseData.data && responseData.data.data && responseData.data.data.analytics) {
            console.log(`Successfully scraped analytics for item: ${itemName}`);
            return responseData.data.data.analytics;
        } else {
            console.warn(`No analytics data returned for item: ${itemName}`);
            return null;
        }
    } catch (error) {
        console.error(`Error using scrapev2 for item "${itemName}":`, error.message);
        return null;
    }
};

const analyzeMenu = asyncHandler(async (req, res) => {
    const { menuId } = req.params;

    if (!menuId) {
        throw new APIError(400, "Menu ID is required");
    }

    // 1. Fetch Menu with items and associated User
    const menu = await Menu.findById(menuId).populate({
        path: 'items',
        model: 'MenuItem' // Explicitly specifying model name
    });
    console.log(`Menu: ${menu}`);
    console.log('Menu location:', menu.location);
    console.log(`Menu latitude: ${menu.location?.lat}, longitude: ${menu.location?.lon}`);
    if (!menu) {
        throw new APIError(404, "Menu not found");
    }
    if (!menu.userId) {
         throw new APIError(404, "Menu is not associated with a user");
    }

    const user = await User.findById(menu.userId);
    if (!user) {
        // This case might indicate data inconsistency
        throw new APIError(404, "User associated with the menu not found");
    }
     if (!user.email) {
        throw new APIError(400, "User does not have an email address configured");
    }


    // 2. Perform Scraper Logic for each item - UPDATED to use scrapev2
    const itemAnalyses = [];
    if (menu.items && menu.items.length > 0) {
        console.log(`Menu latitude: ${menu.location?.lat}, longitude: ${menu.location?.lon}`);
        
        // Run scraping in parallel for efficiency
        const analysisPromises = menu.items.map(item =>
            getCompetitorDataWithScrapev2(item.name, menu.location?.lat, menu.location?.lon)
                .then(analysis => ({ // Add item name to the result
                    itemName: item.name,
                    itemData: item, // Include full item data for comparison
                    analysis: analysis // analysis will be null if scraping failed for this item
                }))
        );

        const results = await Promise.all(analysisPromises);

        // Filter out items where scraping might have failed (result.analysis is null)
        const validResults = results.filter(result => result.analysis !== null);
        
        // Add comparison between menu price and competitor prices
        validResults.forEach(result => {
            try {
                // Ensure menuItemPrice is a number
                const menuItemPrice = parseFloat(result.itemData.price) || 0;
                
                // Ensure avgPrice exists and convert from paise to rupees
                const avgPriceInPaise = result.analysis.avgPrice || 0;
                const competitorAvgPrice = avgPriceInPaise / 100; // Convert paise to rupees
                
                // Calculate differences only if we have valid prices
                const priceDifference = menuItemPrice - competitorAvgPrice;
                
                // Avoid division by zero
                let percentageDifference = "0.00";
                if (competitorAvgPrice > 0) {
                    percentageDifference = ((priceDifference / competitorAvgPrice) * 100).toFixed(2);
                }
                
                // Add comparisons to the analysis object
                result.analysis.comparison = {
                    menuPrice: menuItemPrice,
                    competitorAvgPrice: competitorAvgPrice,
                    priceDifference: priceDifference,
                    percentageDifference: percentageDifference,
                    isMoreExpensive: priceDifference > 0,
                    isLessExpensive: priceDifference < 0,
                    isPriceMatch: Math.abs(priceDifference) < 0.01 // Within 1 cent
                };
            } catch (error) {
                console.error(`Error calculating price comparison for ${result.itemName}:`, error.message);
                // Create a default comparison object if we encounter an error
                result.analysis.comparison = {
                    menuPrice: parseFloat(result.itemData.price) || 0,
                    competitorAvgPrice: 0,
                    priceDifference: 0,
                    percentageDifference: "0.00",
                    isMoreExpensive: false,
                    isLessExpensive: false,
                    isPriceMatch: false
                };
            }
        });
        
        itemAnalyses.push(...validResults);

        if (itemAnalyses.length === 0) {
            console.warn(`Competitor analysis scraping failed for all items in menu ${menuId}`);
            // Proceed without competitor data for the Gemini prompt
        }

    } else {
        console.log(`Menu ${menuId} has no items to analyze.`);
        // Proceed without competitor analysis
    }


    // 3. Call Gemini API
    const apiKey = process.env.Gemini_Api;
    if (!apiKey) {
        console.error("Gemini API key (Gemini_Api) is missing in environment variables.");
        throw new APIError(500, "Server configuration error: Missing API key");
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`; // Updated model name

    // Construct the prompt for Gemini with the enhanced prompt provided
    let prompt = `You are a professional data analyst specializing in the Indian food service market. You are generating a **restaurant menu pricing analysis report** for a client based in **${menu.location?.name || 'Kirti Nagar, Delhi'}**, using **data from competitors sourced via Swiggy**. The report should be structured and formatted to be **directly exportable as a polished PDF document**, with clear sections, tables, bolded highlights, and bullet points where necessary.

## 🔍 Report Content Requirements:

1. **Title Page**  
   Include the following:
   - Report Title: **Menu Pricing Analysis Report**  
   - Subtitle: *Generated for: ${user.name} (${user.email})*  
   - Location: *${menu.location?.name || 'Kirti Nagar, Delhi'}*  
   - Data Source: *Swiggy Competitor Data*  
   - Timestamp: *${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}*

2. **I. Comparative Price Table**  
   Present a clean, well-aligned table comparing:
   - Item name  
   - ${menu.name}'s menu price (₹)  
   - Average competitor price (₹)  
   - Price difference (₹)  
   - Percentage difference (%)  
   Use ₹ as the currency symbol and ensure price formatting is in Indian number style (e.g., ₹20,000.00).

3. **II. Outlier Detection**  
   Highlight which items are major pricing outliers with % difference over 200%. Use bullet points or emphasis formatting (bold or red text indicators) to denote urgency.

4. **III. Category Pricing Trends**  
   Group available items by category (e.g., Main Course, Beverage, Dessert) and mention if overpricing is consistent. If not enough data, mention limitations clearly.

5. **IV. Value for Money Analysis**  
   Explain if pricing is justified based on what's known (ingredients, portion size, presentation). If data is insufficient, state so clearly and suggest what's needed.

6. **V. Strategic Pricing Recommendations**  
   Offer **actionable suggestions**:
   - Suggested price range for each item  
   - Re-categorization notes if items are incorrectly labeled  
   - Call out any likely **data entry errors** (e.g., item listed at ₹20,000 could be due to currency mismatch or typo).

7. **VI. Suggestions for Further Research**  
   Recommend steps for deeper pricing strategy development, including:
   - Ingredient cost breakdown  
   - Portion size standardization  
   - Menu expansion for balanced analysis  
   - Broader competitor dataset  
   - Customer value perception survey

8. **VII. Final Conclusion**  
   Give a clear, data-driven summary:  
   - Is the current pricing viable?  
   - What are the key risks and opportunities?

## 🖋 Formatting Guidelines:

- Use proper **headings** (H1 to H4) for sections  
- Align tables neatly with currency formatting in ₹  
- Include bullet points and bold for key insights  
- Emphasize critical issues in **bold red** (e.g., gross overpricing)  
- Make the content **print-friendly**, with consistent spacing and alignment  
- Add a closing note or signature area with: *"Report generated by AI Assistant | ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}"*

## 🗂 Menu Details:
- Name: ${menu.name}
- Description: ${menu.description || 'N/A'}
- Type: ${menu.type || 'N/A'}
- Location: ${menu.location?.name || 'Kirti Nagar, Delhi'}
- Coordinates: ${menu.location?.lat || 'N/A'}, ${menu.location?.lon || 'N/A'}

## 🗂 Menu Items (${menu.items ? menu.items.length : 0}):
${menu.items && menu.items.length > 0 ? menu.items.map(i => `- ${i.name} (${i.category || 'Uncategorized'}): ₹${i.price}`).join('\n') : 'None'}
`;

    if (itemAnalyses.length > 0) {
        prompt += `

## 🗂 Competitor Data Summary (from Swiggy):
${itemAnalyses.map(itemData => 
`  For Item: "${itemData.itemName}"
    - ${menu.name}'s Price: ₹${itemData.analysis.comparison.menuPrice.toFixed(2)}
    - Average Competitor Price: ₹${itemData.analysis.comparison.competitorAvgPrice.toFixed(2)}
    - Price Difference: ₹${itemData.analysis.comparison.priceDifference.toFixed(2)} (${itemData.analysis.comparison.percentageDifference}% ${itemData.analysis.comparison.isMoreExpensive ? 'higher' : 'lower'} than competitors)
    - Min Competitor Price: ${itemData.analysis.min ? `₹${(itemData.analysis.min.price / 100).toFixed(2)} (Restaurant: ${itemData.analysis.min.name})` : 'N/A'}
    - Max Competitor Price: ${itemData.analysis.max ? `₹${(itemData.analysis.max.price / 100).toFixed(2)} (Restaurant: ${itemData.analysis.max.name})` : 'N/A'}`
).join('\n\n')}
`; // Join individual item summaries with double newline
    } else {
        prompt += `

## 🗂 Competitor Data: 
No competitor data could be gathered for the items in this menu. Please focus the analysis on the target restaurant's own details and general market considerations for its type and location.`;
    }

    prompt += "\n\nPlease provide your detailed analysis report following the structure and formatting guidelines above:";

    let geminiResponseText = "Error: Could not get analysis from AI model.";
    try {
        console.log("Calling Gemini API...");
        const geminiResponse = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: prompt }] }],
             generationConfig: { // Optional: control output format, safety etc.
                 // "responseMimeType": "application/json", // Or "text/plain"
                 "temperature": 0.7,
             },
             safetySettings: [ // Optional: Adjust safety settings
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        });

        if (geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            geminiResponseText = geminiResponse.data.candidates[0].content.parts[0].text;
             console.log("Successfully received response from Gemini API.");
        } else {
             console.error("Invalid response structure from Gemini API:", JSON.stringify(geminiResponse.data, null, 2));
             geminiResponseText = "Error: Received invalid response from AI model.";
             // Do not throw an error here, proceed to send email with error message in PDF
        }

    } catch (error) {
        console.error("Error calling Gemini API:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        // Proceeding to generate PDF/Email with an error message included
        geminiResponseText = `Error: Failed to get analysis from AI model. Details: ${error.message}`;
         // Do not throw an APIError here, allow the process to continue to email the user about the failure.
    }


    // 4. Generate PDF
     console.log("Generating PDF report...");
    const pdfBuffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = new WritableStreamBuffer(); // Use stream-buffers

        doc.pipe(stream);

        // --- PDF Content ---
        // Header
        doc.fontSize(18).text(`Menu Pricing Analysis Report: ${menu.name}`, { align: 'center' });
        doc.moveDown();

        // User Info
        doc.fontSize(12).text(`Generated for: ${user.name} (${user.email})`, { align: 'center' });
        doc.fontSize(10).text(`Location: ${menu.location?.name || 'Kirti Nagar, Delhi'}`, { align: 'center' });
        doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, { align: 'center' });
        doc.moveDown(2);

        // Gemini Analysis Section - will preserve the structured formatting
        doc.fontSize(10).text(geminiResponseText);
        doc.moveDown();

        // Optional: Add price comparison summary if needed
        if (itemAnalyses.length > 0) {
            doc.addPage()
               .fontSize(14).text('Price Comparison Summary', { underline: true })
               .moveDown();
            doc.fontSize(9); // Smaller font for raw data
            itemAnalyses.forEach(itemData => {
                try {
                     doc.text(`Item: "${itemData.itemName}"`, { continued: false }) // Reset continued state
                        .text(`  Your Price: ₹${itemData.analysis.comparison.menuPrice.toFixed(2)}`, { continued: false })
                        .text(`  Avg Competitor Price: ₹${itemData.analysis.comparison.competitorAvgPrice.toFixed(2)}`, { continued: false })
                        .text(`  Price Difference: ₹${itemData.analysis.comparison.priceDifference.toFixed(2)} (${itemData.analysis.comparison.percentageDifference}% ${itemData.analysis.comparison.isMoreExpensive ? 'higher' : 'lower'} than competitors)`, { continued: false })
                        .text(`  Min Price: ${itemData.analysis.min ? `₹${(itemData.analysis.min.price / 100).toFixed(2)} (${itemData.analysis.min.name})` : 'N/A'}`, { continued: false })
                        .text(`  Max Price: ${itemData.analysis.max ? `₹${(itemData.analysis.max.price / 100).toFixed(2)} (${itemData.analysis.max.name})` : 'N/A'}`, { continued: false })
                        .moveDown(0.5);
                } catch (error) {
                    // If there's an error with this item, just write the name and an error message
                    console.error(`Error adding item ${itemData.itemName} to PDF:`, error.message);
                    doc.text(`Item: "${itemData.itemName}" - Error processing data`, { continued: false })
                       .moveDown(0.5);
                }
            });
         }

        // Footer
        doc.moveDown(2);
        doc.fontSize(8).text(`Report generated by AI Assistant | ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`, { align: 'center' });

        // --- Finalize PDF ---
        doc.end();

        stream.on('finish', () => {
            resolve(stream.getContents()); // Get buffer when done
             console.log("PDF generation complete.");
        });

        stream.on('error', (err) => {
            reject(new APIError(500, "Failed to generate PDF buffer", [err]));
        });
    });


    // 5. Send Email
    if (!transporter) {
         console.error("Nodemailer transporter is not configured. Skipping email.");
         throw new APIError(500, "Email service is not configured on the server.");
    }

    const mailOptions = {
        from: `"Your App Name" <${process.env.EMAIL_FROM || 'noreply@example.com'}>`, // Configure sender
        to: user.email,
        subject: `Menu Analysis Report for ${menu.name}`,
        text: `Hi ${user.name},\n\nPlease find your requested analysis report for the menu "${menu.name}" attached.\n\nBest Regards,\nYour App Team`,
        attachments: [
            {
                filename: `analysis_report_${menu.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
            },
        ],
    };

    try {
        console.log(`Sending analysis email to ${user.email}...`);
        let info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully:", info.messageId);

        // Log preview URL if using Ethereal
        if (transporter.options.host === 'smtp.ethereal.email') {
            console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
        }

    } catch (error) {
        console.error("Error sending email:", error);
        // Decide if this failure should prevent a successful response to the user
        // Maybe log it but still return success as the analysis was generated?
        // Throwing an error here means the API request fails if email fails.
        throw new APIError(500, "Analysis generated, but failed to send email.", [error.message]);
    }


    // 6. Send Response to Client
    return res
        .status(200)
        .json(new ApiResponse(200, { message: `Analysis complete. Report sent to ${user.email}` }, "Analysis generated and email sent successfully"));
});

// Export the controller function
export { analyzeMenu };