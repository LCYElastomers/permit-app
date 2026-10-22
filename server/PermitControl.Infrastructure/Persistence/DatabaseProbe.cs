using Microsoft.Extensions.Logging;
using PermitControl.Application;

namespace PermitControl.Infrastructure.Persistence;

internal sealed class DatabaseProbe(PermitDbContext database, ILogger<DatabaseProbe> logger) : IDatabaseProbe
{
    public async Task<bool> CanQueryAsync(CancellationToken cancellationToken)
    {
        try
        {
            return await database.Database.CanConnectAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning("Database readiness check failed ({ExceptionType}).", exception.GetType().Name);
            return false;
        }
    }
}
