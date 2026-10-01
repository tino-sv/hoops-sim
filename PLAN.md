# Hoops Manager plan

Living tracker. Update this file when a request comes in or when a chunk of work lands. Do not start a second plan.

Status: `not started` | `in progress` | `done`

## In the game

- Possession engine, tactics, rotation, box score, badges. `done`
- NBA-style roster, cap, aprons, draft, free agency, offseason. `done`
- 30 fictional teams, 6 divisions, 82-game calendar with off days. `done`
- Front office: coach scheme, owner win goal, patience, cash separate from the cap, luxury tax. `done`
- All-Star rosters, end-of-season awards, Cup group games plus a short elimination bracket. `done`
- Home screen can sim the rest of the regular season, including your games, for testing. `done`
- Standings show each division, with games behind inside that division. The playoff picture is still the conference top 8. `done`
- Honors is its own page, with a live award race you can sort and filter. League leaders, the calendar, and the inbox can be filtered too. `done`
- Screens and news say team, night, and elimination game. The Football Manager words are gone. `done`
- A new game, and a reset, ask which franchise you run, then you name the coach and the scheme. A save you already have keeps its team. `done`
- Playoffs are a best-of-seven bracket. The higher seed hosts games 1, 2, 5, and 7. Your games can be played. The rest of the night can be simulated. `done`
- Six contenders have a player in the high 90s. The next player on those teams is at least 10 points lower. A new game is required to see it. `done`
- Home uniforms can be ordered for cash. The club can move to an open city for cash. The division stays. `done`
- The wire is a short feed. Press, a highlight show, players, the team account, and fans react when you play. `in progress`
- The match is a full court: kits, a score line, floor bars, and the ball. Home opens on the next game, and the lineup board uses the same floor. Shell type is flat, with team color and no emoji. `in progress`
- A watched game is charted before the first trip. A sub or a coverage change throws out the rest and charts again from that moment. `done`
- Steals and blocks sit near the 2024-25 line, about 8 and 5 a game. A 90 steal guard lands near 2.5 a night. An ordinary player stays near 1. A real rim protector is the one who blocks shots. `done`
- A 97 overall takes a first-option share and scores about 32 a game. The team stays near 113. A new career is required to see the new usage. `done`
- Books is its own screen. Each month lists gate, TV, merch, salaries, staff, the building, and fines. An arena and a staff market are still open. `in progress`
- A coach has an age, an origin, a former-player flag, and ratings for offense, defense, teaching, and the locker room. Those ratings change makes and morale. `done`
- A player panel says where he is from, what year he is in, and one line from his badges. The city follows the surname, weighted like a real roster. Shot profile and the glass plan change the possession. `done`
- A new coach picks a pedigree and up to two signatures. A former star steadies veterans and weighs on young players. Seven seconds scores more in transition and turns the ball over in the half court. The ratings stay with the pedigree. `done`
- A starter who plays well under the minutes his spot promises loses morale and can ask out. The wire says so. A scorer next to two other high-usage players makes a slightly worse shot. A contract year and a traded glue guy are still open. `in progress`
- A ribbon across the desk shows the record, the next game, the cap tier, the date, and unread mail. The button says go to the match, simulate the day, or blocked. `done`
- The roster lists role, salary, years left, and who wants out. The draft board is a table. An overall stays a range until you scout him. `done`
- A heavy night can knock a player out for a few days. Home lists who cannot play. `done`
- Books names uniforms, a move, a TV buyout, the tax, and the cup on their own lines. The office money card is the checkbook. `done`

## Next

The player sentence, shot profile, and glass plan are on `feat/player-page`. Hometowns follow the surname on `fix/hometowns` (14, 16). Next in the playbook: hedge, a hunted matchup, hack-a-player, a timeout, and foul-trouble subs. No play drawer (16, 19). Then scouting fog, a medical flag, a two-way, and a mentor (3). Then a postgame answer and an owner who is impatient, cheap, or hands-off (5, 17). A contract year is on `feat/contract-year` and not on main yet (15).

## Backlog

1. Deeper finances. Books shows the year and each month. Still open: incentives, dead money, options, trade kickers, a real repeater tax, apron trade locks, dynamic gate, naming rights, and playoff gate. `in progress`
2. The game should center on an inbox, in the style of Football Manager. `not started`
3. Scouting fog. A hidden ceiling, a medical flag, a two-way affiliate, and a veteran who passes a badge. A combine and a private workout come after the ceiling is real. `not started`
4. Full staff, rival staff, and agents and agencies that change decisions. Scouting, sports science, and the practice building are budget lines with an effect, not sliders. `not started`
5. The wire reacts to games. Still open: a postgame answer that helps the owner or hurts the player, a leak when you shop someone, and the rest of the press. `in progress`
6. Coaching carousel. Move between high school, college, and the pro league. `not started`
7. A full college game, with continuity when a coach has worked both levels. `not started`
8. Shell. A top ribbon with record, next game, cap tier, date, and unread mail. The sim control says simulate the day, go to the match, or blocked. The left nav stays words. Books is a ledger. The office money card is cash, the TV deal, the sponsor, and the tax. `done`
9. Sim the rest of the regular season from the home screen, for testing. `done`
10. Honors on its own page, plus sort and filter controls on the main lists. `done`
11. Redesign the look. Chrome is flat type and team color. The roster shows role, years left, and who wants out. The draft board is a table, and overalls stay hidden until a prospect is scouted. Home lists who cannot play, and the days left. `done`
12. Choose your team when a game starts. `done`
13. Precompute the game, then show that script on the court. A sub or a coverage change recalculates from that moment. Steals and blocks sit near the 2024-25 line. A 96-plus player scores like a modern first option, about 26 to 34 a game, and the team stays near 113. `done`
14. Coach pedigree is in. A player panel says where he is from, what year he is in, and one line from his badges. Hometowns follow the surname. `done`
15. Role and usage resentment. A promised role against real minutes, and a scorer stuck next to two ball-dominant teammates, changes efficiency, morale, and a trade demand. A contract year and a traded glue guy are still open. `in progress`
16. Playbook. Tempo, pick-and-roll coverage, shot profile, and the glass plan are in. Still open: hedge, help rules, hunting a matchup, hack-a-player, a timeout, and foul-trouble subs. No play drawer. `in progress`
17. Owner archetype. An impatient owner wants wins now. A cheap owner blocks the tax and a buyout. A hands-off owner wants a three-year climb and stays out of the deals. `not started`
18. Rotation board. Minute targets that add to 240, a closing five, and stagger so two handlers are not both sitting. Lineup ratings wait until those minutes are real. `not started`
19. Match command. Foul trouble on the floor, a live run, and changes that wait for the next whistle. The court we have stays the view. `not started`
