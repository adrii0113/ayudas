/**
 * Names used by the BDNS (or in common use) that differ from the official INE
 * name. Each code was checked against data/reference/municipalities.json.
 * Add entries when the radar reports an unresolved local organism.
 */
export const MUNICIPALITY_ALIASES: { name: string; ine: string; note: string }[] = [
  { name: "Bigues i Riells", ine: "08023", note: "INE: Bigues i Riells del Fai (renamed)" },
  {
    name: "Castell-Platja d'Aro",
    ine: "17048",
    note: "INE: Castell d'Aro, Platja d'Aro i s'Agaró",
  },
  { name: "Facheca Fageca", ine: "03067", note: "INE: Fageca" },
  { name: "Facheca", ine: "03067", note: "INE: Fageca (Spanish name)" },
  { name: "Noáin", ine: "31088", note: "INE: Valle de Elorz/Elortzibar" },
];
