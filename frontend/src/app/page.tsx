"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface AgentResponse {
  reply: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export default function Home() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/hello-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(
          detail?.detail || `Backend returned ${res.status}`
        );
      }

      const data: AgentResponse = await res.json();
      setResponse(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reach the backend"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Poneglyph</CardTitle>
          <CardDescription>
            Send a message to Claude Opus 4.7. This is a smoke-test for the
            full stack round-trip.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="Ask Opus 4.7 something..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !message.trim()}>
              {isLoading ? "Thinking..." : "Send"}
            </Button>
          </form>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {response && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/50 p-4 text-sm whitespace-pre-wrap">
                {response.reply}
              </div>
              <p className="text-xs text-muted-foreground">
                Model: {response.model} | Tokens: {response.usage.input_tokens} in
                / {response.usage.output_tokens} out
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
