// hooks/useShamBot.js
import { OPENAI_API_KEY } from "@env"; 
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import dataset from "../assets/data/shambot_dataset_v2.json";

/**
 * 🧠 ShamBot Hybrid AI (Offline Dataset + Smart Online Fallback)
 */
export const useShamBot = () => {
  /**
   * 🔹 Find closest response match in the offline dataset
   */
  const findClosestResponse = (userInput) => {
    const lowerInput = userInput.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;

    dataset.forEach((entry) => {
      const promptWords = entry.prompt.toLowerCase().split(" ");
      const overlap = promptWords.filter((w) => lowerInput.includes(w)).length;
      const score = overlap / Math.max(promptWords.length, lowerInput.split(" ").length);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    });

    // Require at least 40% similarity for a match
    return bestScore > 0.4 ? bestMatch : null;
  };


  const isGeneralQuestion = (text) => {
    const keywords = [
      "who", "what", "when", "where", "why", "how", "weather", "news",
      "president", "history", "song", "movie", "country", "food", "earth",
      "time", "day", "today", "tomorrow", "world", "meaning", "person"
    ];
    const cryptoKeywords = ["shamcoin", "crypto", "blockchain", "wallet", "bep", "token", "nft"];
    const lower = text.toLowerCase();

    return keywords.some((k) => lower.includes(k)) && !cryptoKeywords.some((k) => lower.includes(k));
  };


  const hasInternet = async () => {
    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) return false;
      const res = await fetch("https://clients3.google.com/generate_204", { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  };


  const askShamBot = async (userPrompt) => {
    if (!userPrompt || !userPrompt.trim()) {
      return "🙂 Please ask something about ShamCoin, crypto, or general topics.";
    }

    const isOnline = await hasInternet();

    // 1️⃣ Handle general (non-crypto) questions
    if (isGeneralQuestion(userPrompt)) {
      if (isOnline) {
        const aiReply = await fetchOpenAIResponse(userPrompt);
        if (aiReply) return `🤖 ${aiReply}`;
        return "⚠️ I tried to get the latest info but couldn’t reach the server.";
      }
      return "🌐 I can answer that when you're online!";
    }

    // 2️⃣ Try offline dataset (ShamCoin-specific Q&A)
    const match = findClosestResponse(userPrompt);
    if (match) {
      const emojis = {
        general: "💬",
        tokenomics: "💰",
        brand: "✨",
        prediction: "📈",
        update: "📰",
      };
      return `${emojis[match.category] || "💬"} ${match.response}`;
    }

    // 3️⃣ Online fallback via OpenAI (if question is about crypto but unknown)
    if (isOnline) {
      const aiReply = await fetchOpenAIResponse(userPrompt);
      if (aiReply) return `🤖 ${aiReply}`;
    }

    // 4️⃣ Offline fallback info about ShamCoin
    try {
      const json = await AsyncStorage.getItem("shamcoinData");
      const info = json
        ? JSON.parse(json)
        : {
            name: "ShamCoin",
            symbol: "SHAM",
            creator: "Sham Torio",
            totalSupply: "5,000,000,000",
            network: "Binance Smart Chain (BEP-20)",
            launchYear: "2025",
          };

      return `🤖 I couldn’t find that right now, but here’s what I know:
${info.name} (${info.symbol}) was created by ${info.creator} in ${info.launchYear}.
It runs on ${info.network} with a total supply of ${info.totalSupply} tokens.`;
    } catch (err) {
      console.error("ShamBot fallback error:", err);
      return "⚠️ I’m having trouble accessing local ShamCoin data.";
    }
  };

  /**
   * 🔹 OpenAI API Fallback (for general or unknown questions)
   */
  const fetchOpenAIResponse = async (prompt) => {
    try {
      if (!OPENAI_API_KEY || OPENAI_API_KEY === "YOUR_OPENAI_API_KEY") {
        console.warn("⚠️ Missing OpenAI key — please set OPENAI_API_KEY in .env file!");
        return null;
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are ShamBot, a helpful AI assistant for ShamCoin. You know about crypto, blockchain, and ShamCoin, but can also answer general knowledge questions accurately and briefly.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
      console.error("OpenAI fetch error:", err);
      return null;
    }
  };

  return { askShamBot };
};
