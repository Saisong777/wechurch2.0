import { expect, it } from 'vitest';
import { parseCategories, parseNotes, serializeNotes } from './spiritual-fitness';

it('does not render empty or null JSON as a completed insight',()=>{
  for(const raw of [null,'','{}','null','[]'])expect(parseNotes(raw,[])).toEqual({});
  expect(parseNotes(serializeNotes({}),[])).toEqual({});
});
it('preserves legacy uncategorized text and validates structured values',()=>{
  expect(parseNotes('保留舊筆記',[])).toEqual({legacy:'保留舊筆記'});
  expect(parseNotes('{"PROMISE":"應許","WARNING":null,"bad":{}}',['PROMISE'])).toEqual({PROMISE:'應許'});
  expect(parseCategories('["PROMISE",null,{},"unknown"]')).toEqual(['PROMISE']);
});
