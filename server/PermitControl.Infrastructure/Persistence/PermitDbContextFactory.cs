using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PermitControl.Infrastructure.Persistence;

/// <summary>
/// Used only by `dotnet ef` to compile the model. The placeholder password is not a credential
/// and this factory does not open a connection.
/// </summary>
public sealed class PermitDbContextFactory : IDesignTimeDbContextFactory<PermitDbContext>
{
    public PermitDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("PERMIT_DB_CONNECTION")
            ?? "Host=localhost;Port=5432;Database=permit_control;Username=permit_control_api;Password=CHANGE_ME";

        var options = new DbContextOptionsBuilder<PermitDbContext>()
            .UseNpgsql(connection)
            .Options;

        return new PermitDbContext(options);
    }
}
