namespace PermitControl.Domain;

public static class DirectorySeed
{
    public static readonly DateTimeOffset CreatedAt = new(2026, 10, 23, 0, 0, 0, TimeSpan.Zero);

    public static readonly Guid SuperAdmin = Guid.Parse("a0000001-0000-4000-8000-000000000001");
    public static readonly Guid Admin = Guid.Parse("a0000002-0000-4000-8000-000000000002");
    public static readonly Guid Requester = Guid.Parse("a0000003-0000-4000-8000-000000000003");
    public static readonly Guid PermitAuthorizer = Guid.Parse("a0000004-0000-4000-8000-000000000004");
    public static readonly Guid ShiftSupervisor = Guid.Parse("a0000005-0000-4000-8000-000000000005");
    public static readonly Guid CraftReceiver = Guid.Parse("a0000006-0000-4000-8000-000000000006");
    public static readonly Guid Safety = Guid.Parse("a0000007-0000-4000-8000-000000000007");
    public static readonly Guid Viewer = Guid.Parse("a0000008-0000-4000-8000-000000000008");

    public static readonly Guid Bobby = Guid.Parse("b0000001-0000-4000-8000-000000000001");
    public static readonly Guid Patrick = Guid.Parse("b0000002-0000-4000-8000-000000000002");
    public static readonly Guid Mike = Guid.Parse("b0000003-0000-4000-8000-000000000003");
    public static readonly Guid Tommy = Guid.Parse("b0000004-0000-4000-8000-000000000004");
    public static readonly Guid John = Guid.Parse("b0000005-0000-4000-8000-000000000005");
    public static readonly Guid Cody = Guid.Parse("b0000006-0000-4000-8000-000000000006");
    public static readonly Guid Myral = Guid.Parse("b0000007-0000-4000-8000-000000000007");
    public static readonly Guid Angie = Guid.Parse("b0000008-0000-4000-8000-000000000008");

    public static IReadOnlyList<Role> Roles() =>
    [
        Role(SuperAdmin, nameof(AppRole.SUPER_ADMIN)),
        Role(Admin, nameof(AppRole.ADMIN)),
        Role(Requester, nameof(AppRole.REQUESTER)),
        Role(PermitAuthorizer, nameof(AppRole.PERMIT_AUTHORIZER)),
        Role(ShiftSupervisor, nameof(AppRole.SHIFT_SUPERVISOR)),
        Role(CraftReceiver, nameof(AppRole.CRAFT_RECEIVER)),
        Role(Safety, nameof(AppRole.SAFETY)),
        Role(Viewer, nameof(AppRole.VIEWER)),
    ];

    public static IReadOnlyList<User> Users() =>
    [
        Person(Bobby, 1, "Bobby Fitzgerald", "bobby.fitzgerald", "3100", "IT", "IT Manager"),
        Person(Patrick, 2, "Patrick Grigsby", "patrick.grigsby", "5200", "SS", "Day Supervisor"),
        Person(Mike, 3, "Mike Distefano", "mike.distefano", "5200", "SS", "Shift Supervisor"),
        Person(Tommy, 4, "Tommy M Pantoja", "tommy.pantoja", "5200", "SS", "Shift Supervisor"),
        Person(John, 5, "John B. Fugere", "john.fugere", "5200", "SS", "Shift Supervisor"),
        Person(Cody, 6, "Cody Lane Stanfill", "cody.stanfill", "5200", "STEPUP", "Finishing Board Operator"),
        Person(Myral, 7, "Myral Niemtschk", "myral.niemtschk", "5200", "STEPUP", "Finishing Board Operator"),
        Person(Angie, 8, "Angie Balderaz", "angie.balderaz", "5200", "RBOP", "Reaction Board Operator"),
    ];

    public static IReadOnlyList<UserRole> Membership()
    {
        var rows = new List<UserRole> { Link(Bobby, SuperAdmin) };
        foreach (var id in new[] { Patrick, Mike, Tommy, John })
        {
            rows.Add(Link(id, Requester));
            rows.Add(Link(id, PermitAuthorizer));
            rows.Add(Link(id, ShiftSupervisor));
        }

        foreach (var id in new[] { Cody, Myral, Angie })
        {
            rows.Add(Link(id, Requester));
            rows.Add(Link(id, PermitAuthorizer));
        }

        return rows;
    }

    public static IReadOnlyList<UserCredential> Credentials() =>
        Users().Select(user => new UserCredential
        {
            Id = CredentialId(user.Id),
            UserId = user.Id,
            State = PinCredentialState.NOT_ENROLLED,
            CreatedAt = CreatedAt,
        }).ToArray();

    public static Guid CredentialId(Guid userId) =>
        Guid.Parse($"c{userId.ToString()[1..]}");

    private static Role Role(Guid id, string name) => new() { Id = id, Name = name };

    private static UserRole Link(Guid userId, Guid roleId) => new() { UserId = userId, RoleId = roleId };

    private static User Person(Guid id, int sequence, string name, string windows, string reference, string code, string title)
    {
        var permitCode = UserCodes.Format(sequence);
        return new User
        {
            Id = id,
            PermitUserCode = permitCode,
            Username = windows,
            DisplayName = name,
            Email = $"{permitCode.ToLowerInvariant()}@permit-control.local",
            WindowsDomain = "",
            WindowsUsername = windows,
            PersonnelReference = reference,
            PersonnelCode = code,
            JobTitle = title,
            AuthProvider = AuthProvider.LOCAL,
            Enabled = true,
            CreatedAt = CreatedAt,
        };
    }
}
