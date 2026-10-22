using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PermitControl.Domain;

namespace PermitControl.Infrastructure.Persistence;

internal static class ModelConfiguration
{
    public static void Configure(ModelBuilder model)
    {
        ConfigureIdentity(model);
        ConfigureReference(model);
        ConfigurePermits(model);
        ConfigureModules(model);
        ConfigureHistory(model);
        ConfigureFiles(model);
    }

    private static void ConfigureIdentity(ModelBuilder model)
    {
        model.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Username).HasMaxLength(80).IsRequired();
            entity.Property(item => item.DisplayName).HasMaxLength(160).IsRequired();
            entity.Property(item => item.Email).HasMaxLength(200).IsRequired();
            entity.Property(item => item.ExternalSubjectId).HasMaxLength(200);
            entity.Property(item => item.AuthProvider).HasConversion<string>().HasMaxLength(16);
            entity.Property(item => item.CreatedAt).HasColumnType("timestamptz");
            entity.HasIndex(item => item.Username).IsUnique();
        });

        model.Entity<Role>(entity =>
        {
            entity.ToTable("roles");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Name).HasMaxLength(80).IsRequired();
            entity.HasIndex(item => item.Name).IsUnique();
        });

        model.Entity<UserRole>(entity =>
        {
            entity.ToTable("user_roles");
            entity.HasKey(item => new { item.UserId, item.RoleId });
            entity.HasOne(item => item.User).WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(item => item.Role).WithMany().HasForeignKey(item => item.RoleId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureReference(ModelBuilder model)
    {
        model.Entity<Area>(entity =>
        {
            entity.ToTable("areas");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Name).HasMaxLength(AreaRegistration.MaxNameLength).IsRequired();
            entity.HasIndex(item => item.Name).IsUnique();
        });

        model.Entity<Equipment>(entity =>
        {
            entity.ToTable("equipment");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Tag).HasMaxLength(80).IsRequired();
            entity.Property(item => item.Name).HasMaxLength(160).IsRequired();
            entity.HasIndex(item => item.Tag);
            entity.HasOne(item => item.Area).WithMany().HasForeignKey(item => item.AreaId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<Contractor>(entity =>
        {
            entity.ToTable("contractors");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Name).HasMaxLength(160).IsRequired();
        });
    }

    private static void ConfigurePermits(ModelBuilder model)
    {
        model.Entity<Permit>(entity =>
        {
            entity.ToTable("permits");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.PermitNumber).HasMaxLength(32).IsRequired();
            entity.Property(item => item.WorkOrder).HasMaxLength(40).IsRequired();
            entity.Property(item => item.JobDescription).HasMaxLength(2000).IsRequired();
            EnumString(entity.Property(item => item.PermitType));
            EnumString(entity.Property(item => item.Status));
            EnumString(entity.Property(item => item.CompanyType));
            Timestamp(entity.Property(item => item.CreatedAt));
            Timestamp(entity.Property(item => item.UpdatedAt));
            Timestamp(entity.Property(item => item.PlannedStart));
            Timestamp(entity.Property(item => item.ExpiresAt));
            Timestamp(entity.Property(item => item.ActivatedAt));
            Timestamp(entity.Property(item => item.ClosedAt));
            entity.HasIndex(item => item.PermitNumber).IsUnique();
            entity.HasIndex(item => item.Status);
            entity.HasIndex(item => item.PermitType);
            entity.HasIndex(item => item.AreaId);
            entity.HasIndex(item => item.EquipmentId);
            entity.HasIndex(item => item.WorkOrder);
            entity.HasIndex(item => item.CreatedAt);
            entity.HasIndex(item => item.ClosedAt);
            entity.HasOne(item => item.Area).WithMany().HasForeignKey(item => item.AreaId).IsRequired(false).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(item => item.Equipment).WithMany().HasForeignKey(item => item.EquipmentId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(item => item.Contractor).WithMany().HasForeignKey(item => item.ContractorId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(item => item.Creator).WithMany().HasForeignKey(item => item.CreatedBy).IsRequired(false).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<PermitRevision>(entity =>
        {
            entity.ToTable("permit_revisions");
            entity.HasKey(item => item.Id);
            Timestamp(entity.Property(item => item.CreatedAt));
            entity.HasIndex(item => new { item.PermitId, item.Number }).IsUnique();
            entity.HasOne(item => item.Permit).WithMany().HasForeignKey(item => item.PermitId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<PermitEvent>(entity =>
        {
            entity.ToTable("permit_events");
            entity.HasKey(item => item.Id);
            EnumString(entity.Property(item => item.EventType));
            EnumString(entity.Property(item => item.SyncSource));
            entity.Property(item => item.Payload).HasColumnType("jsonb");
            Timestamp(entity.Property(item => item.OccurredAt));
            Timestamp(entity.Property(item => item.RecordedAt));
            entity.HasIndex(item => new { item.PermitId, item.OccurredAt });
            entity.HasOne(item => item.Permit).WithMany().HasForeignKey(item => item.PermitId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureModules(ModelBuilder model)
    {
        model.Entity<PermitParticipant>(entity =>
        {
            entity.ToTable("permit_participants");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.RoleName).HasMaxLength(80).IsRequired();
            entity.Property(item => item.DisplayName).HasMaxLength(160).IsRequired();
            entity.HasOne(item => item.Permit).WithMany().HasForeignKey(item => item.PermitId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<PermitApproval>(entity =>
        {
            entity.ToTable("permit_approvals");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.RoleName).HasMaxLength(80).IsRequired();
            entity.Property(item => item.Decision).HasMaxLength(40).IsRequired();
            Timestamp(entity.Property(item => item.DecidedAt));
            entity.HasOne(item => item.Permit).WithMany().HasForeignKey(item => item.PermitId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<PermitModule>(entity =>
        {
            entity.ToTable("permit_modules");
            entity.HasKey(item => item.Id);
            EnumString(entity.Property(item => item.Kind));
            entity.HasIndex(item => new { item.PermitId, item.Kind });
            entity.HasOne(item => item.Permit).WithMany().HasForeignKey(item => item.PermitId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<PermitHazard>(entity =>
        {
            entity.ToTable("permit_hazards");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Label).HasMaxLength(160).IsRequired();
            RestrictPermit(entity);
        });

        model.Entity<PermitControlRecord>(entity =>
        {
            entity.ToTable("permit_controls");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Label).HasMaxLength(160).IsRequired();
            RestrictPermit(entity);
        });

        model.Entity<PermitPpe>(entity =>
        {
            entity.ToTable("permit_ppe");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Label).HasMaxLength(160).IsRequired();
            RestrictPermit(entity);
        });

        model.Entity<AtmosphericTest>(entity =>
        {
            entity.ToTable("atmospheric_tests");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.OxygenPercent).HasPrecision(5, 2);
            entity.Property(item => item.LelPercent).HasPrecision(5, 2);
            entity.Property(item => item.CarbonMonoxidePpm).HasPrecision(8, 2);
            entity.Property(item => item.Notes).HasMaxLength(500);
            EnumString(entity.Property(item => item.Result));
            Timestamp(entity.Property(item => item.TestedAt));
            entity.HasIndex(item => new { item.PermitId, item.TestedAt });
            entity.HasOne(item => item.Permit).WithMany().HasForeignKey(item => item.PermitId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<Isolation>(entity =>
        {
            entity.ToTable("isolations");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Plan).HasMaxLength(80).IsRequired();
            entity.Property(item => item.LockBox).HasMaxLength(80);
            Timestamp(entity.Property(item => item.ZeroEnergyVerifiedAt));
            entity.HasOne(item => item.Permit).WithMany().HasForeignKey(item => item.PermitId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureHistory(ModelBuilder model)
    {
        model.Entity<PermitSuspension>(entity =>
        {
            entity.ToTable("permit_suspensions");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Reason).HasMaxLength(500).IsRequired();
            Timestamp(entity.Property(item => item.SuspendedAt));
            entity.HasIndex(item => item.PermitId);
            RestrictPermit(entity);
        });

        model.Entity<PermitExtension>(entity =>
        {
            entity.ToTable("permit_extensions");
            entity.HasKey(item => item.Id);
            Timestamp(entity.Property(item => item.PreviousExpiresAt));
            Timestamp(entity.Property(item => item.NewExpiresAt));
            Timestamp(entity.Property(item => item.ExtendedAt));
            RestrictPermit(entity);
        });

        model.Entity<PermitReauthorization>(entity =>
        {
            entity.ToTable("permit_reauthorizations");
            entity.HasKey(item => item.Id);
            Timestamp(entity.Property(item => item.ReauthorizedAt));
            RestrictPermit(entity);
        });

        model.Entity<PermitClosure>(entity =>
        {
            entity.ToTable("permit_closures");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Notes).HasMaxLength(500);
            Timestamp(entity.Property(item => item.ClosedAt));
            entity.HasIndex(item => item.PermitId).IsUnique();
            RestrictPermit(entity);
        });
    }

    private static void ConfigureFiles(ModelBuilder model)
    {
        model.Entity<Attachment>(entity =>
        {
            entity.ToTable("attachments");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.OriginalFilename).HasMaxLength(260).IsRequired();
            entity.Property(item => item.StoredFilename).HasMaxLength(80).IsRequired();
            entity.Property(item => item.StorageKey).HasMaxLength(300).IsRequired();
            entity.Property(item => item.MimeType).HasMaxLength(120).IsRequired();
            entity.Property(item => item.Sha256).HasMaxLength(64).IsRequired();
            EnumString(entity.Property(item => item.StorageProvider));
            Timestamp(entity.Property(item => item.CreatedAt));
            entity.HasIndex(item => item.PermitId);
            entity.HasOne(item => item.Permit).WithMany().HasForeignKey(item => item.PermitId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<Device>(entity =>
        {
            entity.ToTable("devices");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Name).HasMaxLength(120).IsRequired();
            Timestamp(entity.Property(item => item.LastSeenAt));
        });

        model.Entity<PermitNumberCounter>(entity =>
        {
            entity.ToTable("permit_number_counters");
            entity.HasKey(item => item.Year);
            entity.Property(item => item.Year).ValueGeneratedNever();
        });

        model.Entity<SyncEvent>(entity =>
        {
            entity.ToTable("sync_events");
            entity.HasKey(item => item.Id);
            EnumString(entity.Property(item => item.EventType));
            Timestamp(entity.Property(item => item.ReceivedAt));
            entity.HasIndex(item => item.ReceivedAt);
            // PermitId is intentionally not a foreign key. See docs/DATA-MODEL.md.
        });
    }

    private static void RestrictPermit<TDependent>(EntityTypeBuilder<TDependent> entity)
        where TDependent : class
    {
        entity.HasOne<Permit>()
            .WithMany()
            .HasForeignKey("PermitId")
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void EnumString<T>(PropertyBuilder<T> property) where T : struct, Enum =>
        property.HasConversion<string>().HasMaxLength(40);

    private static void Timestamp(PropertyBuilder<DateTimeOffset> property) =>
        property.HasColumnType("timestamptz");

    private static void Timestamp(PropertyBuilder<DateTimeOffset?> property) =>
        property.HasColumnType("timestamptz");
}
