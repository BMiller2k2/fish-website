namespace FishFinder.Models;

// What the API sends back: flat, camelCased by System.Text.Json, with facts as
// a plain ordered string array instead of the child entities.
public record FishDto(
    string Id,
    string Name,
    string ScientificName,
    string Habitat,
    string Diet,
    string Size,
    string ImageUrl,
    string Description,
    IReadOnlyList<string> Facts)
{
    public static FishDto From(Fish f) => new(
        f.Id, f.Name, f.ScientificName, f.Habitat, f.Diet, f.Size,
        f.ImageUrl, f.Description,
        f.Facts.OrderBy(x => x.Position).Select(x => x.Fact).ToList());
}

// What the admin form sends. Every field is optional: on create, missing
// fields default to empty; on update (PUT), a null field means "leave as-is".
public record FishInput(
    string? Id,
    string? Name,
    string? ScientificName,
    string? Habitat,
    string? Diet,
    string? Size,
    string? ImageUrl,
    string? Description,
    List<string>? Facts);

public record LoginRequest(string? Token);

public record ChatRequest(List<ChatMessage>? Messages);

public record ChatMessage(string? Role, string? Content);
