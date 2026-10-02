export async function formatText(input) {
  return { text: input.text.trim().replaceAll(/\s+/g, ' ') };
}
