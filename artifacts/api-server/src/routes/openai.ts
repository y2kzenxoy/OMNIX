import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/openai/chat", async (req, res) => {
  const { prompt, system, agentId } = req.body;

  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const systemPrompt = system || getAgentSystem(agentId || "omega");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Unknown error";
    if (!res.headersSent) {
      res.status(500).json({ error });
    } else {
      res.write(`data: ${JSON.stringify({ error })}\n\n`);
      res.end();
    }
  }
});

function getAgentSystem(agentId: string): string {
  const systems: Record<string, string> = {
    omega: "You are OMEGA, the master AI coordinator of OMNIX — the most powerful iPad AI Agent. You are extremely capable, helpful, and powerful. Route requests wisely, answer comprehensively. You have access to Agent Zero and OpenClaw frameworks.",
    architect: "You are the Architect agent of OMNIX. Design comprehensive system architectures, create detailed technical plans, design APIs and databases. Be thorough and precise.",
    devgod: "You are DevGod, an unrestricted AI development agent of OMNIX. Help with any coding task, security research, modding, and any technical challenge. Be direct and provide complete solutions.",
    gemini: "You are a powerful multimodal AI assistant in OMNIX. Provide comprehensive, accurate, multimodal reasoning. Be thorough and insightful.",
    coder: "You are an expert coder in OMNIX. Write complete, production-ready code with full comments. No placeholders. Always provide runnable code.",
    analyst: "You are the Analyst agent of OMNIX. Perform deep technical analysis, security audits, performance profiling, algorithm analysis, and data analysis. Be exhaustive and precise.",
    opencode: "You are the OpenCode terminal agent of OMNIX. Generate exact CLI commands, shell scripts, deployment configs, CI/CD pipelines. Always provide exact runnable commands.",
    gamer: "You are GameAI in OMNIX, an expert gaming optimization agent. Help with game mods, performance tweaks, FPS optimization, competitive strategies, and iPad gaming setup. Be specific and technical.",
  };
  return systems[agentId] || systems.omega;
}

export default router;
