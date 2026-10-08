using FishFinder.Persistence;
using FishFinder.Models;
using FishFinder.Services;
using Microsoft.EntityFrameworkCore;

namespace FishFinder.Api;

public static class FishEndpoints
{
    public static void MapFishEndpoints(this IEndpointRouteBuilder app)
    {
        // --- Public read ---------------------------------------------------
        app.MapGet("/api/fish", async (AppDbContext db) =>
        {
            var fish = await db.Fish
                .Include(f => f.Facts)
                .OrderBy(f => f.Name)
                .ToListAsync();
            return Results.Ok(fish.Select(FishDto.From));
        });

        // --- Admin writes ------------------------------------------------
        app.MapPost("/api/fish", async (FishInput input, AppDbContext db) =>
        {
            var name = (input.Name ?? "").Trim();
            if (name.Length == 0)
                return Results.Json(new { error = "A fish needs at least a name." }, statusCode: 400);

            var baseId = Slug.Make(string.IsNullOrWhiteSpace(input.Id) ? name : input.Id!);
            if (baseId.Length == 0)
                baseId = "fish-" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            var id = baseId;
            var n = 2;
            while (await db.Fish.AnyAsync(f => f.Id == id))
                id = $"{baseId}-{n++}";

            var now = DateTime.UtcNow;
            var fish = new Fish
            {
                Id = id,
                Name = name,
                ScientificName = (input.ScientificName ?? "").Trim(),
                Habitat = (input.Habitat ?? "").Trim(),
                Diet = (input.Diet ?? "").Trim(),
                Size = (input.Size ?? "").Trim(),
                ImageUrl = (input.ImageUrl ?? "").Trim(),
                Description = (input.Description ?? "").Trim(),
                CreatedAt = now,
                UpdatedAt = now,
                Facts = CleanFacts(input.Facts)
                    .Select((f, i) => new FishFact { Position = i, Fact = f })
                    .ToList(),
            };

            db.Fish.Add(fish);
            await db.SaveChangesAsync();
            return Results.Json(FishDto.From(fish), statusCode: 201);
        }).AddEndpointFilter<AdminOnly>();

        app.MapPut("/api/fish/{id}", async (string id, FishInput input, AppDbContext db) =>
        {
            var fish = await db.Fish
                .Include(f => f.Facts)
                .FirstOrDefaultAsync(f => f.Id == id);
            if (fish is null)
                return Results.Json(new { error = "Fish not found." }, statusCode: 404);

            // Null field => leave as-is (partial update).
            if (input.Name is not null) fish.Name = input.Name.Trim();
            if (input.ScientificName is not null) fish.ScientificName = input.ScientificName.Trim();
            if (input.Habitat is not null) fish.Habitat = input.Habitat.Trim();
            if (input.Diet is not null) fish.Diet = input.Diet.Trim();
            if (input.Size is not null) fish.Size = input.Size.Trim();
            if (input.ImageUrl is not null) fish.ImageUrl = input.ImageUrl.Trim();
            if (input.Description is not null) fish.Description = input.Description.Trim();

            if (input.Facts is not null)
            {
                fish.Facts.Clear(); // orphaned rows are deleted (cascade)
                var cleaned = CleanFacts(input.Facts);
                for (var i = 0; i < cleaned.Count; i++)
                    fish.Facts.Add(new FishFact { Position = i, Fact = cleaned[i] });
            }

            fish.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Results.Ok(FishDto.From(fish));
        }).AddEndpointFilter<AdminOnly>();

        app.MapDelete("/api/fish/{id}", async (string id, AppDbContext db) =>
        {
            var fish = await db.Fish.FirstOrDefaultAsync(f => f.Id == id);
            if (fish is null)
                return Results.Json(new { error = "Fish not found." }, statusCode: 404);

            db.Fish.Remove(fish); // fish_facts rows go via ON DELETE CASCADE
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        }).AddEndpointFilter<AdminOnly>();
    }

    private static List<string> CleanFacts(List<string>? facts) =>
        (facts ?? [])
            .Select(f => (f ?? "").Trim())
            .Where(f => f.Length > 0)
            .ToList();
}
