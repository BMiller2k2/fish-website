namespace FishFinder.Services;

// A single shared bearer token, exactly like the old server: if ADMIN_TOKEN is
// unset the admin API is open (local dev); otherwise every write must carry a
// matching X-Admin-Token header. No users, no sessions.
public class AdminAuth(IConfiguration config)
{
    public string? Token => config["ADMIN_TOKEN"] is { Length: > 0 } t ? t : null;

    public bool TokenRequired => Token is not null;

    public bool IsAuthorized(HttpRequest request)
    {
        if (Token is null) return true;
        return request.Headers.TryGetValue("X-Admin-Token", out var sent)
            && string.Equals(sent.ToString(), Token, StringComparison.Ordinal);
    }
}

// Endpoint filter so admin routes can just chain .AddEndpointFilter<AdminOnly>().
public class AdminOnly(AdminAuth auth) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        if (!auth.IsAuthorized(context.HttpContext.Request))
            return Results.Json(new { error = "Invalid or missing admin token." }, statusCode: 401);
        return await next(context);
    }
}
