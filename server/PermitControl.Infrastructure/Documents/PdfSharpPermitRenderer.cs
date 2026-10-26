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
            footer.DrawLine(new XPen(XColor.FromArgb(180, 180, 180), 0.4), 40, numbered.Height.Point - 34, numbered.Width.Point - 40, numbered.Height.Point - 34);
            footer.DrawString(
                "LCY Permit Control",
                canvas.Small,
                canvas.Muted,
                new XRect(40, numbered.Height.Point - 28, 200, 12),
                XStringFormats.TopLeft);
            footer.DrawString(
                $"Page {index + 1} of {total}",
                canvas.Small,
                canvas.Ink,
                new XRect(40, numbered.Height.Point - 28, numbered.Width.Point - 80, 12),
                XStringFormats.TopRight);
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
        private XGraphics graphics;
        private PdfPage page;
        private int pageNumber = 1;
        private double y;

        public Canvas(PdfDocument pdf, PermitDocument document)
        {
            this.pdf = pdf;
            view = document.Presentation;
            Title = new XFont("IBM Plex Sans", 18, XFontStyleEx.Bold);
            Section = new XFont("IBM Plex Sans", 11, XFontStyleEx.Bold);
            Body = new XFont("IBM Plex Sans", 10, XFontStyleEx.Regular);
            Strong = new XFont("IBM Plex Sans", 11, XFontStyleEx.Bold);
            Label = new XFont("IBM Plex Sans", 8, XFontStyleEx.Bold);
            Brand = new XFont("IBM Plex Sans", 9, XFontStyleEx.Bold);
            Status = new XFont("IBM Plex Sans", 12, XFontStyleEx.Bold);
            Authority = new XFont("IBM Plex Sans", 10, XFontStyleEx.Bold);
            Small = new XFont("IBM Plex Sans", 8, XFontStyleEx.Regular);
            Ink = new XSolidBrush(XColor.FromArgb(32, 32, 32));
            Muted = new XSolidBrush(XColor.FromArgb(90, 90, 90));
            page = pdf.AddPage();
            page.Size = PdfSharp.PageSize.Letter;
            graphics = XGraphics.FromPdfPage(page);
        }

        public XFont Small { get; }
        public XBrush Ink { get; }
        public XBrush Muted { get; }
        private XFont Title { get; }
        private XFont Section { get; }
        private XFont Body { get; }
        private XFont Strong { get; }
        private XFont Label { get; }
        private XFont Brand { get; }
        private XFont Status { get; }
        private XFont Authority { get; }
        private double Width => page.Width.Point - (Left * 2);
        private double Limit => page.Height.Point - 48;

        public void Draw()
        {
            DrawFirstPageHeader();
            DrawBanner();
            if (view.Suspension is not null) DrawLines(view.Suspension.Title, view.Suspension.Lines);
            DrawSummary();
            DrawScope();
            DrawPeople();
            DrawMarks("HAZARDS", view.Hazards, view.HazardsNote, 2);
            DrawMarks("CONTROLS", view.Controls, view.ControlsNote, 1);
            DrawMarks("PPE", view.Ppe, view.PpeNote, 3);
            if (view.Conditions.Count > 0) DrawLines("GENERAL WORK CONDITIONS", view.Conditions.Select(item => item.Text).ToArray());
            foreach (var module in view.Modules) DrawLines(module.Title, module.Lines);
            DrawLines(view.Control.Title, view.Control.Lines, compact: true);
            graphics.Dispose();
        }

        private void DrawFirstPageHeader()
        {
            y = 32;
            graphics.DrawString("LCY", Brand, Ink, new XRect(Left, y, Width, 12), XStringFormats.TopLeft);
            graphics.DrawString("PERMIT CONTROL", Brand, Ink, new XRect(Left, y, Width, 12), XStringFormats.TopRight);
            y += 16;
            graphics.DrawRectangle(new XSolidBrush(XColor.FromArgb(158, 42, 43)), Left, y, Width, 2.5);
            y += 10;
            graphics.DrawString(view.TypeTitle, Title, Ink, new XRect(Left, y, Width, 22), XStringFormats.TopLeft);
            y += 26;
            graphics.DrawString(view.PermitNumber, Strong, Ink, new XRect(Left, y, Width * 0.7, 14), XStringFormats.TopLeft);
            graphics.DrawString($"REV {view.Revision}", Strong, Ink, new XRect(Left, y, Width, 14), XStringFormats.TopRight);
            y += 20;
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
            const double height = 40;
            Ensure(height + 8);
            graphics.DrawRectangle(new XSolidBrush(fill), Left, y, Width, height);
            graphics.DrawRectangle(new XPen(XColor.FromArgb(32, 32, 32), 0.9), Left, y, Width, height);
            graphics.DrawRectangle(new XSolidBrush(bar), Left, y, 6, height);
            graphics.DrawString(view.Status, Status, Ink, new XRect(Left + 14, y + 4, Width - 22, 16), XStringFormats.TopLeft);
            graphics.DrawString(view.Authority, Authority, Ink, new XRect(Left + 14, y + 20, Width - 22, 14), XStringFormats.TopLeft);
            y += height + 10;
        }

        private void DrawSummary()
        {
            (string Title, IReadOnlyList<DocumentField> Fields)[] columns =
            [
                ("WORK LOCATION", view.Location),
                ("WORK PARTY", view.Party),
                ("VALIDITY", view.Validity),
            ];
            var colWidth = Width / 3;
            var height = columns.Max(column => ColumnHeight(column.Fields, colWidth - 16)) + 22;
            Ensure(height + 6);
            for (var index = 0; index < columns.Length; index++)
            {
                var x = Left + (index * colWidth);
                graphics.DrawRectangle(new XSolidBrush(XColor.FromArgb(247, 247, 247)), x, y, colWidth - 6, height);
                graphics.DrawRectangle(new XPen(XColor.FromArgb(190, 190, 190), 0.5), x, y, colWidth - 6, height);
                var cursor = y + 6;
                graphics.DrawString(columns[index].Title, Label, Ink, new XRect(x + 6, cursor, colWidth - 18, 10), XStringFormats.TopLeft);
                cursor += 14;
                foreach (var field in columns[index].Fields)
                {
                    graphics.DrawString(field.Label.ToUpperInvariant(), Small, Muted, new XRect(x + 6, cursor, colWidth - 18, 10), XStringFormats.TopLeft);
                    cursor += 10;
                    foreach (var line in Wrap(field.Value, Body, colWidth - 18))
                    {
                        graphics.DrawString(line, Body, Ink, new XRect(x + 6, cursor, colWidth - 18, 12), XStringFormats.TopLeft);
                        cursor += 12;
                    }

                    cursor += 4;
                }
            }

            y += height + 8;
        }

        private void DrawScope()
        {
            Heading("WORK SCOPE");
            Paragraph(view.Scope, Strong);
            foreach (var fact in view.ScopeFacts) Paragraph(fact.Text, Body);
        }

        private void DrawPeople()
        {
            Heading("PEOPLE & AUTHORIZATION", 64);
            const int columns = 3;
            var colWidth = Width / columns;
            for (var index = 0; index < view.People.Count; index += columns)
            {
                var slice = view.People.Skip(index).Take(columns).ToArray();
                var height = slice.Max(person => CardHeight(person, colWidth - 12));
                Ensure(height + 4);
                for (var column = 0; column < slice.Length; column++)
                {
                    var person = slice[column];
                    var x = Left + (column * colWidth);
                    graphics.DrawLine(new XPen(XColor.FromArgb(32, 32, 32), 0.8), x, y, x + colWidth - 10, y);
                    var cursor = y + 4;
                    graphics.DrawString(person.Role, Label, Ink, new XRect(x, cursor, colWidth - 12, 10), XStringFormats.TopLeft);
                    cursor += 12;
                    foreach (var line in person.Lines)
                    {
                        var font = line is "PENDING" or "NOT ASSIGNED" ? Strong : Body;
                        foreach (var wrapped in Wrap(line, font, colWidth - 12))
                        {
                            graphics.DrawString(wrapped, font, Ink, new XRect(x, cursor, colWidth - 12, 12), XStringFormats.TopLeft);
                            cursor += 12;
                        }
                    }
                }

                y += height + 6;
            }
        }

        private void DrawMarks(string title, IReadOnlyList<string> items, string empty, int columns)
        {
            Heading(title, 28);
            if (items.Count == 0)
            {
                Paragraph(empty, Small);
                return;
            }

            var used = items.Any(item => item.Length > 42) ? 1 : columns;
            var colWidth = Width / used;
            for (var index = 0; index < items.Count; index++)
            {
                if (index % used == 0) Ensure(18);
                var column = index % used;
                var x = Left + (column * colWidth);
                graphics.DrawRectangle(new XPen(XColor.FromArgb(32, 32, 32), 1), x, y + 1, 10, 10);
                graphics.DrawLine(new XPen(XColor.FromArgb(32, 32, 32), 1.4), x + 2, y + 6, x + 4, y + 9);
                graphics.DrawLine(new XPen(XColor.FromArgb(32, 32, 32), 1.4), x + 4, y + 9, x + 8.5, y + 2.5);
                graphics.DrawString(items[index], Body, Ink, new XRect(x + 16, y, colWidth - 20, 14), XStringFormats.TopLeft);
                if (column == used - 1 || index == items.Count - 1) y += 18;
            }

            y += 2;
        }

        private void DrawLines(string title, IReadOnlyList<string> lines, bool compact = false)
        {
            Heading(title, compact ? 72 : 36);
            foreach (var line in lines) Paragraph(line, compact ? Small : Body);
        }

        private void Heading(string title, double follow = 36)
        {
            Ensure(18 + follow);
            y += 6;
            graphics.DrawString(title, Section, Ink, new XRect(Left, y, Width, 14), XStringFormats.TopLeft);
            y += 14;
            graphics.DrawLine(new XPen(XColor.FromArgb(32, 32, 32), 0.6), Left, y, Left + Width, y);
            y += 6;
        }

        private void Paragraph(string text, XFont font)
        {
            var brush = font == Small ? Muted : Ink;
            foreach (var line in Wrap(text, font, Width))
            {
                Ensure(font.Size + 4);
                graphics.DrawString(line, font, brush, new XRect(Left, y, Width, font.Size + 4), XStringFormats.TopLeft);
                y += font.Size + 3;
            }
        }

        private double ColumnHeight(IReadOnlyList<DocumentField> fields, double width)
        {
            var height = 0d;
            foreach (var field in fields)
            {
                height += 14 + (Wrap(field.Value, Body, width).Count * 12);
            }

            return height;
        }

        private double CardHeight(DocumentPerson person, double width)
        {
            var height = 16d;
            foreach (var line in person.Lines)
            {
                var font = line is "PENDING" or "NOT ASSIGNED" ? Strong : Body;
                height += Wrap(line, font, width).Count * 12;
            }

            return height + 4;
        }

        private void Ensure(double height)
        {
            if (y + height <= Limit) return;
            graphics.Dispose();
            page = pdf.AddPage();
            page.Size = PdfSharp.PageSize.Letter;
            graphics = XGraphics.FromPdfPage(page);
            pageNumber++;
            y = 32;
            graphics.DrawRectangle(new XSolidBrush(XColor.FromArgb(158, 42, 43)), Left, y, Width, 2);
            y += 8;
            var state = view.RunningState;
            graphics.DrawString(
                $"{view.PermitNumber}  |  {view.TypeShort}  |  REV {view.Revision}  |  {state}",
                Brand,
                Ink,
                new XRect(Left, y, Width - 70, 12),
                XStringFormats.TopLeft);
            graphics.DrawString($"Page {pageNumber}", Brand, Ink, new XRect(Left, y, Width, 12), XStringFormats.TopRight);
            y += 14;
            graphics.DrawLine(new XPen(XColor.FromArgb(180, 180, 180), 0.5), Left, y, Left + Width, y);
            y += 8;
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
