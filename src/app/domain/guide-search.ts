interface GuideTopic {
  id?: string;
  heading: string;
  paragraphs?: string[];
  paragraphsEn?: string[];
  tables?: {
    caption: string;
    headers: string[];
    rows: string[][];
    captionEn?: string;
    headersEn?: string[];
    rowsEn?: string[][];
  }[];
}
interface SearchableChapter {
  id: string;
  title: string;
  summary: string;
  sections: GuideTopic[];
}
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function guideSectionId(
  section: Pick<GuideTopic, "id" | "heading">,
  index: number,
): string {
  return (
    section.id ||
    normalize(section.heading)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
      "-" +
      (index + 1)
  );
}

export function searchGuide(
  chapters: readonly SearchableChapter[],
  query: string,
) {
  const tokens = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return chapters.flatMap((chapter) =>
    chapter.sections.flatMap((section, index) => {
      const paragraphs = [
        ...(section.paragraphs || []),
        ...(section.paragraphsEn || []),
      ];
      const tables = (section.tables || []).flatMap((table) => [
        table.caption,
        ...table.headers,
        ...table.rows.flat(),
        table.captionEn || "",
        ...(table.headersEn || []),
        ...(table.rowsEn || []).flat(),
      ]);
      const text = normalize(
        [chapter.title, section.heading, ...paragraphs, ...tables].join(" "),
      );
      if (!tokens.every((token) => text.includes(token))) return [];
      const excerpt =
        paragraphs.find((paragraph) =>
          tokens.some((token) => normalize(paragraph).includes(token)),
        ) || chapter.summary;
      return [
        {
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          sectionId: guideSectionId(section, index),
          heading: section.heading,
          excerpt: excerpt.length > 190 ? excerpt.slice(0, 187) + "…" : excerpt,
        },
      ];
    }),
  );
}
