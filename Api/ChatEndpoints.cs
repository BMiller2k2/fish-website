using FishFinder.Persistence;
using FishFinder.Models;
using FishFinder.Services;
using Microsoft.EntityFrameworkCore;

namespace FishFinder.Api;

public static class ChatEndpoints
{
    public static void MapChatEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/chat", async (
            ChatRequest body,
            AppDbContext db,
            GeminiChatService gemini,
            CancellationToken ct) =>
        {
            if (!gemini.HasApiKey)
                return Results.Json(new { error = "The server's GEMINI_API_KEY is missing." }, statusCode: 500);

            var history = body.Messages ?? [];
            if (history.Count == 0)
                return Results.Json(new { error = "No messages provided." }, statusCode: 400);

            var fish = await db.Fish
                .Include(f => f.Facts)
                .OrderBy(f => f.Name)
                .ToListAsync(ct);
            var catalog = fish.Select(FishDto.From).ToList();

            var result = await gemini.AskAsync(history, catalog, ct);
            return result.Outcome switch
            {
                ChatOutcome.Ok => Results.Ok(new { reply = result.Reply }),
                ChatOutcome.RateLimited => Results.Json(
                    new { error = "The chatbot is rate limited right now. Try again shortly." },
                    statusCode: 429),
                ChatOutcome.InvalidKey => Results.Json(
                    new { error = "The server's GEMINI_API_KEY is missing or invalid." },
                    statusCode: 500),
                ChatOutcome.MissingKey => Results.Json(
                    new { error = "The server's GEMINI_API_KEY is missing." },
                    statusCode: 500),
                _ => Results.Json(
                    new { error = "The chatbot had a problem answering that." },
                    statusCode: 500),
            };
        });
    }
}
