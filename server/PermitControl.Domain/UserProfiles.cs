namespace PermitControl.Domain;

public sealed record QualificationView(Guid Id, string QualificationType, DateTimeOffset? EffectiveDate, DateTimeOffset? ExpirationDate, bool Enabled, string? Notes);

public sealed record UserProfileView(
    Guid Id,
    string PermitUserCode,
    string DisplayName,
    string WindowsUsername,
    string? WindowsDomain,
    string PersonnelReference,
    string PersonnelCode,
    string JobTitle,
    string? Department,
    bool Enabled,
    string PinState,
    DateTimeOffset? PinChangedAt,
    int? FailedAttempts,
    DateTimeOffset? LockedUntil,
    IReadOnlyList<string> Roles,
    IReadOnlyList<QualificationView> Qualifications);

public static class UserProfiles
{
    public static UserProfileView View(User user, UserCredential credential, IReadOnlyList<string> roles, IReadOnlyList<UserQualification> qualifications, bool includeAttempts) => new(
        user.Id,
        user.PermitUserCode,
        user.DisplayName,
        user.WindowsUsername,
        string.IsNullOrEmpty(user.WindowsDomain) ? null : user.WindowsDomain,
        user.PersonnelReference,
        user.PersonnelCode,
        user.JobTitle,
        user.Department,
        user.Enabled,
        credential.State.ToString(),
        credential.PinChangedAt,
        includeAttempts ? credential.FailedAttempts : null,
        credential.LockedUntil,
        roles,
        qualifications.Select(item => new QualificationView(item.Id, item.QualificationType.ToString(), item.EffectiveDate, item.ExpirationDate, item.Enabled, item.Notes)).ToArray());
}
