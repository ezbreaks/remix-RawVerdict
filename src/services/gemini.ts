import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey: apiKey });
};

async function generateContentWithRetry(model: string, params: any, retries = 8, delay = 3000): Promise<any> {
  try {
    const ai = getAiClient();
    return await ai.models.generateContent({
      model: model,
      ...params
    });
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    const isQuotaError = 
      error.status === 429 || 
      error.code === 429 || 
      errorStr.includes('429') || 
      errorStr.includes('quota') ||
      errorStr.includes('resource_exhausted') ||
      errorStr.includes('limit exceeded');

    if (retries > 0 && isQuotaError) {
      console.warn(`Rate limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return generateContentWithRetry(model, params, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

export interface CardDetails {
  year: string;
  set_name: string;
  card_number?: string;
  player_name: string;
  team_name?: string;
  variant?: string;
  serial_number?: string;
  graded_by?: string;
  grade?: string;
  cert_number?: string;
  slab_image?: string;
}

export async function identifyCard(frontImageBase64: string, backImageBase64?: string): Promise<CardDetails> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `
    Analyze these trading card images. Identify the following details:
    - Year
    - Set Name (e.g., Topps Chrome, Panini Prizm, Bowman, Upper Deck). IMPORTANT: Do NOT include the year in the set name.
    - Card Number (e.g., #123, #BCP-1)
    - Player Name
    - Team Name
    - Parallel/Variant (e.g., Base, Refractor, Silver Prizm, Holo, Blue /99, etc.). 
      IMPORTANT: Be extremely specific. If it's a base card, enter "Base". If it's a numbered parallel, include the numbering (e.g., "Gold /50").
    - Serial Number (if visible, e.g., 05/99)
    - Graded By (if the card is in a slab, identify the company: PSA, BGS, SGC, CGC, etc.)
    - Grade (if the card is graded, identify the numeric grade and any qualifiers, e.g., 10, 9.5, 9 OC)
    - Certificate Number (if the card is graded, identify the unique certificate or serial number on the slab, especially for PSA)

    Return the result as a JSON object with keys: year, set_name, card_number, player_name, team_name, variant, serial_number, graded_by, grade, cert_number.
    (Note: map 'Parallel/Variant' to the 'variant' key in JSON.)
    If a field is not found, return an empty string.
    Use the Google Search tool to verify the card details if needed, especially for identifying the specific set or variant based on the card design.
    
    IMPORTANT: Return ONLY the JSON object. Do not include any markdown formatting or explanation.
  `;

  const parts: any[] = [
    { text: prompt }
  ];

  // Add front image
  if (frontImageBase64) {
    // Remove header if present
    const base64Data = frontImageBase64.split(',')[1] || frontImageBase64;
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data
      }
    });
  }

  // Add back image if present
  if (backImageBase64) {
    const base64Data = backImageBase64.split(',')[1] || backImageBase64;
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data
      }
    });
  }

  try {
    const response = await generateContentWithRetry(model, {
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    let text = response.text;
    console.log("Gemini raw response:", text);
    if (!text) throw new Error("No response from RawVerdict AI");
    
    // Robust JSON extraction
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1) {
      text = text.substring(startIdx, endIdx + 1);
    }
    
    return JSON.parse(text) as CardDetails;
  } catch (error: any) {
    console.error("Gemini identification failed:", error);
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("API Key error. Please try selecting your key again.");
    }
    throw error;
  }
}

export async function generateBackground(theme: string = "Sports"): Promise<string> {
  // Use gemini-2.5-flash-image for image generation
  const model = "gemini-2.5-flash-image";
  
  let prompt = "";
  switch (theme) {
    case "Baseball":
      prompt = "A premium baseball trading card design (like Topps Chrome) featuring a dynamic, realistic illustration of a baseball player swinging a bat in a stadium. Holographic refractor textures, metallic borders, and team color accents. High-gloss finish. No text.";
      break;
    case "Football":
      prompt = "A high-end football trading card design (like Panini Prizm) featuring a realistic action shot of a football player running with the ball. Metallic shards, vibrant team colors, and a gridiron texture. Glossy, energetic. No text.";
      break;
    case "Hockey":
      prompt = "A hockey trading card design (like Upper Deck) featuring a realistic illustration of a hockey player skating on ice. Ice textures, metallic silver and blue accents, and a 'Young Guns' aesthetic. Sharp lines, frost effects. No text.";
      break;
    case "Soccer":
      prompt = "A soccer trading card design (like Topps Chrome) featuring a realistic action shot of a soccer player kicking a ball. Geometric pitch patterns, gold and silver refractor effects, and vibrant international team colors. Sleek, modern. No text.";
      break;
    case "Pokémon":
      prompt = "A Pokémon TCG style card art featuring a cute, powerful, original monster creature (not an existing Pokémon) in a dynamic pose. Colorful elemental effects (fire, water, or grass), holographic star patterns, and anime art style. Playful and vibrant. No text.";
      break;
    case "Digimon":
      prompt = "A Digimon TCG style card art featuring a cool, digital monster creature (original design) with cybernetic parts. Digital grid patterns, binary code streams, and high-tech data visuals. Cybernetic aesthetic. No text.";
      break;
    case "Magic":
      prompt = "A Magic: The Gathering style card art featuring a powerful fantasy character (wizard, warrior, or beast) casting a spell or fighting. Painterly fantasy art style, mystical runes, and elemental landscapes. Rich, deep colors. No text.";
      break;
    default:
      prompt = "A futuristic trading card design featuring a generic sci-fi character in a dynamic pose. Abstract geometric shapes and vibrant colors like cyan, magenta, and electric blue. Professional and clean. No text.";
  }

  try {
    const response = await generateContentWithRetry(model, {
      contents: { parts: [{ text: prompt }] }
    });
    
    // Extract image
    // The response structure for image generation might vary, but typically it's in the parts
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part && part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Background generation failed:", error);
    return ""; // Return empty string on failure
  }
}

export async function processBatchImages(images: string[]): Promise<any[]> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are a trading card expert. I am providing ${images.length} images of trading cards. Some are fronts, some are backs.
    
    Your tasks:
    1. Analyze all images.
    2. Group them into pairs (Front + Back). If an image has no match, treat it as a single card (Front only).
    3. For EACH image, determine:
       - The bounding box [ymin, xmin, ymax, xmax] on a 0-100 scale to crop the card perfectly, removing any background. 
         CRITICAL INSTRUCTION: If the card is a graded card (in a plastic slab), the bounding box MUST include the ENTIRE slab. You MUST include the grading company's header/label at the top of the slab in the crop. Do NOT crop down to just the paper card inside the slab.
       - The rotation (0, 90, 180, 270) required to make the text upright and readable.
    4. For each PAIR (or single card), identify the details:
       - Year, Set Name, Card Number, Player Name, Team Name, Variant, Serial Number. 
       - IMPORTANT: Do NOT include the year in the Set Name field.
       - IMPORTANT: For the "Variant" field, scan specifically to determine if the card is a "Base" card or a specific parallel (e.g., Refractor, Holo, etc.). If it is a standard card, enter "Base".
    
    Return a JSON ARRAY of objects. Each object represents a CARD and should have:
    {
      "front_image_index": number (index in the provided list),
      "back_image_index": number | null,
      "front_crop": [ymin, xmin, ymax, xmax],
      "front_rotation": number,
      "back_crop": [ymin, xmin, ymax, xmax] | null,
      "back_rotation": number | null,
      "details": {
        "year": string,
        "set_name": string,
        "card_number": string,
        "player_name": string,
        "team_name": string,
        "variant": string,
        "serial_number": string,
        "graded_by": string,
        "grade": string,
        "cert_number": string
      }
    }
  `;

  const parts: any[] = [{ text: prompt }];

  images.forEach(img => {
    const base64Data = img.split(',')[1] || img;
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data
      }
    });
  });

  try {
    const response = await generateContentWithRetry(model, {
      contents: { parts },
      config: {
        responseMimeType: "application/json"
      }
    });

    let text = response.text;
    if (!text) throw new Error("No response from RawVerdict AI");
    
    // Robust JSON extraction
    const startIdx = text.indexOf('[');
    const endIdx = text.lastIndexOf(']');
    
    if (startIdx !== -1 && endIdx !== -1) {
      text = text.substring(startIdx, endIdx + 1);
    }
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Batch processing failed:", error);
    throw error;
  }
}

export interface MarketData {
  estimated_value: string;
  market_demand: string;
  confidence_score: string;
  notes: string;
  last_updated: string;
}

export async function getRecentSales(cardDetails: CardDetails): Promise<MarketData> {
  const model = "gemini-3-flash-preview";
  
  // Filter out empty fields to build a clean query
  const queryParts = [
    cardDetails.year,
    cardDetails.set_name,
    cardDetails.player_name,
    cardDetails.card_number ? (cardDetails.card_number.startsWith('#') ? cardDetails.card_number : `#${cardDetails.card_number}`) : '',
    cardDetails.variant
  ].filter(part => part && part.trim() !== '' && part.toLowerCase() !== 'base');

  if (queryParts.length < 2) {
    return {
      estimated_value: "N/A",
      market_demand: "Unknown",
      confidence_score: "Low",
      notes: "Not enough information to determine market value.",
      last_updated: new Date().toLocaleDateString()
    };
  }

  const query = queryParts.join(' ');
  
  const prompt = `
    You are a market analyst for trading cards. Find the current market value for: "${query}".
    
    CRITICAL: You MUST use the Google Search tool to research the value of this exact card.
    
    CARD DETAILS:
    - Year: ${cardDetails.year}
    - Set Name: ${cardDetails.set_name}
    - Card Number: ${cardDetails.card_number}
    - Player Name: ${cardDetails.player_name}
    - Variant/Parallel: ${cardDetails.variant || "Base"} (If "Base", exclude any numbered parallels, refractors, or special variants.)
    
    INSTRUCTIONS:
    1. Search for recent sales of this exact card ONLY on eBay sold listings, TCGplayer, or SportsCardPro. Do not use other sources.
    2. Determine the lowest recent sale value or the low end of the market value. You MUST return ONLY the low value as a single formatted currency string (e.g., "$15.00"). Do not return a range. If you cannot find exact matches, provide a low estimate based on similar cards or state "Unknown".
    3. Assess the market demand ("High", "Medium", or "Low").
    4. Provide a confidence score ("High", "Medium", or "Low") based on how many exact matches you found.
    5. Provide brief notes on your findings (e.g., "Several recent sales found on eBay sold", "Rare variant, hard to find exact comps, estimate based on similar parallels").
    
    Return a JSON object with:
       - "estimated_value": The low value (e.g., "$15.00").
       - "market_demand": "High", "Medium", or "Low".
       - "confidence_score": "High", "Medium", or "Low".
       - "notes": Brief notes on your findings.
       - "last_updated": Current date (YYYY-MM-DD).
       
    IMPORTANT: You MUST return a valid JSON object. DO NOT include any conversational text, explanations, or apologies. Your entire response must be the JSON object itself.
  `;

  try {
    const response = await generateContentWithRetry(model, {
      contents: { parts: [{ text: prompt }] },
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    let text = response.text;
    if (!text) throw new Error("No response from RawVerdict AI");
    
    // Robust JSON extraction: find the first { and last }
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1) {
      text = text.substring(startIdx, endIdx + 1);
    }
    
    return JSON.parse(text) as MarketData;
  } catch (error) {
    console.error("Market data fetch failed:", error);
    throw error;
  }
}

export interface CardAnalysis {
  description: string;
  player_bio: string;
  market_outlook: string;
  grading_recommendation: string;
  estimated_grade?: string;
  numeric_grade?: number;
  justification?: string;
  subgrades?: {
    centering: string;
    corners: string;
    edges: string;
    surface: string;
  };
}

export async function getCardAnalysis(cardDetails: CardDetails, frontImageBase64?: string, backImageBase64?: string): Promise<CardAnalysis> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `
    Analyze this trading card based on the following details and the provided images:
    - Year: ${cardDetails.year}
    - Set: ${cardDetails.set_name}
    - Card Number: ${cardDetails.card_number}
    - Player: ${cardDetails.player_name}
    - Team: ${cardDetails.team_name}
    - Variant/Parallel: ${cardDetails.variant}
    - Serial Number: ${cardDetails.serial_number}

    Provide a detailed analysis with the following 4 sections:
    1. **Card Description**: A brief description of the card's visual style, significance in the set, and key features.
    2. **Player Bio**: A short summary of the player's career highlights and significance in the sport.
    3. **Market Outlook**: An assessment of the card's current market status (e.g., popular, niche, vintage classic) and potential future trends. (Do not give specific prices, just trends).
    4. **Grading Recommendation**: A recommendation on whether this card is generally worth grading. 
       - Consider the card's potential value and the sensitivity of this specific set to condition issues.
       - **CRITICAL**: Visually analyze the provided images for centering (top/bottom, left/right), corner sharpness, edge wear, and surface defects (scratches, print lines).
       - Mention any specific defects you see in the images that would affect the grade.
       - If the card appears well-centered and clean, note that as a positive factor for grading.

    Return the result as a JSON object with keys: "description", "player_bio", "market_outlook", "grading_recommendation".
    Use the Google Search tool to verify market trends and player details if needed.
  `;

  const parts: any[] = [{ text: prompt }];

  // Add front image
  if (frontImageBase64) {
    const base64Data = frontImageBase64.split(',')[1] || frontImageBase64;
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data
      }
    });
  }

  // Add back image
  if (backImageBase64) {
    const base64Data = backImageBase64.split(',')[1] || backImageBase64;
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data
      }
    });
  }

  try {
    const response = await generateContentWithRetry(model, {
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    let text = response.text;
    if (!text) throw new Error("No response from RawVerdict AI");
    
    // Robust JSON extraction
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1) {
      text = text.substring(startIdx, endIdx + 1);
    }
    
    return JSON.parse(text) as CardAnalysis;
  } catch (error) {
    console.error("Card analysis failed:", error);
    throw error;
  }
}

export async function getCardGrade(cardDetails: CardDetails, frontImageBase64?: string, backImageBase64?: string, previousGrade?: number): Promise<Partial<CardAnalysis>> {
  const model = "gemini-3.1-pro-preview";
  
  const previousGradeInstruction = previousGrade 
    ? `\n    - **IMPORTANT**: You previously assigned this card a numeric grade of ${previousGrade}. You MUST take this original grade into account and include it in your average calculation.`
    : "";

  const prompt = `
    Analyze this trading card based on the following details and the provided images:
    - Year: ${cardDetails.year}
    - Set: ${cardDetails.set_name}
    - Card Number: ${cardDetails.card_number}
    - Player: ${cardDetails.player_name}
    - Team: ${cardDetails.team_name}
    - Variant/Parallel: ${cardDetails.variant}
    - Serial Number: ${cardDetails.serial_number}

    Provide a detailed grading analysis with the following 4 sections:
    1. **Estimated Grade**: Take your time examining the card for the estimated grade. Look very closely for scratches, corner damage, and edge wear. Examine the card 10 separate times to make sure the grade is consistent. Average the 10 numeric estimates ${previousGrade ? `along with the original grade of ${previousGrade} ` : ""}to come up with a final estimated grade (e.g., PSA 8, BGS 9.5, Raw/Ungraded, etc.).${previousGradeInstruction}
    2. **Numeric Grade**: Provide the numeric part of the averaged estimated grade (e.g., 8, 9.5, 10). If the card is ungraded or raw, provide your best estimate of what it would grade as. ALWAYS provide a numeric estimate (1-10) even for raw or low-condition cards. Do not leave this blank or 0.
    3. **Justification**: A brief justification for the estimated grade.
    4. **Subgrades**: Provide specific numeric subgrades (0-10 scale) for the following categories based on visual inspection:
       - **Centering**: Top/bottom and left/right alignment.
       - **Corners**: Sharpness and any visible whitening or dings. (Note: Pokémon and some other TCG cards naturally have rounded corners, do not penalize them for this).
       - **Edges**: Smoothness and any visible chipping or wear.
       - **Surface**: Scratches, dimples, print lines, or stains.

    Return the result as a JSON object with keys: "estimated_grade", "numeric_grade", "justification", and "subgrades" (an object with keys "centering", "corners", "edges", "surface").
  `;

  const parts: any[] = [{ text: prompt }];

  // Add front image
  if (frontImageBase64) {
    const base64Data = frontImageBase64.split(',')[1] || frontImageBase64;
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data
      }
    });
  }

  // Add back image
  if (backImageBase64) {
    const base64Data = backImageBase64.split(',')[1] || backImageBase64;
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data
      }
    });
  }

  try {
    const response = await generateContentWithRetry(model, {
      contents: { parts }
    });

    let text = response.text;
    if (!text) throw new Error("No response from RawVerdict AI");
    
    // Robust JSON extraction
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1) {
      text = text.substring(startIdx, endIdx + 1);
    }
    
    return JSON.parse(text) as Partial<CardAnalysis>;
  } catch (error) {
    console.error("Card grading failed:", error);
    throw error;
  }
}
