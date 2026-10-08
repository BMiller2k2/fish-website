using FishFinder.Models;
using Microsoft.EntityFrameworkCore;

namespace FishFinder.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Fish> Fish => Set<Fish>();
    public DbSet<FishFact> FishFacts => Set<FishFact>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Fish>(e =>
        {
            e.ToTable("fish");
            e.HasKey(f => f.Id);
            e.HasMany(f => f.Facts)
                .WithOne(x => x.Fish)
                .HasForeignKey(x => x.FishId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<FishFact>(e =>
        {
            e.ToTable("fish_facts");
            e.HasKey(x => new { x.FishId, x.Position });
        });
    }
}
