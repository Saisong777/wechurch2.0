// Some Bible imports separate every Han character with spaces. Display only;
// stored Scripture and free-form user writing must remain untouched.
export function formatScriptureText(text: string): string {
  return text.replace(/([\p{Script=Han}，。！？；：「」『』、（）])[ \t]+(?=[\p{Script=Han}，。！？；：「」『』、（）])/gu, '$1');
}
