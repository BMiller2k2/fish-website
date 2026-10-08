using FishFinder.Models;
using FishFinder.Services;

namespace FishFinder.Api;

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        // Does this server even require a token? Lets the sign-in page adapt.
        app.MapGet("/api/admin/config", (AdminAuth auth) =>
            Results.Ok(new { tokenRequired = auth.TokenRequired }));

        // Check a token before the browser stores it and moves to the admin page.
        app.MapPost("/api/admin/login", (LoginRequest body, AdminAuth auth) =>
        {
            if (!auth.TokenRequired)
                return Results.Ok(new { ok = true });

            var token = body.Token ?? "";
            if (token.Length > 0 && string.Equals(token, auth.Token, StringComparison.Ordinal))
                return Results.Ok(new { ok = true });

            return Results.Json(new { error = "That admin token isn't right." }, statusCode: 401);
        });
    }
}
