namespace PermitControl.Api;

/// <summary>
/// Reserved for the authentication pass. Endpoints do not enforce these policies yet.
/// </summary>
public static class PermitAuthorization
{
    public const string ReadReferenceData = "ReferenceData.Read";
    public const string WriteReferenceData = "ReferenceData.Write";
}
