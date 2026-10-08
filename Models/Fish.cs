namespace FishFinder.Models;

// The catalog is two tables: one row per fish, plus an ordered child table of
// "did you know?" facts (fish_facts) linked by FishId with cascade delete.
public class Fish
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string ScientificName { get; set; } = "";
    public string Habitat { get; set; } = "";
    public string Diet { get; set; } = "";
    public string Size { get; set; } = "";
    public string ImageUrl { get; set; } = "";
    public string Description { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<FishFact> Facts { get; set; } = [];
}

public class FishFact
{
    public string FishId { get; set; } = "";
    public int Position { get; set; }
    public string Fact { get; set; } = "";

    public Fish Fish { get; set; } = null!;
}
