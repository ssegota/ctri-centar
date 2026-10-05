/**
 * The Centre's people. Academic titles follow the Croatian convention:
 * `pre` goes before the name (prof. dr. sc.), `post` after it (mag. inf.).
 * Titles and photos are taken from the people's public FIPU profiles.
 * `photo: null` renders an initials placeholder until a photo is supplied —
 * drop a square JPG into public/team/ and set the path here.
 */
export const LEADS = [
  { id: 'nikolic-razem', name: 'Jelena Nikolić Ražem', post: 'dipl. oec.', role: 'business', photo: null },
  { id: 'baressi-segota', pre: 'doc. dr. sc.', name: 'Sandi Baressi Šegota', role: 'scientific', photo: '/team/baressi-segota.jpg' },
]

export const TEAM = [
  { id: 'etinger', pre: 'prof. dr. sc.', name: 'Darko Etinger', photo: '/team/etinger.jpg' },
  { id: 'lorencin', pre: 'doc. dr. sc.', name: 'Ivan Lorencin', photo: '/team/lorencin.jpg' },
  { id: 'tankovic', pre: 'izv. prof. dr. sc.', name: 'Nikola Tanković', photo: '/team/tankovic.jpg' },
  { id: 'sever', name: 'Luka Sever', post: 'mag. ing. comp.', photo: null },
  { id: 'karlovic', name: 'Ratomir Karlović', post: 'mag. inf.', photo: null },
  { id: 'milicevic', name: 'Marijela Miličević', post: 'mag. educ. inf.', photo: null },
  { id: 'rovis', name: 'Mia Rovis', post: 'mag. inf.', photo: null },
  { id: 'staric', name: 'Elvis Starić', post: 'mag. inf.', photo: null },
  { id: 'prenc', name: 'Petar Prenc', post: 'univ. bacc. inf.', photo: null },
]

export const fullName = (p) => [p.pre, p.post ? `${p.name},` : p.name, p.post].filter(Boolean).join(' ')

/** First and last name only, so a double surname gives JR rather than JN. */
export function initials(name) {
  const w = name.split(/\s+/).filter(Boolean)
  return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase()
}
