using System.Data.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using PermitControl.Application;
using PermitControl.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddPermitInfrastructure(builder.Configuration);
builder.Services.AddCors(options =>
{
    options.AddPolicy("local-ui", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://127.0.0.1:3000")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseExceptionHandler(handler =>
{
    handler.Run(async context =>
    {
        var failure = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("PermitControl.Api");
        if (failure is DbException or DbUpdateException or DatabaseUnavailableException)
        {
            logger.LogWarning("Database request failed ({ExceptionType}).", failure.GetType().Name);
        }
        else
        {
            logger.LogError(failure, "Unhandled API exception.");
        }

        var unavailable = failure is DatabaseUnavailableException;
        context.Response.StatusCode = unavailable
            ? StatusCodes.Status503ServiceUnavailable
            : StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new { error = unavailable ? "database-unavailable" : "unexpected-error" });
    });
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("local-ui");
app.MapControllers();
app.Run();
