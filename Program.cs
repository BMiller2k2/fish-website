using FishFinder.Api;
using FishFinder.Persistence;
using FishFinder.Services;
using Microsoft.EntityFrameworkCore;

// Load .env (KEY=value) into the environment before configuration is built, so
// GEMINI_API_KEY / ADMIN_TOKEN / etc. flow through IConfiguration like any env var.
DotEnv.Load(FindUp(".env"));

var builder = WebApplication.CreateBuilder(args);

var contentRoot = builder.Environment.ContentRootPath;
var dbFile = builder.Configuration["DB_FILE"] is { Length: > 0 } configured
    ? Path.GetFullPath(configured, contentRoot)
    : Path.Combine(contentRoot, "data", "fishfinder.db");
Directory.CreateDirectory(Path.GetDirectoryName(dbFile)!);

builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite($"Data Source={dbFile}"));
builder.Services.AddHttpClient();
builder.Services.AddScoped<AdminAuth>();
builder.Services.AddScoped<AdminOnly>();
builder.Services.AddScoped<GeminiChatService>();

var app = builder.Build();

// Create the schema if needed and import data/fish.json on an empty database.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    db.Database.EnsureCreated();

    var seedPath = Path.Combine(contentRoot, "data", "fish.json");
    var seeded = FishSeeder.SeedFromJsonIfEmpty(db, seedPath, logger);
    if (seeded > 0)
        logger.LogInformation("Imported {Count} fish from data/fish.json into the database", seeded);

    if (scope.ServiceProvider.GetRequiredService<GeminiChatService>().HasApiKey is false)
        logger.LogWarning("GEMINI_API_KEY is not set - the catalog works, but the chatbot will error");
}

// Serve the built Angular app from wwwroot, with SPA-style fallback routing.
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapFishEndpoints();
app.MapAdminEndpoints();
app.MapChatEndpoints();

// Unknown /api/* paths are a real 404 — don't hand them the SPA shell.
app.Map("/api/{**rest}", () => Results.NotFound());

// Everything else is a client-side route: serve the Angular entry point.
app.MapFallbackToFile("index.html");

app.Run();

// Walk up from the working directory looking for a file; return the best guess
// even if not found (DotEnv.Load then simply no-ops).
static string FindUp(string fileName)
{
    var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
    while (dir is not null)
    {
        var candidate = Path.Combine(dir.FullName, fileName);
        if (File.Exists(candidate)) return candidate;
        dir = dir.Parent;
    }
    return fileName;
}

public partial class Program;
