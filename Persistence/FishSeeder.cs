using System.Text.Json;
using FishFinder.Models;

namespace FishFinder.Persistence;

// One-time migration: if the fish table is empty and data/fish.json exists,
// import it so moving to EF Core / SQLite doesn't lose the seed catalog.
public static class FishSeeder
{
    private record SeedFish(
        string? Id, string? Name, string? ScientificName, string? Habitat,
        string? Diet, string? Size, string? ImageUrl, string? Description,
        List<string>? Facts);

    public static int SeedFromJsonIfEmpty(AppDbContext db, string jsonPath, ILogger logger)
    {
        if (db.Fish.Any()) return 0;
        if (!File.Exists(jsonPath)) return 0;

        List<SeedFish>? items;
        try
        {
            items = JsonSerializer.Deserialize<List<SeedFish>>(
                File.ReadAllText(jsonPath),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Could not parse seed file {Path}", jsonPath);
            return 0;
        }
        if (items is null || items.Count == 0) return 0;

        var now = DateTime.UtcNow;
        var added = 0;
        foreach (var it in items)
        {
            var name = (it.Name ?? "").Trim();
            if (name.Length == 0) continue;

            var id = Slug.Make(string.IsNullOrWhiteSpace(it.Id) ? name : it.Id!);
            if (id.Length == 0) continue;

            var fish = new Fish
            {
                Id = id,
                Name = name,
                ScientificName = (it.ScientificName ?? "").Trim(),
                Habitat = (it.Habitat ?? "").Trim(),
                Diet = (it.Diet ?? "").Trim(),
                Size = (it.Size ?? "").Trim(),
                ImageUrl = (it.ImageUrl ?? "").Trim(),
                Description = (it.Description ?? "").Trim(),
                CreatedAt = now,
                UpdatedAt = now,
                Facts = (it.Facts ?? [])
                    .Select(f => f.Trim())
                    .Where(f => f.Length > 0)
                    .Select((f, i) => new FishFact { Position = i, Fact = f })
                    .ToList(),
            };
            db.Fish.Add(fish);
            added++;
        }

        db.SaveChanges();
        return added;
    }
}
