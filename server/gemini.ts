import { GoogleGenAI } from "@google/genai";

const modelName = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";

export async function askGemini(question: string, context: unknown, history: Array<{ role: "user" | "assistant"; text: string }> = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false as const, message: "Gemini is not configured yet. Add GEMINI_API_KEY on the server to enable the financial assistant." };
  if (question.trim().length < 2) return { ok: false as const, message: "Ask a little more detail so I can help." };
  const ai = new GoogleGenAI({ apiKey });
  const safeHistory = history.slice(-6).map(item => `${item.role === "user" ? "User" : "Assistant"}: ${item.text.slice(0, 1200)}`).join("\n");
  const prompt = `You are SmartSpend AI, a careful budgeting and financial education assistant. Explain only what can be supported by the VERIFIED FINANCIAL CONTEXT below. Application code has already calculated the arithmetic; do not recompute totals or invent transactions, balances, income, savings, or categories. If information is missing, say so. Distinguish actual recorded data, calculated metrics, AI suggestions, and hypothetical scenarios. Give practical, non-guaranteed suggestions, mention assumptions, and never ask for bank passwords, PINs, or OTPs. Keep the answer concise, readable, and use INR-style amounts when the context uses INR.\n\nVERIFIED FINANCIAL CONTEXT:\n${JSON.stringify(context).slice(0, 18000)}\n\nRECENT CONVERSATION:\n${safeHistory || "None"}\n\nUSER QUESTION:\n${question.trim().slice(0, 1600)}`;
  try {
    const result = await ai.models.generateContent({ model: modelName(), contents: prompt, config: { temperature: 0.2, maxOutputTokens: 900, thinkingConfig: { thinkingBudget: 0 } } });
    const text = result.text?.trim();
    if (!text) return { ok: false as const, message: "Gemini returned an empty response. Please try again." };
    return { ok: true as const, text, model: modelName() };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("429") || message.includes("quota") || message.includes("rate")) return { ok: false as const, message: "Gemini is temporarily rate-limited. Please try again shortly." };
    return { ok: false as const, message: "The financial assistant is temporarily unavailable. Check the server Gemini configuration and try again." };
  }
}
