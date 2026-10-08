using System.Text.RegularExpressions;

namespace FishFinder.Persistence;

// Mirrors the old server's slugify(): lowercase, non-alphanumerics to single
// hyphens, trimmed of leading/trailing hyphens. "Clownfish" -> "clownfish".
public static partial class Slug
{
    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonAlnum();

    [GeneratedRegex("^-+|-+$")]
    private static partial Regex EdgeHyphens();

    public static string Make(string name)
    {
        var lower = (name ?? "").ToLowerInvariant();
        var hyphenated = NonAlnum().Replace(lower, "-");
        return EdgeHyphens().Replace(hyphenated, "");
    }
}
