import ts from 'typescript';
import { sha256 } from './im-bible-migration.mjs';
import { isCalendarDate } from './im-bible-import-plan.mjs';

const monthNumbers = Object.fromEntries([
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
].map((name, index) => [name, index + 1]));

// Parse data literals only. Never evaluate the source app or its expressions.
function readLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(readLiteral);
  if (ts.isObjectLiteralExpression(node)) {
    const result = Object.create(null);
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property) ||
          !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
        throw new Error('CALENDAR_NON_LITERAL_PROPERTY');
      }
      const key = property.name.text;
      if (Object.hasOwn(result, key)) throw new Error('CALENDAR_DUPLICATE_PROPERTY');
      result[key] = readLiteral(property.initializer);
    }
    return result;
  }
  throw new Error('CALENDAR_NON_LITERAL_VALUE');
}

export function extractCalendar(planSource, { sourceCommit, year }) {
  if (typeof planSource !== 'string' || !planSource ||
      !/^[a-f0-9]{40}$/.test(sourceCommit || '') || !Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('CALENDAR_SOURCE_REQUIRED');
  }
  const values = new Map();
  for (const match of planSource.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    const script = ts.createSourceFile('source.js', match[1], ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (script.parseDiagnostics.length) throw new Error('CALENDAR_SOURCE_SYNTAX');
    for (const statement of script.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !['PLAN_DATA', 'PLAN_META'].includes(declaration.name.text)) continue;
        if (!(statement.declarationList.flags & ts.NodeFlags.Const) || !declaration.initializer || values.has(declaration.name.text)) {
          throw new Error('CALENDAR_AMBIGUOUS_DECLARATION');
        }
        values.set(declaration.name.text, readLiteral(declaration.initializer));
      }
    }
  }
  const data = values.get('PLAN_DATA'), meta = values.get('PLAN_META');
  if (!data || !meta || Array.isArray(data) || Array.isArray(meta)) throw new Error('CALENDAR_DATA_REQUIRED');
  const entries = [], dates = new Set();
  for (const [section, days] of Object.entries(data)) {
    if (!Object.hasOwn(monthNumbers, section) || !Array.isArray(days) || !days.length ||
        typeof meta[section]?.title !== 'string' || !meta[section].title.trim()) throw new Error('CALENDAR_INVALID_SECTION');
    let previousDate = '';
    days.forEach((day, index) => {
      const match = typeof day?.date === 'string' && /^(\d{1,2})(?:\/(\d{1,2})|月(\d{1,2})日)$/.exec(day.date.trim());
      if (!match || Number(match[1]) !== monthNumbers[section] || typeof day.passage !== 'string' || !day.passage.trim()) {
        throw new Error('CALENDAR_INVALID_DAY');
      }
      const date = `${year}-${match[1].padStart(2, '0')}-${(match[2] || match[3]).padStart(2, '0')}`;
      if (!isCalendarDate(date) || dates.has(date) || date <= previousDate) throw new Error('CALENDAR_INVALID_OR_DUPLICATE_DATE');
      previousDate = date;
      dates.add(date);
      entries.push({ key: `${section}-${index}`, date, reference: day.passage, planTitle: meta[section].title });
    });
  }
  if (!entries.length) throw new Error('CALENDAR_EMPTY');
  return { format: 'wechurch-im-bible-calendar-draft-v1', sourceCommit,
    sourceSha256: sha256(planSource), year, entries };
}

export function reviewCalendar(draft, { reviewedBy, reviewedOn, expectedSections }) {
  if (draft?.format !== 'wechurch-im-bible-calendar-draft-v1' || !Array.isArray(draft.entries) ||
      typeof reviewedBy !== 'string' || !reviewedBy.trim() || !isCalendarDate(reviewedOn) || !Array.isArray(expectedSections)) {
    throw new Error('CALENDAR_REVIEW_REQUIRED');
  }
  const actual = Object.values(draft.entries.reduce((result, entry) => {
    const section = entry.key.split('-')[0];
    result[section] ||= { section, count: 0, first: entry.date, last: entry.date };
    result[section].count++;
    result[section].last = entry.date;
    return result;
  }, Object.create(null)));
  if (JSON.stringify(actual) !== JSON.stringify(expectedSections)) throw new Error('CALENDAR_REVIEW_MISMATCH');
  return { format: 'wechurch-im-bible-calendar-v1', sourceCommit: draft.sourceCommit,
    sourceSha256: draft.sourceSha256, reviewedBy, reviewedOn, entries: draft.entries };
}
