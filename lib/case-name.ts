import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator'

export function generateCaseName(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    separator: '-',
    style: 'lowerCase',
  })
}
