using System.Text;
using System.Text.Json;
using FishFinder.Models;

namespace FishFinder.Services;

public enum ChatOutcome { Ok, MissingKey, InvalidKey, RateLimited, Failed }

public record ChatResult(ChatOutcome Outcome, string? Reply = null);

// Server-side proxy to Google's Gemini generateContent REST API. The API key
// stays here and is never sent to the browser. The full fish catalog is
// injected into the system instruction on every request ("grounding").
public class GeminiChatService(
    IHttpClientFactory httpFactory,
    IConfiguration config,
    ILogger<GeminiChatService> logger)
{
    private string? ApiKey => config["GEMINI_API_KEY"];
    private string Model => config["GEMINI_MODEL"] is { Length: > 0 } m ? m : "gemini-3.6-flash";

    public bool HasApiKey => !string.IsNullOrEmpty(ApiKey);

    public async Task<ChatResult> AskAsync(
        IEnumerable<ChatMessage> history,
        IReadOnlyList<FishDto> catalog,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(ApiKey))
            return new ChatResult(ChatOutcome.MissingKey);

        // Map the browser's history to Gemini's shape: user -> "user",
        // assistant -> "model". Keep only valid turns, cap the length.
        var contents = history
            .Where(m => m is not null
                && (m.Role == "user" || m.Role == "assistant")
                && !string.IsNullOrEmpty(m.Content))
            .TakeLast(20)
            .Select(m => new
            {
                role = m.Role == "assistant" ? "model" : "user",
                parts = new[] { new { text = m.Content! } },
            })
            .ToList();

        if (contents.Count == 0)
            return new ChatResult(ChatOutcome.Failed);

        var catalogJson = catalog.Count > 0
            ? JsonSerializer.Serialize(catalog, new JsonSerializerOptions { WriteIndented = true })
            : "(The catalog is currently empty — no fish have been added yet.)";

        var system = string.Join('\n',
            "You are a friendly aquarium guide on a small website about fish.",
            "Answer visitors' questions about the fish in the site's catalog below.",
            "Prefer information grounded in the catalog. If the catalog doesn't cover",
            "something, you may share accurate general knowledge, but say when you're",
            "going beyond the catalog. If the catalog is empty, tell the visitor that",
            "no fish have been added yet. Keep answers concise and conversational.",
            "",
            "=== FISH CATALOG (JSON) ===",
            catalogJson);

        var payload = new
        {
            system_instruction = new { parts = new[] { new { text = system } } },
            contents,
            generationConfig = new { maxOutputTokens = 1024 },
        };

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{Model}:generateContent";
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };
        req.Headers.Add("x-goog-api-key", ApiKey);

        try
        {
            using var res = await httpFactory.CreateClient().SendAsync(req, ct);
            var bodyText = await res.Content.ReadAsStringAsync(ct);

            if (!res.IsSuccessStatusCode)
            {
                logger.LogError("Gemini error: {Status} {Body}", (int)res.StatusCode, bodyText);
                return (int)res.StatusCode switch
                {
                    400 or 401 or 403 => new ChatResult(ChatOutcome.InvalidKey),
                    429 => new ChatResult(ChatOutcome.RateLimited),
                    _ => new ChatResult(ChatOutcome.Failed),
                };
            }

            using var doc = JsonDocument.Parse(bodyText);
            var text = new StringBuilder();
            if (doc.RootElement.TryGetProperty("candidates", out var cands)
                && cands.GetArrayLength() > 0
                && cands[0].TryGetProperty("content", out var content)
                && content.TryGetProperty("parts", out var parts))
            {
                foreach (var part in parts.EnumerateArray())
                    if (part.TryGetProperty("text", out var t) && t.ValueKind == JsonValueKind.String)
                        text.Append(t.GetString());
            }

            var reply = text.ToString().Trim();
            return new ChatResult(ChatOutcome.Ok, reply.Length > 0 ? reply : "(no response)");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Chat error");
            return new ChatResult(ChatOutcome.Failed);
        }
    }
}
