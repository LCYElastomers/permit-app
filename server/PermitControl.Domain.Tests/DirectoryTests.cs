using System.Text.Json;
using PermitControl.Domain;
using PermitControl.Infrastructure.Documents;

namespace PermitControl.Domain.Tests;

public sealed class DirectoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 23, 12, 0, 0, TimeSpan.Zero);
    private const string Pin = "135790";
    private const string Next = "246801";
    private const string Third = "102938";
    private const string Fourth = "564738";
    private const string Fifth = "908172";

    [Fact]
    public void Bootstrap_assigns_stable_codes_and_roles()
    {
        var world = DirectoryWorld.Bootstrap();
        var bobby = world.Users.Single(user => user.Id == DirectorySeed.Bobby);
        Assert.Equal("PCU-0001", bobby.PermitUserCode);
        Assert.Equal("Bobby Fitzgerald", bobby.DisplayName);
        Assert.Equal(nameof(AppRole.SUPER_ADMIN), Assert.Single(world.RolesOf(bobby.Id)));
        Assert.True(PermitCapabilities.Has(world.RolesOf(bobby.Id), nameof(AppRole.PERMIT_AUTHORIZER)));
        Assert.True(PermitCapabilities.Has(world.RolesOf(bobby.Id), nameof(AppRole.CRAFT_RECEIVER)));
        Assert.Equal("PCU-0002", world.Users.Single(user => user.Id == DirectorySeed.Patrick).PermitUserCode);
        foreach (var id in new[] { DirectorySeed.Patrick, DirectorySeed.Mike, DirectorySeed.Tommy, DirectorySeed.John })
        {
            var roles = world.RolesOf(id);
            Assert.Contains(nameof(AppRole.REQUESTER), roles);
            Assert.Contains(nameof(AppRole.PERMIT_AUTHORIZER), roles);
            Assert.Contains(nameof(AppRole.SHIFT_SUPERVISOR), roles);
        }

        foreach (var id in new[] { DirectorySeed.Cody, DirectorySeed.Myral, DirectorySeed.Angie })
        {
            var roles = world.RolesOf(id);
            Assert.Contains(nameof(AppRole.REQUESTER), roles);
            Assert.Contains(nameof(AppRole.PERMIT_AUTHORIZER), roles);
            Assert.DoesNotContain(nameof(AppRole.SHIFT_SUPERVISOR), roles);
        }

        Assert.Equal(8, world.Users.Select(user => user.PermitUserCode).Distinct().Count());
        Assert.All(world.Users, user => Assert.NotEqual(Guid.Empty, user.Id));
        Assert.All(world.Credentials, credential => Assert.Null(credential.PinHash));
        Assert.Contains("ON CONFLICT (\"Id\")", UserCodes.AllocateSql, StringComparison.Ordinal);
        Assert.Contains("RETURNING \"LastValue\"", UserCodes.AllocateSql, StringComparison.Ordinal);
    }

    [Fact]
    public void Windows_match_is_normalized_and_display_name_is_not_identity()
    {
        var world = DirectoryWorld.Bootstrap();
        var (error, token) = world.OpenWindows("lcy", "Bobby.Fitzgerald", Now);
        Assert.Null(error);
        Assert.Equal(DirectorySeed.Bobby, world.FindSession(token, Now)!.Id);
        var (domainError, domainToken) = world.OpenWindows(null, @"LCY\bobby.fitzgerald", Now);
        Assert.Null(domainError);
        Assert.Equal(DirectorySeed.Bobby, world.FindSession(domainToken, Now)!.Id);
        Assert.Equal("select-user", world.OpenWindows(null, "Bobby Fitzgerald", Now).Error);
        world.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            PermitUserCode = "PCU-0099",
            Username = "plant\\shared",
            DisplayName = "Shared",
            Email = "shared@permit-control.local",
            WindowsDomain = "plant",
            WindowsUsername = "bobby.fitzgerald",
            Enabled = true,
            CreatedAt = Now,
        });
        Assert.Equal("select-user", world.OpenWindows(null, "bobby.fitzgerald", Now).Error);
    }

    [Fact]
    public void Job_title_and_personnel_code_do_not_grant_authority_or_rewrite_history()
    {
        var world = Ready();
        var permit = world.AddPermit(PermitType.GENERAL_WORK, "Gauge", "WO-1", PermitModuleKind.CORE);
        Assert.Null(world.Submit(permit.Id, DirectorySeed.Patrick, Now));
        Assert.Null(world.Authorize(permit.Id, DirectorySeed.Mike, Pin, 1, Now.AddMinutes(5)));
        var approval = world.Approvals.Single(item => item.Decision == "AUTHORIZED");
        Assert.Equal(nameof(AppRole.PERMIT_AUTHORIZER), approval.ActingRole);
        Assert.Equal("PCU-0003", approval.PermitUserCodeSnapshot);
        Assert.Equal("Mike Distefano", approval.DisplayNameSnapshot);
        var edits = world.Users.Single(user => user.Id == DirectorySeed.Cody);
        edits.JobTitle = "Shift Supervisor";
        edits.Department = "Finishing";
        edits.PersonnelReference = "5201";
        edits.PersonnelCode = "SS";
        edits.WindowsUsername = "cody.stanfill";
        Assert.Null(world.EditProfile(DirectorySeed.Bobby, DirectorySeed.Cody, edits));
        var cody = world.Users.Single(user => user.Id == DirectorySeed.Cody);
        Assert.Equal("PCU-0006", cody.PermitUserCode);
        Assert.Equal("Shift Supervisor", cody.JobTitle);
        Assert.DoesNotContain(nameof(AppRole.SHIFT_SUPERVISOR), world.RolesOf(cody.Id));
        Assert.Equal("Mike Distefano", approval.DisplayNameSnapshot);
        Assert.Equal("Shift Supervisor", world.Users.Single(user => user.Id == DirectorySeed.Mike).JobTitle);
    }

    [Fact]
    public void Pin_enrollment_change_history_age_and_lockout_are_enforced()
    {
        var world = DirectoryWorld.Bootstrap();
        Assert.Equal("pin-format-invalid", world.Enroll(DirectorySeed.Bobby, "12ab56", "12ab56", Now));
        Assert.Equal("pin-too-weak", world.Enroll(DirectorySeed.Bobby, "123456", "123456", Now));
        Assert.Null(world.Enroll(DirectorySeed.Bobby, Pin, Pin, Now));
        var credential = world.Credentials.Single(item => item.UserId == DirectorySeed.Bobby);
        Assert.Equal(PinCredentialState.ACTIVE, credential.State);
        Assert.NotNull(credential.PinChangedAt);
        Assert.StartsWith("$argon2id$", credential.PinHash, StringComparison.Ordinal);
        Assert.DoesNotContain(Pin, credential.PinHash, StringComparison.Ordinal);
        Assert.Equal("pin-minimum-age", world.ChangePin(DirectorySeed.Bobby, Pin, Next, Next, Now.AddHours(1)));
        Assert.Null(world.ChangePin(DirectorySeed.Bobby, Pin, Next, Next, Now.AddHours(25)));
        Assert.Equal("pin-not-accepted", world.ChangePin(DirectorySeed.Bobby, Pin, Third, Third, Now.AddHours(50)));
        Assert.Equal("pin-reuse-not-allowed", world.ChangePin(DirectorySeed.Bobby, Next, Pin, Pin, Now.AddHours(50)));
        Assert.Null(world.ChangePin(DirectorySeed.Bobby, Next, Third, Third, Now.AddHours(50)));
        Assert.Null(world.ChangePin(DirectorySeed.Bobby, Third, Fourth, Fourth, Now.AddHours(75)));
        Assert.Null(world.ChangePin(DirectorySeed.Bobby, Fourth, Fifth, Fifth, Now.AddHours(100)));
        Assert.Equal("pin-reuse-not-allowed", world.ChangePin(DirectorySeed.Bobby, Fifth, Next, Next, Now.AddHours(125)));
        Assert.Null(world.ChangePin(DirectorySeed.Bobby, Fifth, Pin, Pin, Now.AddHours(125)));
        for (var attempt = 0; attempt < 4; attempt++) Assert.Equal("pin-not-accepted", world.Verify(DirectorySeed.Bobby, "111119", Now.AddHours(130)));
        Assert.Equal("pin-locked", world.Verify(DirectorySeed.Bobby, "111119", Now.AddHours(130)));
        Assert.Equal("pin-locked", world.Verify(DirectorySeed.Bobby, Pin, Now.AddHours(130).AddMinutes(1)));
        Assert.Null(world.Verify(DirectorySeed.Bobby, Pin, Now.AddHours(130).AddMinutes(16)));
        Assert.Equal(0, world.Credentials.Single(item => item.UserId == DirectorySeed.Bobby).FailedAttempts);
        var profile = UserProfiles.View(world.Users.Single(user => user.Id == DirectorySeed.Bobby), credential, world.RolesOf(DirectorySeed.Bobby), [], [], false);
        var json = JsonSerializer.Serialize(profile);
        Assert.DoesNotContain("PinHash", json, StringComparison.Ordinal);
        Assert.DoesNotContain(Pin, json, StringComparison.Ordinal);
        Assert.All(world.Audits, audit => Assert.DoesNotContain(Pin, $"{audit.ReasonCode}{audit.EventType}", StringComparison.Ordinal));
    }

    [Fact]
    public void Repeat_enrollment_does_not_replace_an_active_pin()
    {
        var world = DirectoryWorld.Bootstrap();
        Assert.Null(world.Enroll(DirectorySeed.Bobby, Pin, Pin, Now));
        var credential = world.Credentials.Single(item => item.UserId == DirectorySeed.Bobby);
        var enrolledHash = credential.PinHash;
        Assert.NotNull(enrolledHash);
        Assert.Equal("pin-already-enrolled", world.Enroll(DirectorySeed.Bobby, Next, Next, Now.AddMinutes(1)));
        Assert.Equal(enrolledHash, credential.PinHash);
        Assert.Equal(PinCredentialState.ACTIVE, credential.State);
        Assert.Null(world.Verify(DirectorySeed.Bobby, Pin, Now.AddMinutes(2)));
        Assert.Equal("pin-not-accepted", world.Verify(DirectorySeed.Bobby, Next, Now.AddMinutes(2)));
        Assert.DoesNotContain(Pin, enrolledHash, StringComparison.Ordinal);
        Assert.DoesNotContain(Next, enrolledHash, StringComparison.Ordinal);
        Assert.All(world.Audits, audit => Assert.DoesNotContain(Pin, $"{audit.ReasonCode}{audit.EventType}", StringComparison.Ordinal));
    }

    [Fact]
    public void Admin_can_require_change_reset_enrollment_and_unlock()
    {
        var world = Ready();
        Assert.Null(world.RequireChange(DirectorySeed.Bobby, Pin, DirectorySeed.Patrick, Now.AddHours(1)));
        var permit = world.AddPermit(PermitType.GENERAL_WORK, "Gauge", "WO-1", PermitModuleKind.CORE);
        Assert.Null(world.Submit(permit.Id, DirectorySeed.Mike, Now.AddHours(1)));
        Assert.Equal("pin-change-required", world.Authorize(permit.Id, DirectorySeed.Patrick, Pin, 1, Now.AddHours(1)));
        Assert.Null(world.ChangePin(DirectorySeed.Patrick, Pin, Next, Next, Now.AddHours(1)));
        Assert.Null(world.Authorize(permit.Id, DirectorySeed.Patrick, Next, 1, Now.AddHours(1)));
        Assert.Null(world.ResetEnrollment(DirectorySeed.Bobby, Pin, DirectorySeed.Patrick, Now.AddHours(2), reason: "forgotten"));
        Assert.Equal("pin-not-enrolled", world.Verify(DirectorySeed.Patrick, Next, Now.AddHours(2)));
        Assert.Null(world.Enroll(DirectorySeed.Patrick, Third, Third, Now.AddHours(2)));
        Assert.Equal(CredentialAuditType.PIN_ENROLLMENT_RESET, world.Audits.Single(item => item.EventType == CredentialAuditType.PIN_ENROLLMENT_RESET).EventType);
        for (var attempt = 0; attempt < 5; attempt++) world.Verify(DirectorySeed.Patrick, "000001", Now.AddHours(3));
        Assert.Null(world.Unlock(DirectorySeed.Bobby, Pin, DirectorySeed.Patrick, Now.AddHours(3)));
        Assert.Equal(PinCredentialState.ACTIVE, world.Credentials.Single(item => item.UserId == DirectorySeed.Patrick).State);
        Assert.Contains(world.Audits, item => item.EventType == CredentialAuditType.PIN_UNLOCKED && item.PerformedByUserId == DirectorySeed.Bobby);
    }

    [Fact]
    public void Lifecycle_requires_the_acting_capability_pin_and_self_policy()
    {
        var world = Ready();
        var permit = world.AddPermit(PermitType.GENERAL_WORK, "Gauge", "WO-1", PermitModuleKind.CORE);
        var viewer = new User { DisplayName = "Viewer Only", WindowsUsername = "viewer.only" };
        Assert.Null(world.CreateUser(DirectorySeed.Bobby, viewer, [nameof(AppRole.VIEWER)], Now));
        Assert.Equal("capability-required", world.Submit(permit.Id, viewer.Id, Now));
        Assert.Null(world.Submit(permit.Id, DirectorySeed.Patrick, Now));
        Assert.Equal(PermitStatus.PENDING_REVIEW, world.Permits.Single().Status);
        Assert.Equal("capability-required", world.Authorize(permit.Id, viewer.Id, Pin, 1, Now));
        Assert.Equal("pin-not-accepted", world.Authorize(permit.Id, DirectorySeed.Mike, "000001", 1, Now));
        Assert.Equal(PermitStatus.PENDING_REVIEW, world.Permits.Single().Status);
        Assert.Equal("self-authorization-denied", world.Authorize(permit.Id, DirectorySeed.Patrick, Pin, 1, Now));
        var own = world.AddPermit(PermitType.GENERAL_WORK, "Own", "WO-9", PermitModuleKind.CORE);
        Assert.Null(world.Submit(own.Id, DirectorySeed.Bobby, Now));
        Assert.Equal("self-authorization-denied", world.Authorize(own.Id, DirectorySeed.Bobby, Pin, 1, Now));
        world.AllowSelfAuthorization = true;
        Assert.Null(world.Authorize(own.Id, DirectorySeed.Bobby, Pin, 1, Now));
        world.AllowSelfAuthorization = false;
        Assert.Null(world.Authorize(permit.Id, DirectorySeed.Bobby, Pin, 1, Now.AddMinutes(1)));
        var authorized = world.Events.Single(item => item.EventType == PermitEventType.PERMIT_AUTHORIZED && item.PermitId == permit.Id);
        Assert.Equal(DirectorySeed.Bobby, authorized.UserId);
        Assert.Equal(nameof(AppRole.PERMIT_AUTHORIZER), authorized.ActingRole);
        Assert.Equal("PCU-0001", authorized.PermitUserCodeSnapshot);
        Assert.Equal(PermitStatus.AUTHORIZED, world.Permits.Single(item => item.Id == permit.Id).Status);
        Assert.NotEqual("WORK AUTHORIZED", PermitDocumentStatus.Describe(PermitStatus.AUTHORIZED).Authority);
        Assert.Equal("capability-required", world.Accept(permit.Id, DirectorySeed.Mike, Pin, 1, Now.AddMinutes(2)));
        Assert.Equal("pin-not-accepted", world.Accept(permit.Id, DirectorySeed.Bobby, "000001", 1, Now.AddMinutes(2)));
        Assert.Null(world.Accept(permit.Id, DirectorySeed.Bobby, Pin, 1, Now.AddMinutes(2)));
        Assert.Equal(PermitStatus.AUTHORIZED, world.Permits.Single(item => item.Id == permit.Id).Status);
        var hot = world.AddPermit(PermitType.HOT_WORK, "Weld", "WO-2", PermitModuleKind.HOT_WORK, PermitModuleKind.FIRE_WATCH);
        Assert.Null(world.Submit(hot.Id, DirectorySeed.Patrick, Now));
        Assert.Null(world.Authorize(hot.Id, DirectorySeed.Mike, Pin, 1, Now));
        Assert.Null(world.Accept(hot.Id, DirectorySeed.Bobby, Pin, 1, Now));
        Assert.Equal("specialty-incomplete", world.Activate(hot.Id, DirectorySeed.Bobby, Pin, 1, Now));
        Assert.Null(world.Activate(permit.Id, DirectorySeed.Bobby, Pin, 1, Now.AddMinutes(3), nameof(AppRole.CRAFT_RECEIVER)));
        Assert.Equal(PermitStatus.ACTIVE, world.Permits.Single(item => item.Id == permit.Id).Status);
        Assert.Equal("WORK AUTHORIZED", PermitDocumentStatus.Describe(PermitStatus.ACTIVE).Authority);
        var document = GeneralWorkDocuments.Compose(new AuthoritativeGeneralWork
        {
            Permit = world.Permits.Single(item => item.Id == permit.Id),
            Approvals = world.Approvals.Where(item => item.PermitId == permit.Id).ToArray(),
        }, Guid.NewGuid(), Now);
        Assert.Contains("WORK AUTHORIZED", document.Banner);
        Assert.Contains(document.Sections.SelectMany(section => section.Lines), line => line.Contains("PCU-0001", StringComparison.Ordinal));
        Assert.DoesNotContain(Pin, document.Contains(Pin) ? Pin : "", StringComparison.Ordinal);
        Assert.False(document.Contains(Pin));
        var bytes = System.Text.Encoding.Latin1.GetBytes(string.Join('\n', document.Banner.Concat(document.Sections.SelectMany(section => section.Lines))));
        world.Users.Single(user => user.Id == DirectorySeed.Bobby).DisplayName = "Robert Fitzgerald";
        Assert.Contains("Bobby Fitzgerald", System.Text.Encoding.Latin1.GetString(bytes));
    }

    [Fact]
    public void Administration_allocates_the_next_code_and_keeps_disabled_codes()
    {
        var world = Ready();
        Assert.Equal("capability-required", world.CreateUser(DirectorySeed.Patrick, new User { DisplayName = "New Person", WindowsUsername = "new.person" }, [nameof(AppRole.REQUESTER)], Now));
        var profile = new User { DisplayName = "New Person", WindowsUsername = "new.person", JobTitle = "Operator", PersonnelCode = "SS", PersonnelReference = "5200" };
        Assert.Null(world.CreateUser(DirectorySeed.Bobby, profile, [nameof(AppRole.REQUESTER)], Now));
        Assert.Equal("PCU-0009", profile.PermitUserCode);
        world.Users.Single(user => user.Id == DirectorySeed.Angie).Enabled = false;
        var second = new User { DisplayName = "Another Person", WindowsUsername = "another.person" };
        Assert.Null(world.CreateUser(DirectorySeed.Bobby, second, [nameof(AppRole.VIEWER)], Now));
        Assert.Equal("PCU-0010", second.PermitUserCode);
        Assert.Equal("PCU-0008", world.Users.Single(user => user.Id == DirectorySeed.Angie).PermitUserCode);
        Assert.Null(world.AddQualification(DirectorySeed.Bobby, profile.Id, QualificationType.GAS_TESTER, Now));
        Assert.Contains(world.Qualifications, item => item.UserId == profile.Id && item.QualificationType == QualificationType.GAS_TESTER);
        Assert.Equal("capability-required", world.SetRoles(DirectorySeed.Patrick, null, profile.Id, [nameof(AppRole.SUPER_ADMIN)], Now));
    }

    [Fact]
    public void Missing_ppe_blocks_authorization_and_return_for_correction_keeps_history()
    {
        var world = Ready();
        foreach (var type in Enum.GetValues<PermitType>())
        {
            Assert.Contains("PPE", PermitPreparation.RequiredModules(type));
            Assert.Contains("PPE", PermitPreparation.Blocking(type, "Work", "WO-1", 1, 0));
            Assert.DoesNotContain("PPE", PermitPreparation.Blocking(type, "Work", "WO-1", 1, 1));
        }

        var permit = world.AddPermit(PermitType.GENERAL_WORK, "Gauge", "WO-1", PermitModuleKind.PPE);
        world.Ppe.RemoveAll(item => item.PermitId == permit.Id);
        Assert.Null(world.Submit(permit.Id, DirectorySeed.Patrick, Now));
        Assert.Equal("permit-incomplete", world.Authorize(permit.Id, DirectorySeed.Mike, Pin, 1, Now));
        Assert.Equal(PermitStatus.PENDING_REVIEW, world.Permits.Single(item => item.Id == permit.Id).Status);

        world.Ppe.Add(new PermitPpe { Id = Guid.NewGuid(), PermitId = permit.Id, Label = "Gloves" });
        Assert.Null(world.Authorize(permit.Id, DirectorySeed.Mike, Pin, 1, Now.AddMinutes(1)));
        var authorized = world.Approvals.Single(item => item.PermitId == permit.Id && item.Decision == "AUTHORIZED");
        Assert.Equal(1, authorized.PermitRevision);
        Assert.Equal("Mike Distefano", authorized.DisplayNameSnapshot);

        Assert.Equal("lifecycle-conflict", world.Activate(permit.Id, DirectorySeed.Bobby, Pin, 1, Now.AddMinutes(2)));
        world.Ppe.RemoveAll(item => item.PermitId == permit.Id);
        Assert.Null(world.Accept(permit.Id, DirectorySeed.Bobby, Pin, 1, Now.AddMinutes(2)));
        Assert.Equal("permit-incomplete", world.Activate(permit.Id, DirectorySeed.Bobby, Pin, 1, Now.AddMinutes(3), nameof(AppRole.CRAFT_RECEIVER)));

        Assert.Null(world.ReturnForCorrection(permit.Id, DirectorySeed.Mike, 1, Now.AddMinutes(4)));
        var current = world.Permits.Single(item => item.Id == permit.Id);
        Assert.Equal(PermitStatus.PENDING_REVIEW, current.Status);
        Assert.Equal(2, current.CurrentRevision);
        Assert.Equal(permit.Id, current.Id);
        Assert.Equal("PTW-2026-00021", current.PermitNumber);
        Assert.Contains(world.Approvals, item => item.PermitId == permit.Id && item.Decision == "AUTHORIZED" && item.PermitRevision == 1);
        Assert.Contains(world.Events, item => item.PermitId == permit.Id && item.EventType == PermitEventType.PERMIT_RETURNED_FOR_CORRECTION && item.PermitRevision == 2);
        Assert.Equal("revision-conflict", world.Authorize(permit.Id, DirectorySeed.Bobby, Pin, 1, Now.AddMinutes(5)));
        Assert.Equal("permit-incomplete", world.Authorize(permit.Id, DirectorySeed.Bobby, Pin, 2, Now.AddMinutes(5)));
        world.Ppe.Add(new PermitPpe { Id = Guid.NewGuid(), PermitId = permit.Id, Label = "Hard hat" });
        Assert.Null(world.Authorize(permit.Id, DirectorySeed.Bobby, Pin, 2, Now.AddMinutes(6)));
        Assert.NotEqual(PermitStatus.ACTIVE, current.Status);

        var historical = GeneralWorkDocuments.Compose(new AuthoritativeGeneralWork
        {
            Permit = new Permit
            {
                Id = permit.Id,
                PermitNumber = current.PermitNumber,
                PermitType = PermitType.GENERAL_WORK,
                Status = PermitStatus.AUTHORIZED,
                CurrentRevision = 1,
                JobDescription = "Gauge",
                WorkOrder = "WO-1",
            },
            Approvals = [authorized],
        }, Guid.NewGuid(), Now);
        var historicalBytes = new PdfSharpPermitRenderer().Render(historical);
        current.Status = PermitStatus.PENDING_REVIEW;
        current.CurrentRevision = 2;
        var corrected = GeneralWorkDocuments.Compose(new AuthoritativeGeneralWork
        {
            Permit = current,
            Approvals = [authorized],
        }, Guid.NewGuid(), Now.AddMinutes(4));
        var correctedBytes = new PdfSharpPermitRenderer().Render(corrected);
        Assert.Contains("NOT ACTIVE FOR WORK", historical.Banner);
        Assert.Contains("REV 01", historical.Banner);
        Assert.Contains("PENDING REVIEW", corrected.Banner);
        Assert.Contains("NOT AUTHORIZED FOR WORK", corrected.Banner);
        Assert.Contains("REV 02", corrected.Banner);
        Assert.True(corrected.Contains("Rev 01"));
        Assert.False(corrected.Contains("WORK AUTHORIZED"));
        Assert.NotEqual(historicalBytes, correctedBytes);
        var active = GeneralWorkDocuments.Compose(new AuthoritativeGeneralWork
        {
            Permit = new Permit
            {
                Id = permit.Id,
                PermitNumber = current.PermitNumber,
                PermitType = PermitType.GENERAL_WORK,
                Status = PermitStatus.ACTIVE,
                CurrentRevision = 2,
                JobDescription = "Gauge",
                WorkOrder = "WO-1",
            },
        }, Guid.NewGuid(), Now);
        Assert.Contains("WORK AUTHORIZED", active.Banner);
        Assert.DoesNotContain("WORK AUTHORIZED", corrected.Banner);
        current.Status = PermitStatus.ACTIVE;
        Assert.Equal("lifecycle-conflict", world.ReturnForCorrection(permit.Id, DirectorySeed.Mike, 2, Now.AddMinutes(7)));
        current.Status = PermitStatus.SUSPENDED;
        Assert.Equal("lifecycle-conflict", world.ReturnForCorrection(permit.Id, DirectorySeed.Mike, 2, Now.AddMinutes(8)));
        current.Status = PermitStatus.CLOSED;
        Assert.Equal("lifecycle-conflict", world.ReturnForCorrection(permit.Id, DirectorySeed.Mike, 2, Now.AddMinutes(9)));
    }

    private static DirectoryWorld Ready()
    {
        var world = DirectoryWorld.Bootstrap();
        Assert.Null(world.Enroll(DirectorySeed.Bobby, Pin, Pin, Now));
        Assert.Null(world.Enroll(DirectorySeed.Patrick, Pin, Pin, Now));
        Assert.Null(world.Enroll(DirectorySeed.Mike, Pin, Pin, Now));
        return world;
    }
}

file static class DirectoryUsers
{
    public static Guid CreatePlainUser(this DirectoryWorld world, string name)
    {
        var profile = new User { DisplayName = name, WindowsUsername = name.Replace(' ', '.').ToLowerInvariant() };
        var error = world.CreateUser(DirectorySeed.Bobby, profile, [nameof(AppRole.REQUESTER)], new DateTimeOffset(2026, 10, 23, 12, 0, 0, TimeSpan.Zero));
        Assert.Null(error);
        return profile.Id;
    }
}
