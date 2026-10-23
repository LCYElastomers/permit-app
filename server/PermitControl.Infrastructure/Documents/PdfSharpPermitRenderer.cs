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
        var small = new XFont("IBM Plex Sans", 10, XFontStyleEx.Regular);
        var pageNumber = 1;
        graphics.DrawRectangle(new XSolidBrush(XColor.FromArgb(217, 68, 68)), 36, 24, page.Width.Point - 72, 4);
        var y = 40d;
        foreach (var line in document.Banner)
        {
            var emphasis = IsTreatment(document, line);
            var font = line is "LCY PERMIT CONTROL" || line.EndsWith(" PERMIT", StringComparison.Ordinal) || emphasis ? title : bold;
            y = Draw(pdf, document, ref graphics, ref page, ref pageNumber, line, font, bold, title, y, emphasis);
        }

        foreach (var section in document.Sections)
        {
            y += 8;
            y = Draw(pdf, document, ref graphics, ref page, ref pageNumber, section.Title, sectionFont, bold, title, y, false);
            graphics.DrawLine(new XPen(XColor.FromArgb(40, 40, 40), 0.6), 36, y, page.Width.Point - 36, y);
            y += 8;
            foreach (var line in section.Lines)
            {
                y = Draw(pdf, document, ref graphics, ref page, ref pageNumber, line, regular, bold, title, y, false);
            }
        }

        graphics.Dispose();
        var total = pdf.PageCount;
        for (var index = 0; index < total; index++)
        {
            var numbered = pdf.Pages[index];
            using var footer = XGraphics.FromPdfPage(numbered);
            footer.DrawString(
                $"Page {index + 1} of {total}",
                small,
                new XSolidBrush(XColor.FromArgb(32, 32, 32)),
                new XRect(36, numbered.Height.Point - 28, numbered.Width.Point - 72, 14),
                XStringFormats.TopLeft);
        }

        using var stream = new MemoryStream();
        pdf.Save(stream, false);
        return stream.ToArray();
    }

    private static double Draw(
        PdfDocument pdf,
        PermitDocument document,
        ref XGraphics graphics,
        ref PdfPage page,
        ref int pageNumber,
        string text,
        XFont font,
        XFont bold,
        XFont title,
        double y,
        bool emphasis)
    {
        var brush = new XSolidBrush(XColor.FromArgb(32, 32, 32));
        var width = page.Width.Point - 72;
        var size = graphics.MeasureString(text, font);
        var height = Math.Max(size.Height + 4, font.Size + 6);
        if (y + height > page.Height.Point - 48)
        {
            graphics.Dispose();
            page = pdf.AddPage();
            page.Size = PdfSharp.PageSize.Letter;
            graphics = XGraphics.FromPdfPage(page);
            pageNumber++;
            y = DrawContinuation(graphics, page, document.RunningHeader, pageNumber, bold, title);
        }

        if (emphasis)
        {
            graphics.DrawRectangle(XPens.Black, 36, y, width, height + 2);
        }

        graphics.DrawString(text, font, brush, new XRect(42, y, width - 12, height + 2), XStringFormats.TopLeft);
        return y + height + (emphasis ? 4 : 1);
    }

    private static double DrawContinuation(XGraphics graphics, PdfPage page, DocumentRunningHeader header, int pageNumber, XFont bold, XFont title)
    {
        graphics.DrawRectangle(new XSolidBrush(XColor.FromArgb(217, 68, 68)), 36, 24, page.Width.Point - 72, 4);
        var y = 40d;
        (string Text, bool Emphasis)[] lines =
        [
            ($"Permit number: {header.PermitNumber}", false),
            ($"Revision: {header.Revision}", false),
            ($"Lifecycle status: {header.Status}", false),
            (header.Status, true),
            (header.Authority, true),
            ($"Page {pageNumber}", false),
        ];
        foreach (var line in lines)
        {
            var font = line.Emphasis ? title : bold;
            var brush = new XSolidBrush(XColor.FromArgb(32, 32, 32));
            var width = page.Width.Point - 72;
            var height = Math.Max(graphics.MeasureString(line.Text, font).Height + 4, font.Size + 6);
            if (line.Emphasis)
            {
                graphics.DrawRectangle(XPens.Black, 36, y, width, height + 2);
            }

            graphics.DrawString(line.Text, font, brush, new XRect(42, y, width - 12, height + 2), XStringFormats.TopLeft);
            y += height + (line.Emphasis ? 4 : 1);
        }

        return y + 8;
    }

    private static bool IsTreatment(PermitDocument document, string line) =>
        line == document.RunningHeader.Status || line == document.RunningHeader.Authority;

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
