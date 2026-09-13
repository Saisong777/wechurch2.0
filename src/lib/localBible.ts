export interface LocalBibleBook {
  bookName: string;
  bookNumber: number;
  chapterCount: number;
}

export interface LocalBibleChapter {
  chapter: number;
  verseCount: number;
}

export interface LocalBibleVerse {
  id: number;
  verseId: number;
  bookName: string;
  bookNumber: number;
  chapter: number;
  verse: number;
  text: string;
}

interface BibleExportPayload {
  rows?: Array<{
    verseId: number;
    bookName: string;
    bookNumber: number;
    chapter: number;
    verse: number;
    text: string;
  }>;
}

let bibleRowsPromise: Promise<LocalBibleVerse[]> | null = null;
let bibleBooksCache: LocalBibleBook[] | null = null;

async function loadLocalBibleRows(): Promise<LocalBibleVerse[]> {
  if (!bibleRowsPromise) {
    bibleRowsPromise = fetch('/content/bible.json')
      .then((res) => {
        if (!res.ok) throw new Error('Local Bible data is unavailable');
        return res.json() as Promise<BibleExportPayload>;
      })
      .then((payload) =>
        (payload.rows || []).map((row) => ({
          ...row,
          id: row.verseId,
        })),
      );
  }

  return bibleRowsPromise;
}

export async function getLocalBibleBooks(): Promise<LocalBibleBook[]> {
  if (bibleBooksCache) return bibleBooksCache;

  const rows = await loadLocalBibleRows();
  const bookMap = new Map<number, LocalBibleBook>();

  rows.forEach((row) => {
    const existing = bookMap.get(row.bookNumber);
    if (!existing) {
      bookMap.set(row.bookNumber, {
        bookName: row.bookName,
        bookNumber: row.bookNumber,
        chapterCount: row.chapter,
      });
      return;
    }

    existing.chapterCount = Math.max(existing.chapterCount, row.chapter);
  });

  bibleBooksCache = Array.from(bookMap.values()).sort((a, b) => a.bookNumber - b.bookNumber);
  return bibleBooksCache;
}

export async function getLocalBibleChapters(bookName: string): Promise<LocalBibleChapter[]> {
  const rows = await loadLocalBibleRows();
  const chapterMap = new Map<number, number>();

  rows
    .filter((row) => row.bookName === bookName)
    .forEach((row) => {
      chapterMap.set(row.chapter, Math.max(chapterMap.get(row.chapter) || 0, row.verse));
    });

  return Array.from(chapterMap.entries())
    .map(([chapter, verseCount]) => ({ chapter, verseCount }))
    .sort((a, b) => a.chapter - b.chapter);
}

export async function getLocalBibleVerses(bookName: string, chapter: number): Promise<LocalBibleVerse[]> {
  const rows = await loadLocalBibleRows();

  return rows
    .filter((row) => row.bookName === bookName && row.chapter === chapter)
    .sort((a, b) => a.verse - b.verse);
}

export async function searchLocalBibleVerses(query: string, limit = 50): Promise<LocalBibleVerse[]> {
  const normalizedQuery = query.replace(/\s+/g, '');
  if (!normalizedQuery) return [];

  const rows = await loadLocalBibleRows();
  return rows
    .filter((row) => row.text.replace(/\s+/g, '').includes(normalizedQuery))
    .slice(0, limit);
}
