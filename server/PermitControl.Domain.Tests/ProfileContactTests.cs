using PermitControl.Application;
using PermitControl.Domain;

namespace PermitControl.Domain.Tests;

public class ProfileContactTests
{
    [Fact]
    public void EmailKeepsLocalPartCaseAndNormalizesDomain()
    {
        var error = ContactRules.NormalizeEmail("  Bobby.Fitzgerald@LCY.Example  ", out var email);
        Assert.Null(error);
        Assert.Equal("Bobby.Fitzgerald@lcy.example", email);
    }

    [Fact]
    public void InvalidEmailIsRejected()
    {
        Assert.Equal("email-invalid", ContactRules.NormalizeEmail("not-an-email", out _));
    }

    [Theory]
    [InlineData("281-555-0142", "+12815550142")]
    [InlineData("(281) 555-0142", "+12815550142")]
    [InlineData("2815550142", "+12815550142")]
    [InlineData("+1 281 555 0142", "+12815550142")]
    [InlineData("+44 20 7946 0958", "+442079460958")]
    public void PhoneStoresE164(string input, string expected)
    {
        var error = ContactRules.NormalizePhone(input, out var stored);
        Assert.Null(error);
        Assert.Equal(expected, stored);
    }

    [Fact]
    public void InvalidPhoneIsRejected()
    {
        Assert.Equal("phone-invalid", ContactRules.NormalizePhone("555", out _));
    }

    [Fact]
    public void MobileChangeClearsVerificationAndLeavesAuthorityFields()
    {
        var user = Person();
        user.MobilePhone = "+12815550100";
        user.MobileVerifiedAt = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
        var preferences = new List<UserNotificationPreference>();
        var error = ProfileContactRules.Apply(user, preferences, "ada@lcy.example", "281-555-0142", null, [], out var changed);
        Assert.Null(error);
        Assert.Equal("+12815550142", user.MobilePhone);
        Assert.Null(user.MobileVerifiedAt);
        Assert.Equal("IT Manager", user.JobTitle);
        Assert.Equal("bobby.fitzgerald", user.WindowsUsername);
        Assert.Contains("MobilePhone", changed);
        Assert.DoesNotContain(changed, field => field.Contains("1281", StringComparison.Ordinal));
    }

    [Fact]
    public void SmsRequiresAMobileNumber()
    {
        var user = Person();
        var error = ProfileContactRules.Apply(
            user,
            [],
            "ada@lcy.example",
            null,
            null,
            [("SMS", "PERMIT_SUSPENDED", true)],
            out _);
        Assert.Equal("mobile-required", error);
        Assert.Null(user.MobilePhone);
    }

    [Fact]
    public void PermitLifecycleViewDoesNotCarryContactFields()
    {
        var names = typeof(PermitLifecycleView).GetProperties().Select(item => item.Name).ToArray();
        Assert.DoesNotContain("Email", names);
        Assert.DoesNotContain("MobilePhone", names);
        Assert.DoesNotContain("AlternatePhone", names);
    }

    [Fact]
    public void SelfServiceEditDoesNotAcceptAuthorityFields()
    {
        var names = typeof(SelfProfileEdit).GetProperties().Select(item => item.Name).ToArray();
        Assert.DoesNotContain("Roles", names);
        Assert.DoesNotContain("WindowsUsername", names);
        Assert.DoesNotContain("WindowsDomain", names);
        Assert.DoesNotContain("Enabled", names);
        Assert.DoesNotContain("JobTitle", names);
    }

    private static User Person() => new()
    {
        Id = Guid.NewGuid(),
        PermitUserCode = "PCU-0001",
        Username = "bobby.fitzgerald",
        DisplayName = "Bobby Fitzgerald",
        Email = "pcu-0001@permit-control.local",
        WindowsUsername = "bobby.fitzgerald",
        JobTitle = "IT Manager",
        Department = "Information Technology",
        PersonnelReference = "3100",
        PersonnelCode = "IT",
    };
}
