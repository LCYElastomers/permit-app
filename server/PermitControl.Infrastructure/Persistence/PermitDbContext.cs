using Microsoft.EntityFrameworkCore;
using PermitControl.Domain;

namespace PermitControl.Infrastructure.Persistence;

public sealed class PermitDbContext(DbContextOptions<PermitDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<Area> Areas => Set<Area>();
    public DbSet<Equipment> Equipment => Set<Equipment>();
    public DbSet<Contractor> Contractors => Set<Contractor>();
    public DbSet<Permit> Permits => Set<Permit>();
    public DbSet<PermitRevision> PermitRevisions => Set<PermitRevision>();
    public DbSet<PermitEvent> PermitEvents => Set<PermitEvent>();
    public DbSet<PermitParticipant> PermitParticipants => Set<PermitParticipant>();
    public DbSet<PermitApproval> PermitApprovals => Set<PermitApproval>();
    public DbSet<PermitModule> PermitModules => Set<PermitModule>();
    public DbSet<PermitHazard> PermitHazards => Set<PermitHazard>();
    public DbSet<PermitControlRecord> PermitControls => Set<PermitControlRecord>();
    public DbSet<PermitPpe> PermitPpe => Set<PermitPpe>();
    public DbSet<AtmosphericTest> AtmosphericTests => Set<AtmosphericTest>();
    public DbSet<Isolation> Isolations => Set<Isolation>();
    public DbSet<PermitSuspension> PermitSuspensions => Set<PermitSuspension>();
    public DbSet<PermitExtension> PermitExtensions => Set<PermitExtension>();
    public DbSet<PermitReauthorization> PermitReauthorizations => Set<PermitReauthorization>();
    public DbSet<PermitClosure> PermitClosures => Set<PermitClosure>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<SyncEvent> SyncEvents => Set<SyncEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ModelConfiguration.Configure(modelBuilder);
    }
}
