using System.Reflection;
using PdfSharp.Drawing;
using PdfSharp.Fonts;
using PdfSharp.Pdf;
using PermitControl.Application;
using PermitControl.Domain;

namespace PermitControl.Infrastructure.Documents;

public sealed class PdfSharpPermitRenderer : IPermitPdfRenderer
{
    private static readonly object Gate = new();
    private static bool fontsReady;

    public byte[] Render(PermitDocument document)
    {
        EnsureFonts();
        var pdf = new PdfDocument();
        pdf.Info.Title = "LCY Permit Control";
        pdf.Info.Creator = "LCY Permit Control";
        pdf.Options.CompressContentStreams = false;
        var page = pdf.AddPage();
        page.Size = PdfSharp.PageSize.Letter;
        var graphics = XGraphics.FromPdfPage(page);
        var regular = new XFont("IBM Plex Sans", 11, XFontStyleEx.Regular);
        var bold = new XFont("IBM Plex Sans", 12, XFontStyleEx.Bold);
        var title = new XFont("IBM Plex Sans", 16, XFontStyleEx.Bold);
        var sectionFont = new XFont("IBM Plex Sans", 12, XFontStyleEx.Bold);
        var y = 36d;
        graphics.DrawRectangle(new XSolidBrush(XColor.FromArgb(217, 68, 68)), 36, 24, page.Width.Point - 72, 4);
        y = 40;
        foreach (var line in document.Banner)
        {
            var font = line is "LCY PERMIT CONTROL" or "GENERAL WORK PERMIT" or "DRAFT" or "NOT AUTHORIZED FOR WORK" ? title : bold;
            if (line is "DRAFT" or "NOT AUTHORIZED FOR WORK") font = title;
            y = Draw(pdf, ref graphics, ref page, line, font, y, line is "DRAFT" or "NOT AUTHORIZED FOR WORK");
        }

        foreach (var section in document.Sections)
        {
            y += 8;
            y = Draw(pdf, ref graphics, ref page, section.Title, sectionFont, y, false);
            graphics.DrawLine(new XPen(XColor.FromArgb(40, 40, 40), 0.6), 36, y, page.Width.Point - 36, y);
            y += 8;
            foreach (var line in section.Lines)
            {
                y = Draw(pdf, ref graphics, ref page, line, regular, y, false);
            }
        }

        graphics.Dispose();
        using var stream = new MemoryStream();
        pdf.Save(stream, false);
        return stream.ToArray();
    }

    private static double Draw(PdfDocument pdf, ref XGraphics graphics, ref PdfPage page, string text, XFont font, double y, bool emphasis)
    {
        var brush = new XSolidBrush(XColor.FromArgb(32, 32, 32));
        var width = page.Width.Point - 72;
        var size = graphics.MeasureString(text, font);
        var height = Math.Max(size.Height + 4, font.Size + 6);
        if (y + height > page.Height.Point - 36)
        {
            graphics.Dispose();
            page = pdf.AddPage();
            page.Size = PdfSharp.PageSize.Letter;
            graphics = XGraphics.FromPdfPage(page);
            y = 36;
        }

        if (emphasis)
        {
            graphics.DrawRectangle(XPens.Black, 36, y, width, height + 2);
        }

        graphics.DrawString(text, font, brush, new XRect(42, y, width - 12, height + 2), XStringFormats.TopLeft);
        return y + height + (emphasis ? 4 : 1);
    }

    private static void EnsureFonts()
    {
        if (fontsReady) return;
        lock (Gate)
        {
            if (fontsReady) return;
            GlobalFontSettings.FontResolver ??= new EmbeddedPlexFontResolver();
            fontsReady = true;
        }
    }

    private sealed class EmbeddedPlexFontResolver : IFontResolver
    {
        public FontResolverInfo? ResolveTypeface(string familyName, bool isBold, bool isItalic)
        {
            var face = isBold ? "IBMPlexSans-Bold" : "IBMPlexSans-Regular";
            return new FontResolverInfo(face);
        }

        public byte[]? GetFont(string faceName)
        {
            var file = faceName.Contains("Bold", StringComparison.Ordinal) ? "IBMPlexSans-Bold.ttf" : "IBMPlexSans-Regular.ttf";
            var resource = $"PermitControl.Infrastructure.Fonts.{file}";
            using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resource)
                ?? throw new FileStorageException("pdf-font-missing");
            using var memory = new MemoryStream();
            stream.CopyTo(memory);
            return memory.ToArray();
        }
    }
}
