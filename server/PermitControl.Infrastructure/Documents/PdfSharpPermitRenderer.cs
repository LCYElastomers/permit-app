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
        pdf.Info.Title = $"{document.Presentation.TypeTitle} {document.Presentation.PermitNumber}";
        pdf.Info.Creator = "LCY Permit Control";
        pdf.Options.CompressContentStreams = false;
        var canvas = new Canvas(pdf, document);
        canvas.Draw();
        var total = pdf.PageCount;
        for (var index = 0; index < total; index++)
        {
            var numbered = pdf.Pages[index];
            using var footer = XGraphics.FromPdfPage(numbered, XGraphicsPdfPageOptions.Append);
            footer.DrawLine(new XPen(XColor.FromArgb(196, 196, 196), 0.4), 40, numbered.Height.Point - 32, numbered.Width.Point - 40, numbered.Height.Point - 32);
            footer.DrawString(
                $"LCY Permit Control  ·  Controlled Electronic Record  ·  Page {index + 1} of {total}",
                canvas.Footer,
                canvas.Muted,
                new XRect(40, numbered.Height.Point - 24, numbered.Width.Point - 80, 10),
                XStringFormats.TopLeft);
        }

        using var stream = new MemoryStream();
        pdf.Save(stream, false);
        return stream.ToArray();
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

    private sealed class Canvas
    {
        private const double Left = 40;
        private readonly PdfDocument pdf;
        private readonly PermitPresentation view;
        private readonly XImage logo;
        private XGraphics graphics;
        private PdfPage page;
        private double y;

        public Canvas(PdfDocument pdf, PermitDocument document)
        {
            this.pdf = pdf;
            view = document.Presentation;
            logo = BrandLogo.Image;
            Title = new XFont("IBM Plex Sans", 20, XFontStyleEx.Bold);
            Number = new XFont("IBM Plex Sans", 13, XFontStyleEx.Bold);
            Section = new XFont("IBM Plex Sans", 10, XFontStyleEx.Bold);
            Body = new XFont("IBM Plex Sans", 10, XFontStyleEx.Regular);
            Scope = new XFont("IBM Plex Sans", 10.5, XFontStyleEx.Regular);
            Name = new XFont("IBM Plex Sans", 11, XFontStyleEx.Bold);
            Strong = new XFont("IBM Plex Sans", 11, XFontStyleEx.Bold);
            Label = new XFont("IBM Plex Sans", 8, XFontStyleEx.Bold);
            Brand = new XFont("IBM Plex Sans", 9, XFontStyleEx.Bold);
            Running = new XFont("IBM Plex Sans", 8, XFontStyleEx.Regular);
            Status = new XFont("IBM Plex Sans", 16, XFontStyleEx.Bold);
            Authority = new XFont("IBM Plex Sans", 13, XFontStyleEx.Bold);
            Meta = new XFont("IBM Plex Sans", 8.5, XFontStyleEx.Regular);
            Time = new XFont("IBM Plex Sans", 7.5, XFontStyleEx.Regular);
            Small = new XFont("IBM Plex Sans", 7.5, XFontStyleEx.Regular);
            Footer = new XFont("IBM Plex Sans", 7, XFontStyleEx.Regular);
            Ink = new XSolidBrush(XColor.FromArgb(28, 28, 28));
            Muted = new XSolidBrush(XColor.FromArgb(82, 82, 82));
            Paper = new XSolidBrush(XColor.FromArgb(255, 255, 255));
            PaperMuted = new XSolidBrush(XColor.FromArgb(214, 214, 214));
            Charcoal = new XSolidBrush(XColor.FromArgb(27, 29, 31));
            Accent = new XSolidBrush(XColor.FromArgb(158, 42, 43));
            page = pdf.AddPage();
            page.Size = PdfSharp.PageSize.Letter;
            graphics = XGraphics.FromPdfPage(page);
        }

        public XFont Footer { get; }
        public XBrush Muted { get; }
        private XBrush PaperMuted { get; }
        private XBrush Charcoal { get; }
        private XBrush Accent { get; }
        private XFont Title { get; }
        private XFont Number { get; }
        private XFont Section { get; }
        private XFont Body { get; }
        private XFont Scope { get; }
        private XFont Name { get; }
        private XFont Strong { get; }
        private XFont Label { get; }
        private XFont Brand { get; }
        private XFont Running { get; }
        private XFont Status { get; }
        private XFont Authority { get; }
        private XFont Meta { get; }
        private XFont Time { get; }
        private XFont Small { get; }
        private XBrush Ink { get; }
        private XBrush Paper { get; }
        private double Width => page.Width.Point - (Left * 2);
        private double Limit => page.Height.Point - 52;
        private const double SectionGap = 12;
        private const double FieldGap = 7;

        public void Draw()
        {
            DrawFirstPageHeader();
            DrawBanner();
            if (view.Suspension is not null) DrawLines(view.Suspension.Title, view.Suspension.Lines);
            DrawSummary();
            DrawScope();
            DrawPeople();
            DrawMarks("HAZARDS", view.Hazards, view.HazardsNote, 2);
            DrawMarks("CONTROLS", view.Controls, view.ControlsNote, 2);
            DrawMarks("PPE", view.Ppe, view.PpeNote, 3);
            if (view.Conditions.Count > 0) DrawFields("GENERAL WORK CONDITIONS", view.Conditions);
            foreach (var module in view.Modules) DrawLines(module.Title, module.Lines);
            DrawLines(view.Control.Title, view.Control.Lines, quiet: true);
            graphics.Dispose();
        }

        private void DrawFirstPageHeader()
        {
            const double band = 104;
            graphics.DrawRectangle(Charcoal, 0, 0, page.Width.Point, band);
            graphics.DrawRectangle(Accent, 0, band, page.Width.Point, 3);
            const double maxHeight = 28d;
            const double maxWidth = 148d;
            var scale = Math.Min(maxWidth / logo.PointWidth, maxHeight / logo.PointHeight);
            var logoWidth = logo.PointWidth * scale;
            var logoHeight = logo.PointHeight * scale;
            graphics.DrawImage(logo, Left, 16 + ((32 - logoHeight) / 2), logoWidth, logoHeight);
            graphics.DrawString("PERMIT CONTROL", Brand, Paper, new XRect(Left, 22, Width, 14), XStringFormats.TopRight);
            var titleWidth = Width * 0.62;
            var titleFont = graphics.MeasureString(view.TypeTitle, Title).Width <= titleWidth ? Title : Status;
            graphics.DrawString(view.TypeTitle, titleFont, Paper, new XRect(Left, 56, titleWidth, 24), XStringFormats.TopLeft);
            graphics.DrawString(view.PermitNumber, Number, Paper, new XRect(Left, 56, Width, 16), XStringFormats.TopRight);
            graphics.DrawString($"REV {view.Revision}", Brand, PaperMuted, new XRect(Left, 76, Width, 12), XStringFormats.TopRight);
            y = band + 16;
        }

        private void DrawBanner()
        {
            var (fill, bar) = view.Tone switch
            {
                DocumentTone.Active => (XColor.FromArgb(226, 236, 228), XColor.FromArgb(27, 94, 58)),
                DocumentTone.Warning => (XColor.FromArgb(244, 232, 232), XColor.FromArgb(140, 32, 32)),
                DocumentTone.Historical => (XColor.FromArgb(236, 236, 236), XColor.FromArgb(70, 70, 70)),
                _ => (XColor.FromArgb(244, 239, 224), XColor.FromArgb(140, 98, 20)),
            };
            const double height = 56;
            Ensure(height + 8);
            graphics.DrawRectangle(new XSolidBrush(fill), Left, y, Width, height);
            graphics.DrawRectangle(new XSolidBrush(bar), Left, y, 5, height);
            graphics.DrawString(view.Status, Status, Ink, new XRect(Left + 16, y + 8, Width - 28, 20), XStringFormats.TopLeft);
            graphics.DrawString(view.Authority, Authority, Ink, new XRect(Left + 16, y + 32, Width - 28, 16), XStringFormats.TopLeft);
            y += height + 12;
        }

        private void DrawSummary()
        {
            (string Title, IReadOnlyList<DocumentField> Fields)[] columns =
            [
                ("WORK LOCATION", view.Location),
                ("WORK PARTY", view.Party),
                ("VALIDITY", view.Validity),
            ];
            var substantive = columns.Select(column => column.Fields.Count(field => field.Value != "Not recorded")).ToArray();
            var rich = substantive.Count(count => count > 0);
            var widths = rich == 2
                ? substantive.Select(count => count > 0 ? Width * 0.39 : Width * 0.22).ToArray()
                : Enumerable.Repeat(Width / 3, 3).ToArray();
            var height = columns.Select((column, index) => ColumnHeight(column.Fields, widths[index] - 16)).Max() + 26;
            Ensure(height + 6);
            var x = Left;
            for (var index = 0; index < columns.Length; index++)
            {
                var inner = widths[index] - 16;
                var cursor = y;
                graphics.DrawString(columns[index].Title, Section, Ink, new XRect(x, cursor, inner, 12), XStringFormats.TopLeft);
                cursor += 14;
                graphics.DrawRectangle(Accent, x, cursor, 22, 1.6);
                cursor += 8;
                foreach (var field in columns[index].Fields)
                {
                    graphics.DrawString(field.Label.ToUpperInvariant(), Label, Muted, new XRect(x, cursor, inner, 10), XStringFormats.TopLeft);
                    cursor += 11;
                    foreach (var line in Wrap(field.Value, Body, inner))
                    {
                        graphics.DrawString(line, Body, Ink, new XRect(x, cursor, inner, 12), XStringFormats.TopLeft);
                        cursor += 13;
                    }

                    cursor += FieldGap;
                }

                x += widths[index];
            }

            y += height + 8;
        }

        private void DrawScope()
        {
            Heading("WORK SCOPE");
            Paragraph(view.Scope, Scope, 5);
            foreach (var fact in view.ScopeFacts) DrawStacked(fact, Width);
            if (view.ScopeFacts.Count > 0) y += 2;
        }

        private void DrawPeople()
        {
            Heading("PEOPLE & AUTHORIZATION", 72);
            const int columns = 3;
            var colWidth = Width / columns;
            for (var index = 0; index < view.People.Count; index += columns)
            {
                var slice = view.People.Skip(index).Take(columns).ToArray();
                var height = slice.Max(person => CardHeight(person, colWidth - 16));
                Ensure(height + 4);
                for (var column = 0; column < slice.Length; column++)
                {
                    var person = slice[column];
                    var x = Left + (column * colWidth);
                    var cursor = y;
                    graphics.DrawString(person.Role, Label, Muted, new XRect(x, cursor, colWidth - 16, 10), XStringFormats.TopLeft);
                    cursor += 12;
                    for (var lineIndex = 0; lineIndex < person.Lines.Count; lineIndex++)
                    {
                        var line = person.Lines[lineIndex];
                        var font = PersonFont(line, lineIndex == 0);
                        var brush = font == Name || font == Strong ? Ink : Muted;
                        foreach (var wrapped in Wrap(line, font, colWidth - 16))
                        {
                            graphics.DrawString(wrapped, font, brush, new XRect(x, cursor, colWidth - 16, font.Size + 2), XStringFormats.TopLeft);
                            cursor += font.Size + 2;
                        }
                    }
                }

                y += height + 10;
            }
        }

        private void DrawMarks(string title, IReadOnlyList<string> items, string empty, int columns)
        {
            Heading(title, 40);
            if (items.Count == 0)
            {
                Paragraph(empty, Small, 2);
                return;
            }

            var used = items.Any(item => item.Length > 36) ? 1 : columns;
            var colWidth = Width / used;
            var check = new XPen(XColor.FromArgb(28, 28, 28), 1.5);
            for (var index = 0; index < items.Count; index++)
            {
                var column = index % used;
                if (column == 0)
                {
                    var broke = Ensure(index > 0 ? 28 : 16);
                    if (broke && index > 0)
                    {
                        graphics.DrawString($"{title} continued", Label, Muted, new XRect(Left, y, Width, 10), XStringFormats.TopLeft);
                        y += 12;
                    }
                }

                var x = Left + (column * colWidth);
                graphics.DrawLine(check, x, y + 6, x + 3.2, y + 10);
                graphics.DrawLine(check, x + 3.2, y + 10, x + 9.2, y + 2);
                graphics.DrawString(items[index], Body, Ink, new XRect(x + 14, y - 1, colWidth - 18, 13), XStringFormats.TopLeft);
                if (column == used - 1 || index == items.Count - 1) y += 16;
            }

            y += 2;
        }

        private void DrawFields(string title, IReadOnlyList<DocumentField> fields)
        {
            Heading(title);
            foreach (var field in fields) DrawStacked(field, Width);
        }

        private void DrawStacked(DocumentField field, double width)
        {
            Ensure(28);
            graphics.DrawString(field.Label.ToUpperInvariant(), Label, Muted, new XRect(Left, y, width, 10), XStringFormats.TopLeft);
            y += 11;
            foreach (var line in Wrap(field.Value, Body, width))
            {
                Ensure(14);
                graphics.DrawString(line, Body, Ink, new XRect(Left, y, width, 12), XStringFormats.TopLeft);
                y += 13;
            }

            y += 4;
        }

        private void DrawLines(string title, IReadOnlyList<string> lines, bool quiet = false)
        {
            if (quiet) QuietHeading(title);
            else Heading(title, 36);
            var font = quiet ? Small : Body;
            foreach (var line in lines)
            {
                if (Ensure(quiet ? 12 : 16) && !quiet)
                {
                    graphics.DrawString($"{title} continued", Label, Muted, new XRect(Left, y, Width, 10), XStringFormats.TopLeft);
                    y += 12;
                }

                Paragraph(line, font, quiet ? 2 : 3);
            }
        }

        private void Heading(string title, double follow = 36)
        {
            Ensure(18 + follow);
            y += SectionGap;
            graphics.DrawString(title, Section, Ink, new XRect(Left, y, Width, 12), XStringFormats.TopLeft);
            y += 14;
            graphics.DrawRectangle(Accent, Left, y, 22, 1.6);
            y += 8;
        }

        private void QuietHeading(string title)
        {
            Ensure(24);
            y += 8;
            graphics.DrawLine(new XPen(XColor.FromArgb(186, 186, 186), 0.4), Left, y, Left + Width, y);
            y += 4;
            graphics.DrawString(title, Label, Muted, new XRect(Left, y, Width, 9), XStringFormats.TopLeft);
            y += 10;
        }

        private void Paragraph(string text, XFont font, double lead)
        {
            var brush = font == Small ? Muted : Ink;
            foreach (var line in Wrap(text, font, Width))
            {
                Ensure(font.Size + lead);
                graphics.DrawString(line, font, brush, new XRect(Left, y, Width, font.Size + lead), XStringFormats.TopLeft);
                y += font.Size + lead;
            }
        }

        private double ColumnHeight(IReadOnlyList<DocumentField> fields, double width)
        {
            var height = 0d;
            foreach (var field in fields)
            {
                height += 17 + (Wrap(field.Value, Body, width).Count * 13);
            }

            return height;
        }

        private double CardHeight(DocumentPerson person, double width)
        {
            var height = 22d;
            for (var index = 0; index < person.Lines.Count; index++)
            {
                var font = PersonFont(person.Lines[index], index == 0);
                height += Wrap(person.Lines[index], font, width).Count * (font.Size + 3);
            }

            return height + 4;
        }

        private XFont PersonFont(string line, bool first)
        {
            if (line is "PENDING" or "NOT ASSIGNED") return Strong;
            if (line.StartsWith("Submitted", StringComparison.Ordinal)
                || line.StartsWith("Authorized", StringComparison.Ordinal)
                || line.StartsWith("Accepted", StringComparison.Ordinal))
            {
                return Time;
            }

            return first ? Name : Meta;
        }

        private bool Ensure(double height)
        {
            if (y + height <= Limit) return false;
            graphics.Dispose();
            page = pdf.AddPage();
            page.Size = PdfSharp.PageSize.Letter;
            graphics = XGraphics.FromPdfPage(page);
            y = 28;
            var state = view.Tone == DocumentTone.Active ? view.Status : $"{view.Status}  |  {view.Authority}";
            graphics.DrawString(
                $"{view.PermitNumber}  |  {view.TypeShort}  |  REV {view.Revision}  |  {state}",
                Running,
                Ink,
                new XRect(Left, y, Width, 11),
                XStringFormats.TopLeft);
            y += 14;
            graphics.DrawLine(new XPen(XColor.FromArgb(180, 180, 180), 0.4), Left, y, Left + Width, y);
            y += 10;
            return true;
        }

        private IReadOnlyList<string> Wrap(string text, XFont font, double width)
        {
            var source = text.Replace('\r', ' ').Replace('\n', ' ').Trim();
            if (source.Length == 0) return [""];
            var lines = new List<string>();
            var current = "";
            foreach (var word in source.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            {
                var trial = current.Length == 0 ? word : $"{current} {word}";
                if (graphics.MeasureString(trial, font).Width <= width)
                {
                    current = trial;
                    continue;
                }

                if (current.Length > 0) lines.Add(current);
                current = word;
            }

            if (current.Length > 0) lines.Add(current);
            return lines;
        }
    }

    private static class BrandLogo
    {
        private static readonly Lazy<XImage> Cached = new(Load);
        private static MemoryStream? retained;

        public static XImage Image => Cached.Value;

        private static XImage Load()
        {
            using var source = PermitBrandAssets.Open();
            retained = new MemoryStream();
            source.CopyTo(retained);
            retained.Position = 0;
            return XImage.FromStream(retained);
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

public static class PermitBrandAssets
{
    public const string ResourceName = "PermitControl.Infrastructure.Branding.lcy-logo-white.png";
    public const string MissingDiagnostic = "pdf-logo-missing: the packaged LCY logo is not in the application assets. Expected embedded resource PermitControl.Infrastructure.Branding.lcy-logo-white.png or Branding/lcy-logo-white.png beside the application.";

    public static Stream Open() => Open(
        Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourceName),
        Path.Combine(AppContext.BaseDirectory, "Branding", "lcy-logo-white.png"));

    public static Stream Open(Stream? embedded, string filePath)
    {
        if (embedded is not null) return embedded;
        if (!string.IsNullOrWhiteSpace(filePath) && File.Exists(filePath)) return File.OpenRead(filePath);
        throw new FileStorageException(MissingDiagnostic);
    }
}
