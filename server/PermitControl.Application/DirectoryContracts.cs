using PermitControl.Domain;

namespace PermitControl.Application;

public interface IPlantDirectory
{
    Task<IdentityBootstrap> OpenWindowsAsync(string? domain, string? username, CancellationToken cancellationToken);
    Task<SessionStart> ConfirmAsync(Guid userId, string pin, Guid? deviceId, CancellationToken cancellationToken);
    Task<UserProfileView?> CurrentAsync(string? token, CancellationToken cancellationToken);
    Task<string?> EnrollAsync(string? token, string pin, string confirm, Guid? deviceId, CancellationToken cancellationToken);
    Task<string?> ChangePinAsync(string? token, string currentPin, string nextPin, string confirm, Guid? deviceId, CancellationToken cancellationToken);
    Task<IReadOnlyList<UserProfileView>> ListUsersAsync(string? token, string? search, bool? enabled, CancellationToken cancellationToken);
    Task<UserProfileView?> GetUserAsync(string? token, Guid userId, CancellationToken cancellationToken);
    Task<(string? Error, UserProfileView? User)> CreateUserAsync(string? token, UserProfileEdit edit, CancellationToken cancellationToken);
    Task<string?> UpdateUserAsync(string? token, Guid userId, UserProfileEdit edit, CancellationToken cancellationToken);
    Task<string?> SetRolesAsync(string? token, Guid userId, IReadOnlyList<string> roles, string? pin, Guid? deviceId, CancellationToken cancellationToken);
    Task<string?> AddQualificationAsync(string? token, Guid userId, string qualification, CancellationToken cancellationToken);
    Task<string?> RequirePinChangeAsync(string? token, Guid userId, string pin, Guid? deviceId, CancellationToken cancellationToken);
    Task<string?> ResetEnrollmentAsync(string? token, Guid userId, string pin, Guid? deviceId, string? reason, CancellationToken cancellationToken);
    Task<string?> UnlockAsync(string? token, Guid userId, string pin, Guid? deviceId, CancellationToken cancellationToken);
    Task<string?> SetEnabledAsync(string? token, Guid userId, bool enabled, string? pin, Guid? deviceId, CancellationToken cancellationToken);
    Task<IReadOnlyList<PermitLifecycleView>> ListPermitsAsync(string? status, CancellationToken cancellationToken);
    Task<PermitLifecycleView?> GetPermitAsync(Guid permitId, CancellationToken cancellationToken);
    Task<string?> SubmitAsync(string? token, Guid permitId, Guid? deviceId, CancellationToken cancellationToken);
    Task<string?> AuthorizeAsync(string? token, Guid permitId, string pin, int revision, Guid? deviceId, CancellationToken cancellationToken);
    Task<string?> AcceptAsync(string? token, Guid permitId, string pin, int revision, Guid? deviceId, CancellationToken cancellationToken);
    Task<string?> ActivateAsync(string? token, Guid permitId, string pin, int revision, string? actingRole, Guid? deviceId, CancellationToken cancellationToken);
    Task<string?> ReturnForCorrectionAsync(string? token, Guid permitId, int revision, Guid? deviceId, CancellationToken cancellationToken);
}

public sealed record IdentityBootstrap(string Kind, SessionStart? Session, IReadOnlyList<UserChoice> Choices);
public sealed record UserChoice(Guid Id, string PermitUserCode, string DisplayName, string JobTitle);
public sealed record SessionStart(string Token, UserProfileView User);
public sealed record UserProfileEdit(string DisplayName, string? WindowsDomain, string WindowsUsername, string PersonnelReference, string PersonnelCode, string JobTitle, string? Department, bool Enabled, IReadOnlyList<string> Roles);
public sealed record ApprovalView(string ActingRole, string DisplayName, string PermitUserCode, string? JobTitle, DateTimeOffset? At);
public sealed record PermitLifecycleView(Guid Id, string PermitNumber, string PermitType, string Status, int Revision, string JobDescription, string WorkOrder, string? AreaName, IReadOnlyList<string> Hazards, IReadOnlyList<string> Controls, IReadOnlyList<string> Ppe, IReadOnlyList<string> Modules, IReadOnlyList<ApprovalView> Approvals, IReadOnlyList<string> Missing, string? EquipmentTag, Guid? CreatedBy, bool AllowSelfAuthorization);
