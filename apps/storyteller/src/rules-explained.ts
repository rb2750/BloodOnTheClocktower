/*
 * The rules in plain words, for a Storyteller who has never run the script.
 * Each entry says what the character does and the part Storytellers most
 * often get wrong. Ability text on the token stays the official wording; this
 * is the explanation underneath it.
 */
export const EXPLAIN: Record<string, string> = {
  // Bad Moon Rising: Townsfolk
  grandmother:
    'On night 1 only, you show her one good player and that player’s real character: her “grandchild”. Later, if the Demon kills the grandchild at night, the Grandmother dies too. An execution or the Assassin killing the grandchild does not count; it has to be the Demon.',
  sailor:
    'Each night the Sailor points at an alive player, and you decide which one of the two is drunk until dusk. While sober, the Sailor cannot die by any means. To let the Sailor die, they must be drunk or poisoned at that moment.',
  chambermaid:
    'Each night they point at 2 alive players other than themselves, and you show 0, 1 or 2: how many of those two woke tonight because of their own ability. Minion and Demon info on night 1 does not count. The Chambermaid goes last, so everyone earlier tonight counts.',
  exorcist:
    'From night 2 they point at a player, never the same one twice in a row. If it is the Demon, the Demon learns who the Exorcist is and does not wake or act tonight, so no Demon kill.',
  innkeeper:
    'From night 2 they point at 2 players: neither can die tonight. You pick one of the two to be drunk until dusk. The Assassin still kills through this. A drunk or poisoned Innkeeper protects nobody.',
  gambler:
    'From night 2 they point at a player and guess their character. A right guess does nothing. A wrong guess and the Gambler dies. You never tell them if they were right.',
  gossip:
    'Each day they may make a public statement. If it was true, someone dies tonight, and you choose who. If false, nothing happens.',
  courtier:
    'Once per game at night they choose a character from the script, not a player. If that character is in play, whoever has it is drunk for 3 nights and 3 days. If not, nothing happens and the ability is still used.',
  professor:
    'Once per game from night 2 they point at a dead player. If that player is a Townsfolk they come back to life, ability and all. Otherwise nothing happens and the ability is spent.',
  minstrel:
    'If a Minion is executed and dies, every other player is drunk until dusk tomorrow. Nobody is told.',
  tealady: 'If both of the Tea Lady’s alive neighbours are good, neither of them can die, by any means.',
  pacifist: 'When a good player is executed, you may decide they don’t die. Say they were executed, then that they survive.',
  fool: 'The first time the Fool would die, for any reason, they don’t. Nobody is told. The second time, they die normally.',
  // Outsiders
  tinker:
    'You, the Storyteller, can kill the Tinker whenever you like, day or night, for any reason. It is your balancing tool: use it when good is pulling ahead. Say nothing about how.',
  moonchild:
    'When the Moonchild finds out they died, at dawn or when executed, they publicly choose an alive player. If that player is good, they die that night. If evil, nothing happens.',
  goon: 'Each night, the first player to choose the Goon with their ability is drunk until dusk, and the Goon changes to that player’s team.',
  lunatic:
    'The Lunatic believes they are the Demon. You treat them like one: show them fake Minions and bluffs, wake them to “kill” each night, but nobody dies from it. The real Demon learns who the Lunatic is and who they chose.',
  // Minions
  godfather:
    'Changes the Outsider count at setup by one. On night 1 they learn which Outsiders are in play. If an Outsider died today, they choose a player tonight who dies.',
  devilsadvocate:
    'Each night they point at a living player, not the same one as last night. If that player is executed tomorrow, they don’t die. Announce the execution as normal, then that they survive.',
  assassin:
    'Once per game, from night 2, they point at a player who dies no matter what: the Sailor, Innkeeper, Tea Lady and Fool cannot save them.',
  mastermind:
    'If the Demon is executed and dies, the game does not end: play one more day. If anyone is executed that day, their team loses. If nobody is, evil loses.',
  // Demons
  pukka:
    'From night 1 the Pukka points at a player: they are poisoned. On its next turn, last night’s poisoned player dies, then it poisons someone new. So every Pukka kill lands a night late, and the victim’s ability doesn’t work in between. Nobody dies on night 1.',
  zombuul:
    'Only kills on nights after a day when nobody died. The first time the Zombuul dies, it stays alive but looks dead.',
  shabaloth: 'From night 2 it kills 2 players a night. You may bring one of the previous night’s victims back to life.',
  po: 'Each night it may kill one player or no-one. If it chose no-one, the next night it kills 3.',
  // Trouble Brewing, in case that script is played
  imp: 'From night 2 the Imp points at a player who dies. If the Imp kills itself, a Minion becomes the Imp.',
  drunk: 'The Drunk thinks they are a Townsfolk. Their ability never works; give them believable but possibly wrong information.',
}

/** The core rules, each one short enough to read with the table waiting. */
export const BASICS: { title: string; text: string }[] = [
  { title: 'How each side wins', text: 'Good wins when the Demon dies. Evil wins when only 2 players are alive and one of them is the Demon.' },
  { title: 'Night and day', text: 'At night you wake players one at a time in the order the app shows. By day the town talks, nominates and may execute one player, then night falls again.' },
  { title: '“Night*”', text: 'An ability marked with a star works every night except the first.' },
  { title: 'Drunk and poisoned', text: 'A drunk or poisoned player’s ability silently does nothing. They are never told. If it gives information, you may give them false information, and you should make it believable.' },
  { title: 'Telling the truth', text: 'Everyone who is sober and healthy gets true information. You only lie to the drunk and poisoned, and to players whose ability says so.' },
  { title: 'Nominations', text: 'Each alive player may nominate once a day, and each player may be nominated once a day. Everyone then votes with a raised hand.' },
  { title: 'Executions', text: 'A player needs votes from at least half of the living players, rounded up. At the end of the day the highest vote above that is executed. A tie means nobody is.' },
  { title: 'The dead', text: 'Dead players still talk and still win or lose with their team. They can’t nominate, and they get one vote for the rest of the game. Their abilities stop.' },
  { title: 'Announcing deaths', text: 'At dawn say who died, never how. The town has to work it out.' },
  { title: 'You are in charge', text: 'When a rule is unclear, you decide, and you decide in the way that keeps the game fun and close.' },
]
