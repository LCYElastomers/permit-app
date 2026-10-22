using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PermitControl.Application;
using PermitControl.Infrastructure.Areas;
using PermitControl.Infrastructure.Documents;
using PermitControl.Infrastructure.Persistence;
using PermitControl.Infrastructure.Sync;
using PermitControl.Infrastructure.Storage;

namespace PermitControl.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddPermitInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connection = PermitDatabaseSettings.ConnectionString(configuration);
        services.AddSingleton<IDatabaseAvailability>(new DatabaseAvailability(connection is not null));
        services.AddDbContext<PermitDbContext>(options =>
        {
            options.UseNpgsql(connection ?? PermitDatabaseSettings.DesignTimePlaceholder);
        });
        services.AddSingleton<IFileStorage>(_ => new LocalFileStorage(configuration["PERMIT_FILE_ROOT"] ?? configuration["FileStorage:Root"]));
        services.AddScoped<IAreaCatalog, AreaCatalog>();
        services.AddScoped<IGeneralWorkSync, GeneralWorkSync>();
        services.AddSingleton<IPermitPdfRenderer, PdfSharpPermitRenderer>();
        services.AddScoped<IPermitPdfExport, PermitPdfExportService>();
        services.AddScoped<IDatabaseProbe, DatabaseProbe>();
        return services;
    }
}

public sealed record DatabaseAvailability(bool IsConfigured) : IDatabaseAvailability;

public static class PermitDatabaseSettings
{
    public const string DesignTimePlaceholder =
        "Host=localhost;Port=5432;Database=permit_control;Username=permit_control_api;Password=CHANGE_ME";

    public static string? ConnectionString(IConfiguration configuration)
    {
        var explicitConnection = configuration.GetConnectionString("PermitDatabase");
        if (!string.IsNullOrWhiteSpace(explicitConnection))
        {
            return explicitConnection;
        }

        var host = configuration["PERMIT_DB_HOST"] ?? configuration["PermitDatabase:Host"];
        var name = configuration["PERMIT_DB_NAME"] ?? configuration["PermitDatabase:Name"];
        var user = configuration["PERMIT_DB_USER"] ?? configuration["PermitDatabase:User"];
        var password = configuration["PERMIT_DB_PASSWORD"] ?? configuration["PermitDatabase:Password"];
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
        {
            return null;
        }

        var port = configuration["PERMIT_DB_PORT"] ?? configuration["PermitDatabase:Port"] ?? "5432";
        return $"Host={host};Port={port};Database={name};Username={user};Password={password}";
    }
}
