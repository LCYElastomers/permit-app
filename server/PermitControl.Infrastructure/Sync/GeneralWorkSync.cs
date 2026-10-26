using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using PermitControl.Application;
using PermitControl.Domain;
using PermitControl.Infrastructure.Persistence;

namespace PermitControl.Infrastructure.Sync;

public sealed class GeneralWorkSync(PermitDbContext database) : IGeneralWorkSync
{
    public async Task<GeneralWorkResult> PushAsync(GeneralWorkPush push, CancellationToken cancellationToken)
    {
        if (string.Equals(push.EventType, nameof(PermitEventType.PERMIT_SUBMITTED), StringComparison.Ordinal))
        {
            return await PushSubmissionAsync(push, cancellationToken);
        }

        var error = GeneralWorkAcceptance.Validate(push);
        if (error is not null) return GeneralWorkResult.Invalid(error);

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var receipt = await database.SyncEvents.FirstOrDefaultAsync(item => item.Id == push.EventId, cancellationToken);
            if (receipt is not null)
            {
                if (receipt.PermitId != push.PermitId) return GeneralWorkResult.Conflict("event-permit-mismatch");
                var existingNumber = await database.Permits
                    .Where(item => item.Id == push.PermitId)
                    .Select(item => item.PermitNumber)
                    .FirstAsync(cancellationToken);
                return GeneralWorkResult.Duplicate(push.EventId, push.PermitId, existingNumber);
            }

            if (await database.Permits.AnyAsync(item => item.Id == push.PermitId, cancellationToken))
            {
                return GeneralWorkResult.Conflict("permit-already-created");
            }

            if (push.Body?.AreaId is Guid areaId
                && !await database.Areas.AnyAsync(item => item.Id == areaId, cancellationToken))
            {
                return GeneralWorkResult.Invalid("unknown-area");
            }

            var recordedAt = DateTimeOffset.UtcNow;
            var number = await AllocateNumberAsync(recordedAt.Year, cancellationToken);
            var plan = GeneralWorkAcceptance.Build(push, number, recordedAt);
            database.Add(plan.Permit);
            database.Add(plan.Revision);
            database.Add(plan.Event);
            database.Add(plan.Receipt);
            database.AddRange(plan.Participants);
            database.AddRange(plan.Hazards);
            database.AddRange(plan.Controls);
            database.AddRange(plan.Ppe);
            database.AddRange(plan.Modules);
            database.AddRange(plan.ModuleFacts);
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return GeneralWorkResult.Accepted(plan);
        }
        catch (Exception exception) when (IsUniqueViolation(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            database.ChangeTracker.Clear();
            var receipt = await database.SyncEvents.AsNoTracking().FirstOrDefaultAsync(item => item.Id == push.EventId, cancellationToken);
            if (receipt?.PermitId == push.PermitId)
            {
                var number = await database.Permits.AsNoTracking()
                    .Where(item => item.Id == push.PermitId)
                    .Select(item => item.PermitNumber)
                    .FirstOrDefaultAsync(cancellationToken);
                if (!string.IsNullOrWhiteSpace(number))
                {
                    return GeneralWorkResult.Duplicate(push.EventId, push.PermitId, number);
                }
            }

            throw new DatabaseUnavailableException();
        }
        catch (Exception exception) when (IsDatabaseFailure(exception))
        {
            throw new DatabaseUnavailableException();
        }
    }

    private async Task<GeneralWorkResult> PushSubmissionAsync(GeneralWorkPush push, CancellationToken cancellationToken)
    {
        var error = GeneralWorkAcceptance.ValidateSubmission(push);
        if (error is not null) return GeneralWorkResult.Invalid(error);

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var receipt = await database.SyncEvents.FirstOrDefaultAsync(item => item.Id == push.EventId, cancellationToken);
            if (receipt is not null)
            {
                if (receipt.PermitId != push.PermitId) return GeneralWorkResult.Conflict("event-permit-mismatch");
                var existingNumber = await database.Permits
                    .Where(item => item.Id == push.PermitId)
                    .Select(item => item.PermitNumber)
                    .FirstAsync(cancellationToken);
                return GeneralWorkResult.Duplicate(push.EventId, push.PermitId, existingNumber);
            }

            var permit = await database.Permits.FirstOrDefaultAsync(item => item.Id == push.PermitId, cancellationToken);
            if (permit is null) return GeneralWorkResult.Conflict("permit-not-ready");
            if (permit.Status is not (PermitStatus.DRAFT or PermitStatus.PENDING_REVIEW))
            {
                return GeneralWorkResult.Conflict("lifecycle-conflict");
            }

            var recordedAt = DateTimeOffset.UtcNow;
            var (domainEvent, syncReceipt) = GeneralWorkAcceptance.BuildSubmission(permit, push, recordedAt);
            database.Add(domainEvent);
            database.Add(syncReceipt);
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return GeneralWorkResult.AcceptedSubmission(domainEvent.Id, permit.Id, permit.PermitNumber);
        }
        catch (Exception exception) when (IsUniqueViolation(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            database.ChangeTracker.Clear();
            var receipt = await database.SyncEvents.AsNoTracking().FirstOrDefaultAsync(item => item.Id == push.EventId, cancellationToken);
            if (receipt?.PermitId == push.PermitId)
            {
                var number = await database.Permits.AsNoTracking()
                    .Where(item => item.Id == push.PermitId)
                    .Select(item => item.PermitNumber)
                    .FirstOrDefaultAsync(cancellationToken);
                if (!string.IsNullOrWhiteSpace(number))
                {
                    return GeneralWorkResult.Duplicate(push.EventId, push.PermitId, number);
                }
            }

            throw new DatabaseUnavailableException();
        }
        catch (Exception exception) when (IsDatabaseFailure(exception))
        {
            throw new DatabaseUnavailableException();
        }
    }

    private async Task<string> AllocateNumberAsync(int year, CancellationToken cancellationToken)
    {
        var connection = database.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.Transaction = database.Database.CurrentTransaction?.GetDbTransaction();
        command.CommandText = PermitNumberSql.Allocate;
        var parameter = command.CreateParameter();
        parameter.ParameterName = "year";
        parameter.Value = year;
        command.Parameters.Add(parameter);
        var value = await command.ExecuteScalarAsync(cancellationToken);
        var sequence = value switch
        {
            int number => number,
            long number => checked((int)number),
            _ => throw new DatabaseUnavailableException(),
        };
        return PermitNumbers.Format(year, sequence);
    }

    private static bool IsUniqueViolation(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgres && postgres.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return true;
            }
        }

        return false;
    }

    private static bool IsDatabaseFailure(Exception exception) =>
        exception is DbException or DbUpdateException or DatabaseUnavailableException;
}
